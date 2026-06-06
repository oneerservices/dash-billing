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

async function processar(sheets, id, ano, client) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'PAGAMENTOS!A6:Z3500' });
  const rows = r.data.values || [];
  const header = rows[0].map(h => h.trim().toUpperCase());
  const ci = header.indexOf('IMEI');
  const cp = header.indexOf('VALOR PENDENTE');
  const ccli = header.indexOf('CLIENTE');
  const cprod = header.indexOf('PRODUTO');

  for (let i = 1; i < rows.length; i++) {
    const imei = (rows[i][ci] || '').trim().toUpperCase();
    const pend = parseMoeda(rows[i][cp]);
    if (pend <= 0 || !imei) continue;

    const res = await client.query(
      `SELECT v.valor_pendente FROM vendas v JOIN produtos p ON p.id = v.produto_id WHERE p.imei = $1`, [imei]);

    if (res.rows.length === 0) {
      console.log(`[${ano}] SEM VENDA NO BANCO | ${imei} | ${rows[i][cprod]} | ${rows[i][ccli]} | planilha R$ ${pend}`);
    } else {
      const banco = parseFloat(res.rows[0].valor_pendente);
      if (Math.abs(banco - pend) > 0.005) {
        console.log(`[${ano}] DIVERGENTE | ${imei} | ${rows[i][cprod]} | planilha R$ ${pend} vs banco R$ ${banco}`);
      }
    }
  }
}

async function run() {
  const sheets = await autenticarGoogle();
  const client = await pool.connect();
  try {
    for (const [ano, id] of Object.entries(SHEETS)) {
      console.log('=== ' + ano + ' ===');
      await processar(sheets, id, ano, client);
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log('Fim da comparacao.');
}

run().catch(e => console.error('Erro:', e.message));
