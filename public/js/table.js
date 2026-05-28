function updateStats() {
  const linhasAbertas = (baseRowsRaw || []).filter(linhaDeveAparecer);
  const resumo = calcularResumoStatus(linhasAbertas);

  const totalAberto = linhasAbertas.reduce((s, r) => s + parseValorBR(r[COL_PENDENTE]), 0);
  const clientes = new Set(linhasAbertas.map(r => normalizarTexto(r[COL_CLIENTE])).filter(Boolean));

  document.getElementById('stat-red').textContent = resumo.red.count;
  document.getElementById('stat-yellow').textContent = resumo.yellow.count;
  document.getElementById('stat-green').textContent = resumo.green.count;

  document.getElementById('stat-red-val').textContent = fmtBRL(Math.abs(resumo.red.valor));
  document.getElementById('stat-yellow-val').textContent = fmtBRL(Math.abs(resumo.yellow.valor));
  document.getElementById('stat-green-val').textContent = fmtBRL(Math.abs(resumo.green.valor));

  document.getElementById('stat-total').textContent = fmtBRL(Math.abs(totalAberto));
  document.getElementById('stat-count').textContent = `${clientes.size} clientes`;

  const totalItens = resumo.red.count + resumo.yellow.count + resumo.green.count;
  document.getElementById('count-all').textContent = totalItens;
  document.getElementById('count-red').textContent = resumo.red.count;
  document.getElementById('count-yellow').textContent = resumo.yellow.count;
  document.getElementById('count-green').textContent = resumo.green.count;
}


function renderTable(rows) {
  document.getElementById('table-loading').style.display = 'none';

  if (!rows.length) {
    document.getElementById('main-table').style.display = 'none';
    document.getElementById('empty-state').style.display = 'block';
    return;
  }

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('main-table').style.display = 'table';

  const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const statusEmoji = { red: '🔴', yellow: '🟡', green: '🟢' };
  const statusBadge = { red: 'badge-red', yellow: 'badge-yellow', green: 'badge-green' };

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = rows.map(r => `
    <tr class="${selectedIds.has(r.id) ? 'tr-selected' : ''}" onclick="toggleRow(${r.id}, event)">
      <td class="col-check"><input type="checkbox" ${selectedIds.has(r.id) ? 'checked' : ''} onchange="toggleRow(${r.id}, event)" onclick="event.stopPropagation()"></td>
      <td class="col-status"><div class="status-badge ${statusBadge[r.status]}">${statusEmoji[r.status]}</div></td>
      <td class="nome-cell">
        <span class="nome-link" onclick="event.stopPropagation(); openDetailModal('${r.nome.replace(/'/g, "\\'")}', ${r.id})" title="Ver itens de ${r.nome.replace(/"/g, '&quot;')}">
          ${r.nome}
        </span>
      </td>
      <td class="col-valor ${r.valor < 0 ? 'valor-neg' : 'valor-pos'}">${fmt(r.valor)}</td>
      <td class="col-faturas" style="color:var(--muted);font-size:12px">${r.faturas || '—'}</td>
      <td class="col-date date-cell">${formatDate(r.data)}</td>
    </tr>
  `).join('');

  filteredRows = rows;
  updateBottomBar();
}

function formatDate(d) {
  if (!d) return '—';
  const parts = d.split('/');
  if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}`;
  return d;
}

function filterTable() {
  const search = normalizarTexto(document.getElementById('search-input').value);

  filteredRows = allRows.filter(r => {
    const matchSearch = !search || normalizarTexto(r.nome).includes(search);
    let matchFilter = true;

    if (currentFilter !== 'all') {
      matchFilter = (r.itens || []).some(item => linhaTemVencimentoNoStatus(item, currentFilter));
    }

    return matchSearch && matchFilter;
  });

  if (sortCol) {
    filteredRows.sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];

      if (sortCol === 'valor') {
        va = Math.abs(Number(va) || 0);
        vb = Math.abs(Number(vb) || 0);
      }

      if (sortCol === 'data') {
        const da = parseDataBR(a.data);
        const db = parseDataBR(b.data);
        va = da ? da.getTime() : 0;
        vb = db ? db.getTime() : 0;
      }

      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
  }

  renderTable(filteredRows);
}


function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterTable();
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  filterTable();
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    if (sortCol === 'nome') return a.nome.localeCompare(b.nome) * sortDir;
    if (sortCol === 'valor') return (a.valor - b.valor) * sortDir;
    if (sortCol === 'data') return a.data.localeCompare(b.data) * sortDir;
    return 0;
  });
}

function toggleRow(id, e) {
  if (e.target.tagName === 'INPUT') return;
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderTable(filteredRows);
}

function toggleAll(cb) {
  if (cb.checked) filteredRows.forEach(r => selectedIds.add(r.id));
  else filteredRows.forEach(r => selectedIds.delete(r.id));
  renderTable(filteredRows);
}

function clearSelection() {
  selectedIds.clear();
  renderTable(filteredRows);
}

function updateBottomBar() {
  if (!loggedIn) return;
  const bar = document.getElementById('bottom-bar');
  const selected = allRows.filter(r => selectedIds.has(r.id));
  const total = selected.reduce((s, r) => s + Math.abs(r.valor), 0);
  const fmt = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  document.getElementById('selected-count').textContent = selected.length;
  document.getElementById('selected-total').textContent = fmt(total);

  if (selected.length > 0) bar.classList.add('visible');
  else bar.classList.remove('visible');
}
