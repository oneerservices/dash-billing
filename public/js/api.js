async function loadSheetData() {
  if (!validarConfiguracao()) return;

  detailCache = null;
  document.getElementById('table-loading').style.display = 'flex';
  document.getElementById('main-table').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await resp.json();
    const allData = data.values || [];

    if (!allData.length) { showEmpty(); return; }

    aplicarSchema(allData);

    // Linha 2 é cabeçalho; dados começam na linha 3.
    baseRowsRaw = allData.slice(DATA_START_ROW).filter(linhaTemCliente);
    detailCache = baseRowsRaw;

    // Só entram linhas com pendência real e que não estejam pagas.
    const linhasAbertas = baseRowsRaw.filter(linhaDeveAparecer);

    const grupos = new Map();

    linhasAbertas.forEach(r => {
      const nome = (r[COL_CLIENTE] || '').toString().trim();
      const key = normalizarTexto(nome);
      const pendente = parseValorBR(r[COL_PENDENTE]);
      const valorOriginal = parseValorBR(r[COL_VALOR]);

      if (!grupos.has(key)) {
        grupos.set(key, {
          nome,
          itens: [],
          totalPendente: 0,
          totalOriginal: 0,
          resumoStatus: null
        });
      }

      const g = grupos.get(key);
      g.itens.push(r);
      g.totalPendente += pendente;
      g.totalOriginal += valorOriginal;
    });

    allRows = Array.from(grupos.values()).map((g, idx) => {
      const status = statusPorVencimento(g.itens);
      const resumoStatus = calcularResumoStatus(g.itens);
      return {
        id: idx + 1,
        nome: g.nome,
        valor: g.totalPendente,
        faturas: g.itens.length,
        data: menorVencimentoTexto(g.itens),
        status,
        resumoStatus,
        row: g.itens[0],
        itens: g.itens
      };
    });

    allRows.sort((a, b) => {
      const ordem = { red: 0, yellow: 1, green: 2 };
      if (ordem[a.status] !== ordem[b.status]) return ordem[a.status] - ordem[b.status];
      return Math.abs(b.valor) - Math.abs(a.valor);
    });

    selectedIds.clear();
    updateStats();
    renderTable(allRows);
  } catch (e) {
    console.error(e);
    document.getElementById('table-loading').innerHTML =
      `<div style="color:var(--red)">Erro ao carregar dados. Verifique permissões, nome da aba e cabeçalho da linha 2.</div>`;
  }
}

async function loadDetailSheet() {
  if (detailCache) return detailCache;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_DETAIL)}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await resp.json();
  const allData = data.values || [];

  aplicarSchema(allData);
  baseRowsRaw = allData.slice(DATA_START_ROW).filter(linhaTemCliente);
  detailCache = baseRowsRaw;
  return detailCache;
}
