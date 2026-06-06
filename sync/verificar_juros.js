require('dotenv').config({ path: __dirname + '/.env' });
const { google } = require('googleapis');

const SHEET_ID = '1Gf8oJeX3J38hMIUa7MJ6MMLYBfmqO5CDBnA0AFJJe5w';

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
    spreadsheetId: SHEET_ID, range: 'ESTOQUE!A6:S4600',
  });
  const rows = r.data.values || [];
  const header = rows[0].map(h => h.trim().toUpperCase());
  const ci = header.indexOf('IMEI');
  const cp = header.indexOf('PRODUTO');

  const alvos = ['200125749','200988863','200979557','200841359','200489995'];
  console.log('=== Procurando os IMEIs de emprestimo na aba Estoque ===');
  let achou = 0;
  for (let i = 1; i < rows.length; i++) {
    const imei = (rows[i][ci] || '').trim();
    if (alvos.includes(imei)) {
      achou++;
      console.log('Linha ' + (i+6) + ': IMEI=' + imei + ' | Produto=' + rows[i][cp]);
    }
  }
  if (achou === 0) console.log('NENHUM desses IMEIs foi encontrado na aba Estoque.');
}
t().catch(e => console.error('Erro:', e.message));
