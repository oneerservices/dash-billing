// ============================================================
// detail-image.js — Geração da imagem canvas do extrato
// ============================================================

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

