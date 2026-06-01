// =============================================================
// Mapeamento de colunas da aba Base — fonte única da verdade.
// Se a planilha mudar, altere APENAS aqui.
// A Data da Venda | B IMEI | C Produto | D Cliente | E Valor |
// F Valor Recebido | G Valor Pendente | H Status | I Vencimento 1
// =============================================================
const COL_DATA_VENDA  = 0;  // A
const COL_IMEI        = 1;  // B
const COL_PRODUTO     = 2;  // C
const COL_CLIENTE     = 3;  // D
const COL_VALOR       = 4;  // E
const COL_RECEBIDO    = 5;  // F
const COL_PENDENTE    = 6;  // G
const COL_STATUS      = 7;  // H
const COL_VENCIMENTO  = 8;  // I = Vencimento 1

const DETAIL_HEADER_ROW = 1; // Linha 2 da planilha
const DATA_START_ROW    = 2; // Linha 3 da planilha

// Pares de parcelas: vencimento e pagamento correspondente.
const PAYMENT_PAIRS = [
  { numero: 1, vencimentoCol: 8,  pagamentoCol: 10 }, // I / K
  { numero: 2, vencimentoCol: 11, pagamentoCol: 13 }, // L / N
  { numero: 3, vencimentoCol: 14, pagamentoCol: 16 }, // O / Q
  { numero: 4, vencimentoCol: 17, pagamentoCol: 19 }, // R / T
];

// =============================================================
// Estado de runtime — mutável conforme o app roda.
// =============================================================
let baseHeaders    = [];
let baseRowsRaw    = [];
let paymentPairs   = PAYMENT_PAIRS; // alias mutável mantido por compatibilidade

let accessToken        = null;
let allRows            = [];
let filteredRows       = [];
let selectedIds        = new Set();
let currentFilter      = 'all';
let sortCol            = null;
let sortDir            = 1;
let loggedIn           = false;
let detailCache        = null;
let currentDetailIndex = -1;
