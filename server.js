require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK = process.env.N8N_WEBHOOK;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rotas existentes ─────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'dash-cobrancas' });
});

app.get('/api/version', (req, res) => {
  const packageJson = require('./package.json');
  res.json({
    version: packageJson.version || '1.0.0',
    name: packageJson.name || 'dash-cobrancas'
  });
});

app.post('/api/cobrancas', async (req, res) => {
  try {
    if (!N8N_WEBHOOK) {
      return res.status(500).json({
        ok: false,
        error: 'N8N_WEBHOOK não configurado no arquivo .env'
      });
    }

    const respostaN8N = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const texto = await respostaN8N.text();
    return res.status(respostaN8N.status).send(texto || JSON.stringify({ ok: respostaN8N.ok }));
  } catch (erro) {
    console.error('Erro ao enviar cobrança para o n8n:', erro);
    return res.status(500).json({ ok: false, error: 'Falha ao comunicar com o n8n' });
  }
});

// ─── Rotas novas — Banco de dados ─────────────────────────────────────────────

// Cobranças em aberto (parcelas pendentes com dados do cliente)
app.get('/api/db/cobrancas', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        p.id            AS parcela_id,
        p.numero,
        p.vencimento,
        p.valor_esperado,
        p.valor_pago,
        p.status,
        p.forma_pagamento,
        pe.id           AS pessoa_id,
        pe.nome         AS cliente,
        pe.telefone,
        v.id            AS venda_id,
        v.data_venda
      FROM parcelas p
      JOIN vendas v   ON v.id = p.venda_id
      JOIN pessoas pe ON pe.id = v.cliente_id
      WHERE p.status != 'pago'
      ORDER BY p.vencimento ASC
    `);

    res.json({ ok: true, data: resultado.rows });
  } catch (erro) {
    console.error('Erro ao buscar cobranças:', erro);
    res.status(500).json({ ok: false, error: 'Erro ao buscar cobranças' });
  }
});

// Relatório financeiro com filtro de data
app.get('/api/db/financeiro', async (req, res) => {
  const { inicio, fim } = req.query;

  if (!inicio || !fim) {
    return res.status(400).json({ ok: false, error: 'Parâmetros inicio e fim são obrigatórios' });
  }

  try {
    const [
      estoque,
      vendas,
      pagamentos,
      compras,
      contas
    ] = await Promise.all([

      // Estoque: entradas e saídas por período
      pool.query(`
        SELECT
          localizacao,
          COUNT(*) FILTER (WHERE status = 'disponivel')  AS entradas,
          SUM(custo) FILTER (WHERE status = 'disponivel') AS valor_entradas,
          COUNT(*) FILTER (WHERE status = 'vendido')     AS saidas,
          SUM(custo) FILTER (WHERE status = 'vendido')   AS valor_saidas,
          COUNT(*)                                        AS total_unidades,
          SUM(custo)                                      AS valor_total
        FROM produtos
        WHERE criado_em BETWEEN $1 AND $2
        GROUP BY localizacao
      `, [inicio, fim]),

      // Vendas realizadas e lucro
      pool.query(`
        SELECT
          COUNT(*)        AS total_vendas,
          SUM(valor_venda) AS valor_total,
          SUM(valor_ganho) AS lucro_total
        FROM vendas_com_lucro
        WHERE data_venda BETWEEN $1 AND $2
          AND status_venda != 'cancelado'
      `, [inicio, fim]),

      // Vendas pagas e pendentes (parcelas)
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE p.status = 'pago')     AS vendas_pagas,
          SUM(p.valor_pago) FILTER (WHERE p.status = 'pago') AS valor_pago,
          COUNT(*) FILTER (WHERE p.status != 'pago')    AS vendas_pendentes,
          SUM(p.valor_esperado - COALESCE(p.valor_pago, 0))
            FILTER (WHERE p.status != 'pago')           AS valor_pendente
        FROM parcelas p
        JOIN vendas v ON v.id = p.venda_id
        WHERE v.data_venda BETWEEN $1 AND $2
      `, [inicio, fim]),

      // Compras pagas e pendentes
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pago')    AS compras_pagas,
          SUM(valor_pago) FILTER (WHERE status = 'pago') AS valor_pago,
          COUNT(*) FILTER (WHERE status != 'pago')   AS compras_pendentes,
          SUM(valor_pendente) FILTER (WHERE status != 'pago') AS valor_pendente
        FROM compras
        WHERE data_compra BETWEEN $1 AND $2
      `, [inicio, fim]),

      // Saldo por conta bancária
      pool.query(`
        SELECT nome, saldo
        FROM contas
        ORDER BY nome ASC
      `)
    ]);

    const saldoTotal = contas.rows.reduce((acc, c) => acc + parseFloat(c.saldo), 0);

    res.json({
      ok: true,
      data: {
        estoque: estoque.rows,
        vendas: vendas.rows[0],
        pagamentos: pagamentos.rows[0],
        compras: compras.rows[0],
        contas: contas.rows,
        saldo_total: saldoTotal
      }
    });
  } catch (erro) {
    console.error('Erro ao buscar financeiro:', erro);
    res.status(500).json({ ok: false, error: 'Erro ao buscar financeiro' });
  }
});

// Atualizar saldo de uma conta
app.patch('/api/db/contas/:id', async (req, res) => {
  const { id } = req.params;
  const { saldo } = req.body;

  if (saldo === undefined) {
    return res.status(400).json({ ok: false, error: 'Campo saldo é obrigatório' });
  }

  try {
    const resultado = await pool.query(`
      UPDATE contas
      SET saldo = $1, atualizado_em = now()
      WHERE id = $2
      RETURNING *
    `, [saldo, id]);

    if (!resultado.rows.length) {
      return res.status(404).json({ ok: false, error: 'Conta não encontrada' });
    }

    res.json({ ok: true, data: resultado.rows[0] });
  } catch (erro) {
    console.error('Erro ao atualizar conta:', erro);
    res.status(500).json({ ok: false, error: 'Erro ao atualizar conta' });
  }
});

// ─── Iniciar servidor ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Dash rodando em http://localhost:${PORT}`);
});