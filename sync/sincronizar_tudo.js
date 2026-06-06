require('dotenv').config({ path: __dirname + '/.env' });
const { execSync } = require('child_process');
const path = require('path');

const scripts = [
  'sincronizar.js',
  'sincronizar_vendas.js',
  'sincronizar_compras.js',
  'sincronizar_parcelas.js',
  'sync2025_produtos.js',
  'sync2025_vendas.js',
  'sync2025_compras.js',
  'sync2025_parcelas.js',
  'zerar_pendentes.js',
  'atualizar_saldos.js',
  'sync2025_saldos.js',
  'criar_orfaos.js',
  'sincronizar_despesas.js',
  'sync2025_despesas.js',
];

async function main() {
  const dir = __dirname;
  const inicio = Date.now();
  console.log('=== SINCRONIZACAO COMPLETA ===');
  console.log('Inicio: ' + new Date().toLocaleString('pt-BR'));
  console.log('');
  for (const script of scripts) {
    console.log('--- Rodando: ' + script + ' ---');
    try {
      execSync(`node ${path.join(dir, script)}`, { stdio: 'inherit' });
    } catch (err) {
      console.error('ERRO em ' + script + ': ' + err.message);
    }
    console.log('');
  }
  const fim = Date.now();
  const segundos = Math.round((fim - inicio) / 1000);
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  console.log('=== CONCLUIDO ===');
  console.log('Fim: ' + new Date().toLocaleString('pt-BR'));
  console.log('Duracao: ' + (min > 0 ? min + 'min ' : '') + seg + 's');
}
main();
