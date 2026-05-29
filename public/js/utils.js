function normalizarTexto(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseValorBR(v) {
  if (typeof v === 'number') return v;
  let s = (v || '0').toString().trim();
  if (!s) return 0;

  const isNegative = /^-/.test(s) || s.includes('-R$') || s.includes('−');
  s = s
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .replace(/−/g, '-')
    .replace(/[^0-9,.-]/g, '');

  if (!s) return 0;

  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  let n = parseFloat(s.replace(/(?!^)-/g, ''));
  if (Number.isNaN(n)) n = 0;
  return isNegative ? -Math.abs(n) : n;
}

function fmtBRL(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const fmtBRLGlobal = fmtBRL;

function parseDataBR(v) {
  const raw = (v || '').toString().trim();
  if (!raw) return null;

  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let ano = Number(m[3]);
    if (ano < 100) ano += 2000;
    const d = new Date(ano, Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mesmoDia(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}


function encontrarLinhaCabecalho(allData) {
  // No print da aba Base, os títulos estão na linha 2.
  return 1;
}

function acharColuna(headers, termos, fallback) {
  // Mantido só por compatibilidade, mas a aba Base está mapeada fixamente.
  return fallback;
}

function aplicarSchema(allData) {
  // Mapeamento fixo conforme aba Base:
  // A Data da Venda | B IMEI | C Produto | D Cliente | E Valor |
  // F Valor Recebido | G Valor Pendente | H Status | I Vencimento 1
  DETAIL_HEADER_ROW = 1;
  DATA_START_ROW = 2;
  baseHeaders = allData[DETAIL_HEADER_ROW] || [];

  COL_DATA_VENDA = 0;
  COL_IMEI = 1;
  COL_PRODUTO = 2;
  COL_CLIENTE = 3;
  COL_VALOR = 4;
  COL_RECEBIDO = 5;
  COL_PENDENTE = 6;
  COL_STATUS = 7;
  COL_VENCIMENTO = 8;

  paymentPairs = [
    { numero: 1, vencimentoCol: 8,  pagamentoCol: 10 },
    { numero: 2, vencimentoCol: 11, pagamentoCol: 13 },
    { numero: 3, vencimentoCol: 14, pagamentoCol: 16 },
    { numero: 4, vencimentoCol: 17, pagamentoCol: 19 }
  ];
}

function linhaTemCliente(r) {
  return r && r.length && (r[COL_CLIENTE] || '').toString().trim();
}

function linhaDeveAparecer(r) {
  if (!linhaTemCliente(r)) return false;

  const pendente = parseValorBR(r[COL_PENDENTE]);
  const status = normalizarTexto(r[COL_STATUS]);

  // Na aba Base:
  // H = Status e G = Valor Pendente.
  // Deve aparecer apenas quem ainda tem pendência.
  if (status === 'pago') return false;
  if (Math.abs(pendente) < 0.005) return false;

  return true;
}

function statusPorVencimento(rows) {
  if (rows.some(r => statusDaLinha(r) === 'red')) return 'red';
  if (rows.some(r => statusDaLinha(r) === 'yellow')) return 'yellow';
  return 'green';
}


function getVencimentosLinha(r) {
  const vencs = [];

  // Vencimentos das parcelas 1..4 conforme aba Base.
  // Usar todos resolve casos em que o vencimento atual não é o Vencimento 1.
  paymentPairs.forEach(pair => {
    const txt = r[pair.vencimentoCol];
    const data = parseDataBR(txt);
    if (data) {
      data.setHours(0, 0, 0, 0);
      vencs.push({
        data,
        texto: txt,
        numero: pair.numero
      });
    }
  });

  // Fallback para a coluna I/Vencimento 1.
  if (!vencs.length) {
    const txt = r[COL_VENCIMENTO];
    const data = parseDataBR(txt);
    if (data) {
      data.setHours(0, 0, 0, 0);
      vencs.push({ data, texto: txt, numero: 1 });
    }
  }

  return vencs;
}

function getVencimentoAtualLinha(r) {
  const vencs = getVencimentosLinha(r);

  if (!vencs.length) {
    return { data: null, texto: '—', numero: null };
  }

  // Regra nova:
  // usa sempre a última coluna de vencimento preenchida:
  // Vencimento 4 > Vencimento 3 > Vencimento 2 > Vencimento 1
  const ultimoInformado = vencs
    .sort((a, b) => b.numero - a.numero)[0];

  return ultimoInformado;
}

function linhaTemVencimentoNoStatus(r, statusFiltro) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return getVencimentosLinha(r).some(v => {
    if (statusFiltro === 'red') return v.data < hoje;
    if (statusFiltro === 'yellow') return mesmoDia(v.data, hoje);
    if (statusFiltro === 'green') return v.data > hoje;
    return true;
  });
}


function statusDaLinha(r) {
  const vencAtual = getVencimentoAtualLinha(r);
  if (!vencAtual.data) return 'green';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (vencAtual.data < hoje) return 'red';
  if (mesmoDia(vencAtual.data, hoje)) return 'yellow';
  return 'green';
}


function calcularResumoStatus(rows) {
  const resumo = {
    red: { count: 0, valor: 0, clientes: new Set() },
    yellow: { count: 0, valor: 0, clientes: new Set() },
    green: { count: 0, valor: 0, clientes: new Set() }
  };

  rows.forEach(r => {
    const clienteKey = normalizarTexto(r[COL_CLIENTE]);
    const valor = parseValorBR(r[COL_PENDENTE]);

    ['red', 'yellow', 'green'].forEach(st => {
      if (linhaTemVencimentoNoStatus(r, st)) {
        resumo[st].clientes.add(clienteKey);
        resumo[st].valor += valor;
      }
    });
  });

  ['red', 'yellow', 'green'].forEach(st => {
    resumo[st].count = resumo[st].clientes.size;
  });

  return resumo;
}


function menorVencimentoTexto(rows) {
  const vencimentos = rows
    .map(r => getVencimentoAtualLinha(r))
    .filter(x => x && x.data);

  if (!vencimentos.length) return '—';

  // Para cliente com vários itens, mostra a última data informada mais recente
  vencimentos.sort((a, b) => b.data - a.data);

  return vencimentos[0].texto || '—';
}

function getUltimoPagamentoCliente(nome, rows = baseRowsRaw) {
  const nomeNorm = normalizarTexto(nome);
  const candidatos = [];

  rows.filter(r => normalizarTexto(r[COL_CLIENTE]) === nomeNorm).forEach(r => {
    // Valor Recebido total da linha também entra como fallback, mas os pagamentos 1..4 são preferidos.
    paymentPairs.forEach(pair => {
      const valor = parseValorBR(r[pair.pagamentoCol]);
      const data = parseDataBR(r[pair.vencimentoCol]);
      if (valor > 0 && data) candidatos.push({ data, dataTexto: r[pair.vencimentoCol], valor });
    });

    if (!paymentPairs.length) {
      const valor = parseValorBR(r[COL_RECEBIDO]);
      const data = parseDataBR(r[COL_VENCIMENTO]);
      if (valor > 0 && data) candidatos.push({ data, dataTexto: r[COL_VENCIMENTO], valor });
    }
  });

  if (!candidatos.length) return { data: '—', valor: 0, valorStr: fmtBRL(0) };

  const ultima = candidatos.reduce((max, p) => p.data > max ? p.data : max, candidatos[0].data);
  const valor = candidatos
    .filter(p => mesmoDia(p.data, ultima))
    .reduce((s, p) => s + p.valor, 0);

  const dataTexto = candidatos.find(p => mesmoDia(p.data, ultima)).dataTexto;
  return { data: dataTexto || '—', valor, valorStr: fmtBRL(valor) };
}
