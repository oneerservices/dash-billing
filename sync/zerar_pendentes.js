require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE vendas SET valor_pendente = 0, valor_recebido = valor_venda, atualizado_em = NOW()
       WHERE valor_pendente <> 0 OR valor_recebido <> valor_venda`);
    console.log('Pendentes zerados (serao recalculados pela aba Pagamentos): ' + res.rowCount + ' vendas');
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(e => { console.error('Erro:', e.message); pool.end(); });
