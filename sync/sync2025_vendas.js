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

async function garantirUsuario(client, nome) {
  if (!nome || !nome.trim()) return null;
  const n = nome.trim();
  const existe = await client.query('SELECT id FROM usuarios WHERE LOWER(nome) = LOWER($1)', [n]);
  if (existe.rows.length > 0) return existe.rows[0].id;
  const novo = await client.query(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1,$2,$3,'vendedor') RETURNING id`,
    [n, n.toLowerCase().replace(/\s+/g, '.') + '@interno', 'sem_senha']);
  return novo.rows[0].id;
}

async function garantirPessoa(client, nome) {
  if (!nome || !nome.trim()) return null;
  const existe = await client.query('SELECT id FROM pessoas WHERE LOWER(nome) = LOWER($1)', [nome.trim()]);
  if (existe.rows.length > 0) return existe.rows[0].id;
  const novo = await client.query('INSERT INTO pessoas (nome, is_cliente) VALUES ($1, true) RETURNING id', [nome.trim()]);
  return novo.rows[0].id;
}

async function sincronizar(sheets) {
  const SHEET_NAME = 'VENDAS';
  const HEADER_ROW = 6;
  const BATCH_SIZE = 500;

  console.log('Buscando cabecalho vendas 2025...');
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: `${SHEET_NAME}!A${HEADER_ROW}:Z${HEADER_ROW}`,
  });
  const header = (headerRes.data.values[0] || []).map(h => h.trim().toUpperCase());
  console.log('Colunas:', header.join(', '));

  const col = {
    data_venda:  header.indexOf('DATA DA VENDA'),
    vendedor:    header.indexOf('VENDEDOR'),
    imei:        header.indexOf('IMEI'),
    cliente:     header.indexOf('CLIENTE'),
    valor_venda: header.indexOf('VALOR DA VENDA'),
    reparo:      header.indexOf('REPARO'),
    motoqueiro:  header.indexOf('MOTOQUEIRO'),
    status_venda:header.indexOf('VENDA'),
    valor_recebido: header.indexOf('VALOR RECEBIDO'),
    valor_pendente: header.indexOf('VALOR PENDENTE'),
    comissao10:  header.indexOf('COMISSÃO 10%'),
    comissao9:   header.indexOf('COMISSÃO 9%'),
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
        const produto = await client.query('SELECT id FROM produtos WHERE imei = $1', [imei]);
        if (produto.rows.length === 0) { ignorados++; continue; }
        const produtoId = produto.rows[0].id;

        const clienteNome = (row[col.cliente] || '').trim();
        if (!clienteNome) { ignorados++; continue; }
        const clienteId  = await garantirPessoa(client, clienteNome);
        const vendedorId = await garantirUsuario(client, row[col.vendedor]);

        const data_venda     = parseData(row[col.data_venda]);
        const valor_venda    = parseMoeda(row[col.valor_venda]);
        const custo_reparo   = parseMoeda(row[col.reparo]);
        const custo_moto     = parseMoeda(row[col.motoqueiro]);
        const status_venda   = (row[col.status_venda] || '').trim() || 'ativa';
        const valor_recebido = parseMoeda(row[col.valor_recebido]);
        const valor_pendente = parseMoeda(row[col.valor_pendente]);
        const com10 = parseMoeda(row[col.comissao10]);
        const com9  = parseMoeda(row[col.comissao9]);
        const comissao_percentual = com10 > 0 ? 10 : com9 > 0 ? 9 : 0;

        const existe = await client.query('SELECT id FROM vendas WHERE produto_id = $1', [produtoId]);
        if (existe.rows.length === 0) {
          await client.query(
            `INSERT INTO vendas (produto_id, cliente_id, vendedor_id, data_venda, valor_venda, custo_reparo, custo_motoqueiro, status_venda, valor_recebido, valor_pendente, comissao_percentual)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [produtoId, clienteId, vendedorId, data_venda, valor_venda, custo_reparo, custo_moto, status_venda, valor_recebido, valor_pendente, comissao_percentual]);
          inseridos++;
        } else {
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

  console.log('Concluido!');
  console.log('Inseridos: ' + inseridos);
  console.log('Atualizados (ja existiam, ignorados): ' + atualizados);
  console.log('Ignorados: ' + ignorados);
  await pool.end();
}

async function main() {
  try { const sheets = await autenticarGoogle(); await sincronizar(sheets); }
  catch (err) { console.error('Erro:', err.message); await pool.end(); }
}
main();
