// ============================================================
// detail-render.js — Renderiza o corpo do modal de detalhe
// ============================================================

function renderDetailBody(nome, itens) {
  const fmt = v => {
    const n = parseValorBR(v);
    return { val: n, str: fmtBRL(n) };
  };

  _currentDetailItens = itens;
  const footer = document.getElementById('detail-footer');
  if (footer) footer.style.display = itens.length ? 'block' : 'none';

  const fonteRows = baseRowsRaw.length ? baseRowsRaw : (detailCache || []);
  const ultimoPagamento = getUltimoPagamentoCliente(nome, fonteRows);

  let totalValor = 0, totalRecebido = 0, totalPendente = 0;
  itens.forEach(r => {
    totalValor += fmt(r[COL_VALOR]).val;
    totalRecebido += fmt(r[COL_RECEBIDO]).val;
    totalPendente += fmt(r[COL_PENDENTE]).val;
  });

  document.getElementById('detail-summary').innerHTML = `
    <div class="detail-kpi">
      <div class="detail-kpi-label">Pendente</div>
      <div class="detail-kpi-value" style="color:${itens.length ? 'var(--red)' : 'var(--green)'}">${fmtBRL(totalPendente)}</div>
    </div>
    <div class="detail-kpi">
      <div class="detail-kpi-label">Data último pagamento</div>
      <div class="detail-kpi-value">${ultimoPagamento.data}</div>
    </div>
    <div class="detail-kpi">
      <div class="detail-kpi-label">Valor último pagamento</div>
      <div class="detail-kpi-value" style="color:var(--green)">${ultimoPagamento.valorStr}</div>
    </div>`;

  const perfil = analisarPerfilCliente(nome, fonteRows);
  const maiorAtraso = itens.reduce((acc, r) => Math.max(acc, calcularDiasAtrasoLinha(r)), 0);

  const sidebar = `
    <aside class="detail-side-clean">
      ${renderPerfilCliente(nome)}

      <div class="detail-clean-card">
        <div class="detail-clean-title">Resumo</div>
        <div class="detail-clean-grid">
          <div class="detail-clean-stat">
            <div class="detail-clean-label">Itens</div>
            <div class="detail-clean-value">${itens.length}</div>
          </div>
          <div class="detail-clean-stat">
            <div class="detail-clean-label">Maior atraso</div>
            <div class="detail-clean-value">${maiorAtraso}d</div>
          </div>
          <div class="detail-clean-stat">
            <div class="detail-clean-label">Recebido</div>
            <div class="detail-clean-value" style="color:var(--green)">${fmtBRL(totalRecebido)}</div>
          </div>
          <div class="detail-clean-stat">
            <div class="detail-clean-label">Pendente</div>
            <div class="detail-clean-value" style="color:var(--red)">${fmtBRL(totalPendente)}</div>
          </div>
        </div>
      </div>
    </aside>`;

  if (!itens.length) {
    document.getElementById('detail-body').innerHTML = `
      <div class="detail-layout-clean">
        ${sidebar}
        <section class="detail-main-clean">
          <div class="detail-empty-limpo">
            <div style="font-size:32px;margin-bottom:12px">📭</div>
            <div style="color:var(--text);font-family:var(--font-head);font-weight:700;margin-bottom:6px">Nenhuma cobrança em aberto</div>
            <div>Linhas pagas ou com pendente zerado ficam ocultas.</div>
          </div>
        </section>
      </div>`;
    return;
  }

  const getStatusClass = raw => {
    const s = normalizarTexto(raw);
    if (s.includes('vencid') || s.includes('atraso') || s.includes('pendente')) return 'dsm-red';
    if (s.includes('proxim') || s.includes('parcial')) return 'dsm-yellow';
    return 'dsm-green';
  };

  const getStatusLabel = raw => {
    const s = (raw || '').toString().trim();
    return s || 'Pendente';
  };

  window._currentDetailItensJuros = itens;

  const itemsHTML = itens.map((r, idx) => {
    const produto = r[COL_PRODUTO] || '—';
    const imei = r[COL_IMEI] || '—';
    const dataVenda = r[COL_DATA_VENDA] || '—';
    const valorStr = fmt(r[COL_VALOR]).str;
    const recebidoStr = fmt(r[COL_RECEBIDO]).str;
    const pendenteVal = fmt(r[COL_PENDENTE]).val;
    const pendenteStr = fmt(r[COL_PENDENTE]).str;
    const statusRaw = r[COL_STATUS] || 'Pendente';
    const vencObj = getVencimentoAtualLinha(r);
    const vencimento = (vencObj.texto || r[COL_VENCIMENTO] || '—');
    const atraso = calcularDiasAtrasoLinha(r);
    const statusClass = getStatusClass(statusRaw);
    const statusLabel = getStatusLabel(statusRaw);

    const jurosHTML = renderBotaoJuros(idx, pendenteVal, vencObj.data);

    return `
      <div class="detail-item">
        <div class="detail-produto">${produto}</div>
        <div class="detail-valor-pend" style="color:var(--red)">${pendenteStr}</div>
        <div class="detail-item-meta">
          <div class="detail-meta-chip">Venda: <strong>${dataVenda}</strong></div>
          <div class="detail-meta-chip">Venc: <strong>${vencimento}</strong></div>
          <div class="detail-meta-chip">IMEI: <strong>${imei}</strong></div>
          <div class="detail-meta-chip">Valor: <strong>${valorStr}</strong></div>
          <div class="detail-meta-chip">Recebido: <strong style="color:var(--green)">${recebidoStr}</strong></div>
          <div class="detail-meta-chip">Atraso: <strong>${atraso}d</strong></div>
          <span class="detail-status-mini ${statusClass}">${statusLabel}</span>
        </div>
        ${jurosHTML}
      </div>`;
  }).join('');

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-layout-clean">
      ${sidebar}

      <section class="detail-main-clean">
        ${renderCardJurosTotal(itens)}

        <div class="detail-main-clean-head">
          <div class="detail-section-title" style="margin-bottom:0">Itens em aberto</div>
          <div class="detail-count-pill">${itens.length} item(ns)</div>
        </div>
        ${itemsHTML}
      </section>
    </div>`;
}