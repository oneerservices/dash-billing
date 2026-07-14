// ============================================================
// juros.js — Regra de juros por atraso
//
// Regra definida pelo Eudes (áudio 12/07):
//  - Carência: 3 dias após o vencimento sem cobrar juro.
//  - A partir do 4º dia de atraso, incide 1% ao dia sobre o valor
//    original da dívida (juro simples, não composto).
//  - O juro NÃO é aplicado direto na dívida do cliente — é uma
//    simulação/projeção mostrada na tela, e uma diferença calculada
//    apenas no momento da baixa (pagamento).
//  - Na baixa, se o cliente pagou só o valor original, o sistema
//    aponta a diferença (juro) e dá a opção de descartar (perdoar)
//    ou manter/cobrar essa diferença.
// ============================================================

const JUROS_CONFIG = {
  carenciaDias: 3,   // dias de tolerância sem juro após o vencimento
  taxaDiaria: 0.01,  // 1% ao dia sobre o valor original
  diasProjecao: 10   // quantos dias pra frente mostrar na simulação
};

/**
 * Calcula os dias de atraso "com juro" (já descontada a carência).
 * Ex: carência 3 dias, atraso de 5 dias -> 2 dias de juro.
 */
function diasComJuros(diasAtraso, carenciaDias = JUROS_CONFIG.carenciaDias) {
  const d = diasAtraso - carenciaDias;
  return d > 0 ? d : 0;
}

/**
 * Calcula o valor de juro e o valor atualizado para uma dívida,
 * numa data de referência (por padrão, hoje).
 *
 * @param {number} valorOriginal
 * @param {Date|string} dataVencimento
 * @param {Date} [dataReferencia] - se omitido, usa hoje
 * @returns {{diasAtraso:number, diasComJuros:number, valorJuros:number, valorAtualizado:number, dentroCarencia:boolean}}
 */
function calcularJuros(valorOriginal, dataVencimento, dataReferencia) {
  const venc = (dataVencimento instanceof Date) ? new Date(dataVencimento) : parseDataBR(dataVencimento);
  const valor = Number(valorOriginal) || 0;

  if (!venc) {
    return { diasAtraso: 0, diasComJuros: 0, valorJuros: 0, valorAtualizado: valor, dentroCarencia: true };
  }
  venc.setHours(0, 0, 0, 0);

  const ref = dataReferencia ? new Date(dataReferencia) : new Date();
  ref.setHours(0, 0, 0, 0);

  const diasAtraso = Math.max(0, Math.floor((ref - venc) / 86400000));
  const diasJuro = diasComJuros(diasAtraso);
  const valorJuros = +(valor * JUROS_CONFIG.taxaDiaria * diasJuro).toFixed(2);
  const valorAtualizado = +(valor + valorJuros).toFixed(2);

  return {
    diasAtraso,
    diasComJuros: diasJuro,
    valorJuros,
    valorAtualizado,
    dentroCarencia: diasAtraso <= JUROS_CONFIG.carenciaDias
  };
}

/**
 * Gera a projeção "se pagar em cada um dos próximos N dias, o valor será X",
 * a partir da data de vencimento. Serve pra mostrar na ficha do cliente
 * (igual a simulação de parcelas de uma compra online).
 *
 * @param {number} valorOriginal
 * @param {Date|string} dataVencimento
 * @param {number} [diasProjecao]
 * @returns {Array<{data:Date, dataStr:string, diasAtraso:number, valor:number, valorStr:string, comJuros:boolean}>}
 */
function gerarProjecaoJuros(valorOriginal, dataVencimento, diasProjecao = JUROS_CONFIG.diasProjecao) {
  const venc = (dataVencimento instanceof Date) ? new Date(dataVencimento) : parseDataBR(dataVencimento);
  if (!venc) return [];
  venc.setHours(0, 0, 0, 0);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Começa a projeção a partir de hoje (ou do vencimento, o que for maior),
  // pra sempre mostrar pelo menos os próximos N dias úteis pro cobrador.
  const inicio = hoje > venc ? hoje : venc;

  const linhas = [];
  for (let i = 0; i < diasProjecao; i++) {
    const data = new Date(inicio);
    data.setDate(data.getDate() + i);

    const calc = calcularJuros(valorOriginal, venc, data);
    linhas.push({
      data,
      dataStr: data.toLocaleDateString('pt-BR'),
      diasAtraso: calc.diasAtraso,
      valor: calc.valorAtualizado,
      valorStr: fmtBRL(calc.valorAtualizado),
      comJuros: calc.diasComJuros > 0
    });
  }
  return linhas;
}

/**
 * Compara o valor pago pelo cliente com o valor devido (com juros) na data
 * do pagamento, pra tela de baixa. Se o cliente pagou só o valor original,
 * aponta a diferença e deixa a decisão (descartar ou manter) pro cobrador.
 *
 * @param {number} valorOriginal
 * @param {Date|string} dataVencimento
 * @param {Date|string} dataPagamento
 * @param {number} valorPago
 */
function calcularDiferencaBaixa(valorOriginal, dataVencimento, dataPagamento, valorPago) {
  const dataPag = (dataPagamento instanceof Date) ? dataPagamento : parseDataBR(dataPagamento);
  const calc = calcularJuros(valorOriginal, dataVencimento, dataPag || new Date());
  const pago = Number(valorPago) || 0;
  const diferenca = +(calc.valorAtualizado - pago).toFixed(2);

  return {
    ...calc,
    dataPagamentoStr: dataPag ? dataPag.toLocaleDateString('pt-BR') : '—',
    valorPago: pago,
    valorPagoStr: fmtBRL(pago),
    valorDevidoStr: fmtBRL(calc.valorAtualizado),
    diferenca,
    diferencaStr: fmtBRL(diferenca),
    temDiferenca: diferenca > 0.005
  };
}
