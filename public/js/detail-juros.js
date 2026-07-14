// ============================================================
// detail-juros.js — Simulação de juros por item e do valor total
// ============================================================

// -------- por item (fica escondido até clicar em "Simular Juros") --------

function renderBotaoJuros(idx, valorOriginal, dataVencimento) {
  if (!dataVencimento) return '';
  return `
    <button type="button" class="btn-simular-juros" onclick="toggleSimulacaoItem(this, ${idx})">
      🧮 Simular Juros deste item
    </button>
    <div class="juros-bloco" id="juros-item-${idx}" style="display:none"></div>`;
}

function toggleSimulacaoItem(btn, idx) {
  const bloco = document.getElementById(`juros-item-${idx}`);
  if (!bloco) return;

  const abrindo = bloco.style.display === 'none';
  if (abrindo) {
    const itens = window._currentDetailItensJuros || [];
    const r = itens[idx];
    if (!r) return;
    const vencObj = getVencimentoAtualLinha(r);
    const pendente = Math.abs(parseValorBR(r[COL_PENDENTE]));
    const juros = vencObj.data ? calcularJuros(pendente, vencObj.data) : null;
    bloco.innerHTML = renderConteudoJuros(pendente, vencObj.data, juros);
  }

  bloco.style.display = abrindo ? 'block' : 'none';
  btn.textContent = abrindo ? '🧮 Ocultar simulação de juros' : '🧮 Simular Juros deste item';
}

function renderConteudoJuros(valorOriginal, dataVencimento, juros) {
  if (!dataVencimento || !juros) return '<div class="juros-titulo">Sem data de vencimento identificada.</div>';

  const tagCarencia = juros.dentroCarencia
    ? `<span class="detail-status-mini dsm-green">Dentro da carência (${JUROS_CONFIG.carenciaDias}d) — sem juro hoje</span>`
    : `<span class="detail-status-mini dsm-red">${juros.diasComJuros}d com juro · +${fmtBRL(juros.valorJuros)}</span>`;

  return `
    <div class="juros-titulo">Simulação de juros (1% a.d., carência ${JUROS_CONFIG.carenciaDias}d)</div>
    <div class="juros-resumo-linha">
      ${tagCarencia}
      <div class="juros-valor-hoje">Se pagar hoje: <strong style="color:var(--text)">${fmtBRL(juros.valorAtualizado)}</strong></div>
    </div>
    <div class="juros-projecao-scroll">
      ${gerarProjecaoJuros(valorOriginal, dataVencimento).map(l => `
        <div class="juros-dia ${l.comJuros ? 'com-juros' : ''}">
          <div class="juros-dia-data">${l.dataStr}</div>
          <div class="juros-dia-valor">${l.valorStr}</div>
        </div>`).join('')}
    </div>`;
}

// -------- do valor total (soma de todos os itens em aberto do cliente) --------

function renderCardJurosTotal(itens) {
  const totalPendente = itens.reduce((s, r) => s + Math.abs(parseValorBR(r[COL_PENDENTE])), 0);

  // Referência: o vencimento mais antigo em aberto entre os itens do cliente.
  const vencs = itens
    .map(r => getVencimentoAtualLinha(r))
    .filter(v => v && v.data)
    .sort((a, b) => a.data - b.data);
  const vencRef = vencs.length ? vencs[0].data : null;

  if (!totalPendente || !vencRef) return '';

  return `
    <div class="detail-clean-card juros-total-card">
      <div class="juros-total-card-head">
        <div class="detail-clean-title" style="margin-bottom:0">Simular Juros do Total</div>
        <button type="button" class="btn-simular-juros juros-total-btn" onclick="toggleSimulacaoTotal(this)">
          🧮 Simular Juros do Total (${fmtBRL(totalPendente)})
        </button>
      </div>
      <div class="juros-bloco" id="juros-total" style="display:none;margin-top:10px"></div>
    </div>`;
}

function toggleSimulacaoTotal(btn) {
  const bloco = document.getElementById('juros-total');
  if (!bloco) return;

  const abrindo = bloco.style.display === 'none';
  if (abrindo) {
    const itens = window._currentDetailItensJuros || [];
    const totalPendente = itens.reduce((s, r) => s + Math.abs(parseValorBR(r[COL_PENDENTE])), 0);
    const vencs = itens
      .map(r => getVencimentoAtualLinha(r))
      .filter(v => v && v.data)
      .sort((a, b) => a.data - b.data);
    const vencRef = vencs.length ? vencs[0].data : null;
    const juros = vencRef ? calcularJuros(totalPendente, vencRef) : null;

    bloco.innerHTML = juros
      ? renderConteudoJuros(totalPendente, vencRef, juros) +
        `<div class="juros-obs">Referência: vencimento mais antigo em aberto (${vencRef.toLocaleDateString('pt-BR')}), aplicado sobre a soma de todos os itens pendentes.</div>`
      : '<div class="juros-titulo">Não há vencimento identificado para simular.</div>';
  }

  bloco.style.display = abrindo ? 'block' : 'none';
  btn.textContent = abrindo ? '🧮 Ocultar simulação do total' : `🧮 Simular Juros do Total`;
}