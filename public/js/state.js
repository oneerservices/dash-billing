let COL_CLIENTE = 3;       // D = Cliente
let COL_IMEI = 1;          // B = IMEI
let COL_PRODUTO = 2;       // C = Produto
let COL_DATA_VENDA = 0;    // A = Data da Venda
let COL_VALOR = 4;         // E = Valor
let COL_RECEBIDO = 5;      // F = Valor Recebido
let COL_PENDENTE = 6;      // G = Valor Pendente
let COL_STATUS = 7;        // H = Status
let COL_VENCIMENTO = 8;    // I = Vencimento 1
let DETAIL_HEADER_ROW = 1; // Linha 2 da planilha
let DATA_START_ROW = 2;    // Linha 3 da planilha
let baseHeaders = [];
let baseRowsRaw = [];
let paymentPairs = [
  { numero: 1, vencimentoCol: 8, pagamentoCol: 10 },  // I / K
  { numero: 2, vencimentoCol: 11, pagamentoCol: 13 }, // L / N
  { numero: 3, vencimentoCol: 14, pagamentoCol: 16 }, // O / Q
  { numero: 4, vencimentoCol: 17, pagamentoCol: 19 }  // R / T
];

let accessToken = null;
let allRows = [];
let filteredRows = [];
let selectedIds = new Set();
let currentFilter = 'all';
let sortCol = null;
let sortDir = 1;
let loggedIn = false;
let detailCache = null;
let currentDetailIndex = -1;
