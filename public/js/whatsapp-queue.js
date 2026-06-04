let filaCobranca = [];
let filaIndiceAtual = 0;
let filaAguardando = false;

function iniciarFilaCobranca() {
  const clientesSelecionados = allRows.filter(cliente => selectedIds.has(cliente.id));

  if (!clientesSelecionados.length) {
    alert('Selecione pelo menos um cliente para cobrar.');
    return;
  }

  filaCobranca = clientesSelecionados;
  filaIndiceAtual = 0;
  filaAguardando = false;

  abrirModalFilaCobranca();
  renderizarFilaCobranca();
}

function abrirModalFilaCobranca() {
  const overlay = document.getElementById('queue-overlay');

  if (overlay) {
    overlay.classList.add('open');
  }
}

function fecharFilaCobranca() {
  const overlay = document.getElementById('queue-overlay');

  if (overlay) {
    overlay.classList.remove('open');
  }

  filaCobranca = [];
  filaIndiceAtual = 0;
  filaAguardando = false;
}

function getClienteAtualFila() {
  return filaCobranca[filaIndiceAtual] || null;
}

function renderizarFilaCobranca() {
  const total = filaCobranca.length;
  const cliente = getClienteAtualFila();

  const counter = document.getElementById('queue-counter');
  const status = document.getElementById('queue-status');
  const progress = document.getElementById('queue-progress-bar');
  const clientName = document.getElementById('queue-client-name');
  const clientInfo = document.getElementById('queue-client-info');
  const waitBox = document.getElementById('queue-wait-box');
  const mainBtn = document.getElementById('queue-main-btn');

  if (!total || !cliente) {
    if (counter) counter.textContent = 'Cliente 0 de 0';
    if (status) status.textContent = 'Finalizado';
    if (progress) progress.style.width = '100%';
    if (clientName) clientName.textContent = 'Fila concluída';
    if (clientInfo) clientInfo.textContent = 'Todos os clientes selecionados foram processados.';
    if (waitBox) waitBox.style.display = 'none';
    if (mainBtn) {
      mainBtn.textContent = 'Finalizado';
      mainBtn.disabled = true;
    }
    return;
  }

  const atual = filaIndiceAtual + 1;
  const percentual = Math.round((filaIndiceAtual / total) * 100);

  if (counter) counter.textContent = `Cliente ${atual} de ${total}`;
  if (status) status.textContent = filaAguardando ? 'Aguardando' : 'Pronto';
  if (progress) progress.style.width = `${percentual}%`;
  if (clientName) clientName.textContent = cliente.nome || '—';
  if (clientInfo) clientInfo.textContent = `Valor em aberto: ${fmtBRL(cliente.valor || 0)} · Vencimento: ${cliente.data || '—'}`;
  if (waitBox) waitBox.style.display = filaAguardando ? 'flex' : 'none';

  if (mainBtn) {
    mainBtn.disabled = filaAguardando;
    mainBtn.textContent = filaAguardando ? 'Aguarde...' : 'Abrir WhatsApp';
  }
}

function gerarTempoAleatorioFila() {
  return Math.floor(Math.random() * 4000) + 3000;
}

async function abrirWhatsappFilaAtual() {
  if (filaAguardando) return;

  const cliente = getClienteAtualFila();

  if (!cliente) {
    finalizarFilaCobranca();
    return;
  }

  try {
    const abriu = await abrirWhatsappCliente(cliente);

    if (!abriu) {
      renderizarFilaCobranca();
      return;
    }

    filaAguardando = true;
    renderizarFilaCobranca();

    const tempo = gerarTempoAleatorioFila();
    iniciarContagemEsperaFila(tempo);
  } catch (error) {
    console.error('Erro ao abrir WhatsApp da fila:', error);
    alert('Não foi possível abrir o WhatsApp deste cliente.');
  }
}

function iniciarContagemEsperaFila(tempoMs) {
  const mainBtn = document.getElementById('queue-main-btn');
  const waitSub = document.getElementById('queue-wait-sub');

  let restante = Math.ceil(tempoMs / 1000);

  if (mainBtn) {
    mainBtn.disabled = true;
    mainBtn.textContent = `Aguarde ${restante}s`;
  }

  if (waitSub) {
    waitSub.textContent = `Próximo cliente será liberado em ${restante}s.`;
  }

  const intervalo = setInterval(() => {
    restante -= 1;

    if (mainBtn) {
      mainBtn.textContent = `Aguarde ${Math.max(restante, 0)}s`;
    }

    if (waitSub) {
      waitSub.textContent = `Próximo cliente será liberado em ${Math.max(restante, 0)}s.`;
    }
  }, 1000);

  setTimeout(() => {
    clearInterval(intervalo);
    avancarFilaCobranca();
  }, tempoMs);
}

function avancarFilaCobranca() {
  filaIndiceAtual += 1;
  filaAguardando = false;

  if (filaIndiceAtual >= filaCobranca.length) {
    finalizarFilaCobranca();
    return;
  }

  renderizarFilaCobranca();
}

function finalizarFilaCobranca() {
  filaIndiceAtual = filaCobranca.length;
  filaAguardando = false;

  const total = filaCobranca.length;

  const counter = document.getElementById('queue-counter');
  const status = document.getElementById('queue-status');
  const progress = document.getElementById('queue-progress-bar');
  const clientName = document.getElementById('queue-client-name');
  const clientInfo = document.getElementById('queue-client-info');
  const waitBox = document.getElementById('queue-wait-box');
  const mainBtn = document.getElementById('queue-main-btn');

  if (counter) counter.textContent = `Cliente ${total} de ${total}`;
  if (status) status.textContent = 'Finalizado';
  if (progress) progress.style.width = '100%';
  if (clientName) clientName.textContent = 'Fila concluída';
  if (clientInfo) clientInfo.textContent = 'Todos os clientes selecionados foram processados.';
  if (waitBox) waitBox.style.display = 'none';

  if (mainBtn) {
    mainBtn.textContent = 'Finalizado';
    mainBtn.disabled = true;
  }
}