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

async function processar(sheets, id, ano) {
  const v = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'PAGAMENTOS!A6:Z3500' });
  const vrows = v.data.values || [];
  const vh = vrows[0].map(h => h.trim().toUpperCase());
  const vi = vh.indexOf('IMEI');
  const vp = vh.indexOf('VALOR PENDENTE');

  const imeisPag = new Set();
  for (let i = 1; i < vrows.length; i++) {
    const imei = (vrows[i][vi] || '').trim().toUpperCase();
    if (imei) imeisPag.add(imei);
  }

  // Agora pega vendas com pendente > 0 que nao tem IMEI na aba Pagamentos
  const p = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'VENDAS!A6:Z3500' });
  const prows = p.data.values || [];
  const ph = prows[0].map(h => h.trim().toUpperCase());
  const pi = ph.indexOf('IMEI');
  const pp = ph.indexOf('VALOR PENDENTE');
  const pc = ph.indexOf('CLIENTE');
  const pprod = ph.indexOf('PRODUTO');

  console.log('=== ' + ano + ': vendas com pendente que NAO estao em Pagamentos ===');
  for (let i = 1; i < prows.length; i++) {
    const imei = (prows[i][pi] || '').trim().toUpperCase();
    const pend = parseMoeda(prows[i][pp]);
    if (pend > 0 && imei && !imeisPag.has(imei)) {
      console.log(`  ${imei} | ${prows[i][pprod]} | ${prows[i][pc]} | R$ ${pend}`);
    }
  }
}

async function run() {
  const sheets = await autenticarGoogle();
  for (const [ano, id] of Object.entries(SHEETS)) {
    await processar(sheets, id, ano);
  }
}
run().catch(e => console.error('Erro:', e.message));
