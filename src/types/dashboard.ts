export type DashboardKind = 'ibid' | 'clp-estados' | 'clp-municipios'

export interface SelectOption {
  label: string
  value: string
  /** Seção do select (optgroup) em que a opção aparece. */
  group?: string
}

export interface FilterDefinition {
  id: string
  label: string
  value: string
  options: SelectOption[]
  disabled?: boolean
}

export interface SummaryMetric {
  eyebrow: string
  title: string
  metric: string
  rank: string
  note: string
  emphasis?: 'primary' | 'neutral'
}

export interface RankingItem {
  position: number
  name: string
  value: number
  wasNull?: boolean
  /** Código do território usado nos filtros (presente no ranking de estados). */
  code?: string
  /** Nome completo do território (presente no ranking de estados). */
  label?: string
}

export interface RankingHistoryItem {
  year: number
  national: number
  nationalTotal: number
  regional?: number
  regionalTotal?: number
}

export type HighlightDirection = 'up' | 'down' | 'stable'

export interface HighlightItem {
  id: string
  title: string
  pillarId?: string
  pillarTitle?: string
  direction: HighlightDirection
  change: number
  currentPosition: number
  previousPosition?: number
  topTier?: 3 | 5 | 10
  topStatus?: 'entered' | 'remained'
  year: number
}

export interface HighlightGroup {
  id: string
  label: string
  items: HighlightItem[]
}

export interface DetailRow {
  id: string
  level: 'Grupo' | 'Pilar' | 'Dimensão' | 'Indicador'
  title: string
  nationalRank?: string
  nationalScore?: string
  regionalRank?: string
  regionalScore?: string
  comparisonNationalRank?: string
  comparisonNationalScore?: string
  comparisonRegionalRank?: string
  comparisonRegionalScore?: string
  year?: string
  /** Último ano com dado disponível para o componente (pode ser anterior ao ano do ranking). */
  updateYear?: string
  description?: string
  unit?: string
  source?: string
  children?: DetailRow[]
}

export interface InsightPositionPoint {
  year: number
  position: number | null
  /** Posição do território de comparação (nulo sem comparação selecionada). */
  comparisonPosition: number | null
  /** Quantidade de territórios com nota no componente naquele ano. */
  total: number
}

/** Pilar, dimensão ou indicador com as notas do ano selecionado e o histórico de posição. */
export interface ComponentInsight {
  id: string
  name: string
  /** Nota do território principal no ano selecionado. */
  score: number | null
  comparisonScore: number | null
  nationalAverage: number | null
  position: number | null
  total: number
  history: InsightPositionPoint[]
}

export interface InsightGroup {
  level: 'Pilar' | 'Dimensão' | 'Indicador'
  items: ComponentInsight[]
}

export interface DashboardDataset {
  kind: DashboardKind
  meta: {
    updatedAt: string
    dataPeriod: string
    source: string
  }
  filters: FilterDefinition[]
  summary: SummaryMetric[]
  chart: {
    years: number[]
    primary: Array<number | null>
    comparison: Array<number | null>
    nationalAverage: Array<number | null>
    regional: Array<number | null>
    comparisonRegional: Array<number | null>
    primaryLabel: string
    comparisonLabel: string
    regionalLabel: string
    comparisonRegionalLabel: string
    yMax: number
  }
  rankingLabels: {
    national: string
    regional: string
  }
  nationalRanking: RankingItem[]
  regionalRanking: RankingItem[]
  stateRanking: RankingItem[]
  /** Municípios do estado selecionado (apenas no painel de municípios); `position` é a posição nacional. */
  municipalityRanking?: RankingItem[]
  history: RankingHistoryItem[]
  comparisonHistory: RankingHistoryItem[]
  highlights: HighlightGroup[]
  /** Pilares, dimensões e indicadores relacionados à métrica selecionada, agrupados por nível. */
  insightGroups?: InsightGroup[]
  /** Nível da métrica selecionada quando ela é um pilar, dimensão ou indicador (ausente na nota geral e em grupos). */
  metricLevel?: InsightGroup['level']
  details: DetailRow[]
}

export interface ComparisonDataset {
  ibid: DashboardDataset
  clp: DashboardDataset
  meta: DashboardDataset['meta']
}
