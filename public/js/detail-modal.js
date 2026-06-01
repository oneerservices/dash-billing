// ============================================================
// detail-modal.js — Abrir, fechar e navegar o modal de detalhe
// ============================================================

let _currentDetailItens = [];

async function openDetailModal(nome, id = null) {
  const normalizarNav = s => (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (id !== null) {
    currentDetailIndex = filteredRows.findIndex(r => r.id === id);
  } else {
    const nomeNav = normalizarNav(nome);
    currentDetailIndex = filteredRows.findIndex(r => normalizarNav(r.nome) === nomeNav);
  }

  updateDetailNavButtons();
  document.getElementById('detail-nome').textContent = nome;
  document.getElementById('detail-summary').innerHTML = '';
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-loading">
      <div class="spinner"></div>
      <span>Buscando itens de ${nome}...</span>
    </div>`;
  document.getElementById('detail-overlay').classList.add('open');
  updateDetailNavButtons();
  document.body.style.overflow = 'hidden';
  const footer = document.getElementById('detail-footer');
  if (footer) footer.style.display = 'none';

  try {
    const rows = await loadDetailSheet();
    const normalizar = s => (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nomeNorm = normalizar(nome);
    const itens = rows.filter(r => {
      const clienteCell = r[COL_CLIENTE] || '';
      return normalizar(clienteCell) === nomeNorm && linhaDeveAparecer(r);
    });
    renderDetailBody(nome, itens);
  } catch (e) {
    console.error(e);
    document.getElementById('detail-body').innerHTML = `
      <div class="detail-empty">
        <div style="font-size:32px;margin-bottom:12px">⚠️</div>
        <div>Erro ao carregar detalhes.<br><span style="font-size:12px;color:var(--muted)">Tente atualizar a página.</span></div>
      </div>`;
  }
}

function updateDetailNavButtons() {
  const prevBtn = document.getElementById('detail-prev');
  const nextBtn = document.getElementById('detail-next');
  const count   = document.getElementById('detail-nav-count');

  if (!prevBtn || !nextBtn || !count) return;

  const total = filteredRows.length;
  const hasValidIndex = currentDetailIndex >= 0 && currentDetailIndex < total;

  prevBtn.disabled = !hasValidIndex || currentDetailIndex === 0;
  nextBtn.disabled = !hasValidIndex || currentDetailIndex === total - 1;
  count.textContent = hasValidIndex ? `${currentDetailIndex + 1}/${total}` : `—/${total || '—'}`;
}

function navigateDetail(direction) {
  const overlay = document.getElementById('detail-overlay');
  if (!overlay.classList.contains('open')) return;

  const total = filteredRows.length;
  if (!total || currentDetailIndex < 0) return;

  const nextIndex = currentDetailIndex + direction;
  if (nextIndex < 0 || nextIndex >= total) return;

  const nextCliente = filteredRows[nextIndex];
  openDetailModal(nextCliente.nome, nextCliente.id);
}

function closeDetailModal(e) {
  if (e && e.target !== document.getElementById('detail-overlay')) return;
  document.getElementById('detail-overlay').classList.remove('open');
  document.body.style.overflow = '';
  currentDetailIndex = -1;
  updateDetailNavButtons();
}
