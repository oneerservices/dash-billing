function normalizarNomeContato(nome) {
  return (nome || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizarTelefoneWhatsApp(telefone) {
  let numero = (telefone || '').toString().replace(/\D/g, '');

  if (!numero) return '';

  // Remove prefixo internacional digitado como 00.
  if (numero.startsWith('00')) {
    numero = numero.slice(2);
  }

  // Remove zero inicial usado em alguns formatos brasileiros: 085999999999.
  if (numero.startsWith('0') && numero.length > 11) {
    numero = numero.replace(/^0+/, '');
  }

  // Se vier só DDD + número, adiciona Brasil 55.
  // Exemplos:
  // 85999999999  -> 5585999999999
  // 8533334444   -> 558533334444
  if (!numero.startsWith('55') && (numero.length === 10 || numero.length === 11)) {
    numero = `55${numero}`;
  }

  return numero;
}

function telefoneWhatsAppValido(telefone) {
  const numero = normalizarTelefoneWhatsApp(telefone);

  // WhatsApp usa formato internacional sem +, geralmente entre 11 e 15 dígitos.
  return /^\d{11,15}$/.test(numero);
}

function obterSheetContatos() {
  return CONTACTS_SHEET_NAME || CONFIG.CONTACTS_SHEET_NAME || 'Contatos';
}

function obterSheetId() {
  return SHEET_ID || CONFIG.SHEET_ID || '';
}

async function carregarContatosSheet() {
  const sheetName = obterSheetContatos();
  const sheetId = obterSheetId();
  const range = sheetName;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = await resp.json();

  if (!resp.ok) {
    console.error('Erro ao carregar contatos:', data);
    const detalhes = data?.error?.message || 'Erro ao carregar contatos';
    throw new Error(detalhes);
  }

  const rows = data.values || [];

  // Remove cabeçalho. A linha real na planilha começa em 2.
  return rows.slice(1).map((row, index) => ({
    row,
    sheetRow: index + 2
  })).filter(item => item.row[0]);
}

async function buscarContatoCliente(nomeCliente) {
  const nomeNormalizado = normalizarNomeContato(nomeCliente);
  const contatos = await carregarContatosSheet();

  const contato = contatos.find(item => {
    const cliente = normalizarNomeContato(item.row[0]);
    return cliente === nomeNormalizado;
  });

  if (!contato || !contato.row[1]) return null;

  return {
    cliente: contato.row[0],
    telefone: normalizarTelefoneWhatsApp(contato.row[1]),
    criadoEm: contato.row[2] || '',
    atualizadoEm: contato.row[3] || '',
    origem: contato.row[4] || '',
    sheetRow: contato.sheetRow
  };
}

function obterDataHoraBR() {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza'
  });
}

const salvamentosContatoEmAndamento = new Map();

function gerarChaveContato(nomeCliente, telefone) {
  return `${normalizarNomeContato(nomeCliente)}|${normalizarTelefoneWhatsApp(telefone)}`;
}

function encontrarContatoExistente(contatos, nomeCliente, telefone) {
  const nomeNormalizado = normalizarNomeContato(nomeCliente);
  const telefoneNormalizado = normalizarTelefoneWhatsApp(telefone);

  return contatos.find(item => {
    const nomeLinha = normalizarNomeContato(item.row[0]);
    const telefoneLinha = normalizarTelefoneWhatsApp(item.row[1]);

    return nomeLinha === nomeNormalizado || telefoneLinha === telefoneNormalizado;
  });
}

async function salvarContatoCliente(nomeCliente, telefone) {
  const telefoneNormalizado = normalizarTelefoneWhatsApp(telefone);

  if (!nomeCliente || !telefoneWhatsAppValido(telefoneNormalizado)) {
    throw new Error('Cliente ou telefone inválido');
  }

  const chave = gerarChaveContato(nomeCliente, telefoneNormalizado);

  // Evita registro duplicado quando o usuário clica duas vezes rápido
  // ou quando duas chamadas tentam salvar o mesmo contato ao mesmo tempo.
  if (salvamentosContatoEmAndamento.has(chave)) {
    return salvamentosContatoEmAndamento.get(chave);
  }

  const promessa = salvarContatoClienteInterno(nomeCliente, telefoneNormalizado)
    .finally(() => {
      salvamentosContatoEmAndamento.delete(chave);
    });

  salvamentosContatoEmAndamento.set(chave, promessa);
  return promessa;
}

async function salvarContatoClienteInterno(nomeCliente, telefoneNormalizado) {
  const sheetName = obterSheetContatos();
  const sheetId = obterSheetId();
  const agora = obterDataHoraBR();
  const contatos = await carregarContatosSheet();
  const contatoExistente = encontrarContatoExistente(contatos, nomeCliente, telefoneNormalizado);

  const values = [[
    nomeCliente,
    telefoneNormalizado,
    contatoExistente?.row?.[2] || agora,
    agora,
    'dashboard'
  ]];

  let url;
  let method;

  if (contatoExistente) {
    const range = `${sheetName}!A${contatoExistente.sheetRow}:E${contatoExistente.sheetRow}`;
    url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    method = 'PUT';
  } else {
    const range = `${sheetName}!A:E`;
    url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
    method = 'POST';
  }

  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  const data = await resp.json();

  if (!resp.ok) {
    console.error('Erro ao salvar contato:', data);
    const detalhes = data?.error?.message || 'Erro ao salvar contato';
    throw new Error(detalhes);
  }

  return {
    cliente: nomeCliente,
    telefone: telefoneNormalizado,
    criadoEm: contatoExistente?.row?.[2] || agora,
    atualizadoEm: agora,
    origem: 'dashboard',
    sheetRow: contatoExistente?.sheetRow || null
  };
}
