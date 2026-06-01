// ============================================================
// detail-analytics.js — Cálculos: atraso, pagamentos, perfil
// ============================================================

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


