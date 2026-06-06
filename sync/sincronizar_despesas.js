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

async function sincronizarDespesas(sheets) {
  const SHEET_NAME = 'Despesas';
  const HEADER_ROW = 8;
  const BATCH_SIZE = 500;

  console.log('Buscando cabecalho...');
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: `${SHEET_NAME}!A${HEADER_ROW}:Z${HEADER_ROW}`,
  });

  const header = (headerRes.data.values[0] || []).map(h => h.trim().toUpperCase());
  console.log('Colunas:', header.join(', '));

  const col = {
    data_despesa:    header.indexOf('DATA DA DESPESA'),
    categoria:       header.indexOf('CATEGORIA'),
    descricao:       header.indexOf('SUB CATEGORIA'),
    favorecido:      header.indexOf('FAVORECIDO'),
    valor:           header.indexOf('VALOR'),
    forma_pagamento: header.indexOf('FORMA DE PAGAMENTO'),
    observacoes:     header.indexOf('OBSERVAÇÕES'),
  };

  let startRow = HEADER_ROW + 1;
  let inseridos = 0;
  let atualizados = 0;
  let ignorados = 0;
  let lote = 1;

  while (true) {
    const endRow = startRow + BATCH_SIZE - 1;
    console.log('Lote ' + lote + ': linhas ' + startRow + ' a ' + endRow);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: `${SHEET_NAME}!A${startRow}:Z${endRow}`,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      console.log('Fim dos dados.');
      break;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of rows) {
        const data_despesa = parseData(row[col.data_despesa]);
        const valor        = parseMoeda(row[col.valor]);

        if (!data_despesa || !valor) { ignorados++; continue; }

        const categoria       = (row[col.categoria]       || '').trim() || null;
        const descricao       = (row[col.descricao]       || '').trim() || null;
        const favorecido      = (row[col.favorecido]      || '').trim() || null;
        const forma_pagamento = (row[col.forma_pagamento] || '').trim() || null;
        const observacoes     = (row[col.observacoes]     || '').trim() || null;

        const existe = await client.query(
          `SELECT id FROM despesas
           WHERE data_despesa = $1 AND favorecido = $2 AND valor = $3`,
          [data_despesa, favorecido, valor]
        );

        if (existe.rows.length === 0) {
          await client.query(
            `INSERT INTO despesas
              (data_despesa, categoria, descricao, favorecido, valor, forma_pagamento, observacoes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [data_despesa, categoria, descricao, favorecido, valor, forma_pagamento, observacoes]
          );
          inseridos++;
        } else {
          await client.query(
            `UPDATE despesas SET
               categoria = $2, descricao = $3, forma_pagamento = $4, observacoes = $5
             WHERE id = $1`,
            [existe.rows[0].id, categoria, descricao, forma_pagamento, observacoes]
          );
          atualizados++;
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
    await sincronizarDespesas(sheets);
  } catch (err) {
    console.error('Erro:', err.message);
    await pool.end();
  }
}

main();
