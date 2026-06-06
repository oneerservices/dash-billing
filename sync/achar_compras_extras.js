require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const { google } = require('googleapis');

const SHEETS = {
  '2025': '1Gf8oJeX3J38hMIUa7MJ6MMLYBfmqO5CDBnA0AFJJe5w',
  '2026': process.env.SHEET_ID,
};

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

async function run() {
  const sheets = await autenticarGoogle();
  const comPendente = new Set();

  for (const [ano, id] of Object.entries(SHEETS)) {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'ESTOQUE!A6:Z4600' });
    const rows = r.data.values || [];
    const h = rows[0].map(x => x.trim().toUpperCase());
    const ci = h.indexOf('IMEI');
    const cp = h.indexOf('VALOR PENDENTE');
    for (let i = 1; i < rows.length; i++) {
      const imei = (rows[i][ci] || '').trim().toUpperCase();
      const pend = parseMoeda(rows[i][cp]);
      if (imei && pend > 0) comPendente.add(imei);
    }
    console.log('Planilha ' + ano + ': ' + comPendente.size + ' IMEIs com pendente');
  }

  const client = await pool.connect();
  const res = await client.query(`
    SELECT p.imei, p.nome, c.valor_compra, c.valor_pendente, c.data_compra
    FROM compras c JOIN produtos p ON p.id = c.produto_id
    WHERE c.valor_pendente > 0
    ORDER BY c.valor_pendente DESC`);

  console.log('=== Compras no banco com pendente que NAO estao na planilha ===');
  let total = 0, soma = 0;
  for (const row of res.rows) {
    if (!comPendente.has(row.imei)) {
      total++;
      soma += parseFloat(row.valor_pendente);
      console.log(`${row.imei} | ${row.nome} | compra ${row.data_compra} | pendente R$ ${row.valor_pendente}`);
    }
  }
  console.log('---');
  console.log('Total: ' + total + ' | Soma: R$ ' + soma.toFixed(2));
  client.release();
  await pool.end();
}
run().catch(e => console.error('Erro:', e.message));
