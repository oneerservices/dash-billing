ETAPA 4 - JavaScript organizado em arquivos menores

Nesta etapa, o arquivo app.js grande foi dividido em arquivos por responsabilidade:

- config-loader.js: carrega as configurações
- state.js: guarda variáveis globais
- utils.js: funções auxiliares
- auth.js: login Google
- api.js: leitura da planilha
- detail.js: modal de detalhes, imagem e mensagem
- table.js: tabela, filtros e seleção
- modal.js: disparo de cobranças
- app.js: inicialização e atalhos

Como testar:
1. Rode npm install
2. Configure .env
3. Configure public/js/config.js
4. Rode npm run dev
5. Abra http://localhost:3000

Não use Live Server nesta etapa.
