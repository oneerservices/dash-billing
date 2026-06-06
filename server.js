require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK = process.env.N8N_WEBHOOK;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'dash-cobrancas' });
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
    return res.status(500).json({
      ok: false,
      error: 'Falha ao comunicar com o n8n'
    });
  }
});


app.get('/api/client-config', (req, res) => {
  res.json({
    apiSecret: process.env.API_SECRET || ''
  });
});

app.get('/api/version', (req, res) => {
  const packageJson = require('./package.json');

  res.json({
    version: packageJson.version || '1.0.0',
    name: packageJson.name || 'dash-cobrancas'
  });
});

app.listen(PORT, () => {
  console.log(`Dash rodando em http://localhost:${PORT}`);
});

// ===== PAINEL FINANCEIRO =====
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

const IMEIS_2025 = [
  '200887654','359823654716192','200284170','359220905353067','200639437',
  '356200542297086','200666907','353869223526279','359811266230173','354440898252614'
];

app.get('/api/painel', async (req, res) => {
  const data = req.query.data || new Date().toISOString().split('T')[0];
  try {
    const client = await pool.connect();
    const [
      vendas, entradas, saida, lucro,
      vend_pend_dia, comp_pagas_dia, comp_pend_dia, vend_pagas_dia,
      vend_pend_total, comp_pend_total, comp_pend_reparos, estoque, ultima_sync
    ] = await Promise.all([
      client.query(`SELECT COUNT(*) qtd, COALESCE(SUM(valor_venda),0) total FROM vendas WHERE data_venda=$1`, [data]),
      client.query(`SELECT COUNT(*) qtd, COALESCE(SUM(valor_compra),0) total FROM compras WHERE data_compra=$1`, [data]),
      client.query(`SELECT COUNT(*) qtd, COALESCE(SUM(p.custo_total),0) total FROM vendas v JOIN produtos p ON p.id=v.produto_id WHERE v.data_venda=$1`, [data]),
      client.query(`SELECT COALESCE(SUM(v.valor_venda)-SUM(p.custo_total),0) lucro, CASE WHEN SUM(v.valor_venda)>0 THEN ROUND((SUM(v.valor_venda)-SUM(p.custo_total))/SUM(v.valor_venda)*100,2) ELSE 0 END pct FROM vendas v JOIN produtos p ON p.id=v.produto_id WHERE v.data_venda=$1`, [data]),
      client.query(`SELECT COUNT(*) qtd, COALESCE(SUM(v.valor_pendente),0) total FROM parcelas p JOIN vendas v ON v.id=p.venda_id WHERE p.vencimento=$1 AND p.valor_pago=0 AND v.valor_pendente>0`, [data]),
      client.query(`SELECT COUNT(*) qtd, COALESCE(SUM(valor_pago),0) total FROM compras WHERE vencimento=$1 AND valor_pago>0`, [data]),
      client.query(`SELECT COUNT(*) qtd, COALESCE(SUM(valor_pendente),0) total FROM compras WHERE vencimento=$1 AND valor_pendente>0`, [data]),
      client.query(`SELECT COUNT(*) qtd, COALESCE(SUM(valor_pago),0) total FROM parcelas WHERE vencimento=$1 AND valor_pago>0`, [data]),
      client.query(`SELECT COUNT(*) qtd, COALESCE(SUM(valor_pendente),0) total FROM vendas WHERE valor_pendente>0`),
      client.query(`SELECT COUNT(*) qtd FROM compras WHERE status IN ('pendente','parcialmente')`),
      client.query(`SELECT COALESCE(SUM(c.valor_pendente),0) + COALESCE((SELECT SUM(p.reparo) FROM produtos p JOIN compras c2 ON c2.produto_id=p.id WHERE p.reparo_pago=false AND p.reparo>0 AND c2.data_compra>='2026-01-01'),0) AS total FROM compras c WHERE c.valor_pendente>0`),
      client.query(`SELECT COUNT(DISTINCT p.id) qtd, COALESCE(SUM(p.custo_total),0) total FROM produtos p LEFT JOIN compras c ON c.produto_id=p.id WHERE p.disponibilidade IN ('EM ESTOQUE','ATIVO EMPRESA','CLIENTE') AND (c.data_compra>='2026-01-01' OR p.imei=ANY($1))`, [IMEIS_2025]),
      client.query(`SELECT MAX(atualizado_em) ultima FROM produtos`),
    ]);
    client.release();

    const estoque_val = parseFloat(estoque.rows[0].total);
    const vp_val = parseFloat(vend_pend_total.rows[0].total);
    const cp_val = parseFloat(comp_pend_reparos.rows[0].total);

    res.json({
      data,
      ultima_sync: ultima_sync.rows[0].ultima,
      estoque: {
        entradas_qtd: parseInt(entradas.rows[0].qtd),
        entradas_val: parseFloat(entradas.rows[0].total),
        saida_qtd: parseInt(saida.rows[0].qtd),
        saida_val: parseFloat(saida.rows[0].total),
        geral_qtd: parseInt(estoque.rows[0].qtd),
        geral_val: estoque_val,
      },
      vendas: {
        qtd: parseInt(vendas.rows[0].qtd),
        total: parseFloat(vendas.rows[0].total),
        lucro: parseFloat(lucro.rows[0].lucro),
        pct_lucro: parseFloat(lucro.rows[0].pct),
      },
      pagamentos: {
        vendas_pagas_qtd: parseInt(vend_pagas_dia.rows[0].qtd),
        vendas_pagas_val: parseFloat(vend_pagas_dia.rows[0].total),
        vendas_pend_qtd: parseInt(vend_pend_dia.rows[0].qtd),
        vendas_pend_val: parseFloat(vend_pend_dia.rows[0].total),
        compras_pagas_qtd: parseInt(comp_pagas_dia.rows[0].qtd),
        compras_pagas_val: parseFloat(comp_pagas_dia.rows[0].total),
        compras_pend_qtd: parseInt(comp_pend_dia.rows[0].qtd),
        compras_pend_val: parseFloat(comp_pend_dia.rows[0].total),
      },
      financeiro: {
        estoque_geral_qtd: parseInt(estoque.rows[0].qtd),
        estoque_geral_val: estoque_val,
        vendas_pend_qtd: parseInt(vend_pend_total.rows[0].qtd),
        vendas_pend_val: vp_val,
        compras_pend_qtd: parseInt(comp_pend_total.rows[0].qtd),
        compras_pend_val: cp_val,
        parcial: estoque_val + vp_val - cp_val,
      }
    });
  } catch (err) {
    console.error('Erro painel:', err.message);
    res.status(500).json({ error: err.message });
  }
});
