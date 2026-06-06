require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const { google } = require('googleapis');

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

async function t() {
  const sheets = await autenticarGoogle();
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID, range: 'Estoque!A6:Z4600'
  });
  const rows = r.data.values || [];
  const h = rows[0].map(x => x.trim().toUpperCase());
  const ce = h.indexOf('ESTOQUE');
  const ci = h.indexOf('IMEI');
  const cp = h.indexOf('PRODUTO');

  const imeis2026 = new Set();
  for (let i = 1; i < rows.length; i++) {
    const disp = (rows[i][ce] || '').trim().toUpperCase();
    if (!['EM ESTOQUE','ATIVO EMPRESA','CLIENTE'].includes(disp)) continue;
    const imei = (rows[i][ci] || '').trim().toUpperCase();
    if (imei) imeis2026.add(imei);
  }
  console.log('Total em estoque na planilha 2026: ' + imeis2026.size);

  const client = await pool.connect();
  const res = await client.query(`
    SELECT p.imei, p.nome, c.data_compra
    FROM produtos p JOIN compras c ON c.produto_id = p.id
    WHERE c.data_compra < '2026-01-01'
    AND p.disponibilidade IN ('EM ESTOQUE','ATIVO EMPRESA','CLIENTE')`);

  console.log('=== IMEIs de 2025 que aparecem em estoque na planilha 2026 ===');
  const lista = [];
  for (const row of res.rows) {
    if (imeis2026.has(row.imei)) {
      lista.push(row.imei);
      console.log(row.imei + ' | ' + row.nome + ' | compra: ' + row.data_compra);
    }
  }
  console.log('---');
  console.log('Total: ' + lista.length);
  console.log('Lista para usar na consulta SQL:');
  console.log("'" + lista.join("','") + "'");
  client.release();
  await pool.end();
}
t().catch(e => console.error('Erro:', e.message));
