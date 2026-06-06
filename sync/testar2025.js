require('dotenv').config({ path: __dirname + '/.env' });
const { google } = require('googleapis');

const SHEET_2025 = '1Gf8oJeX3J38hMIUa7MJ6MMLYBfmqO5CDBnA0AFJJe5w';

async function t() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const s = google.sheets({ version: 'v4', auth });

  // Lista as abas
  const meta = await s.spreadsheets.get({ spreadsheetId: SHEET_2025 });
  console.log('=== ABAS DA PLANILHA 2025 ===');
  meta.data.sheets.forEach(sh => console.log('  - ' + sh.properties.title));

  // Cabecalho da aba Estoque (linha 6)
  console.log('\n=== CABECALHO ABA ESTOQUE (linha 6) ===');
  const est = await s.spreadsheets.values.get({
    spreadsheetId: SHEET_2025,
    range: 'Estoque!A6:Z6'
  });
  console.log((est.data.values[0] || []).join(' | '));

  // Cabecalho da aba Vendas
  console.log('\n=== CABECALHO ABA VENDAS (linha 6) ===');
  const ven = await s.spreadsheets.values.get({
    spreadsheetId: SHEET_2025,
    range: 'Vendas!A6:Z6'
  });
  console.log((ven.data.values[0] || []).join(' | '));
}
t().catch(e => console.error('ERRO:', e.message));
