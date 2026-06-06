require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');
const { google } = require('googleapis');

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
  return parseFloat(
    valor.toString()
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()
  ) || 0;
}

async function garantirCategoria(client, nome) {
  if (!nome || !nome.trim()) return null;
  const existe = await client.query(
    'SELECT id FROM categorias WHERE LOWER(nome) = LOWER($1)',
    [nome.trim()]
  );
  if (existe.rows.length > 0) return existe.rows[0].id;
  const novo = await client.query(
    'INSERT INTO categorias (nome) VALUES ($1) RETURNING id',
    [nome.trim()]
  );
  return novo.rows[0].id;
}

async function garantirPessoa(client, nome) {
  if (!nome || !nome.trim()) return null;
  const existe = await client.query(
    'SELECT id FROM pessoas WHERE LOWER(nome) = LOWER($1)',
    [nome.trim()]
  );
  if (existe.rows.length > 0) return existe.rows[0].id;
  const novo = await client.query(
    'INSERT INTO pessoas (nome, is_fornecedor) VALUES ($1, true) RETURNING id',
    [nome.trim()]
  );
  return novo.rows[0].id;
}

async function sincronizarProdutos(sheets) {
  const SHEET_NAME = 'Estoque';
  const HEADER_ROW = 6;
  const BATCH_SIZE = 500;

  console.log('Buscando cabecalho...');

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: `${SHEET_NAME}!A${HEADER_ROW}:Z${HEADER_ROW}`,
  });

  const header = (headerRes.data.values[0] || []).map(h => h.trim().toUpperCase());
  console.log('Colunas:', header.join(', '));

  const col = {
    tipo:         header.indexOf('TIPO'),
    imei:         header.indexOf('IMEI'),
    produto:      header.indexOf('PRODUTO'),
    bateria:      header.indexOf('BATERIA'),
    fornecedor:   header.indexOf('FORNECEDOR'),
    custo:        header.indexOf('CUSTO'),
    reparo:       header.indexOf('REPARO'),
    reparo_pago:  header.indexOf('REPARO PAGO'),
    motoqueiro:   header.indexOf('MOTOQUEIRO'),
    disponibilidade: header.indexOf('ESTOQUE'),
    estoque:      header.indexOf('DISPONIBILIDADE'),
    observacao:   header.indexOf('OBSERVAÇÃO'),
  };

  console.log('Iniciando sincronizacao em lotes de ' + BATCH_SIZE + '...');

  let startRow = HEADER_ROW + 1;
  let inseridos = 0;
  let atualizados = 0;
  let ignorados = 0;
  let lote = 1;

  while (true) {
    const endRow = startRow + BATCH_SIZE - 1;
    console.log('Lote ' + lote + ': linhas ' + startRow + ' a ' + endRow);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: `${SHEET_NAME}!A${startRow}:Z${endRow}`,
    });

    const rows = res.data.values || [];
    if (rows.length === 0) {
      console.log('Fim dos dados.');
      break;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of rows) {
        const imei    = (row[col.imei]    || '').trim();
        const nome    = (row[col.produto] || '').trim();

        if (!imei || !nome) {
          ignorados++;
          continue;
        }

        const categoriaId  = await garantirCategoria(client, row[col.tipo]);
        const fornecedorId = await garantirPessoa(client, row[col.fornecedor]);

        const custo      = parseMoeda(row[col.custo]);
        const reparo     = parseMoeda(row[col.reparo]);
        const motoqueiro = parseMoeda(row[col.motoqueiro]);
        const bateria    = parseInt(row[col.bateria]) || null;
        const disponibilidade = (row[col.disponibilidade] || '').trim() || null;
        const localizacao     = (row[col.estoque]   || '').trim() || null;
        const observacoes     = (row[col.observacao] || '').trim() || null;
        const reparo_pago     = (row[col.reparo_pago] || '').trim().toUpperCase() === 'SIM';

        const existe = await client.query(
          'SELECT id FROM produtos WHERE imei = $1',
          [imei]
        );

        if (existe.rows.length === 0) {
          await client.query(
            `INSERT INTO produtos
              (nome, imei, categoria_id, fornecedor_id, custo, reparo, motoqueiro, bateria, localizacao, disponibilidade, observacoes, reparo_pago)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [nome, imei, categoriaId, fornecedorId, custo, reparo, motoqueiro, bateria, localizacao, disponibilidade, observacoes, reparo_pago]
          );
          inseridos++;
        } else {
          await client.query(
            `UPDATE produtos SET
               nome = $2, categoria_id = $3, fornecedor_id = $4,
               custo = $5, reparo = $6, motoqueiro = $7, bateria = $8,
               localizacao = $9, disponibilidade = $10, observacoes = $11, reparo_pago = $12,
               atualizado_em = NOW()
             WHERE imei = $1`,
            [imei, nome, categoriaId, fornecedorId, custo, reparo, motoqueiro, bateria, localizacao, disponibilidade, observacoes, reparo_pago]
          );
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

    // Pausa entre lotes para nao sobrecarregar a API do Google
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
    await sincronizarProdutos(sheets);
  } catch (err) {
    console.error('Erro:', err.message);
    await pool.end();
  }
}

main();
