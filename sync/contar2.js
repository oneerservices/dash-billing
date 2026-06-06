require('dotenv').config({ path: __dirname + '/.env' });
const { google } = require('googleapis');

function parseMoeda(v) {
  if (!v) return 0;
  const l = v.toString().replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return Math.abs(parseFloat(l)) || 0;
}

async function t() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  const s = google.sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Pagamentos!A6:H3402'
  });
  const rows = r.data.values || [];
  const header = rows[0].map(h => h.trim().toUpperCase());
  const ci = header.indexOf('VALOR PENDENTE');
  const im = header.indexOf('IMEI');

  let comPendente = 0;
  let semImei = 0;
  for (let i = 1; i < rows.length; i++) {
    const pend = parseMoeda(rows[i][ci]);
    if (pend !== 0) {
      comPendente++;
      const imei = (rows[i][im] || '').trim();
      if (!imei) semImei++;
    }
  }
  console.log('Total com pendente != 0:', comPendente);
  console.log('Desses, SEM imei:', semImei);
}
t();
