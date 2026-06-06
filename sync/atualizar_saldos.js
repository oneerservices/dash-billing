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
  const limpo = valor.toString()
    .replace(/[^0-9,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(limpo);
  return Math.abs(num) || 0;
}

async function atualizarSaldos(sheets) {
  const SHEET_NAME = 'Pagamentos';
  const HEADER_ROW = 6;
  const BATCH_SIZE = 500;

  console.log('Buscando cabecalho...');
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: `${SHEET_NAME}!A${HEADER_ROW}:Z${HEADER_ROW}`,
  });

  const header = (headerRes.data.values[0] || []).map(h => h.trim().toUpperCase());

  const col = {
    imei:           header.indexOf('IMEI'),
    valor_recebido: header.indexOf('VALOR RECEBIDO'),
    valor_pendente: header.indexOf('VALOR PENDENTE'),
  };

  let startRow = HEADER_ROW + 1;
  let atualizados = 0;
  let ignorados = 0;
  const imeisIgnorados = [];
  let lote = 1;

  while (true) {
    const endRow = startRow + BATCH_SIZE - 1;

    let rows = [];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SHEET_ID,
        range: `${SHEET_NAME}!A${startRow}:Z${endRow}`,
      });
      rows = res.data.values || [];
    } catch (err) {
      if (err.message && err.message.includes('exceeds grid limits')) break;
      throw err;
    }

    if (rows.length === 0) break;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of rows) {
        const imei = (row[col.imei] || '').trim().toUpperCase();
        if (!imei) { ignorados++; continue; }

        const valor_recebido = parseMoeda(row[col.valor_recebido]);
        const valor_pendente = parseMoeda(row[col.valor_pendente]);

        const res = await client.query(
          `UPDATE vendas SET
             valor_recebido = $2,
             valor_pendente = $3,
             atualizado_em = NOW()
           FROM produtos p
           WHERE vendas.produto_id = p.id
           AND p.imei = $1`,
          [imei, valor_recebido, valor_pendente]
        );

        if (res.rowCount > 0) {
          atualizados++;
        } else {
          ignorados++;
          imeisIgnorados.push(imei);
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
  console.log('Atualizados: ' + atualizados);
  console.log('Ignorados: ' + ignorados);
  console.log('IMEIs ignorados (nao encontrados como venda no banco):');
  imeisIgnorados.forEach(i => console.log('  - ' + i));
  await pool.end();
}

async function main() {
  try {
    const sheets = await autenticarGoogle();
    await atualizarSaldos(sheets);
  } catch (err) {
    console.error('Erro:', err.message);
    await pool.end();
  }
}

main();
