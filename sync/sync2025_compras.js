require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const { google } = require('googleapis');

const SHEET_ID = '1Gf8oJeX3J38hMIUa7MJ6MMLYBfmqO5CDBnA0AFJJe5w';

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
function parseData(v){if(!v||!v.trim())return null;const p=v.trim().split('/');if(p.length===3)return `${p[2]}-${p[1]}-${p[0]}`;return null;}

function parseStatus(statusRaw, valorPago, valorPendente) {
  const s = (statusRaw || '').trim().toLowerCase();
  if (s.includes('cancel')) return 'cancelada';
  if (valorPago > 0 && valorPendente > 0) return 'parcialmente';
  if (valorPendente === 0 && valorPago > 0) return 'pago';
  return 'pendente';
}

async function sincronizar(sheets) {
  const SHEET_NAME = 'ESTOQUE';
  const HEADER_ROW = 6;
  const BATCH_SIZE = 500;

  console.log('Buscando cabecalho compras 2025...');
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A${HEADER_ROW}:Z${HEADER_ROW}`,
  });
  const header = (headerRes.data.values[0] || []).map(h => h.trim().toUpperCase());

  const col = {
    imei:          header.indexOf('IMEI'),
    fornecedor:    header.indexOf('FORNECEDOR'),
    data_compra:   header.indexOf('DATA DA COMPRA'),
    valor_compra:  header.indexOf('CUSTO'),
    valor_pago:    header.indexOf('VALOR PAGO'),
    valor_pendente:header.indexOf('VALOR PENDENTE'),
    status:        header.indexOf('STATUS'),
    vencimento:    header.indexOf('VENCIMENTO'),
  };

  let startRow = HEADER_ROW + 1;
  let inseridos = 0, atualizados = 0, ignorados = 0, lote = 1;

  while (true) {
    const endRow = startRow + BATCH_SIZE - 1;
    console.log('Lote ' + lote + ': linhas ' + startRow + ' a ' + endRow);
    let rows = [];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A${startRow}:Z${endRow}`,
      });
      rows = res.data.values || [];
    } catch (err) {
      if (err.message && err.message.includes('exceeds grid limits')) { console.log('Fim.'); break; }
      throw err;
    }
    if (rows.length === 0) { console.log('Fim.'); break; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of rows) {
        const imei = (row[col.imei] || '').trim().toUpperCase();
        if (!imei) { ignorados++; continue; }

        const produtoRes = await client.query('SELECT id, fornecedor_id FROM produtos WHERE imei = $1', [imei]);
        if (produtoRes.rows.length === 0) { ignorados++; continue; }
        const produtoId    = produtoRes.rows[0].id;
        const fornecedorId = produtoRes.rows[0].fornecedor_id;

        const data_compra   = parseData(row[col.data_compra]);
        const valor_compra  = parseMoeda(row[col.valor_compra]);
        if (!data_compra || !valor_compra) { ignorados++; continue; }

        const valor_pago     = parseMoeda(row[col.valor_pago]);
        const valor_pendente = parseMoeda(row[col.valor_pendente]);
        const vencimento     = parseData(row[col.vencimento]);
        const status         = parseStatus(row[col.status], valor_pago, valor_pendente);

        const existe = await client.query('SELECT id FROM compras WHERE produto_id = $1', [produtoId]);
        if (existe.rows.length === 0) {
          await client.query(
            `INSERT INTO compras (produto_id, fornecedor_id, data_compra, valor_compra, valor_pago, valor_pendente, vencimento, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [produtoId, fornecedorId, data_compra, valor_compra, valor_pago, valor_pendente, vencimento, status]);
          inseridos++;
        } else {
          await client.query(
            `UPDATE compras SET fornecedor_id=$2, data_compra=$3, valor_compra=$4, valor_pago=$5, valor_pendente=$6, vencimento=$7, status=$8
             WHERE produto_id=$1`,
            [produtoId, fornecedorId, data_compra, valor_compra, valor_pago, valor_pendente, vencimento, status]);
          atualizados++;
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro no lote ' + lote + ':', err.message);
    } finally { client.release(); }

    startRow += BATCH_SIZE; lote++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Concluido! Inseridos: ' + inseridos + ' Atualizados: ' + atualizados + ' Ignorados: ' + ignorados);
  await pool.end();
}

async function main() {
  try { const sheets = await autenticarGoogle(); await sincronizar(sheets); }
  catch (err) { console.error('Erro:', err.message); await pool.end(); }
}
main();
