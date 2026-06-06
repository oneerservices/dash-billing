require('dotenv').config({ path: __dirname + '/.env' });

const { Pool } = require('pg');
const { google } = require('googleapis');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
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

function parseData(valor) {
  if (!valor || !valor.trim()) return null;

  const partes = valor.trim().split('/');

  if (partes.length === 3) {
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }

  return null;
}

async function garantirUsuario(client, nome) {
  if (!nome || !nome.trim()) return null;

  const n = nome.trim();

  const existe = await client.query(
    'SELECT id FROM usuarios WHERE LOWER(nome) = LOWER($1)',
    [n]
  );

  if (existe.rows.length > 0) return existe.rows[0].id;

  const novo = await client.query(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil)
     VALUES ($1, $2, $3, 'vendedor') RETURNING id`,
    [n, n.toLowerCase().replace(/\s+/g, '.') + '@interno', 'sem_senha']
  );

  return novo.rows[0].id;
}

async function garantirPessoa(client, nome) {
  if (!nome || !nome.trim()) return null;

  const n = nome.trim();

  const existe = await client.query(
    'SELECT id FROM pessoas WHERE LOWER(nome) = LOWER($1)',
    [n]
  );

  if (existe.rows.length > 0) return existe.rows[0].id;

  const novo = await client.query(
    'INSERT INTO pessoas (nome, is_cliente) VALUES ($1, true) RETURNING id',
    [n]
  );

  return novo.rows[0].id;
}

async function cancelarVendasRemovidasDaPlanilha(client, imeisAtivos) {
  if (!imeisAtivos.size) {
    console.log('Nenhum IMEI ativo encontrado na planilha. Cancelamento automatico ignorado por seguranca.');
    return 0;
  }

  const imeis = Array.from(imeisAtivos);

  const result = await client.query(
    `
    UPDATE vendas v
       SET status_venda = 'Cancelado',
           valor_pendente = 0,
           atualizado_em = NOW()
      FROM produtos p
     WHERE p.id = v.produto_id
       AND p.imei IS NOT NULL
       AND p.imei <> ''
       AND NOT (p.imei = ANY($1))
       AND COALESCE(v.status_venda, '') NOT IN ('Pago', 'Cancelado')
    `,
    [imeis]
  );

  return result.rowCount;
}

async function sincronizarVendas(sheets) {
  const SHEET_NAME = 'Vendas';
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
    data_venda: header.indexOf('DATA DA VENDA'),
    vendedor: header.indexOf('VENDEDOR'),
    imei: header.indexOf('IMEI'),
    cliente: header.indexOf('CLIENTE'),
    valor_venda: header.indexOf('VALOR DA VENDA'),
    reparo: header.indexOf('REPARO'),
    motoqueiro: header.indexOf('MOTOQUEIRO'),
    status_venda: header.indexOf('SITUAÇÃO'),
    status_entrega: header.indexOf('ENTREGA'),
    onde_estava: header.indexOf('ONDE ESTAVA'),
    comissao10: header.indexOf('COMISSÃO 10%'),
    comissao9: header.indexOf('COMISSÃO 9%'),
  };

  let startRow = HEADER_ROW + 1;
  let inseridos = 0;
  let atualizados = 0;
  let ignorados = 0;
  let cancelados = 0;
  let lote = 1;

  const imeisAtivosNaPlanilha = new Set();

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
        const imei = (row[col.imei] || '').trim().toUpperCase();

        if (!imei) {
          ignorados++;
          continue;
        }

        imeisAtivosNaPlanilha.add(imei);

        const produto = await client.query(
          'SELECT id FROM produtos WHERE imei = $1',
          [imei]
        );

        if (produto.rows.length === 0) {
          ignorados++;
          continue;
        }

        const produtoId = produto.rows[0].id;

        const clienteNome = (row[col.cliente] || '').trim();

        if (!clienteNome) {
          ignorados++;
          continue;
        }

        const clienteId = await garantirPessoa(client, clienteNome);
        const vendedorId = await garantirUsuario(client, row[col.vendedor]);

        const data_venda = parseData(row[col.data_venda]);
        const valor_venda = parseMoeda(row[col.valor_venda]);
        const custo_reparo = parseMoeda(row[col.reparo]);
        const custo_moto = parseMoeda(row[col.motoqueiro]);
        const status_venda = (row[col.status_venda] || '').trim() || 'Vendido';
        const status_entrega = (row[col.status_entrega] || '').trim() || 'pendente';
        const onde_estava = (row[col.onde_estava] || '').trim() || null;

        const com10 = parseMoeda(row[col.comissao10]);
        const com9 = parseMoeda(row[col.comissao9]);
        const comissao_percentual = com10 > 0 ? 10 : com9 > 0 ? 9 : 0;

        const existe = await client.query(
          'SELECT id FROM vendas WHERE produto_id = $1',
          [produtoId]
        );

        if (existe.rows.length === 0) {
          await client.query(
            `INSERT INTO vendas
              (produto_id, cliente_id, vendedor_id, data_venda, valor_venda,
               custo_reparo, custo_motoqueiro, status_venda, status_entrega,
               onde_estava, comissao_percentual)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              produtoId,
              clienteId,
              vendedorId,
              data_venda,
              valor_venda,
              custo_reparo,
              custo_moto,
              status_venda,
              status_entrega,
              onde_estava,
              comissao_percentual
            ]
          );

          inseridos++;
        } else {
          await client.query(
            `UPDATE vendas SET
               cliente_id = $2,
               vendedor_id = $3,
               data_venda = $4,
               valor_venda = $5,
               custo_reparo = $6,
               custo_motoqueiro = $7,
               status_venda = $8,
               status_entrega = $9,
               onde_estava = $10,
               comissao_percentual = $11,
               atualizado_em = NOW()
             WHERE produto_id = $1`,
            [
              produtoId,
              clienteId,
              vendedorId,
              data_venda,
              valor_venda,
              custo_reparo,
              custo_moto,
              status_venda,
              status_entrega,
              onde_estava,
              comissao_percentual
            ]
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
    await new Promise(r => setTimeout(r, 1000));
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    cancelados = await cancelarVendasRemovidasDaPlanilha(client, imeisAtivosNaPlanilha);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao cancelar vendas removidas da planilha:', err.message);
  } finally {
    client.release();
  }

  console.log('Concluido!');
  console.log('Inseridos: ' + inseridos);
  console.log('Atualizados: ' + atualizados);
  console.log('Cancelados por ausencia na planilha: ' + cancelados);
  console.log('Ignorados: ' + ignorados);

  await pool.end();
}

async function main() {
  try {
    const sheets = await autenticarGoogle();
    await sincronizarVendas(sheets);
  } catch (err) {
    console.error('Erro:', err.message);
    await pool.end();
  }
}

main();
