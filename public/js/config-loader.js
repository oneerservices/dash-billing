// As configurações do front ficam no arquivo js/config.js.
// O webhook do n8n e o API_SECRET ficam no arquivo .env do servidor.
// O arquivo js/config.js NÃO deve ser enviado para o GitHub.
const CONFIG = window.APP_CONFIG || {};

const SHEET_ID = CONFIG.SHEET_ID || '';
const SHEET_NAME = CONFIG.SHEET_NAME || 'Base';
const SHEET_DETAIL = CONFIG.SHEET_DETAIL || 'Base';
const CONTACTS_SHEET_NAME = window.APP_CONFIG ? (window.APP_CONFIG.CONTACTS_SHEET_NAME || 'Contatos') : 'Contatos';
const API_COBRANCAS_URL = CONFIG.API_COBRANCAS_URL || '/api/cobrancas';
const GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID || '';
const INTERVALO_MS = Number(CONFIG.INTERVALO_MS || 60000);

// Secret buscado do servidor uma vez ao iniciar.
// Nunca hardcoded no front — fica em memória apenas.
let _apiSecret = null;

async function carregarApiSecret() {
  try {
    const resp = await fetch('/api/client-config');
    if (!resp.ok) throw new Error('Falha ao buscar configuração do servidor');
    const data = await resp.json();
    _apiSecret = data.apiSecret || null;
  } catch (e) {
    console.error('Não foi possível carregar o API secret:', e);
  }
}

function getApiSecret() {
  return _apiSecret;
}

function validarConfiguracao() {
  const faltando = [];

  if (!SHEET_ID) faltando.push('SHEET_ID');
  if (!GOOGLE_CLIENT_ID) faltando.push('GOOGLE_CLIENT_ID');

  if (faltando.length) {
    console.warn('Configuração incompleta. Preencha js/config.js:', faltando.join(', '));
    const loginSub = document.querySelector('.login-sub');
    if (loginSub) {
      loginSub.innerHTML = `Configuração incompleta: <strong>${faltando.join(', ')}</strong>.<br>Abra o arquivo <strong>js/config.js</strong> e preencha os dados.`;
    }
  }

  return faltando.length === 0;
}

// Carrega o secret assim que o script é executado.
carregarApiSecret();
