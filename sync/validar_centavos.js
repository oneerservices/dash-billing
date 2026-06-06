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

function parseMoeda(v){if(!v)return 0;const l=v.toString().replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');return Math.abs(parseFloat(l))||0;}

async function t() {
  const sheets = await autenticarGoogle();
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'PAGAMENTOS!A6:Z3500',
  });
  const rows = r.data.values || [];
  const header = rows[0].map(h => h.trim().toUpperCase());
  const cp = header.indexOf('VALOR PENDENTE');
  const ci = header.indexOf('IMEI');
  const ccli = header.indexOf('CLIENTE');
  const cprod = header.indexOf('PRODUTO');

  let totalPequenos = 0;
  let qtd = 0;
  console.log('=== Linhas com pendente entre 0 e 1 real ===');
  for (let i = 1; i < rows.length; i++) {
    const pend = parseMoeda(rows[i][cp]);
    if (pend > 0 && pend <= 1) {
      qtd++;
      totalPequenos += pend;
      console.log(`  ${rows[i][cprod]} | ${rows[i][ccli]} | R$ ${pend}`);
    }
  }
  console.log('---');
  console.log('Quantidade de linhas pequenas: ' + qtd);
  console.log('Soma total delas: R$ ' + totalPequenos.toFixed(2));
}
t().catch(e => console.error('Erro:', e.message));
