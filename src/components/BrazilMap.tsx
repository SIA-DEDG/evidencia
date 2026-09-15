import brazilMap from '@svg-maps/brazil'
import type { DashboardKind, RankingItem } from '../types/dashboard'
import { ChoroplethMap, type MapLocation } from './ChoroplethMap'

const map = brazilMap as unknown as { viewBox: string; locations: MapLocation[] }

interface BrazilMapProps {
  comparisonCode?: string
  decimals: number
  kind: DashboardKind
  metricLabel: string
  onSelect?: (code: string) => void
  ranking: RankingItem[]
  selectedCode?: string
  year: string
}

export function BrazilMap({ comparisonCode, decimals, kind, metricLabel, onSelect, ranking, selectedCode, year }: BrazilMapProps) {
  // Os ids do mapa são as siglas das UFs em minúsculas.
  const itemBySigla = new Map(ranking.map((item) => [item.name.toLowerCase(), item]))

  return (
    <ChoroplethMap
      ariaLabel={`Mapa do Brasil por ${metricLabel}`}
      comparisonCode={comparisonCode}
      decimals={decimals}
      description={<>{metricLabel} - {kind === 'ibid' ? 'IBID' : 'CLP'}. Clique em um estado para selecioná-lo.</>}
      itemFor={(location) => itemBySigla.get(location.id)}
      kind={kind}
      locations={map.locations}
      noDataLabel="Sem dado"
      onSelect={onSelect}
      positionText={(item) => [`${item.position}º lugar`]}
      selectedCode={selectedCode}
      title={`Mapa do Brasil por nota${year ? ` (${year})` : ''}`}
      titleId="brazil-map-title"
      viewBox={map.viewBox}
    />
  )
}
