# Deploy do EvidêncIA na Vercel

O frontend continua chamando `GET /api/dashboard`. Em desenvolvimento, o endpoint é atendido pelo plugin do Vite; na Vercel, é atendido por `api/dashboard.ts`. Os dois adaptadores reutilizam `server/dashboardService.ts`, mantendo as consultas PostgreSQL fora do navegador.

## 1. Pacote privado

Mantenha este `.npmrc` na raiz do projeto:

```ini
@sia-dedg:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Não grave o token real no arquivo. Em **Vercel → Project → Settings → Environment Variables**, crie `NPM_TOKEN` com um Personal Access Token clássico do GitHub que tenha `read:packages`, acesso à organização `SIA-DEDG` e autorização de SSO quando exigida.

Na máquina de desenvolvimento, defina a mesma variável apenas na sessão antes de instalar dependências. No PowerShell:

```powershell
$env:NPM_TOKEN = 'seu-token'
npm install
```

Não grave esse comando com o valor real em arquivos versionados. Uma nova janela do terminal exigirá que a variável seja definida novamente, a menos que sua equipe utilize um gerenciador seguro de segredos.

## 2. Banco de dados

Cadastre também na Vercel:

```text
SUPABASE_URL=postgresql://usuario:senha@host:porta/postgres
```

`SUPABASE_URL` não usa o prefixo `VITE_`: ela é uma credencial exclusiva do servidor e nunca deve ser enviada ao navegador. Configure-a em Production e Preview conforme a necessidade.

## 3. Configuração do projeto

Ao importar o repositório na Vercel, use:

- Framework Preset: `Vite`;
- Install Command: `npm install`;
- Build Command: `npm run build`;
- Output Directory: `dist`;
- Node.js: versão 20 ou 22.

A pasta `api/` é detectada automaticamente pela Vercel como Functions. Não é necessário alterar a URL usada pelo frontend.

O arquivo `vercel.json` mantém a Function do dashboard com duração máxima de 60 segundos. Depois de cadastrar ou alterar `SUPABASE_URL`, faça um novo deploy para aplicar a variável ao ambiente publicado.

## 4. Validação

Depois do deploy, abra:

```text
https://SEU-DOMINIO/api/dashboard?kind=ibid
```

O retorno esperado é JSON com status 200. Respostas comuns:

- `401` ou erro durante `npm install`: revise `NPM_TOKEN` e a autorização da organização;
- `503`: `SUPABASE_URL` não foi cadastrada no ambiente do deploy;
- `500`: confira conectividade, credenciais, SSL e logs da Function;
- `404`: confirme que `api/dashboard.ts` foi enviado ao repositório e faça um novo deploy.

## 5. Migração futura para VPS

Na VPS, mantenha `server/dashboardService.ts` e exponha `/api/dashboard` com um processo Node. O Nginx servirá `dist/` e encaminhará `/api/*` para esse processo. O frontend e as consultas do serviço não precisam ser reescritos; muda apenas o adaptador HTTP usado pela hospedagem.
