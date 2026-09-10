export type DashboardKind = 'ibid' | 'clp-estados' | 'clp-municipios'

export interface SelectOption {
  label: string
  value: string
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
  description?: string
  unit?: string
  source?: string
  children?: DetailRow[]
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
  history: RankingHistoryItem[]
  comparisonHistory: RankingHistoryItem[]
  highlights: HighlightGroup[]
  details: DetailRow[]
}
