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

async function achar(sheets) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'PAGAMENTOS!A6:Z3500',
  });
  const rows = r.data.values || [];
  const header = rows[0].map(h => h.trim().toUpperCase());
  const ci = header.indexOf('IMEI');
  const cp = header.indexOf('VALOR PENDENTE');
  const ccli = header.indexOf('CLIENTE');
  const cprod = header.indexOf('PRODUTO');

  const client = await pool.connect();
  console.log('=== Linhas com pendente != 0 que NAO tem venda no banco ===');
  for (let i = 1; i < rows.length; i++) {
    const imei = (rows[i][ci] || '').trim().toUpperCase();
    const pend = parseMoeda(rows[i][cp]);
    if (pend === 0 || !imei) continue;
    const res = await client.query(
      `SELECT v.id FROM vendas v JOIN produtos p ON p.id = v.produto_id WHERE p.imei = $1`, [imei]);
    if (res.rows.length === 0) {
      console.log(`IMEI: ${imei} | Produto: ${rows[i][cprod]} | Cliente: ${rows[i][ccli]} | Pendente: ${pend}`);
    }
  }
  client.release();
  await pool.end();
}

async function main() {
  try { const sheets = await autenticarGoogle(); await achar(sheets); }
  catch (err) { console.error('Erro:', err.message); await pool.end(); }
}
main();
