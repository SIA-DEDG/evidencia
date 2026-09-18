/**
 * Relações entre componentes do IBID e do CLP (Ranking de Competitividade dos Estados)
 * que medem a mesma coisa com nomes diferentes.
 *
 * Critério: mesma fonte e mesma medida. O IBID não publica descrição dos indicadores,
 * então a medida foi comparada entre o nome do indicador do IBID (que já descreve o
 * cálculo) e a descrição do indicador do CLP. Indicadores do CLP sem fonte nem descrição
 * na base ficaram de fora, porque não há como confirmar a relação.
 *
 * O IBID não publica nota por indicador: a comparação numérica acontece nos pilares,
 * e os pares de pilares abaixo derivam dos indicadores relacionados.
 */

export interface IndicatorRelation {
  /** Nome do indicador no IBID. */
  ibid: string
  /** Nome do indicador no CLP. */
  clp: string
  /** Fonte comum aos dois estudos. */
  source: string
  /** O que a medida tem em comum (ou de diferente) entre os estudos. */
  note: string
}

export interface PillarRelation {
  id: string
  /** Código do pilar do IBID, usado como métrica do painel. */
  ibidMetric: string
  ibidPillar: string
  /** Código do pilar do CLP, usado como métrica do painel. */
  clpMetric: string
  clpPillar: string
  indicators: IndicatorRelation[]
}

export const pillarRelations: PillarRelation[] = [
  {
    id: 'infraestrutura-infraestrutura',
    ibidMetric: 'IBID_1_3_INFRAESTRUTURA',
    ibidPillar: 'Infraestrutura',
    clpMetric: 'IF',
    clpPillar: 'Infraestrutura',
    indicators: [
      { ibid: 'Qualidade das rodovias', clp: 'Qualidade das Rodovias', source: 'CNT', note: 'Avaliação das condições das rodovias pela pesquisa CNT.' },
      { ibid: 'Acessibilidade ao mercado aéreo', clp: 'Disponibilidade de Voos Diretos', source: 'ANAC', note: 'Oferta de voos domésticos regulares.' },
      { ibid: 'Duração média de interrupção do fornecimento de energia elétrica', clp: 'Qualidade da Energia Elétrica', source: 'ANEEL', note: 'Continuidade do fornecimento de energia (DEC/DGC).' },
    ],
  },
  {
    id: 'infraestrutura-sustentabilidade-ambiental',
    ibidMetric: 'IBID_1_3_INFRAESTRUTURA',
    ibidPillar: 'Infraestrutura',
    clpMetric: 'AS',
    clpPillar: 'Sustentabilidade Ambiental',
    indicators: [
      { ibid: 'Emissão de CO2 per capita', clp: 'Emissões de CO2', source: 'SEEG', note: 'Emissões de CO2; o IBID divide pela população e o CLP pelo PIB.' },
    ],
  },
  {
    id: 'instituicoes-eficiencia-maquina-publica',
    ibidMetric: 'IBID_1_1_INSTITUICOES',
    ibidPillar: 'Instituições',
    clpMetric: 'EP',
    clpPillar: 'Eficiência da Máquina Pública',
    indicators: [
      { ibid: 'Qualidade das informações contábeis e fiscais dos Estados', clp: 'Qualidade da Informação Contábil e Fiscal', source: 'Tesouro Nacional', note: 'Ranking da qualidade da informação contábil e fiscal no Siconfi.' },
    ],
  },
  {
    id: 'instituicoes-inovacao',
    ibidMetric: 'IBID_1_1_INSTITUICOES',
    ibidPillar: 'Instituições',
    clpMetric: 'IN',
    clpPillar: 'Inovação',
    indicators: [
      { ibid: 'Quantidade de empresas de alto crescimento', clp: 'Empresas de Alto Crescimento', source: 'IBGE', note: 'Empresas de alto crescimento (Demografia das Empresas).' },
    ],
  },
  {
    id: 'instituicoes-potencial-mercado',
    ibidMetric: 'IBID_1_1_INSTITUICOES',
    ibidPillar: 'Instituições',
    clpMetric: 'PM',
    clpPillar: 'Potencial de Mercado',
    indicators: [
      { ibid: 'Inadimplência', clp: 'Inadimplência', source: 'Serasa', note: 'Consumidores inadimplentes.' },
    ],
  },
  {
    id: 'instituicoes-capital-humano',
    ibidMetric: 'IBID_1_1_INSTITUICOES',
    ibidPillar: 'Instituições',
    clpMetric: 'CH',
    clpPillar: 'Capital Humano',
    indicators: [
      { ibid: 'Taxa de informalidade', clp: 'Formalidade do Mercado de Trabalho', source: 'IBGE', note: 'Mesma medida da PNAD em sentidos opostos: informalidade no IBID, formalidade no CLP.' },
    ],
  },
  {
    id: 'capital-humano-educacao',
    ibidMetric: 'IBID_1_2_CAPITAL_HUMANO',
    ibidPillar: 'Capital humano',
    clpMetric: 'ED',
    clpPillar: 'Educação',
    indicators: [
      { ibid: 'Taxa de frequência escolar líquida do ensino médio', clp: 'Taxa de Frequência Líquida do Ensino Médio', source: 'IBGE', note: 'Jovens de 15 a 17 anos frequentando o ensino médio.' },
    ],
  },
  {
    id: 'capital-humano-capital-humano',
    ibidMetric: 'IBID_1_2_CAPITAL_HUMANO',
    ibidPillar: 'Capital humano',
    clpMetric: 'CH',
    clpPillar: 'Capital Humano',
    indicators: [
      { ibid: 'Escolaridade média da população adulta', clp: 'Qualificação dos Trabalhadores', source: 'IBGE', note: 'Anos médios de estudo; o IBID considera a população adulta e o CLP, os ocupados.' },
    ],
  },
  {
    id: 'capital-humano-inovacao',
    ibidMetric: 'IBID_1_2_CAPITAL_HUMANO',
    ibidPillar: 'Capital humano',
    clpMetric: 'IN',
    clpPillar: 'Inovação',
    indicators: [
      { ibid: 'Investimentos públicos em P&D', clp: 'Investimentos Públicos em P&D', source: 'MCTI', note: 'Investimento público em pesquisa e desenvolvimento.' },
    ],
  },
  {
    id: 'economia-criativa-infraestrutura',
    ibidMetric: 'IBID_2_2_ECONOMIA_CRIATIVA',
    ibidPillar: 'Economia criativa',
    clpMetric: 'IF',
    clpPillar: 'Infraestrutura',
    indicators: [
      { ibid: 'Número de acessos à Internet', clp: 'Acessibilidade do Serviço de Telecomunicações', source: 'Anatel', note: 'Acessos de telefonia móvel e banda larga registrados pela Anatel.' },
    ],
  },
]

export const generalMetricValue = 'geral'

export function pillarRelation(id: string | undefined) {
  return pillarRelations.find((relation) => relation.id === id)
}

export function pillarRelationLabel(relation: PillarRelation) {
  const count = relation.indicators.length
  return `${relation.ibidPillar} (IBID) × ${relation.clpPillar} (CLP) · ${count} indicador${count > 1 ? 'es' : ''} em comum`
}
