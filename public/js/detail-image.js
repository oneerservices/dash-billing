// ============================================================
// detail-image.js — Geração da imagem canvas do extrato
// ============================================================

async function gerarImagem() {
  const icon = document.getElementById("imagem-icon");
  const label = document.getElementById("imagem-label");

  try {
    if (icon) icon.textContent = "⏳";
    if (label) label.textContent = "Gerando...";

    const nome =
      (document.getElementById("detail-nome")?.textContent || "").trim() ||
      "Cliente";
    const itens = Array.isArray(_currentDetailItens) ? _currentDetailItens : [];

    const rowsFonte =
      typeof baseRowsRaw !== "undefined" &&
      Array.isArray(baseRowsRaw) &&
      baseRowsRaw.length
        ? baseRowsRaw
        : detailCache || itens;

    const ultimoPagamento = getUltimoPagamentoCliente(nome, rowsFonte);

    const totalPendente = itens.reduce(
      (s, r) => s + Math.abs(parseValorBR(r[COL_PENDENTE])),
      0,
    );
    const totalRecebidoPeriodo = itens.reduce(
      (s, r) => s + Math.abs(parseValorBR(r[COL_RECEBIDO])),
      0,
    );

    const hoje = new Date();
    const periodoInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const periodoFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    // Layout mais compacto na horizontal e mais alto na vertical
    const W = 1450;
    const HEADER_H = 70;
    const SUMMARY_H = 120;
    const FILTER_H = 48;
    const TABLE_HEAD_H = 40;
    const ROW_H = 52;
    const PAD_X = 18;
    const PAD_Y = 20;
    const BASE_H =
      PAD_Y +
      HEADER_H +
      14 +
      SUMMARY_H +
      18 +
      FILTER_H +
      16 +
      TABLE_HEAD_H +
      24 +
      60;
    const H = Math.max(460, BASE_H + Math.max(1, itens.length) * ROW_H);

    // Fator de escala do canvas: 2 = nitidez máxima (tipo retina) porém
    // arquivo pesado; 1.5 mantém boa nitidez com ~44% menos pixels.
    const SCALE = 1.5;

    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;

    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);

    const C = {
      bg: "#ffffff",
      panel: "#ffffff",
      panel2: "#ffffff",
      panel3: "#f5f5f5",
      border: "#d9d9d9",
      text: "#000000",
      muted: "#000000",
      green: "#00a86b",
      greenHeader: "#ffffff",
      red: "#d90429",
      redDark: "#b10322",
      white: "#ffffff",
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

      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }

      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    function txt(t, x, y, font, color, align = "left") {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.fillText(String(t ?? ""), x, y);
      ctx.textAlign = "left";
    }

    function fitText(texto, maxW, startSize, weight = "bold") {
      let size = startSize;

      while (size > 12) {
        ctx.font = `${weight} ${size}px Arial`;

        if (ctx.measureText(String(texto || "")).width <= maxW) {
          break;
        }

        size -= 1;
      }

      return `${weight} ${size}px Arial`;
    }

    function fmtDate(d) {
      if (!d) return "—";
      return new Date(d).toLocaleDateString("pt-BR");
    }

    function parseDataBR(dataStr) {
      if (!dataStr) return null;

      if (dataStr instanceof Date && !isNaN(dataStr.getTime())) {
        return dataStr;
      }

      const s = String(dataStr).trim();

      // Formato brasileiro: dd/mm/aaaa
      let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        const [, dd, mm, yyyy] = m;
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        return isNaN(d.getTime()) ? null : d;
      }

      // Formato alternativo: yyyy-mm-dd
      m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) {
        const [, yyyy, mm, dd] = m;
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        return isNaN(d.getTime()) ? null : d;
      }

      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }

    function diasDesdeCompra(dataStr) {
      const dataCompra = parseDataBR(dataStr);

      if (!dataCompra) return "—";

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      dataCompra.setHours(0, 0, 0, 0);

      const diffMs = hoje - dataCompra;
      const dias = Math.floor(diffMs / 86400000);

      return dias >= 0 ? `${dias}d` : "0d";
    }

    // fundo
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // container principal
    rr(12, 12, W - 24, H - 24, 18, C.panel, C.border);

    // cabeçalho
    const headerY = PAD_Y;

    txt(
      "CONSULTA DE COBRANÇAS 2026",
      PAD_X + 8,
      headerY + 32,
      "bold 24px Arial",
      C.text,
    );
    txt(
      new Date().toLocaleDateString("pt-BR"),
      W - PAD_X - 8,
      headerY + 32,
      "14px Arial",
      C.muted,
      "right",
    );

    // resumo
    const y1 = headerY + HEADER_H;

    const leftCols = [255, 205, 200, 235];
    const leftTitles = [
      "PERÍODO",
      "RECEBIDOS NO PERÍODO",
      "DATA ÚLTIMO PAGAMENTO",
      "VALOR ÚLTIMO PAGAMENTO",
    ];

    const gapAfterSummary = 18;

    const totalDebtX = PAD_X + leftCols.reduce((a, b) => a + b, 0);
    const totalDebtW = W - PAD_X - totalDebtX;
    const totalDebtTop = y1;
    const totalDebtH = 155;

    // diminui um pouco horizontalmente o bloco vermelho
    const debtInsetX = 24;
    const debtBoxX = totalDebtX + debtInsetX;
    const debtBoxW = totalDebtW - debtInsetX * 2;

    let x = PAD_X;

    for (let i = 0; i < leftCols.length; i++) {
      rr(x, y1, leftCols[i], 30, 0, C.greenHeader, C.border);
      txt(
        leftTitles[i],
        x + leftCols[i] / 2,
        y1 + 20,
        "bold 12px Arial",
        C.muted,
        "center",
      );
      x += leftCols[i];
    }

    // total da dívida - bloco vermelho em destaque
    rr(debtBoxX, totalDebtTop, debtBoxW, totalDebtH, 12, C.red, C.redDark);

    // faixa superior interna
    rr(debtBoxX + 12, totalDebtTop + 12, debtBoxW - 24, 44, 9, C.redDark, null);

    txt(
      "TOTAL DA DÍVIDA",
      debtBoxX + debtBoxW / 2,
      totalDebtTop + 42,
      "bold 23px Arial",
      C.white,
      "center",
    );

    txt(
      "-" + fmtBRL(Math.abs(totalPendente)).replace("-", ""),
      debtBoxX + debtBoxW / 2,
      totalDebtTop + 122,
      "bold 52px Arial",
      C.white,
      "center",
    );

    x = PAD_X;

    const boxY = y1 + 30;
    const boxH = 70;

    rr(x, boxY, leftCols[0], boxH, 0, C.panel2, C.border);
    txt(
      fmtDate(periodoInicio),
      x + leftCols[0] / 2,
      boxY + 27,
      "bold 14px Arial",
      C.text,
      "center",
    );
    txt(
      fmtDate(periodoFim),
      x + leftCols[0] / 2,
      boxY + 54,
      "bold 14px Arial",
      C.text,
      "center",
    );
    x += leftCols[0];

    rr(x, boxY, leftCols[1], boxH, 0, C.panel2, C.border);
    txt(
      fmtBRL(totalRecebidoPeriodo),
      x + leftCols[1] / 2,
      boxY + 43,
      "bold 20px Arial",
      C.green,
      "center",
    );
    x += leftCols[1];

    rr(x, boxY, leftCols[2], boxH, 0, C.panel2, C.border);
    txt(
      ultimoPagamento?.data || "—",
      x + leftCols[2] / 2,
      boxY + 43,
      "bold 17px Arial",
      C.text,
      "center",
    );
    x += leftCols[2];

    rr(x, boxY, leftCols[3], boxH, 0, C.panel2, C.border);
    txt(
      ultimoPagamento?.valorStr || "—",
      x + leftCols[3] / 2,
      boxY + 43,
      "bold 20px Arial",
      C.green,
      "center",
    );

    // identificação do cliente
    const yFilter = boxY + boxH + gapAfterSummary;

    rr(PAD_X, yFilter, 110, FILTER_H, 0, C.greenHeader, C.border);
    txt("Cliente:", PAD_X + 55, yFilter + 30, "14px Arial", C.muted, "center");

    rr(PAD_X + 110, yFilter, 395, FILTER_H, 0, C.panel2, C.border);

    const clientFont = fitText(nome, 370, 22, "bold");
    txt(nome, PAD_X + 122, yFilter + 31, clientFont, C.text);

    // tabela
    const tableY = yFilter + FILTER_H + 18;

    rr(PAD_X, tableY, W - PAD_X * 2, TABLE_HEAD_H, 0, C.greenHeader, C.border);

    const colSpecs = [
      ["Data da Venda", 115],
      ["IMEI", 130],
      ["Produto", 285],
      ["Valor", 120],
      ["Valor Recebido", 145],
      ["Valor Pendente", 155],
      ["Vencimento Atual", 140],
      ["Dias da Compra", 120],
    ];

    x = PAD_X + 6;

    colSpecs.forEach(([labelTxt, w]) => {
      txt(labelTxt, x, tableY + 26, "bold 12px Arial", C.muted);
      x += w;
    });

    let rowY = tableY + TABLE_HEAD_H;

    if (!itens.length) {
      rr(PAD_X, rowY, W - PAD_X * 2, ROW_H, 0, C.panel2, C.border);
      txt(
        "Nenhum item em aberto.",
        PAD_X + 12,
        rowY + 32,
        "14px Arial",
        C.text,
      );
      rowY += ROW_H;
    } else {
      itens.forEach((r, idx) => {
        const bg = idx % 2 === 0 ? C.panel2 : C.panel3;

        rr(PAD_X, rowY, W - PAD_X * 2, ROW_H, 0, bg, C.border);

        const dataVenda = r[COL_DATA_VENDA] || "—";
        const imei = r[COL_IMEI] || "—";
        const produto = r[COL_PRODUTO] || "Produto";

        const valor = fmtBRL(Math.abs(parseValorBR(r[COL_VALOR])));
        const recebido = fmtBRL(Math.abs(parseValorBR(r[COL_RECEBIDO])));
        const pendente =
          "-" +
          fmtBRL(Math.abs(parseValorBR(r[COL_PENDENTE]))).replace("-", "");

        const venc =
          getVencimentoAtualLinha(r).texto || r[COL_VENCIMENTO] || "—";
        const diasCompra = diasDesdeCompra(dataVenda);

        let x2 = PAD_X + 6;

        txt(dataVenda, x2, rowY + 33, "14px Arial", C.text);
        x2 += 115;

        txt(imei, x2, rowY + 33, "14px Arial", C.text);
        x2 += 130;

        let prod = String(produto);
        ctx.font = "14px Arial";

        while (ctx.measureText(prod).width > 265 && prod.length > 1) {
          prod = prod.slice(0, -1);
        }

        if (prod !== String(produto)) {
          prod += "…";
        }

        txt(prod, x2, rowY + 33, "14px Arial", C.text);
        x2 += 285;

        txt(valor, x2, rowY + 33, "bold 14px Arial", C.text);
        x2 += 120;

        txt(recebido, x2, rowY + 33, "bold 14px Arial", C.green);
        x2 += 145;

        txt(pendente, x2, rowY + 33, "bold 14px Arial", C.red);
        x2 += 155;

        txt(venc, x2, rowY + 33, "14px Arial", C.text);
        x2 += 140;

        txt(diasCompra, x2, rowY + 33, "bold 14px Arial", C.text);

        rowY += ROW_H;
      });
    }
    // Aviso no rodapé
    ctx.font = "bold 12px Arial";
    ctx.fillStyle = "#666666";
    ctx.textAlign = "center";

    ctx.fillText(
      "Compras ou pagamentos recentes podem ainda não constar nesta imagem.",
      W / 2,
      H - 20,
    );

    ctx.textAlign = "left";
    const link = document.createElement("a");
    const dataArquivo = new Date()
      .toLocaleDateString("pt-BR")
      .replace(/\//g, "-");

    link.download = `cobranca_${nome.replace(/\s+/g, "_")}_${dataArquivo}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.85);
    link.click();

    if (icon) icon.textContent = "✅";
    if (label) label.textContent = "Imagem baixada!";

    setTimeout(() => {
      if (icon) icon.textContent = "📸";
      if (label) label.textContent = "Gerar Imagem";
    }, 2500);
  } catch (e) {
    console.error(e);

    if (icon) icon.textContent = "❌";
    if (label) label.textContent = "Erro ao gerar";

    setTimeout(() => {
      if (icon) icon.textContent = "📸";
      if (label) label.textContent = "Gerar Imagem";
    }, 2500);
  }
}