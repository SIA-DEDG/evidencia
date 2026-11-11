# Mapeamento das planilhas IBID

## Fontes suportadas

| Tipo interno | Arquivo | Uso |
|---|---|---|
| `SERIE_HISTORICA` | `IBIDSriehistrica_20142026.xlsx` | Notas e posições de 2014 a 2025 |
| `QUADROS_COMPLETOS` | `ibid2026quadroscompletos.xlsx` | Estrutura completa, metadados, notas e posições de 2026 |

O ano de 2026 existente na série histórica é lido apenas pelo comando `validate-ibid-pair`. Ele não é incluído na carga histórica.

## Componentes

| Nível | Quantidade | Persistência |
|---|---:|---|
| Geral | 1 | `componente` e `resultado_ranking` |
| Grupo | 2 | `componente` e `resultado_ranking` |
| Pilar | 7 | `componente` e `resultado_ranking` |
| Dimensão | 21 | `componente` e `resultado_ranking` em 2026 |
| Indicador | 81 | `componente` e `componente_edicao`; sem fato bruto |

## Territórios

As referências transitórias do parser são tipadas (`UF:SE` e `REGIAO:SE`). No banco, ambas apontam para registros distintos de `territorio`, identificados pela combinação `tipo + codigo`.

## Correções documentadas

- `Tecnologias da informação e comunicação (TICs)` no glossário e `TICs` nas tabelas são aliases da mesma dimensão.
- `Sustentabilidade` aparece como `1.2.3` nas tabelas, mas pertence ao pilar `1.3 Infraestrutura`; o código interno adotado é `1.3.3`.
- Cinco indicadores renomeados ou realocados em 2026 reutilizam seus códigos técnicos de 2025, preservando identidade e governança. `Presença das mulheres no total de inventores de patentes` é o único indicador realmente novo.
- Códigos históricos de região são convertidos: `NO→N`, `SU→S`; `NE`, `SE` e `CO` são preservados com tipo `REGIAO`.

## Controles estruturais

O parser recusa o arquivo antes da gravação quando não encontra:

- 20 abas nos quadros completos e 16 na série histórica;
- 27 UFs, cinco regiões e Brasil;
- 31 componentes pontuados e 81 indicadores no arquivo de 2026;
- 10 componentes agregados em cada ano histórico;
- 1.023 resultados em 2026 ou 3.960 resultados entre 2014 e 2025.
