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
