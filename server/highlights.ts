import type { DashboardKind, HighlightGroup, HighlightItem } from '../src/types/dashboard.js'

interface HighlightComponent {
  id: string
  tipo: string
  nome: string
  parent_id: string | null
}

interface HighlightResult {
  componente_id?: string
  ano_referencia?: number
  posicao: number | null
}

const groupLabels: Record<string, string> = {
  GERAL: 'Nota geral',
  PILAR: 'Pilares',
  DIMENSAO: 'Dimensões',
  INDICADOR: 'Indicadores',
}

function topTier(position: number): 3 | 5 | 10 | undefined {
  if (position <= 3) return 3
  if (position <= 5) return 5
  if (position <= 10) return 10
}

/** Só há comparação quando o mesmo componente tem posição nos dois anos consecutivos. */
export function buildHighlights(
  components: HighlightComponent[],
  results: HighlightResult[],
  selectedYear: number,
  kind: DashboardKind,
): HighlightGroup[] {
  const allowedTypes = new Set(kind === 'ibid'
    ? ['GERAL', 'PILAR', 'DIMENSAO', 'INDICADOR']
    : ['GERAL', 'PILAR', 'INDICADOR'])
  const previousYear = selectedYear - 1
  const positions = new Map<string, Map<number, number>>()
  for (const result of results) {
    if (!result.componente_id || !result.ano_referencia || result.posicao === null || !Number.isInteger(result.posicao) || result.posicao <= 0) continue
    if (result.ano_referencia !== selectedYear && result.ano_referencia !== previousYear) continue
    const years = positions.get(result.componente_id) ?? new Map<number, number>()
    years.set(result.ano_referencia, result.posicao)
    positions.set(result.componente_id, years)
  }
  const componentById = new Map(components.map((component) => [component.id, component]))
  function pillarFor(component: HighlightComponent) {
    let current: HighlightComponent | undefined = component
    const visited = new Set<string>()
    while (current && !visited.has(current.id)) {
      if (current.tipo === 'PILAR') return current
      visited.add(current.id)
      current = current.parent_id ? componentById.get(current.parent_id) : undefined
    }
  }

  const itemsByType = new Map<string, HighlightItem[]>()
  for (const component of components) {
    if (!allowedTypes.has(component.tipo)) continue
    const currentPosition = positions.get(component.id)?.get(selectedYear)
    const previousPosition = positions.get(component.id)?.get(previousYear)
    if (currentPosition === undefined || previousPosition === undefined) continue

    const change = previousPosition - currentPosition
    const currentTier = topTier(currentPosition)
    if (Math.abs(change) <= 3 && !currentTier) continue

    const previousTier = topTier(previousPosition)
    const pillar = pillarFor(component)
    const item: HighlightItem = {
      id: component.id,
      title: component.tipo === 'GERAL' ? kind === 'ibid' ? 'Nota Geral IBID' : 'Nota Geral CLP' : component.nome,
      pillarId: pillar?.id,
      pillarTitle: pillar?.nome,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      change,
      currentPosition,
      previousPosition,
      previousYear,
      topTier: currentTier,
      topStatus: currentTier ? !previousTier || previousTier > currentTier ? 'entered' : 'remained' : undefined,
      year: selectedYear,
    }
    const items = itemsByType.get(component.tipo) ?? []
    items.push(item)
    itemsByType.set(component.tipo, items)
  }

  return Object.entries(groupLabels).flatMap(([type, label]) => {
    const items = itemsByType.get(type)
    if (!items?.length) return []
    return [{
      id: type.toLowerCase(),
      label,
      items: items.sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.currentPosition - b.currentPosition || a.title.localeCompare(b.title, 'pt-BR')),
    }]
  })
}
