# EvidencIA Inovação

Dashboard responsivo implementado em React, TypeScript, Tailwind CSS e Recharts (SVG vetorial) a partir do arquivo Figma do projeto SIA/DEDG.

## Executar

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm run build
npm run preview
```

## Telas implementadas

- Sobre o Painel
- IBID
- CLP — Estados
- CLP — Municípios
- Comparativo — IBID × CLP

O comparativo reúne as notas gerais do IBID e do CLP para o mesmo estado e ano.

## Banco de dados

O dashboard consulta PostgreSQL no servidor através da variável `SUPABASE_URL`. A credencial nunca é enviada ao navegador. Em desenvolvimento e no preview de produção, o middleware do Vite expõe somente o endpoint agregado `/api/dashboard`.

Crie um arquivo `.env` local:

```env
SUPABASE_URL=postgresql://usuario:senha@host:porta/banco
CRON_SECRET=gere-uma-chave-aleatoria-com-pelo-menos-16-caracteres
```

As consultas usam `pesquisa`, `edicao`, `territorio`, `componente`, `estrutura_componente`, `componente_edicao` e `resultado_ranking`. Filtros, cards, séries, rankings e a tabela detalhada são calculados a partir dessas tabelas.

Em produção, a Vercel chama `/api/keep-alive` às 12:00 UTC nos dias 1, 5, 9 e assim por diante. O endpoint protegido por `CRON_SECRET` executa uma consulta simples no PostgreSQL para manter o projeto ativo. Configure o mesmo segredo nas variáveis de ambiente da Vercel; a plataforma o envia automaticamente no cabeçalho `Authorization` das chamadas agendadas.

## Metadados de governança

O utilitário `scripts/import-governance-metadata.py` valida e importa pesos de pilares/dimensões, esferas estaduais e vínculos agregados de órgãos. Requer Python com `openpyxl` e `psycopg` instalados. Sem `--apply`, ele apenas valida os arquivos e os mapeamentos; com `--apply`, grava tudo em uma transação e salva um backup local em `backups/`.

```powershell
python scripts/import-governance-metadata.py `
  --ibid-orgs "C:\dados\Indicadores_IBID_x_Orgaos_Piaui.xlsx" `
  --clp-orgs "C:\dados\Indicadores_CLP_x_Orgaos_Piaui.xlsx" `
  --weights "C:\dados\Pesos_Pilares_Estados_e_Municipios_2026.xlsx" `
  --spheres "C:\dados\Indicadores_por_Esfera_2026.xlsx" `
  --apply
```

## Preferências do header

O tamanho da fonte e o tema são persistidos no navegador com as mesmas chaves usadas nas demais aplicações SIA:

- `observatorio:escala-fonte`: `0.9`, `1` ou `1.1`.
- `observatorio:tema`: `light` ou `dark`.

O tema também é refletido em `<html data-theme="light|dark">`.
