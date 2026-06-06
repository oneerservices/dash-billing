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

async function ler(sheets, id, aba) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: aba + '!A6:Z3500' });
  const rows = r.data.values || [];
  const header = rows[0].map(h => h.trim().toUpperCase());
  return { rows, header };
}

async function processar(sheets, id, ano) {
  // Vendas: IMEI -> pendente
  const v = await ler(sheets, id, 'VENDAS');
  const vi = v.header.indexOf('IMEI');
  const vp = v.header.indexOf('VALOR PENDENTE');
  const mapaVendas = {};
  for (let i = 1; i < v.rows.length; i++) {
    const imei = (v.rows[i][vi] || '').trim().toUpperCase();
    if (!imei) continue;
    mapaVendas[imei] = parseMoeda(v.rows[i][vp]);
  }

  // Pagamentos: IMEI -> pendente
  const p = await ler(sheets, id, 'PAGAMENTOS');
  const pi = p.header.indexOf('IMEI');
  const pp = p.header.indexOf('VALOR PENDENTE');
  const cprod = p.header.indexOf('PRODUTO');
  const ccli = p.header.indexOf('CLIENTE');

  console.log('=== ' + ano + ': divergencias Vendas vs Pagamentos ===');
  let difTotal = 0;
  for (let i = 1; i < p.rows.length; i++) {
    const imei = (p.rows[i][pi] || '').trim().toUpperCase();
    if (!imei) continue;
    const pendPag = parseMoeda(p.rows[i][pp]);
    const pendVen = mapaVendas[imei];
    if (pendVen === undefined) continue;
    if (Math.abs(pendPag - pendVen) > 0.005) {
      const dif = pendVen - pendPag;
      difTotal += dif;
      console.log(`  ${imei} | ${p.rows[i][cprod]} | ${p.rows[i][ccli]} | Vendas R$ ${pendVen} vs Pag R$ ${pendPag} | dif ${dif.toFixed(2)}`);
    }
  }
  console.log('  >>> Diferenca total no ano: R$ ' + difTotal.toFixed(2));
}

async function run() {
  const sheets = await autenticarGoogle();
  for (const [ano, id] of Object.entries(SHEETS)) {
    await processar(sheets, id, ano);
  }
}
run().catch(e => console.error('Erro:', e.message));
