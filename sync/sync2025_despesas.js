require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const { google } = require('googleapis');

const SHEET_ID = '1Gf8oJeX3J38hMIUa7MJ6MMLYBfmqO5CDBnA0AFJJe5w';

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function autenticarGoogle() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

function parseMoeda(v){if(!v)return 0;const l=v.toString().replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');return Math.abs(parseFloat(l))||0;}
function parseData(v){if(!v||!v.trim())return null;const p=v.trim().split('/');if(p.length===3)return `${p[2]}-${p[1]}-${p[0]}`;return null;}

async function sincronizar(sheets) {
  const SHEET_NAME = 'DESPESAS';
  const HEADER_ROW = 8;
  const BATCH_SIZE = 500;

  console.log('Buscando cabecalho despesas 2025...');
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A${HEADER_ROW}:Z${HEADER_ROW}`,
  });
  const header = (headerRes.data.values[0] || []).map(h => h.trim().toUpperCase());
  console.log('Colunas:', header.join(', '));

  const col = {
    data_despesa:    header.indexOf('DATA DA DESPESA'),
    descricao:       header.indexOf('DESPESA'),
    favorecido:      header.indexOf('FAVORECIDO'),
    valor:           header.indexOf('VALOR'),
    forma_pagamento: header.indexOf('FORMA DE PAGAMENTO 1'),
    observacoes:     header.indexOf('OBSERVAÇÕES'),
  };

  let startRow = HEADER_ROW + 1;
  let inseridos = 0, atualizados = 0, ignorados = 0, lote = 1;

  while (true) {
    const endRow = startRow + BATCH_SIZE - 1;
    console.log('Lote ' + lote + ': linhas ' + startRow + ' a ' + endRow);
    let rows = [];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A${startRow}:Z${endRow}`,
      });
      rows = res.data.values || [];
    } catch (err) {
      if (err.message && err.message.includes('exceeds grid limits')) { console.log('Fim.'); break; }
      throw err;
    }
    if (rows.length === 0) { console.log('Fim.'); break; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of rows) {
        const data_despesa = parseData(row[col.data_despesa]);
        const valor        = parseMoeda(row[col.valor]);
        if (!data_despesa || !valor) { ignorados++; continue; }

        const descricao       = (row[col.descricao]       || '').trim() || null;
        const favorecido      = (row[col.favorecido]      || '').trim() || null;
        const forma_pagamento = (row[col.forma_pagamento] || '').trim() || null;
        const observacoes     = (row[col.observacoes]     || '').trim() || null;

        const existe = await client.query(
          `SELECT id FROM despesas WHERE data_despesa=$1 AND favorecido=$2 AND valor=$3`,
          [data_despesa, favorecido, valor]);

        if (existe.rows.length === 0) {
          await client.query(
            `INSERT INTO despesas (data_despesa, descricao, favorecido, valor, forma_pagamento, observacoes)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [data_despesa, descricao, favorecido, valor, forma_pagamento, observacoes]);
          inseridos++;
        } else {
          await client.query(
            `UPDATE despesas SET descricao=$2, forma_pagamento=$3, observacoes=$4 WHERE id=$1`,
            [existe.rows[0].id, descricao, forma_pagamento, observacoes]);
          atualizados++;
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro no lote ' + lote + ':', err.message);
    } finally { client.release(); }

    startRow += BATCH_SIZE; lote++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Concluido!');
  console.log('Inseridos: ' + inseridos);
  console.log('Atualizados: ' + atualizados);
  console.log('Ignorados: ' + ignorados);
  await pool.end();
}

async function main() {
  try { const sheets = await autenticarGoogle(); await sincronizar(sheets); }
  catch (err) { console.error('Erro:', err.message); await pool.end(); }
}
main();
