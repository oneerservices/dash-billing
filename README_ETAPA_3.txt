ETAPA 3 - WEBHOOK OCULTO COM BACKEND

O que mudou:
1. O projeto agora tem uma pasta public/ com HTML, CSS e JS.
2. O webhook do n8n saiu do JavaScript do navegador.
3. O webhook agora fica no arquivo .env.
4. O front chama /api/cobrancas.
5. O servidor Node.js recebe essa chamada e repassa para o n8n.

Como rodar:
1. Abra a pasta no VS Code.
2. Abra o terminal dentro da pasta.
3. Rode: npm install
4. Copie .env.example e renomeie para .env
5. Coloque sua URL real do n8n no .env
6. Abra public/js/config.js e coloque SHEET_ID e GOOGLE_CLIENT_ID
7. Rode: npm run dev
8. Abra no navegador: http://localhost:3000

Importante:
Nesta etapa, use http://localhost:3000 em vez de Live Server.
Se o login Google reclamar de origem não autorizada, adicione http://localhost:3000 nas origens autorizadas do OAuth no Google Cloud.
