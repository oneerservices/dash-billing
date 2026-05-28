# Dashboard de Cobranças

Dashboard de cobranças com front-end separado e servidor Node.js para proteger o webhook do n8n.

## Estrutura

```txt
public/
  index.html
  css/style.css
  js/
    app.js
    auth.js
    api.js
    table.js
    detail.js
    modal.js
    utils.js
    state.js
    config-loader.js
    config.example.js
server.js
package.json
.env.example
.gitignore
```

## Requisitos

- Node.js 18 ou superior
- Conta Google Cloud com OAuth configurado
- Planilha Google com permissão adequada
- Webhook n8n ativo

## Como rodar localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o arquivo `.env`

Copie o arquivo `.env.example` e renomeie para `.env`.

Preencha assim:

```env
N8N_WEBHOOK=https://seu-webhook-do-n8n-aqui
PORT=3000
```

### 3. Criar o arquivo de configuração do front

Copie:

```txt
public/js/config.example.js
```

E renomeie a cópia para:

```txt
public/js/config.js
```

Depois preencha:

```js
window.APP_CONFIG = {
  SHEET_ID: 'ID_DA_SUA_PLANILHA',
  SHEET_NAME: 'Base',
  SHEET_DETAIL: 'Base',
  GOOGLE_CLIENT_ID: 'SEU_CLIENT_ID_DO_GOOGLE',
  INTERVALO_MS: 60000,
  API_COBRANCAS_URL: '/api/cobrancas'
};
```

## Rodar o projeto

```bash
npm run dev
```

Abra no navegador:

```txt
http://localhost:3000
```

## Arquivos que NÃO devem ir para o GitHub

Estes arquivos ficam somente no seu computador:

```txt
.env
public/js/config.js
node_modules/
```

Eles já estão protegidos pelo `.gitignore`.

## Subir para o GitHub

```bash
git init
git add .
git status
git commit -m "Primeira versão do dashboard de cobranças"
git branch -M main
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

Antes de fazer commit, confira com:

```bash
git status
```

O arquivo `.env` e o arquivo `public/js/config.js` não devem aparecer na lista de arquivos que serão enviados.

## Observação importante

O webhook do n8n fica protegido no servidor, dentro do `.env`.

O `GOOGLE_CLIENT_ID` e o `SHEET_ID` continuam no front-end porque são usados pelo navegador. Eles não são segredos reais como uma senha, mas você deve manter permissões corretas na sua planilha e no Google Cloud.
