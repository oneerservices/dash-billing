// ============================================================
// detail-perfil.js — Render do card de perfil e mensagem de cobrança
// ============================================================

function togglePerfilDetalhes(btn) {
  const card = btn.closest('.perfil-card');
  if (!card) return;

  const expanded = card.classList.toggle('expanded');
  const label = btn.querySelector('.toggle-label');
  const icon = btn.querySelector('.toggle-icon');

  if (label) label.textContent = expanded ? 'Ocultar detalhe da análise' : 'Ver detalhe da análise';
  if (icon) icon.textContent = expanded ? '⌃' : '⌄';
}

function renderPerfilCliente(nome) {
  const perfil = analisarPerfilCliente(nome, baseRowsRaw.length ? baseRowsRaw : (detailCache || []));
  const pct = Math.round((perfil.percentualPago || 0) * 100);
  const scoreColor = perfil.classe === 'pa' ? 'var(--green)' : perfil.classe === 'pb' ? 'var(--yellow)' : perfil.classe === 'pe' ? '#a855f7' : 'var(--red)';

  return `
    <div class="perfil-card" style="--score-width:${perfil.score}%;--score-color:${scoreColor}">
      <div class="perfil-badge ${perfil.classe}">${perfil.perfil}</div>
      <div>
        <div class="perfil-title">${perfil.label} · ${perfil.score}/100</div>
        <div class="perfil-desc">${perfil.descricao}</div>
      </div>

      <div class="perfil-score-line">
        <div class="perfil-score-fill"></div>
      </div>

      <button type="button" class="perfil-details-toggle" onclick="togglePerfilDetalhes(this)">
        <span class="toggle-label">Detalhe da análise</span>
        <span class="toggle-icon">⌄</span>
      </button>

      <div class="perfil-details">
        <div class="perfil-metrics">
          <div class="perfil-metric">
            <div class="perfil-metric-label">Compras</div>
            <div class="perfil-metric-value">${perfil.qtdCompras}</div>
          </div>
          <div class="perfil-metric">
            <div class="perfil-metric-label">Pendências</div>
            <div class="perfil-metric-value">${perfil.qtdPendencias}</div>
          </div>
          <div class="perfil-metric">
            <div class="perfil-metric-label">Pago</div>
            <div class="perfil-metric-value">${pct}%</div>
          </div>
          <div class="perfil-metric">
            <div class="perfil-metric-label">Atraso</div>
            <div class="perfil-metric-value">${perfil.maiorAtraso}d</div>
          </div>
          <div class="perfil-metric">
            <div class="perfil-metric-label">Sem pagar</div>
            <div class="perfil-metric-value">${perfil.diasSemPagar === 9999 ? '—' : perfil.diasSemPagar + 'd'}</div>
          </div>
          <div class="perfil-metric">
            <div class="perfil-metric-label">Pgto 30d</div>
            <div class="perfil-metric-value">${perfil.pagamentos30d}/${perfil.meta30d}</div>
          </div>
        </div>
      </div>
    </div>`;
}


function gerarMensagemPorPerfil(nome, itens, perfil) {
  const totalPendente = itens.reduce((s, r) => s + Math.abs(parseValorBR(r[COL_PENDENTE])), 0);
  const ultimoPagamento = perfil.ultimoPagamento || getUltimoPagamentoCliente(nome, baseRowsRaw.length ? baseRowsRaw : (detailCache || itens));

  const itensTexto = itens.map((r, idx) => {
    const produto = r[COL_PRODUTO] || 'Produto';
    const imei = r[COL_IMEI] || '—';
    const venc = (getVencimentoAtualLinha(r).texto || r[COL_VENCIMENTO] || '—');
    const pendente = Math.abs(parseValorBR(r[COL_PENDENTE]));
    return `${idx + 1}. ${produto}
IMEI: ${imei}
Vencimento: ${venc}
Pendente: ${fmtBRL(pendente)}`;
  }).join('\n\n');

  const ultimaMovimentacao = (ultimoPagamento && ultimoPagamento.data && ultimoPagamento.data !== '—')
    ? `Último pagamento identificado: ${ultimoPagamento.data} - ${ultimoPagamento.valorStr || fmtBRL(0)}.`
    : '';

  const blocoItens = itensTexto ? `\n\nItens em aberto:\n${itensTexto}` : '';

  if (perfil.perfil === 'A') {
    return `Olá, ${nome}. Tudo bem?

Passando para alinhar o valor em aberto de ${fmtBRL(totalPendente)}.${blocoItens}

${ultimaMovimentacao}

Consegue me informar uma previsão para regularização?`;
  }

  if (perfil.perfil === 'EX') {
    return `Olá, ${nome}. Tudo bem?

Existe um valor em aberto de ${fmtBRL(totalPendente)} e queria alinhar isso com você.${blocoItens}

${ultimaMovimentacao}

Consegue me passar uma previsão para continuarmos a regularização?`;
  }

  if (perfil.perfil === 'C') {
    return `Olá, ${nome}. Tudo bem?

Consta um valor em aberto de ${fmtBRL(totalPendente)}.${blocoItens}

${ultimaMovimentacao}

Preciso que você me informe uma previsão para regularização.`;
  }

  return `Olá, ${nome}. Tudo bem?

Consta em aberto o valor de ${fmtBRL(totalPendente)}.${blocoItens}

${ultimaMovimentacao}

Consegue me confirmar uma previsão de pagamento?`;
}


function copiarMensagem() {
  const nome = document.getElementById('detail-nome').textContent;
  const itens = _currentDetailItens || [];
  const perfil = analisarPerfilCliente(nome, baseRowsRaw.length ? baseRowsRaw : (detailCache || itens));
  const msg = gerarMensagemPorPerfil(nome, itens, perfil);

  navigator.clipboard.writeText(msg).then(() => {
    const btn = document.getElementById('btn-copiar');
    const icon = document.getElementById('copiar-icon');
    const label = document.getElementById('copiar-label');

    btn.classList.add('copiado');
    icon.textContent = '✅';
    label.textContent = `Texto ${perfil.perfil} copiado!`;

    setTimeout(() => {
      btn.classList.remove('copiado');
      icon.textContent = '📋';
      label.textContent = 'Copiar Texto';
    }, 1800);
  }).catch(() => {
    alert(msg);
  });
}

