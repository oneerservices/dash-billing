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

function parseMoeda(v){if(!v)return 0;const l=v.toString().replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');return Math.abs(parseFloat(l))||0;}

async function achar(sheets) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID, range: 'Estoque!A6:Z4600'
  });
  const rows = r.data.values || [];
  const header = rows[0].map(h => h.trim().toUpperCase());
  const ci = header.indexOf('IMEI');
  const cp = header.indexOf('PRODUTO');
  const cd = header.indexOf('DISPONIBILIDADE');
  const cc = header.indexOf('CUSTO');
  const cf = header.indexOf('FORNECEDOR');

  const client = await pool.connect();
  console.log('=== Produtos em estoque na planilha sem compra no banco ===');
  console.log('Linha | IMEI | Produto | Fornecedor | Custo | Motivo');

  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    const imei  = (rows[i][ci] || '').trim().toUpperCase();
    const disp  = (rows[i][cd] || '').trim().toUpperCase();
    const custo = parseMoeda(rows[i][cc]);

    // Só produtos em estoque
    if (!['EM ESTOQUE','ATIVO EMPRESA','CLIENTE'].includes(disp)) continue;

    let motivo = '';
    if (!imei) { motivo = 'SEM IMEI'; }
    else if (!custo) { motivo = 'SEM CUSTO'; }
    else {
      const res = await client.query(
        `SELECT c.id FROM compras c JOIN produtos p ON p.id = c.produto_id WHERE p.imei = $1`, [imei]);
      if (res.rows.length === 0) motivo = 'SEM COMPRA NO BANCO';
    }

    if (motivo) {
      total++;
      console.log(`Linha ${i+6} | ${imei || '---'} | ${rows[i][cp]} | ${rows[i][cf]} | R$ ${custo} | ${motivo}`);
    }
  }
  console.log('---');
  console.log('Total: ' + total);
  client.release();
  await pool.end();
}

async function main() {
  try { const sheets = await autenticarGoogle(); await achar(sheets); }
  catch (err) { console.error('Erro:', err.message); await pool.end(); }
}
main();
