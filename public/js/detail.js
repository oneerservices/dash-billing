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

  const itemsHTML = itens.map(r => {
    const produto = r[COL_PRODUTO] || '—';
    const imei = r[COL_IMEI] || '—';
    const dataVenda = r[COL_DATA_VENDA] || '—';
    const valorStr = fmt(r[COL_VALOR]).str;
    const recebidoStr = fmt(r[COL_RECEBIDO]).str;
    const pendenteStr = fmt(r[COL_PENDENTE]).str;
    const statusRaw = r[COL_STATUS] || 'Pendente';
    const vencimento = (getVencimentoAtualLinha(r).texto || r[COL_VENCIMENTO] || '—');
    const atraso = calcularDiasAtrasoLinha(r);
    const statusClass = getStatusClass(statusRaw);
    const statusLabel = getStatusLabel(statusRaw);

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
      </div>`;
  }).join('');

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-layout-clean">
      ${sidebar}

      <section class="detail-main-clean">
        <div class="detail-main-clean-head">
          <div class="detail-section-title" style="margin-bottom:0">Itens em aberto</div>
          <div class="detail-count-pill">${itens.length} item(ns)</div>
        </div>
        ${itemsHTML}
      </section>
    </div>`;
}


async function gerarImagem() {
  const icon  = document.getElementById('imagem-icon');
  const label = document.getElementById('imagem-label');

  try {
    if (icon) icon.textContent = '⏳';
    if (label) label.textContent = 'Gerando...';

    const nome = (document.getElementById('detail-nome')?.textContent || '').trim() || 'Cliente';
    const itens = Array.isArray(_currentDetailItens) ? _currentDetailItens : [];
    const rowsFonte = baseRowsRaw.length ? baseRowsRaw : (detailCache || itens);
    const ultimoPagamento = getUltimoPagamentoCliente(nome, rowsFonte);

    const totalPendente = itens.reduce((s, r) => s + Math.abs(parseValorBR(r[COL_PENDENTE])), 0);
    const totalRecebidoPeriodo = itens.reduce((s, r) => s + Math.abs(parseValorBR(r[COL_RECEBIDO])), 0);

    const hoje = new Date();
    const periodoInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const periodoFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const W = 1600;
    const HEADER_H = 64;
    const SUMMARY_H = 112;
    const FILTER_H = 42;
    const TABLE_HEAD_H = 32;
    const ROW_H = 38;
    const PAD_X = 26;
    const PAD_Y = 20;
    const BASE_H = PAD_Y + HEADER_H + 14 + SUMMARY_H + 18 + FILTER_H + 16 + TABLE_HEAD_H + 24 + 22;
    const H = Math.max(430, BASE_H + Math.max(1, itens.length) * ROW_H);

    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    const C = {
      bg: '#060915',
      panel: '#0b1020',
      panel2: '#12182b',
      panel3: '#161d31',
      border: '#252d49',
      text: '#f5f7ff',
      muted: '#7c86ac',
      green: '#00e5a0',
      greenHeader: '#0d1428',
      red: '#ff4d78',
      white: '#ffffff'
    };

    function rr(x, y, w, h, r, fill, stroke) {
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
      } else {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
      }
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }

    function txt(t, x, y, font, color, align='left') {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(String(t ?? ''), x, y);
      ctx.textAlign = 'left';
    }

    function fitText(texto, maxW, startSize, weight='bold') {
      let size = startSize;
      while (size > 12) {
        ctx.font = `${weight} ${size}px Arial`;
        if (ctx.measureText(String(texto || '')).width <= maxW) break;
        size -= 1;
      }
      return `${weight} ${size}px Arial`;
    }

    function fmtDate(d) {
      if (!d) return '—';
      return new Date(d).toLocaleDateString('pt-BR');
    }

    // fundo
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // container principal
    rr(16, 16, W - 32, H - 32, 22, C.panel, C.border);

    // cabeçalho limpo
    const headerY = PAD_Y;
    txt('CONSULTA DE COBRANÇAS 2026', PAD_X + 12, headerY + 30, 'bold 22px Arial', C.text);
    txt(new Date().toLocaleDateString('pt-BR'), W - PAD_X - 12, headerY + 30, '13px Arial', C.muted, 'right');

    // bloco de resumo
    const y1 = headerY + HEADER_H;
    const leftCols = [280, 220, 210, 260];
    const leftTitles = ['PERÍODO', 'RECEBIDOS NO PERÍODO', 'DATA ÚLTIMO PAGAMENTO', 'VALOR ÚLTIMO PAGAMENTO'];
    const gapAfterSummary = 18;

    const totalDebtX = PAD_X + leftCols.reduce((a, b) => a + b, 0);
    const totalDebtW = W - PAD_X - totalDebtX;
    const totalDebtTop = y1;
    const totalDebtH = 28 + 64 + gapAfterSummary + FILTER_H; // ocupa também a faixa abaixo do resumo

    let x = PAD_X;
    for (let i = 0; i < leftCols.length; i++) {
      rr(x, y1, leftCols[i], 28, 0, C.greenHeader, C.border);
      txt(leftTitles[i], x + leftCols[i] / 2, y1 + 19, 'bold 11px Arial', C.muted, 'center');
      x += leftCols[i];
    }

    // cartão expandido do total da dívida
    rr(totalDebtX, totalDebtTop, totalDebtW, totalDebtH, 0, C.panel2, C.border);
    rr(totalDebtX, totalDebtTop, totalDebtW, 28, 0, C.red, C.border);
    txt('TOTAL DA DÍVIDA', totalDebtX + totalDebtW / 2, totalDebtTop + 19, 'bold 12px Arial', C.white, 'center');
    txt('-' + fmtBRL(Math.abs(totalPendente)).replace('-', ''), totalDebtX + totalDebtW / 2, totalDebtTop + 90, 'bold 33px Arial', C.red, 'center');

    x = PAD_X;
    const boxY = y1 + 28;
    const boxH = 64;

    rr(x, boxY, leftCols[0], boxH, 0, C.panel2, C.border);
    txt(fmtDate(periodoInicio), x + 140, boxY + 24, 'bold 13px Arial', C.text, 'center');
    txt(fmtDate(periodoFim), x + 140, boxY + 49, 'bold 13px Arial', C.text, 'center');
    x += leftCols[0];

    rr(x, boxY, leftCols[1], boxH, 0, C.panel2, C.border);
    txt(fmtBRL(totalRecebidoPeriodo), x + leftCols[1] / 2, boxY + 39, 'bold 19px Arial', C.green, 'center');
    x += leftCols[1];

    rr(x, boxY, leftCols[2], boxH, 0, C.panel2, C.border);
    txt(ultimoPagamento?.data || '—', x + leftCols[2] / 2, boxY + 39, 'bold 16px Arial', C.text, 'center');
    x += leftCols[2];

    rr(x, boxY, leftCols[3], boxH, 0, C.panel2, C.border);
    txt(ultimoPagamento?.valorStr || '—', x + leftCols[3] / 2, boxY + 39, 'bold 19px Arial', C.green, 'center');

    // identificação: apenas cliente (sem status)
    const yFilter = boxY + boxH + gapAfterSummary;
    rr(PAD_X, yFilter, 120, FILTER_H, 0, C.greenHeader, C.border);
    txt('Cliente:', PAD_X + 60, yFilter + 26, '13px Arial', C.muted, 'center');

    rr(PAD_X + 120, yFilter, 430, FILTER_H, 0, C.panel2, C.border);
    const clientFont = fitText(nome, 400, 20, 'bold');
    txt(nome, PAD_X + 132, yFilter + 28, clientFont, C.text);

    // tabela
    const tableY = yFilter + FILTER_H + 18;
    rr(PAD_X, tableY, W - PAD_X * 2, TABLE_HEAD_H, 0, C.greenHeader, C.border);

    const colSpecs = [
      ['Data da Venda', 145],
      ['IMEI', 155],
      ['Produto', 420],
      ['Valor', 160],
      ['Valor Recebido', 180],
      ['Valor Pendente', 190],
      ['Vencimento Atual', 170]
    ];

    x = PAD_X + 10;
    colSpecs.forEach(([labelTxt, w]) => {
      txt(labelTxt, x, tableY + 21, 'bold 11px Arial', C.muted);
      x += w;
    });

    let rowY = tableY + TABLE_HEAD_H;
    if (!itens.length) {
      rr(PAD_X, rowY, W - PAD_X * 2, ROW_H, 0, C.panel2, C.border);
      txt('Nenhum item em aberto.', PAD_X + 14, rowY + 24, '13px Arial', C.text);
      rowY += ROW_H;
    } else {
      itens.forEach((r, idx) => {
        const bg = idx % 2 === 0 ? C.panel2 : C.panel3;
        rr(PAD_X, rowY, W - PAD_X * 2, ROW_H, 0, bg, C.border);

        const dataVenda = r[COL_DATA_VENDA] || '—';
        const imei = r[COL_IMEI] || '—';
        const produto = r[COL_PRODUTO] || 'Produto';
        const valor = fmtBRL(Math.abs(parseValorBR(r[COL_VALOR])));
        const recebido = fmtBRL(Math.abs(parseValorBR(r[COL_RECEBIDO])));
        const pendente = '-' + fmtBRL(Math.abs(parseValorBR(r[COL_PENDENTE]))).replace('-', '');
        const venc = (getVencimentoAtualLinha(r).texto || r[COL_VENCIMENTO] || '—');

        let x2 = PAD_X + 10;
        txt(dataVenda, x2, rowY + 24, '13px Arial', C.text); x2 += 145;
        txt(imei, x2, rowY + 24, '13px Arial', C.text); x2 += 155;

        let prod = String(produto);
        ctx.font = '13px Arial';
        while (ctx.measureText(prod).width > 390 && prod.length > 1) prod = prod.slice(0, -1);
        if (prod !== String(produto)) prod += '…';
        txt(prod, x2, rowY + 24, '13px Arial', C.text); x2 += 420;

        txt(valor, x2, rowY + 24, '13px Arial', C.text); x2 += 160;
        txt(recebido, x2, rowY + 24, '13px Arial', C.green); x2 += 180;
        txt(pendente, x2, rowY + 24, '13px Arial', C.red); x2 += 190;
        txt(venc, x2, rowY + 24, '13px Arial', C.text);

        rowY += ROW_H;
      });
    }

    const link = document.createElement('a');
    const dataArquivo = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    link.download = `cobranca_${nome.replace(/\s+/g, '_')}_${dataArquivo}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    if (icon) icon.textContent = '✅';
    if (label) label.textContent = 'Imagem baixada!';
    setTimeout(() => {
      if (icon) icon.textContent = '📸';
      if (label) label.textContent = 'Gerar Imagem';
    }, 2500);
  } catch (e) {
    console.error(e);
    if (icon) icon.textContent = '❌';
    if (label) label.textContent = 'Erro ao gerar';
    setTimeout(() => {
      if (icon) icon.textContent = '📸';
      if (label) label.textContent = 'Gerar Imagem';
    }, 2500);
  }
}


function calcularDiasAtrasoLinha(r) {
  const vencAtual = getVencimentoAtualLinha(r);
  if (!vencAtual || !vencAtual.data) return 0;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const venc = new Date(vencAtual.data);
  venc.setHours(0, 0, 0, 0);

  const dias = Math.floor((hoje - venc) / 86400000);
  return dias > 0 ? dias : 0;
}


function getPagamentosCliente(nome, rows = baseRowsRaw) {
  const nomeNorm = normalizarTexto(nome);
  const pagamentos = [];

  (rows || [])
    .filter(r => normalizarTexto(r[COL_CLIENTE]) === nomeNorm)
    .forEach(r => {
      paymentPairs.forEach(pair => {
        const valor = parseValorBR(r[pair.pagamentoCol]);
        const data = parseDataBR(r[pair.vencimentoCol]);
        if (valor > 0 && data) {
          pagamentos.push({
            data,
            dataTexto: r[pair.vencimentoCol],
            valor,
            parcela: pair.numero
          });
        }
      });

      if (!paymentPairs.length) {
        const valor = parseValorBR(r[COL_RECEBIDO]);
        const data = parseDataBR(r[COL_VENCIMENTO]);
        if (valor > 0 && data) {
          pagamentos.push({ data, dataTexto: r[COL_VENCIMENTO], valor, parcela: 1 });
        }
      }
    });

  return pagamentos.sort((a, b) => b.data - a.data);
}

function diasEntreDatas(dataAntiga, dataNova = new Date()) {
  if (!dataAntiga) return 9999;
  const a = new Date(dataAntiga);
  const b = new Date(dataNova);
  a.setHours(0,0,0,0);
  b.setHours(0,0,0,0);
  return Math.max(0, Math.floor((b - a) / 86400000));
}

function filtrarPagamentosPorDias(pagamentos, dias) {
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  return (pagamentos || []).filter(p => p.data && diasEntreDatas(p.data, hoje) <= dias);
}


function getMetaPagamentoPorDivida(valorPendente) {
  const valor = Math.abs(Number(valorPendente) || 0);

  // Meta mensal por tamanho da dívida.
  // A partir de 15k, a exigência aumenta mais forte.
  if (valor >= 50000) {
    return { meta30d: 40, meta15d: 20, faixa: '+50k' };
  }

  if (valor >= 40000) {
    return { meta30d: 34, meta15d: 17, faixa: '+40k' };
  }

  if (valor >= 30000) {
    return { meta30d: 28, meta15d: 14, faixa: '+30k' };
  }

  if (valor >= 20000) {
    return { meta30d: 22, meta15d: 11, faixa: '+20k' };
  }

  if (valor >= 15000) {
    return { meta30d: 16, meta15d: 8, faixa: '+15k' };
  }

  if (valor >= 10000) {
    return { meta30d: 10, meta15d: 5, faixa: '+10k' };
  }

  if (valor >= 5000) {
    return { meta30d: 5, meta15d: 3, faixa: '+5k' };
  }

  return { meta30d: 3, meta15d: 2, faixa: 'até 5k' };
}


function analisarPerfilCliente(nome, rows = baseRowsRaw) {
  const nomeNorm = normalizarTexto(nome);
  const historico = (rows || []).filter(r => normalizarTexto(r[COL_CLIENTE]) === nomeNorm);
  const abertos = historico.filter(linhaDeveAparecer);

  const totalComprado = historico.reduce((s, r) => s + Math.abs(parseValorBR(r[COL_VALOR])), 0);
  const totalRecebido = historico.reduce((s, r) => s + Math.abs(parseValorBR(r[COL_RECEBIDO])), 0);
  const totalPendente = abertos.reduce((s, r) => s + Math.abs(parseValorBR(r[COL_PENDENTE])), 0);

  const qtdCompras = historico.length;
  const qtdPendencias = abertos.length;
  const percentualPago = totalComprado > 0 ? totalRecebido / totalComprado : 0;
  const maiorAtraso = abertos.reduce((max, r) => Math.max(max, calcularDiasAtrasoLinha(r)), 0);
  const ultimoPagamento = getUltimoPagamentoCliente(nome, rows || []);

  const pagamentos = getPagamentosCliente(nome, rows || []);
  const pagamentosRealizados = pagamentos.length;
  const pagamentos3d = filtrarPagamentosPorDias(pagamentos, 3);
  const pagamentos7d = filtrarPagamentosPorDias(pagamentos, 7);
  const pagamentos15d = filtrarPagamentosPorDias(pagamentos, 15);
  const pagamentos30d = filtrarPagamentosPorDias(pagamentos, 30);
  const valorPago30d = pagamentos30d.reduce((s, p) => s + p.valor, 0);
  const diasSemPagar = pagamentos.length ? diasEntreDatas(pagamentos[0].data) : 9999;

  // Regra comercial por tamanho da dívida.
  // Exige mais pagamentos mensais conforme a dívida cresce.
  const metaDivida = getMetaPagamentoPorDivida(totalPendente);
  const meta30d = metaDivida.meta30d;
  const meta15d = metaDivida.meta15d;
  const faixaDivida = metaDivida.faixa;

  const pagouRecentemente = diasSemPagar <= 3;
  const bateuMeta15d = pagamentos15d.length >= meta15d;
  const bateuMeta30d = pagamentos30d.length >= meta30d;
  const superouMetaMes = pagamentos30d.length >= Math.ceil(meta30d * 1.5);
  const excelenteHistorico = percentualPago >= 0.90 && qtdCompras >= 5;
  const bomHistorico = percentualPago >= 0.75 && qtdCompras >= 3;
  const amortizouBem30d = totalPendente > 0 && valorPago30d >= Math.min(totalPendente * 0.25, 1000);

  const frequenciaForte = bateuMeta30d || superouMetaMes || bateuMeta15d;
  const frequenciaMedia = pagamentos30d.length >= Math.max(2, Math.ceil(meta30d * 0.5)) || pagamentos15d.length >= Math.max(1, Math.ceil(meta15d * 0.5));
  const atrasoMuitoAntigo = maiorAtraso >= 60;
  const atrasoCritico = maiorAtraso >= 120;

  let score = 100;
  const motivos = [];

  // 1) Movimento recente ajuda, mas não resolve sozinho.
  if (pagouRecentemente) {
    score += 8;
    motivos.push('pagou nos últimos 3 dias: +8');
  } else if (diasSemPagar <= 7) {
    score += 5;
    motivos.push('pagou nos últimos 7 dias: +5');
  } else if (diasSemPagar <= 15) {
    score -= 10;
    motivos.push(`${diasSemPagar} dias sem pagar: -10`);
  } else {
    score -= 35;
    motivos.push(`${diasSemPagar === 9999 ? 'sem histórico' : diasSemPagar + ' dias'} sem pagar: -35`);
  }

  // 2) Frequência exigida conforme valor da dívida.
  if (superouMetaMes) {
    score += 30;
    motivos.push(`freq. mês ${pagamentos30d.length}/${meta30d}: +30`);
  } else if (bateuMeta30d) {
    score += 24;
    motivos.push(`freq. mês ${pagamentos30d.length}/${meta30d}: +24`);
  } else if (bateuMeta15d) {
    score += 14;
    motivos.push(`freq. 15d ${pagamentos15d.length}/${meta15d}: +14`);
  } else if (frequenciaMedia) {
    score += 6;
    motivos.push(`freq. parcial ${pagamentos30d.length}/${meta30d}: +6`);
  } else if (qtdPendencias > 0) {
    const descFreq = Math.min(25, Math.max(1, meta30d - pagamentos30d.length) * 5);
    score -= descFreq;
    motivos.push(`baixa freq. mês ${pagamentos30d.length}/${meta30d}: -${descFreq}`);
  }

  // Penalidade extra se a dívida não bateu a meta da faixa.
  if (totalPendente >= 5000 && pagamentos30d.length < meta30d) {
    const faltam = meta30d - pagamentos30d.length;
    const desc = Math.min(35, faltam * 3);
    score -= desc;
    motivos.push(`${faixaDivida} exige ${meta30d} pgto/mês: -${desc}`);
  }

  if (amortizouBem30d) {
    score += 10;
    motivos.push(`amortizou ${fmtBRL(valorPago30d)} em 30d: +10`);
  }

  // 3) Atraso pesa, mas pode ser reduzido se a frequência está compatível com a dívida.
  if (maiorAtraso > 0) {
    let descAtraso = Math.min(45, Math.round((Math.min(maiorAtraso, 120) / 120) * 45));

    if (frequenciaForte && excelenteHistorico) {
      descAtraso = Math.round(descAtraso * 0.30);
      motivos.push(`${maiorAtraso} dias atraso, freq. adequada: -${descAtraso}`);
    } else if (pagouRecentemente && frequenciaMedia) {
      descAtraso = Math.round(descAtraso * 0.65);
      motivos.push(`${maiorAtraso} dias atraso, freq. parcial: -${descAtraso}`);
    } else {
      motivos.push(`${maiorAtraso} dias atraso: -${descAtraso}`);
    }

    score -= descAtraso;
  }

  // 4) Pendências e valor
  if (qtdPendencias > 0) {
    let descPend = Math.min(18, qtdPendencias * 3);

    if (excelenteHistorico && frequenciaForte) {
      descPend = Math.round(descPend * 0.45);
      motivos.push(`${qtdPendencias} pendência(s), freq. adequada: -${descPend}`);
    } else {
      motivos.push(`${qtdPendencias} pendência(s): -${descPend}`);
    }

    score -= descPend;
  }

  if (totalPendente >= 10000) {
    const descValor = excelenteHistorico && frequenciaForte ? 8 : 18;
    score -= descValor;
    motivos.push(`valor muito alto: -${descValor}`);
  } else if (totalPendente >= 5000) {
    const descValor = excelenteHistorico && frequenciaForte ? 6 : 14;
    score -= descValor;
    motivos.push(`valor alto +5k: -${descValor}`);
  } else if (totalPendente >= 3000) {
    const descValor = excelenteHistorico && frequenciaForte ? 5 : 12;
    score -= descValor;
    motivos.push(`valor alto: -${descValor}`);
  } else if (totalPendente >= 1500) {
    score -= 6;
    motivos.push(`valor médio: -6`);
  } else if (totalPendente > 0) {
    score -= 3;
    motivos.push(`valor baixo: -3`);
  }

  if (excelenteHistorico) {
    score += 12;
    motivos.push(`histórico pago ${Math.round(percentualPago * 100)}%: +12`);
  } else if (bomHistorico) {
    score += 7;
    motivos.push(`histórico pago ${Math.round(percentualPago * 100)}%: +7`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const pagadorAtivoForte = excelenteHistorico && pagouRecentemente && frequenciaForte;
  const bomComPendencia = (bomHistorico || excelenteHistorico) && pagouRecentemente && (frequenciaMedia || amortizouBem30d);
  const ativoFraco = pagouRecentemente && !frequenciaMedia && !frequenciaForte;

  // Proteções agora respeitam a meta por valor:
  // Para ser A, precisa bater a frequência mínima exigida pelo tamanho da dívida.
  if (pagadorAtivoForte) {
    score = Math.max(score, 85);
  } else if (bomComPendencia && !atrasoCritico) {
    score = Math.max(score, 65);
  } else if (ativoFraco && atrasoMuitoAntigo) {
    score = Math.min(score, 54);
  }

  let perfil = 'B';
  let label = 'Atenção';
  let classe = 'pb';
  let tom = 'objetivo';
  let descricao = 'Tem pendência e precisa de uma previsão clara de quitação.';

  if (totalPendente <= 0.005 || qtdPendencias === 0) {
    perfil = 'A';
    label = 'Bom pagador';
    classe = 'pa';
    tom = 'relacional';
    descricao = 'Sem pendência aberta no momento.';
    score = 100;
  } else if (pagadorAtivoForte) {
    perfil = 'A';
    label = 'Pagador ativo';
    classe = 'pa';
    tom = 'leve';
    descricao = 'Cliente com histórico forte e frequência compatível com o tamanho da dívida.';
  } else if (bomComPendencia && !atrasoCritico) {
    perfil = 'EX';
    label = 'Bom com pendência';
    classe = 'pe';
    tom = 'cuidadoso';
    descricao = 'Tem pendência, mas vem pagando. Cobrança cuidadosa para manter o acordo.';
  } else if (ativoFraco && atrasoMuitoAntigo) {
    perfil = 'B';
    label = 'Atenção';
    classe = 'pb';
    tom = 'objetivo';
    descricao = 'Pagou recentemente, mas a frequência ainda é baixa para o tamanho/idade da dívida.';
  } else if (score >= 80) {
    perfil = 'A';
    label = 'Bom pagador';
    classe = 'pa';
    tom = 'leve';
    descricao = 'Baixo risco, cobrança leve.';
  } else if (score >= 55) {
    perfil = 'B';
    label = 'Atenção';
    classe = 'pb';
    tom = 'objetivo';
    descricao = 'Risco moderado. Cobrança objetiva com pedido de previsão.';
  } else {
    perfil = 'C';
    label = 'Risco alto';
    classe = 'pc';
    tom = 'firme';
    descricao = 'Atraso antigo, baixa frequência para o valor da dívida ou valor/pendências altos.';
  }

  return {
    perfil,
    label,
    classe,
    tom,
    descricao,
    score,
    totalComprado,
    totalRecebido,
    totalPendente,
    qtdCompras,
    qtdPendencias,
    percentualPago,
    maiorAtraso,
    ultimoPagamento,
    pagamentosRealizados,
    diasSemPagar,
    pagamentos3d: pagamentos3d.length,
    pagamentos7d: pagamentos7d.length,
    pagamentos15d: pagamentos15d.length,
    pagamentos30d: pagamentos30d.length,
    valorPago30d,
    meta15d,
    meta30d,
    faixaDivida,
    pagadorAtivoForte,
    bomComPendencia,
    ativoFraco,
    frequenciaForte,
    frequenciaMedia,
    excelenteHistorico,
    bomHistorico,
    motivos
  };
}



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


function updateDetailNavButtons() {
  const prevBtn = document.getElementById('detail-prev');
  const nextBtn = document.getElementById('detail-next');
  const count = document.getElementById('detail-nav-count');

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
