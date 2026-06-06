require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const { google } = require('googleapis');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function autenticarGoogle() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

function parseMoeda(valor) {
  if (!valor) return 0;
  return parseFloat(
    valor.toString()
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()
  ) || 0;
}

function parseData(valor) {
  if (!valor || !valor.trim()) return null;
  const partes = valor.trim().split('/');
  if (partes.length === 3) return `${partes[2]}-${partes[1]}-${partes[0]}`;
  return null;
}

async function sincronizarParcelas(sheets) {
  const SHEET_NAME = 'Pagamentos';
  const HEADER_ROW = 6;
  const BATCH_SIZE = 500;

  console.log('Buscando cabecalho...');
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: `${SHEET_NAME}!A${HEADER_ROW}:Z${HEADER_ROW}`,
  });

  const header = (headerRes.data.values[0] || []).map(h => h.trim().toUpperCase());
  console.log('Colunas:', header.join(', '));

  const col = {
    imei:  header.indexOf('IMEI'),
    valor: header.indexOf('VALOR'),
    venc1: header.indexOf('VENCIMENTO 1'),
    fpag1: header.indexOf('FORMA DE PAGAMENTO 1'),
    pag1:  header.indexOf('PAGAMENTO 1'),
    venc2: header.indexOf('VENCIMENTO 2'),
    fpag2: header.indexOf('FORMA DE PAGAMENTO 2'),
    pag2:  header.indexOf('PAGAMENTO 2'),
    venc3: header.indexOf('VENCIMENTO 3'),
    fpag3: header.indexOf('FORMA DE PAGAMENTO 3'),
    pag3:  header.indexOf('PAGAMENTO 3'),
    venc4: header.indexOf('VENCIMENTO 4'),
    fpag4: header.indexOf('FORMA DE PAGAMENTO 4'),
    pag4:  header.indexOf('PAGAMENTO 4'),
  };

  let startRow = HEADER_ROW + 1;
  let inseridos = 0;
  let atualizados = 0;
  let ignorados = 0;
  let lote = 1;

  while (true) {
    const endRow = startRow + BATCH_SIZE - 1;
    console.log('Lote ' + lote + ': linhas ' + startRow + ' a ' + endRow);

    let rows = [];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: `${SHEET_NAME}!A${startRow}:Z${endRow}`,
      });
      rows = res.data.values || [];
    } catch (err) {
      if (err.message && err.message.includes('exceeds grid limits')) {
        console.log('Fim dos dados (limite da planilha atingido).');
        break;
      }
      throw err;
    }

    if (rows.length === 0) {
      console.log('Fim dos dados.');
      break;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of rows) {
        const imei = (row[col.imei] || '').trim().toUpperCase();
        if (!imei) { ignorados++; continue; }

        const vendaRes = await client.query(
          `SELECT v.id, v.valor_venda FROM vendas v
           JOIN produtos p ON p.id = v.produto_id
           WHERE p.imei = $1`,
          [imei]
        );
        if (vendaRes.rows.length === 0) { ignorados++; continue; }

        const vendaId    = vendaRes.rows[0].id;
        const valorTotal = parseMoeda(row[col.valor]) || vendaRes.rows[0].valor_venda;

        const parcelas = [
          { num: 1, venc: col.venc1, fpag: col.fpag1, pag: col.pag1 },
          { num: 2, venc: col.venc2, fpag: col.fpag2, pag: col.pag2 },
          { num: 3, venc: col.venc3, fpag: col.fpag3, pag: col.pag3 },
          { num: 4, venc: col.venc4, fpag: col.fpag4, pag: col.pag4 },
        ];

        for (const p of parcelas) {
          const vencimento = parseData(row[p.venc]);
          if (!vencimento) continue;

          const forma_pagamento = (row[p.fpag] || '').trim() || null;
          const valor_pago      = parseMoeda(row[p.pag]);

          let status = 'aberta';
          if (valor_pago >= valorTotal) status = 'quitada';
          else if (valor_pago > 0) status = 'parcial';

          const existe = await client.query(
            'SELECT id FROM parcelas WHERE venda_id = $1 AND numero = $2',
            [vendaId, p.num]
          );

          if (existe.rows.length === 0) {
            await client.query(
              `INSERT INTO parcelas
                (venda_id, numero, vencimento, valor_esperado, valor_pago, forma_pagamento, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [vendaId, p.num, vencimento, valorTotal, valor_pago, forma_pagamento, status]
            );
            inseridos++;
          } else {
            await client.query(
              `UPDATE parcelas SET
                 vencimento = $3, valor_esperado = $4, valor_pago = $5,
                 forma_pagamento = $6, status = $7, atualizado_em = NOW()
               WHERE venda_id = $1 AND numero = $2`,
              [vendaId, p.num, vencimento, valorTotal, valor_pago, forma_pagamento, status]
            );
            atualizados++;
          }
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro no lote ' + lote + ':', err.message);
    } finally {
      client.release();
    }

    startRow += BATCH_SIZE;
    lote++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Concluido!');
  console.log('Inseridos: ' + inseridos);
  console.log('Atualizados: ' + atualizados);
  console.log('Ignorados: ' + ignorados);
  await pool.end();
}

async function main() {
  try {
    const sheets = await autenticarGoogle();
    await sincronizarParcelas(sheets);
  } catch (err) {
    console.error('Erro:', err.message);
    await pool.end();
  }
}

main();
