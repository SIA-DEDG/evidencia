# EvidencIA Inovação

Dashboard responsivo implementado em React, TypeScript, Tailwind CSS e Chart.js a partir do arquivo Figma do projeto SIA/DEDG.

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

O item Comparativo permanece visível e desabilitado no menu, conforme o layout de referência.

## Banco de dados

O dashboard consulta PostgreSQL no servidor através da variável `SUPABASE_URL`. A credencial nunca é enviada ao navegador. Em desenvolvimento e no preview de produção, o middleware do Vite expõe somente o endpoint agregado `/api/dashboard`.

Crie um arquivo `.env` local:

```env
SUPABASE_URL=postgresql://usuario:senha@host:porta/banco
```

As consultas usam `pesquisa`, `edicao`, `territorio`, `componente`, `estrutura_componente`, `componente_edicao` e `resultado_ranking`. Filtros, cards, séries, rankings e a tabela detalhada são calculados a partir dessas tabelas.

## Preferências do header

O tamanho da fonte e o tema são persistidos no navegador com as mesmas chaves usadas nas demais aplicações SIA:

- `observatorio:escala-fonte`: `0.9`, `1` ou `1.1`.
- `observatorio:tema`: `light` ou `dark`.

O tema também é refletido em `<html data-theme="light|dark">`.
