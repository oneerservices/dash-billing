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
function parseData(v){if(!v||!v.trim())return null;const p=v.trim().split('/');if(p.length===3)return `${p[2]}-${p[1]}-${p[0]}`;return null;}

async function garantirCategoria(client, nome) {
  const existe = await client.query('SELECT id FROM categorias WHERE LOWER(nome) = LOWER($1)', [nome]);
  if (existe.rows.length > 0) return existe.rows[0].id;
  const novo = await client.query('INSERT INTO categorias (nome) VALUES ($1) RETURNING id', [nome]);
  return novo.rows[0].id;
}

async function garantirPessoa(client, nome) {
  if (!nome || !nome.trim()) return null;
  const existe = await client.query('SELECT id FROM pessoas WHERE LOWER(nome) = LOWER($1)', [nome.trim()]);
  if (existe.rows.length > 0) return existe.rows[0].id;
  const novo = await client.query('INSERT INTO pessoas (nome, is_cliente) VALUES ($1, true) RETURNING id', [nome.trim()]);
  return novo.rows[0].id;
}

async function processar(sheets, id, ano, client, catId) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'PAGAMENTOS!A6:Z3500' });
  const rows = r.data.values || [];
  const header = rows[0].map(h => h.trim().toUpperCase());
  const ci = header.indexOf('IMEI');
  const cp = header.indexOf('VALOR PENDENTE');
  const cr = header.indexOf('VALOR RECEBIDO');
  const cv = header.indexOf('VALOR');
  const ccli = header.indexOf('CLIENTE');
  const cprod = header.indexOf('PRODUTO');
  const cdata = header.indexOf('DATA DA VENDA');

  let criados = 0;
  for (let i = 1; i < rows.length; i++) {
    const imei = (rows[i][ci] || '').trim().toUpperCase();
    const pend = parseMoeda(rows[i][cp]);
    if (pend <= 0 || !imei) continue;  // so exige pendente > 0 (inclui centavos)

    const jaTem = await client.query(
      `SELECT v.id FROM vendas v JOIN produtos p ON p.id = v.produto_id WHERE p.imei = $1`, [imei]);
    if (jaTem.rows.length > 0) continue;

    const nome = (rows[i][cprod] || 'INDEFINIDO').trim();
    const clienteNome = (rows[i][ccli] || '').trim();
    const valor = parseMoeda(rows[i][cv]);
    const recebido = parseMoeda(rows[i][cr]);
    const data = parseData(rows[i][cdata]);

    let prod = await client.query('SELECT id FROM produtos WHERE imei = $1', [imei]);
    let produtoId;
    if (prod.rows.length === 0) {
      const novo = await client.query(
        `INSERT INTO produtos (nome, imei, categoria_id, custo, disponibilidade) VALUES ($1,$2,$3,0,'vendido') RETURNING id`,
        [nome, imei, catId]);
      produtoId = novo.rows[0].id;
    } else {
      produtoId = prod.rows[0].id;
    }

    const clienteId = await garantirPessoa(client, clienteNome);
    await client.query(
      `INSERT INTO vendas (produto_id, cliente_id, data_venda, valor_venda, status_venda, valor_recebido, valor_pendente)
       VALUES ($1,$2,$3,$4,'Pendente',$5,$6)`,
      [produtoId, clienteId, data, valor, recebido, pend]);
    criados++;
    console.log(`[${ano}] ${nome} | ${clienteNome} | R$ ${pend}`);
  }
  return criados;
}

async function run() {
  const sheets = await autenticarGoogle();
  const client = await pool.connect();
  let total = 0;
  try {
    const catId = await garantirCategoria(client, 'Outro');
    for (const [ano, id] of Object.entries(SHEETS)) {
      console.log('=== ' + ano + ' ===');
      total += await processar(sheets, id, ano, client, catId);
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log('Total criados: ' + total);
}

run().catch(e => console.error('Erro:', e.message));
