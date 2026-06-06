require('dotenv').config({ path: __dirname + '/.env' });
const { google } = require('googleapis');

const SHEETS = {
  '2025': '1Gf8oJeX3J38hMIUa7MJ6MMLYBfmqO5CDBnA0AFJJe5w',
  '2026': process.env.SHEET_ID,
};

async function autenticarGoogle() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

function parseMoeda(v){if(!v)return 0;const l=v.toString().replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');return Math.abs(parseFloat(l))||0;}

async function somar(sheets, id, label) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'ESTOQUE!A6:Z4600' });
  const rows = r.data.values || [];
  const header = rows[0].map(h => h.trim().toUpperCase());
  const cp = header.indexOf('VALOR PENDENTE');
  let total = 0, qtd = 0;
  for (let i = 1; i < rows.length; i++) {
    const p = parseMoeda(rows[i][cp]);
    if (p > 0) { total += p; qtd++; }
  }
  console.log(label + ': ' + qtd + ' contas / R$ ' + total.toFixed(2));
  return { total, qtd };
}

async function t() {
  const sheets = await autenticarGoogle();
  const a = await somar(sheets, SHEETS['2025'], 'Estoque 2025');
  const b = await somar(sheets, SHEETS['2026'], 'Estoque 2026');
  console.log('---');
  console.log('SOMA TOTAL: ' + (a.qtd + b.qtd) + ' contas / R$ ' + (a.total + b.total).toFixed(2));
}
t().catch(e => console.error('Erro:', e.message));
