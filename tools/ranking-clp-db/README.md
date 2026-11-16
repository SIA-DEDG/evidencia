# Rankings CLP e IBID → Supabase

Projeto Python que cria um esquema relacional no PostgreSQL do Supabase e importa as planilhas do Ranking de Competitividade (CLP) e do Índice Brasil de Inovação e Desenvolvimento (IBID) sem exigir um arquivo `.sql` escrito à mão.

## Escopo validado da versão 0.5

| Planilha | Situação |
|---|---|
| Estados — base principal | Implementada e validada |
| Estados — ESG e ODS | Implementada e validada |
| Municípios — base principal | Implementada e validada |
| Municípios — ESG e ODS | Implementada e validada |
| IBID — quadros completos 2026 | Implementada e validada |
| IBID — série histórica 2014–2026 | Implementada e validada; 2026 é usado para conferência |

O programa valida nomes de abas, blocos e quantidades esperadas antes de gravar. Uma edição futura com estrutura incompatível é recusada, evitando deslocamento silencioso de colunas.

### Estruturas encontradas em 2026

| Arquivo | Estrutura relevante |
|---|---|
| Estados principal | 1 geral, 10 pilares e 100 indicadores em 114 abas |
| Municípios principal | 1 geral, 3 dimensões, 13 pilares, 65 indicadores e 423 municípios em tabelas largas |
| Estados ESG/ODS | 100 indicadores relacionados a E/S/G e aos 17 ODS |
| Municípios ESG/ODS | 65 indicadores relacionados a E/S/G e a 16 ODS; o ODS 7 não aparece na matriz |

O nome do arquivo ESG/ODS dos Estados termina em “Municípios”, mas o leitor confirma o conteúdo estadual pelas abas e pelas 27 UFs. Na planilha ESG municipal, `Ceará-Mirim` aparece com UF `CE`; a base municipal principal informa `RN`. Essa correção é aplicada e registrada como aviso da carga.

### Estrutura encontrada no IBID

- 27 UFs, cinco grandes regiões e Brasil;
- 1 índice geral, 2 grupos, 7 pilares e 21 dimensões com resultados;
- 81 indicadores descritos no glossário, sem valores brutos no arquivo;
- 10 componentes agregados na série histórica de 2014 a 2026.

Os 330 valores agregados e as 81 posições de 2026 existentes nos dois arquivos foram reconciliados sem divergências. Para não duplicar fatos, a série histórica grava 2014–2025; os quadros completos são a fonte canônica de 2026.

O cabeçalho de `Tab4A/Tab4B` chama Sustentabilidade de `1.2.3`, código já usado por P&D. O importador registra o aviso e usa o código interno coerente `1.3.3`, sob Infraestrutura.

## O que é importado

- metadados de indicadores (`Índice` e `Descrições`);
- ranking geral, pilares e indicadores;
- valores brutos dos indicadores;
- notas normalizadas, posições e variações de posição;
- disponibilidade por ano;
- estados, regiões, municípios e Brasil, preservando códigos do IBGE quando fornecidos;
- estrutura, notas e posições do IBID, reutilizando os mesmos territórios do CLP;
- arquivo de origem, SHA-256, versão e histórico de cargas.

Mapas, gráficos e objetos de desenho são ignorados por serem visualizações derivadas. Nas planilhas ESG/ODS, as grandes bases normalizadas repetem notas dos indicadores da base principal; o importador usa a matriz para os relacionamentos e as abas `Ranking ESG`/`Ranking ODS` para os resultados agregados, evitando duplicação desnecessária.

## Instalação no Windows

Requer Python 3.11 ou superior.

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
Copy-Item .env.example .env
```

No painel do Supabase, abra **Connect** e copie a URI indicada para SQLAlchemy. Para `init-db`, prefira a conexão direta ou o **Session Pooler**, porta 5432. Coloque a URI em `.env` e mantenha esse arquivo fora do Git.

Se a senha contiver `@`, `:`, `/`, `#` ou `%`, use a versão codificada da senha na URI.

## Uso

Validar sem acessar o Supabase:

```powershell
ranking-clp validate "C:\dados\ESTADOS-Planilha.xlsx" `
  --pesquisa ESTADOS --tipo BASE_PRINCIPAL --edicao 2026
