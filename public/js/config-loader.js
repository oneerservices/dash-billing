// As configurações do front ficam no arquivo js/config.js.
// O webhook do n8n saiu do front e agora fica no arquivo .env do servidor.
// O arquivo js/config.js NÃO deve ser enviado para o GitHub.
const CONFIG = window.APP_CONFIG || {};

const SHEET_ID = CONFIG.SHEET_ID || '';
const SHEET_NAME = CONFIG.SHEET_NAME || 'Base';
const SHEET_DETAIL = CONFIG.SHEET_DETAIL || 'Base';
const API_COBRANCAS_URL = CONFIG.API_COBRANCAS_URL || '/api/cobrancas';
const GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID || '';
const INTERVALO_MS = Number(CONFIG.INTERVALO_MS || 60000);

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
