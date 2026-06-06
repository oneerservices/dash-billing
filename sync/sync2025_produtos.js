require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const { google } = require('googleapis');

const SHEET_ID = '1Gf8oJeX3J38hMIUa7MJ6MMLYBfmqO5CDBnA0AFJJe5w';

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function autenticarGoogle() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

function parseMoeda(valor) {
  if (!valor) return 0;
  const l = valor.toString().replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return Math.abs(parseFloat(l)) || 0;
}

async function garantirCategoria(client, nome) {
  if (!nome || !nome.trim()) return null;
  const existe = await client.query('SELECT id FROM categorias WHERE LOWER(nome) = LOWER($1)', [nome.trim()]);
  if (existe.rows.length > 0) return existe.rows[0].id;
  const novo = await client.query('INSERT INTO categorias (nome) VALUES ($1) RETURNING id', [nome.trim()]);
  return novo.rows[0].id;
}

async function garantirPessoa(client, nome) {
  if (!nome || !nome.trim()) return null;
  const existe = await client.query('SELECT id FROM pessoas WHERE LOWER(nome) = LOWER($1)', [nome.trim()]);
  if (existe.rows.length > 0) return existe.rows[0].id;
  const novo = await client.query('INSERT INTO pessoas (nome, is_fornecedor) VALUES ($1, true) RETURNING id', [nome.trim()]);
  return novo.rows[0].id;
}

async function sincronizar(sheets) {
  const SHEET_NAME = 'ESTOQUE';
  const HEADER_ROW = 6;
  const BATCH_SIZE = 500;

  console.log('Buscando cabecalho 2025...');
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${HEADER_ROW}:Z${HEADER_ROW}`,
  });
  const header = (headerRes.data.values[0] || []).map(h => h.trim().toUpperCase());
  console.log('Colunas:', header.join(', '));

  const col = {
    tipo:            header.indexOf('TIPO'),
    imei:            header.indexOf('IMEI'),
    produto:         header.indexOf('PRODUTO'),
    bateria:         header.indexOf('BATERIA'),
    fornecedor:      header.indexOf('FORNECEDOR'),
    custo:           header.indexOf('CUSTO'),
    reparo:          header.indexOf('REPARO'),
    motoqueiro:      header.indexOf('MOTOQUEIRO'),
    localizacao:     header.indexOf('SITUAÇÃO'),     // 2025: Situacao = localizacao
    disponibilidade: header.indexOf('ESTOQUE'),      // 2025: Estoque = disponibilidade
    observacao:      header.indexOf('OBSERVAÇÃO'),
  };

  let startRow = HEADER_ROW + 1;
  let inseridos = 0, atualizados = 0, ignorados = 0, lote = 1;

  while (true) {
    const endRow = startRow + BATCH_SIZE - 1;
    console.log('Lote ' + lote + ': linhas ' + startRow + ' a ' + endRow);

    let rows = [];
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A${startRow}:Z${endRow}`,
      });
      rows = res.data.values || [];
    } catch (err) {
      if (err.message && err.message.includes('exceeds grid limits')) { console.log('Fim dos dados.'); break; }
      throw err;
    }
    if (rows.length === 0) { console.log('Fim dos dados.'); break; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of rows) {
        const imei = (row[col.imei] || '').trim().toUpperCase();
        const nome = (row[col.produto] || '').trim();
        if (!imei || !nome) { ignorados++; continue; }

        const categoriaId  = await garantirCategoria(client, row[col.tipo]);
        const fornecedorId = await garantirPessoa(client, row[col.fornecedor]);
        const custo      = parseMoeda(row[col.custo]);
        const reparo     = parseMoeda(row[col.reparo]);
        const motoqueiro = parseMoeda(row[col.motoqueiro]);
        const bateria    = parseInt(row[col.bateria]) || null;
        const localizacao     = (row[col.localizacao]     || '').trim() || null;
        const disponibilidade = (row[col.disponibilidade] || '').trim() || null;
        const observacoes     = (row[col.observacao]       || '').trim() || null;

        const existe = await client.query('SELECT id FROM produtos WHERE imei = $1', [imei]);
        if (existe.rows.length === 0) {
          await client.query(
            `INSERT INTO produtos (nome, imei, categoria_id, fornecedor_id, custo, reparo, motoqueiro, bateria, localizacao, disponibilidade, observacoes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [nome, imei, categoriaId, fornecedorId, custo, reparo, motoqueiro, bateria, localizacao, disponibilidade, observacoes]);
          inseridos++;
        } else {
          await client.query(
            `UPDATE produtos SET nome=$2, categoria_id=$3, fornecedor_id=$4, custo=$5, reparo=$6, motoqueiro=$7, bateria=$8, localizacao=$9, disponibilidade=$10, observacoes=$11, atualizado_em=NOW() WHERE imei=$1`,
            [imei, nome, categoriaId, fornecedorId, custo, reparo, motoqueiro, bateria, localizacao, disponibilidade, observacoes]);
          atualizados++;
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro no lote ' + lote + ':', err.message);
    } finally {
      client.release();
    }

    startRow += BATCH_SIZE;
    lote++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('Concluido!');
  console.log('Inseridos: ' + inseridos);
  console.log('Atualizados: ' + atualizados);
  console.log('Ignorados: ' + ignorados);
  await pool.end();
}

async function main() {
  try {
    const sheets = await autenticarGoogle();
    await sincronizar(sheets);
  } catch (err) {
    console.error('Erro:', err.message);
    await pool.end();
  }
}
main();