```

Criar as tabelas:

```powershell
ranking-clp init-db
```

Importar:

```powershell
ranking-clp import "C:\dados\ESTADOS-Planilha.xlsx" `
  --pesquisa ESTADOS --tipo BASE_PRINCIPAL --edicao 2026 `
  --url-origem "https://.../arquivo.xlsx"
```

Importe preferencialmente nesta ordem:

```powershell
ranking-clp import "C:\dados\ESTADOS-Planilha.xlsx" `
  --pesquisa ESTADOS --tipo BASE_PRINCIPAL --edicao 2026

ranking-clp import "C:\dados\ESG-ODS-ESTADOS.xlsx" `
  --pesquisa ESTADOS --tipo ESG_ODS --edicao 2026

ranking-clp import "C:\dados\MUNICIPIOS-Planilha.xlsx" `
  --pesquisa MUNICIPIOS --tipo BASE_PRINCIPAL --edicao 2026

ranking-clp import "C:\dados\ESG-ODS-MUNICIPIOS.xlsx" `
  --pesquisa MUNICIPIOS --tipo ESG_ODS --edicao 2026
```

Consultar o histórico das cargas:

```powershell
ranking-clp status
```

Auditar relações territoriais e totais após as cargas:

```powershell
ranking-clp audit-db
```

## Importar o IBID

Primeiro, confira automaticamente a sobreposição de 2026:

```powershell
ranking-clp validate-ibid-pair `
  "C:\dados\ibid2026quadroscompletos.xlsx" `
  "C:\dados\IBIDSriehistrica_20142026.xlsx"
```

O resultado esperado é `SUCESSO`, com 330 notas e 81 posições comparadas, sem divergências.

Depois importe os dois arquivos:

```powershell
ranking-clp import "C:\dados\IBIDSriehistrica_20142026.xlsx" `
  --pesquisa IBID --tipo SERIE_HISTORICA --edicao 2026

ranking-clp import "C:\dados\ibid2026quadroscompletos.xlsx" `
  --pesquisa IBID --tipo QUADROS_COMPLETOS --edicao 2026
```

A carga esperada é de 3.960 resultados históricos e 1.023 resultados de 2026. Repetir qualquer um dos mesmos arquivos retorna `IGNORADO` e não duplica dados.

Reimportar um arquivo com o mesmo SHA-256 é uma operação idempotente: a segunda carga é ignorada. Se o conteúdo mudar mantendo o mesmo nome e edição, uma nova versão é preservada e passa a ser a ativa.

## Segurança no Supabase

O importador usa uma conexão administrativa do PostgreSQL somente no computador ou no servidor de ingestão. Nunca coloque `DATABASE_URL` no navegador ou em código frontend. Depois da carga, exponha os dados por views/API e configure RLS conforme o público da aplicação.

## Modelo

Veja [docs/modelo-relacional.md](docs/modelo-relacional.md). A tabela `estrutura_componente` permite que a mesma métrica participe de diferentes classificações (ranking padrão, ESG e ODS) sem duplicar o indicador.

## Compatibilidade de esquema

A versão 0.5 separa territorialmente `UF + SE` (Sergipe) de `REGIAO + SE` (Sudeste). Bancos da versão 3 são reparados automaticamente: Sergipe é criado quando necessário, resultados estaduais são reassociados e municípios `MUN_SE_*` passam a apontar para a UF correta.

A migração da versão 2 continua incluindo a ampliação de `territorio.codigo` de 20 para 80 caracteres. As migrações 2→3→4 são executadas automaticamente na próxima chamada a `init-db`, `audit-db` ou `import`. O esquema 5, que acrescenta governança sem alterar as tabelas de resultados, também é aceito sem downgrade.

A versão 0.5.1 acrescenta `resultado_ranking.situacao_dado` (`INFORMADO` ou `SEM_DADO_FONTE`). A coluna é aditiva e não muda `schema_version`. Ela é criada automaticamente na próxima chamada a `init-db`, `audit-db` ou `import`, e as cargas já gravadas são marcadas na mesma transação. Notas de indicador sem valor bruto para o território, quando outros territórios têm valor bruto, passam a `SEM_DADO_FONTE`. Veja [docs/modelo-relacional.md](docs/modelo-relacional.md).

Se o banco ainda estiver em `schema_version=1`, a carga é interrompida porque essa versão antecede o modelo municipal e requer uma migração separada ou um banco novo.
