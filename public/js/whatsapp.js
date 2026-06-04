const whatsappClientesEmProcessamento = new Set();

function gerarMensagemWhatsappCliente(cliente) {
  const nome = cliente?.nome || 'cliente';
  const valor = fmtBRL(cliente?.valor || 0);

  return `Olá, ${nome}! Atualizando: o valor pendente hoje é de ${valor}.`;
}

function gerarLinkWhatsapp(telefone, mensagem) {
  const telefoneNormalizado = normalizarTelefoneWhatsApp(telefone);

  if (!telefoneWhatsAppValido(telefoneNormalizado)) {
    throw new Error('Telefone inválido');
  }

  const texto = encodeURIComponent(mensagem || '');

  return `https://wa.me/${telefoneNormalizado}?text=${texto}`;
}

function abrirLinkWhatsappComFallback(link) {
  // Abre somente uma nova aba.
  // Não usa fallback com window.location.href, porque isso faz a página do sistema
  // sair do dashboard e ir para o WhatsApp também.
  const novaAba = window.open(link, '_blank');

  if (novaAba) {
    novaAba.opener = null;
    return true;
  }

  alert('O navegador bloqueou a abertura do WhatsApp. Libere pop-ups para este site e tente novamente.');
  return false;
}

async function abrirWhatsappCliente(cliente) {
  if (!cliente || !cliente.nome) {
    alert('Cliente inválido.');
    return false;
  }

  const chaveCliente = normalizarNomeContato(cliente.nome);

  if (whatsappClientesEmProcessamento.has(chaveCliente)) {
    return false;
  }

  whatsappClientesEmProcessamento.add(chaveCliente);

  try {
    const contato = await buscarContatoCliente(cliente.nome);
    let contatoFinal = contato;

    if (!contatoFinal || !contatoFinal.telefone) {
      const telefoneDigitado = await abrirModalTelefone(cliente);

      if (!telefoneDigitado) {
        return false;
      }

      if (!telefoneWhatsAppValido(telefoneDigitado)) {
        alert('Telefone inválido. Informe com DDD, exemplo: 85999999999');
        return false;
      }

      // A aba do WhatsApp só pode abrir depois que o número foi informado
      // e salvo/atualizado com sucesso na planilha.
      contatoFinal = await salvarContatoCliente(cliente.nome, telefoneDigitado);
    }

    const mensagem = gerarMensagemWhatsappCliente(cliente);
    const link = gerarLinkWhatsapp(contatoFinal.telefone, mensagem);

    abrirLinkWhatsappComFallback(link);
    return true;
  } catch (error) {
    console.error('Erro ao abrir WhatsApp:', error);
    alert(`Não foi possível gerar o link do WhatsApp. ${error.message || ''}`);
    return false;
  } finally {
    whatsappClientesEmProcessamento.delete(chaveCliente);
  }
}

async function cobrarClienteAtual() {
  try {
    if (currentDetailIndex === null || currentDetailIndex < 0) {
      alert('Nenhum cliente selecionado.');
      return;
    }

    const cliente = filteredRows[currentDetailIndex];

    if (!cliente) {
      alert('Não foi possível identificar o cliente atual.');
      return;
    }

    await abrirWhatsappCliente(cliente);
  } catch (error) {
    console.error('Erro ao cobrar cliente atual:', error);
    alert('Não foi possível cobrar este cliente.');
  }
}

let clientePendenteTelefone = null;
let resolverModalTelefone = null;

function abrirModalTelefone(cliente) {
  clientePendenteTelefone = cliente;

  const overlay = document.getElementById('phone-overlay');
  const nomeEl = document.getElementById('phone-client-name');
  const input = document.getElementById('phone-input');

  if (nomeEl) {
    nomeEl.textContent = cliente?.nome || '—';
  }

  if (input) {
    input.value = '';
  }

  if (overlay) {
    overlay.classList.add('open');
  }

  setTimeout(() => {
    if (input) input.focus();
  }, 100);

  return new Promise((resolve) => {
    resolverModalTelefone = resolve;
  });
}

function fecharModalTelefone() {
  const overlay = document.getElementById('phone-overlay');

  if (overlay) {
    overlay.classList.remove('open');
  }

  if (resolverModalTelefone) {
    resolverModalTelefone(null);
  }

  clientePendenteTelefone = null;
  resolverModalTelefone = null;
}

function salvarTelefoneModal() {
  const input = document.getElementById('phone-input');
  const telefone = input ? input.value : '';

  const telefoneNormalizado = normalizarTelefoneWhatsApp(telefone);

  if (!telefoneWhatsAppValido(telefoneNormalizado)) {
    alert('Telefone inválido. Informe com DDD, exemplo: 85999999999');
    return;
  }

  const overlay = document.getElementById('phone-overlay');

  if (overlay) {
    overlay.classList.remove('open');
  }

  if (resolverModalTelefone) {
    resolverModalTelefone(telefoneNormalizado);
  }

  clientePendenteTelefone = null;
  resolverModalTelefone = null;
}
