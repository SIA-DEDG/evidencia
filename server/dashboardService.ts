import pg from 'pg'
import type {
  DashboardDataset,
  DashboardKind,
  DetailRow,
  FilterDefinition,
  HighlightGroup,
  HighlightItem,
  ComponentInsight,
  InsightGroup,
  RankingHistoryItem,
  RankingItem,
  SelectOption,
  SummaryMetric,
} from '../src/types/dashboard.js'

type QueryValues = Record<string, string | undefined>

interface TerritoryRow {
  id: string
  codigo: string
  sigla: string | null
  nome: string
  tipo: 'BRASIL' | 'REGIAO' | 'UF' | 'MUNICIPIO'
  parent_id: string | null
}

interface ResultRow extends TerritoryRow {
  ano_referencia: number
  nota: number | null
  posicao: number | null
}

interface DetailResultRow {
  componente_id?: string
  id: string
  ano_referencia?: number
  nota: number | null
  posicao: number | null
  delta_posicao?: number | null
}

interface ComponentRow {
  id: string
  codigo: string
  tipo: string
  nome: string
  parent_id: string | null
  ordem_exibicao: number | null
  descricao: string | null
  fonte: string | null
  unidade_medida: string | null
  ultimo_ano_disponivel?: number | null
}

const kindConfig = {
  ibid: {
    research: 'IBID',
    entityType: 'UF',
    source: 'INPI – Coordenação-Geral de Economia e Inovação',
    metricTypes: ['GERAL', 'GRUPO', 'PILAR', 'DIMENSAO'],
  },
  'clp-estados': {
    research: 'ESTADOS',
    entityType: 'UF',
    source: 'Centro de Liderança Pública (CLP)',
    metricTypes: ['GERAL', 'PILAR'],
  },
  'clp-municipios': {
    research: 'MUNICIPIOS',
    entityType: 'MUNICIPIO',
    source: 'Centro de Liderança Pública (CLP)',
    metricTypes: ['GERAL', 'DIMENSAO', 'PILAR'],
  },
} as const

const typeLabels: Record<string, string> = {
  GERAL: 'Nota Geral',
  GRUPO: 'Grupo',
  PILAR: 'Pilar',
  DIMENSAO: 'Dimensão',
  INDICADOR: 'Indicador',
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scoreDecimals(kind: DashboardKind) {
  return kind === 'ibid' ? 3 : 2
}

function scoreText(kind: DashboardKind, value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: scoreDecimals(kind),
    maximumFractionDigits: scoreDecimals(kind),
  })
}

function rankText(position: number | null | undefined, total: number) {
  return position ? `${position}º/${total}` : '—'
}

function titleForMetric(component: Pick<ComponentRow, 'tipo' | 'nome'>, kind: DashboardKind) {
  if (component.tipo === 'GERAL') return kind === 'ibid' ? 'Nota Geral - IBID' : 'Nota Geral - CLP'
  return `${typeLabels[component.tipo] ?? component.tipo} - ${component.nome}`
}

function toOption(territory: TerritoryRow): SelectOption {
  return { label: territory.sigla ? `${territory.nome} (${territory.sigla})` : territory.nome, value: territory.codigo }
}

function findTerritory(rows: TerritoryRow[], code: string | undefined, fallback: (row: TerritoryRow) => boolean) {
  return rows.find((row) => row.codigo === code) ?? rows.find(fallback) ?? rows[0]
}

function valueRank(rows: Array<Pick<ResultRow, 'id' | 'nota'>>, territoryId: string) {
  const valid = rows.filter((row) => row.nota !== null).sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0))
  const index = valid.findIndex((row) => row.id === territoryId)
  return index < 0 ? undefined : index + 1
}

function average(rows: Array<Pick<ResultRow, 'nota'>>) {
  const values = rows.flatMap((row) => row.nota === null ? [] : [row.nota])
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function ranking(rows: ResultRow[]): RankingItem[] {
  return rows
    .filter((row) => row.nota !== null)
    .sort((a, b) => (a.posicao ?? Number.MAX_SAFE_INTEGER) - (b.posicao ?? Number.MAX_SAFE_INTEGER) || (b.nota ?? 0) - (a.nota ?? 0))
    .slice(0, 5)
    .map((row, index) => ({ position: row.posicao ?? index + 1, name: row.sigla ?? row.nome, value: row.nota! }))
}

function scopedRanking(rows: ResultRow[]): RankingItem[] {
  return rows
    .filter((row) => row.nota !== null)
    .sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0))
    .slice(0, 5)
    .map((row, index) => ({ position: index + 1, name: row.sigla ?? row.nome, value: row.nota! }))
}

function buildStateRanking(states: TerritoryRow[], selectedResults: ResultRow[]): RankingItem[] {
  const resultByTerritory = new Map(selectedResults.map((row) => [row.id, row]))

  return states
    .map((state) => {
      const result = resultByTerritory.get(state.id)
      const wasNull = result?.nota === null || result?.nota === undefined

      return {
        code: state.codigo,
        name: state.sigla ?? state.nome,
        sortName: state.nome,
        value: wasNull ? 0 : result.nota!,
        position: result?.posicao ?? null,
        wasNull,
      }
    })
    .sort((a, b) => {
      // A ordem do gráfico vem da posição oficial salva no banco.
      // Isso preserva o desempate adotado pela fonte mesmo quando as notas são iguais.
      const positionOrder = (a.position ?? Number.MAX_SAFE_INTEGER)
        - (b.position ?? Number.MAX_SAFE_INTEGER)

      if (positionOrder !== 0) return positionOrder

      // Fallback apenas para registros sem posição oficial ou inconsistências de origem.
      return a.sortName.localeCompare(b.sortName, 'pt-BR', { sensitivity: 'base' })
    })
    .map(({ code, name, sortName, value, position, wasNull }, index) => ({
      position: position ?? index + 1,
      name,
      code,
      label: sortName,
      value,
      wasNull,
    }))
}

function buildMunicipalityRanking(municipalities: TerritoryRow[], selectedResults: ResultRow[]): RankingItem[] {
  const resultByTerritory = new Map(selectedResults.map((row) => [row.id, row]))

  return municipalities.map((municipality) => {
    const result = resultByTerritory.get(municipality.id)
    const wasNull = result?.nota === null || result?.nota === undefined
    return {
      position: result?.posicao ?? 0,
      name: municipality.nome,
      code: municipality.codigo,
      label: municipality.nome,
      value: wasNull ? 0 : result.nota!,
      wasNull,
    }
  })
}

function buildMunicipalStateRanking(
  states: TerritoryRow[],
  municipalities: TerritoryRow[],
  selectedMunicipalResults: ResultRow[],
): RankingItem[] {
  const stateByMunicipality = new Map(
    municipalities.flatMap((municipality) => municipality.parent_id
      ? [[municipality.id, municipality.parent_id] as const]
      : []),
  )
  const valuesByState = new Map<string, number[]>()

  for (const result of selectedMunicipalResults) {
    if (result.nota === null) continue
    const stateId = stateByMunicipality.get(result.id)
    if (!stateId) continue
    const values = valuesByState.get(stateId) ?? []
    values.push(result.nota)
    valuesByState.set(stateId, values)
  }

  return states
    .map((state) => {
      const values = valuesByState.get(state.id) ?? []
      return {
        code: state.codigo,
        name: state.sigla ?? state.nome,
        sortName: state.nome,
        value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
        wasNull: values.length === 0,
      }
    })
    .sort((a, b) => b.value - a.value || a.sortName.localeCompare(b.sortName, 'pt-BR'))
    .map(({ code, name, sortName, value, wasNull }, index) => ({ position: index + 1, name, code, label: sortName, value, wasNull }))
}

const highlightGroupLabels: Record<string, string> = {
  GERAL: 'Nota geral',
  GRUPO: 'Grupos',
  PILAR: 'Pilares',
  DIMENSAO: 'Dimensões',
  INDICADOR: 'Indicadores',
}

function topTier(position: number): 3 | 5 | 10 | undefined {
  if (position <= 3) return 3
  if (position <= 5) return 5
  if (position <= 10) return 10
  return undefined
}

function buildHighlights(
  components: ComponentRow[],
  results: DetailResultRow[],
  selectedYear: number,
  kind: DashboardKind,
): HighlightGroup[] {
  const allowedTypes = new Set(
    kind === 'ibid'
      ? ['GERAL', 'DIMENSAO', 'INDICADOR']
      : ['GERAL', 'PILAR', 'INDICADOR'],
  )
  const resultsByComponent = new Map<string, DetailResultRow[]>()
  const componentById = new Map(components.map((component) => [component.id, component]))

  function pillarFor(component: ComponentRow) {
    let current: ComponentRow | undefined = component
    const visited = new Set<string>()

    while (current && !visited.has(current.id)) {
      if (current.tipo === 'PILAR') return current
      visited.add(current.id)
      current = current.parent_id ? componentById.get(current.parent_id) : undefined
    }

    return undefined
  }

  for (const result of results) {
    if (!result.componente_id || !result.ano_referencia) continue
    const componentResults = resultsByComponent.get(result.componente_id) ?? []
    componentResults.push(result)
    resultsByComponent.set(result.componente_id, componentResults)
  }

  const itemsByType = new Map<string, HighlightItem[]>()

  for (const component of components) {
    if (!allowedTypes.has(component.tipo)) continue
    const componentResults = (resultsByComponent.get(component.id) ?? [])
      .filter((result) => result.posicao !== null && result.posicao !== undefined)
      .sort((a, b) => (a.ano_referencia ?? 0) - (b.ano_referencia ?? 0))
    const current = componentResults
      .filter((result) => (result.ano_referencia ?? 0) <= selectedYear)
      .at(-1)
    if (!current?.posicao) continue

    const change = current.delta_posicao ?? 0
    const previousPosition = current.delta_posicao === null || current.delta_posicao === undefined
      ? undefined
      : current.posicao + current.delta_posicao
    const currentTier = topTier(current.posicao)
    const hasLargeVariation = Math.abs(change) > 3

    if (!hasLargeVariation && !currentTier) continue

    const previousTier = previousPosition ? topTier(previousPosition) : undefined
    const pillar = pillarFor(component)
    const item: HighlightItem = {
      id: component.id,
      title: component.tipo === 'GERAL'
        ? kind === 'ibid' ? 'Nota Geral IBID' : 'Nota Geral CLP'
        : component.nome,
      pillarId: pillar?.id,
      pillarTitle: pillar?.nome,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      change,
      currentPosition: current.posicao,
      previousPosition,
      topTier: currentTier,
      topStatus: currentTier
        ? !previousTier || previousTier > currentTier
          ? 'entered'
          : 'remained'
        : undefined,
      year: selectedYear,
    }

    const typeItems = itemsByType.get(component.tipo) ?? []
    typeItems.push(item)
    itemsByType.set(component.tipo, typeItems)
  }

  return Object.entries(highlightGroupLabels).flatMap(([type, label]) => {
    const items = itemsByType.get(type)
    if (!items?.length) return []

    return [{
      id: type.toLowerCase(),
      label,
      items: items.sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.currentPosition - b.currentPosition || a.title.localeCompare(b.title, 'pt-BR')),
    }]
  })
}

function historyFor(territory: TerritoryRow | undefined, results: ResultRow[], entities: TerritoryRow[]): RankingHistoryItem[] {
  if (!territory) return []
  const years = [...new Set(results.map((row) => row.ano_referencia))].sort((a, b) => a - b)
  return years.flatMap((year) => {
    const yearResults = results.filter((row) => row.ano_referencia === year && row.tipo === territory.tipo)
    const current = yearResults.find((row) => row.id === territory.id)
    if (!current?.posicao) return []
    const peerIds = new Set(entities.filter((row) => row.parent_id === territory.parent_id).map((row) => row.id))
    const peers = yearResults.filter((row) => peerIds.has(row.id))
    return [{
      year,
      national: current.posicao,
      nationalTotal: yearResults.filter((row) => row.nota !== null).length,
      regional: valueRank(peers, territory.id),
      regionalTotal: peers.filter((row) => row.nota !== null).length,
    }]
  })
}

function makeSummary(
  kind: DashboardKind,
  metricLabel: string,
  selectedYear: number,
  primary: TerritoryRow,
  comparison: TerritoryRow | undefined,
  entityResults: ResultRow[],
  peers: ResultRow[],
  scopeName: string,
  scopeScore?: number | null,
): SummaryMetric[] {
  const primaryResult = entityResults.find((row) => row.id === primary.id && row.ano_referencia === selectedYear)
  const comparisonResult = comparison
    ? entityResults.find((row) => row.id === comparison.id && row.ano_referencia === selectedYear)
    : undefined
  const total = entityResults.filter((row) => row.ano_referencia === selectedYear && row.nota !== null).length
  const primaryEyebrow = kind === 'clp-municipios' ? 'Município principal' : 'Estado principal'
  const comparisonEyebrow = kind === 'clp-municipios' ? 'Comparação com o município' : 'Comparação com'
  const scopeEyebrow = kind === 'clp-municipios' ? 'Média do estado' : 'Média da região'

  return [
    {
      eyebrow: primaryEyebrow,
      title: primary.nome,
      metric: metricLabel,
      rank: rankText(primaryResult?.posicao, total),
      note: `nota ${scoreText(kind, primaryResult?.nota)}`,
      emphasis: 'primary',
    },
    {
      eyebrow: comparisonEyebrow,
      title: comparison?.nome ?? 'Não selecionado',
      metric: metricLabel,
      rank: comparison ? rankText(comparisonResult?.posicao, total) : '—',
      note: comparison ? `nota ${scoreText(kind, comparisonResult?.nota)}` : 'selecione para comparar',
    },
    {
      eyebrow: scopeEyebrow,
      title: scopeName,
      metric: metricLabel,
      rank: '—',
      note: `nota ${scoreText(kind, scopeScore ?? average(peers))}`,
    },
  ]
}

/** Diz se a edição candidata deve substituir a escolhida para um ano: a do próprio ano vence; senão, a mais recente. */
function prefersEdition(candidateEditionYear: number, chosenEditionYear: number | undefined, year: number) {
  if (chosenEditionYear === undefined) return true
  if (candidateEditionYear === year) return chosenEditionYear !== year
  return chosenEditionYear !== year && candidateEditionYear > chosenEditionYear
}

interface InsightResultRow {
  componente_id: string
  edicao_id: string
  ano_referencia: number
  media: number | null
  total: number
  nota: number | null
  posicao: number | null
  nota_comparacao: number | null
  posicao_comparacao: number | null
}

const insightLevels = ['PILAR', 'DIMENSAO', 'INDICADOR'] as const
type InsightLevel = typeof insightLevels[number]

/**
 * Componentes de cada nível relacionados à métrica, na ordem da estrutura:
 * todos (nota geral), a própria métrica, os descendentes do nível ou o ancestral do nível.
 * Os níveis saem ordenados pela profundidade na estrutura (ex.: no IBID o pilar vem antes da dimensão).
 */
function componentsForMetric(components: ComponentRow[], metricId: string) {
  const byId = new Map(components.map((component) => [component.id, component]))
  const byParent = new Map<string, ComponentRow[]>()
  for (const component of components) {
    const key = component.parent_id ?? ''
    byParent.set(key, [...(byParent.get(key) ?? []), component])
  }
  const ordered: ComponentRow[] = []
  const visit = (parentId: string) => {
    const children = (byParent.get(parentId) ?? [])
      .sort((a, b) => (a.ordem_exibicao ?? 9999) - (b.ordem_exibicao ?? 9999) || a.nome.localeCompare(b.nome, 'pt-BR'))
    for (const child of children) {
      ordered.push(child)
      visit(child.id)
    }
  }
  visit('')

  const ancestorsOf = (component: ComponentRow) => {
    const ancestors: ComponentRow[] = []
    let current = component.parent_id ? byId.get(component.parent_id) : undefined
    while (current && !ancestors.includes(current)) {
      ancestors.push(current)
      current = current.parent_id ? byId.get(current.parent_id) : undefined
    }
    return ancestors
  }

  const metric = byId.get(metricId)
  const depthOf = (component: ComponentRow) => ancestorsOf(component).length

  const levels = insightLevels.flatMap((level) => {
    const ofLevel = ordered.filter((component) => component.tipo === level)
    if (!ofLevel.length) return []
    const depth = Math.min(...ofLevel.map(depthOf))
    let items: ComponentRow[]
    if (!metric || metric.tipo === 'GERAL') items = ofLevel
    else if (metric.tipo === level) items = [metric]
    else {
      const descendants = ofLevel.filter((component) => ancestorsOf(component).some((ancestor) => ancestor.id === metric.id))
      const ancestor = ancestorsOf(metric).find((component) => component.tipo === level)
      items = descendants.length ? descendants : ancestor ? [ancestor] : []
    }
    return items.length ? [{ level, depth, items }] : []
  })
  return levels.sort((a, b) => a.depth - b.depth)
}

function buildInsightItems(
  items: ComponentRow[],
  rows: InsightResultRow[],
  editionYearById: Map<string, number>,
  years: number[],
  selectedYear: number,
): ComponentInsight[] {
  const chosen = new Map<string, InsightResultRow>()
  for (const row of rows) {
    const key = `${row.componente_id}:${row.ano_referencia}`
    const current = chosen.get(key)
    const currentYear = current ? editionYearById.get(current.edicao_id) : undefined
    if (prefersEdition(editionYearById.get(row.edicao_id)!, currentYear, row.ano_referencia)) chosen.set(key, row)
  }

  return items.flatMap((item) => {
    const history = years.map((year) => {
      const row = chosen.get(`${item.id}:${year}`)
      return { year, position: row?.posicao ?? null, comparisonPosition: row?.posicao_comparacao ?? null, total: row?.total ?? 0 }
    })
    const current = chosen.get(`${item.id}:${selectedYear}`)
    if (!current && history.every((point) => point.position === null && point.comparisonPosition === null)) return []
    return [{
      id: item.id,
      name: item.nome,
      score: numberValue(current?.nota),
      comparisonScore: numberValue(current?.nota_comparacao),
      nationalAverage: numberValue(current?.media),
      position: current?.posicao ?? null,
      total: current?.total ?? 0,
      history,
    }]
  })
}

/** Filhos de cada componente na ordem de exibição e a numeração hierárquica (ex.: [1, 2] = 1.2) a partir da nota geral. */
function indexComponents(components: ComponentRow[]) {
  const byParent = new Map<string, ComponentRow[]>()
  for (const component of components) {
    if (!component.parent_id) continue
    const siblings = byParent.get(component.parent_id) ?? []
    siblings.push(component)
    byParent.set(component.parent_id, siblings)
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => (a.ordem_exibicao ?? 9999) - (b.ordem_exibicao ?? 9999) || a.nome.localeCompare(b.nome, 'pt-BR'))
  }

  const general = components.find((component) => component.tipo === 'GERAL')
  const roots = general ? byParent.get(general.id) ?? [] : components.filter((component) => !component.parent_id)
  const pathByComponent = new Map<string, number[]>()
  const indexPaths = (items: ComponentRow[], parentPath: number[] = []) => {
    items.forEach((item, index) => {
      const path = [...parentPath, index + 1]
      pathByComponent.set(item.id, path)
      indexPaths(byParent.get(item.id) ?? [], path)
    })
  }
  indexPaths(roots)

  return { byParent, general, roots, pathByComponent }
}

const metricGroupLabels: Record<string, string> = {
  GERAL: 'Geral',
  GRUPO: 'Grupos',
  PILAR: 'Pilares',
  DIMENSAO: 'Dimensões',
}

/**
 * Opções do filtro de métrica agrupadas por tipo e na ordem da estrutura.
 * Os dois primeiros níveis levam a numeração (1. / 1.1); os mais profundos, o nome do componente pai (Pilar › Dimensão).
 */
function buildMetricOptions(metrics: ComponentRow[], components: ComponentRow[], metricTypes: readonly string[], kind: DashboardKind): SelectOption[] {
  const byId = new Map(components.map((component) => [component.id, component]))
  const { pathByComponent } = indexComponents(components)
  const comparePaths = (a: number[] | undefined, b: number[] | undefined) => {
    if (!a || !b) return (a ? 0 : 1) - (b ? 0 : 1)
    for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
      if (a[index] !== b[index]) return a[index] - b[index]
    }
    return a.length - b.length
  }

  return metrics
    .slice()
    .sort((a, b) => metricTypes.indexOf(a.tipo) - metricTypes.indexOf(b.tipo)
      || comparePaths(pathByComponent.get(a.id), pathByComponent.get(b.id))
      || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((metric) => {
      const path = pathByComponent.get(metric.id)
      const parentId = byId.get(metric.id)?.parent_id
      const parent = parentId ? byId.get(parentId) : undefined
      let label = metric.nome
      if (metric.tipo === 'GERAL') label = kind === 'ibid' ? 'Nota Geral (IBID)' : 'Nota Geral (CLP)'
      else if (path && path.length <= 2) label = `${path.length === 1 ? `${path[0]}.` : path.join('.')} ${metric.nome}`
      else if (parent && parent.tipo !== 'GERAL') label = `${parent.nome} › ${metric.nome}`
      return { label, value: metric.codigo, group: metricGroupLabels[metric.tipo] ?? typeLabels[metric.tipo] }
    })
}

function buildDetails(
  components: ComponentRow[],
  detailResults: DetailResultRow[],
  primary: TerritoryRow,
  scopeTerritoryId: string | undefined,
  comparison: TerritoryRow | undefined,
  comparisonScopeTerritoryId: string | undefined,
  selectedMetricId: string,
  kind: DashboardKind,
  selectedYear: number,
  entities: TerritoryRow[],
) {
  const { byParent, general, roots, pathByComponent } = indexComponents(components)

  const resultByComponent = new Map<string, DetailResultRow[]>()
  for (const result of detailResults) {
    if (!result.componente_id) continue
    const values = resultByComponent.get(result.componente_id) ?? []
    values.push(result)
    resultByComponent.set(result.componente_id, values)
  }
  const peerIds = new Set(entities.filter((row) => row.parent_id === scopeTerritoryId).map((row) => row.id))
  const comparisonPeerIds = new Set(
    entities.filter((row) => row.parent_id === comparisonScopeTerritoryId).map((row) => row.id),
  )

  function descend(component: ComponentRow, path: number[]): DetailRow {
    const results = resultByComponent.get(component.id) ?? []
    const primaryResult = results.find((row) => row.id === primary.id)
    const comparisonResult = comparison ? results.find((row) => row.id === comparison.id) : undefined
    const peerResults = results.filter((row) => peerIds.has(row.id))
    const comparisonPeerResults = results.filter((row) => comparisonPeerIds.has(row.id))
    const officialRegion = kind === 'ibid' ? results.find((row) => row.id === scopeTerritoryId) : undefined
    const comparisonOfficialRegion = kind === 'ibid'
      ? results.find((row) => row.id === comparisonScopeTerritoryId)
      : undefined
    const regionalRank = valueRank(peerResults, primary.id)
    const comparisonRegionalRank = comparison ? valueRank(comparisonPeerResults, comparison.id) : undefined
    const children = byParent.get(component.id) ?? []
    const level = (typeLabels[component.tipo] ?? 'Indicador') as DetailRow['level']
    const childRows = children.map((child, index) => descend(child, [...path, index + 1]))
    // Pilares e dimensões não têm ano próprio: vale o dado mais recente entre os componentes filhos.
    const childYears = childRows.flatMap((row) => row.updateYear ? [Number(row.updateYear)] : [])
    const updateYear = component.ultimo_ano_disponivel ?? (childYears.length ? Math.max(...childYears) : undefined)
    return {
      id: component.id,
      level,
      title: `${path.join('.')}. ${component.nome}`,
      nationalRank: primaryResult?.posicao ? `${primaryResult.posicao}º` : '—',
      nationalScore: scoreText(kind, primaryResult?.nota),
      regionalRank: regionalRank ? `${regionalRank}º` : '—',
      regionalScore: scoreText(kind, officialRegion?.nota ?? average(peerResults)),
      comparisonNationalRank: comparisonResult?.posicao ? `${comparisonResult.posicao}º` : undefined,
      comparisonNationalScore: comparison ? scoreText(kind, comparisonResult?.nota) : undefined,
      comparisonRegionalRank: comparisonRegionalRank ? `${comparisonRegionalRank}º` : undefined,
      comparisonRegionalScore: comparison
        ? scoreText(kind, comparisonOfficialRegion?.nota ?? average(comparisonPeerResults))
        : undefined,
      year: String(selectedYear),
      updateYear: updateYear ? String(updateYear) : undefined,
      description: component.descricao ?? undefined,
      unit: component.unidade_medida ?? undefined,
      source: component.fonte ?? undefined,
      children: childRows,
    }
  }

  if (general?.id !== selectedMetricId) {
    const selectedMetric = components.find((component) => component.id === selectedMetricId)
    if (selectedMetric) {
      return [descend(selectedMetric, pathByComponent.get(selectedMetric.id) ?? [1])]
    }
  }

  return roots.map((root, index) => descend(root, [index + 1]))
}

export class DashboardService {
  constructor(private readonly pool: pg.Pool) {}

  async getDashboard(kind: DashboardKind, values: QueryValues): Promise<DashboardDataset> {
    const config = kindConfig[kind]
    const client = await this.pool.connect()
    try {
      const editionResult = await client.query<{
        id: string
        ano: number
        updated_at: string
      }>(`
        select e.id, e.ano, max(ci.concluida_em)::text as updated_at
        from edicao e
        join pesquisa p on p.id = e.pesquisa_id
        join carga_importacao ci on ci.status = 'SUCESSO'
        join arquivo_fonte af on af.id = ci.arquivo_fonte_id and af.edicao_id = e.id and af.ativo
        where p.codigo = $1
        group by e.id
        order by e.ano desc
      `, [config.research])
      // Uma pesquisa pode ter várias edições (ex.: uma planilha por ano do CLP Municípios).
      const editions = editionResult.rows
      const latestEdition = editions[0]
      if (!latestEdition) throw new Error(`Não há carga concluída para ${config.research}.`)
      const editionIds = editions.map((row) => row.id)

      const territoryResult = await client.query<TerritoryRow>(`
        select t.id, t.codigo, t.sigla, t.nome, t.tipo, t.parent_id
        from territorio t
        where t.tipo in ('REGIAO', 'UF', 'MUNICIPIO')
        order by t.nome
      `)
      const allTerritories = territoryResult.rows
      const regions = allTerritories.filter((row) => row.tipo === 'REGIAO')
      const states = allTerritories.filter((row) => row.tipo === 'UF')
      const municipalities = allTerritories.filter((row) => row.tipo === 'MUNICIPIO')
      const municipalityParentIds = new Set(municipalities.map((row) => row.parent_id))
      const availableStates = kind === 'clp-municipios' ? states.filter((row) => municipalityParentIds.has(row.id)) : states
      const selectedState = findTerritory(availableStates, values.state, (row) => row.sigla === 'PI')
      const availableEntities = kind === 'clp-municipios'
        ? municipalities.filter((row) => row.parent_id === selectedState?.id)
        : states
      const primary = findTerritory(
        availableEntities,
        values.primary,
        (row) => kind === 'clp-municipios' ? row.nome === 'Teresina' : row.sigla === 'PI',
      )
      if (!primary) throw new Error('Nenhum território disponível para o painel.')
      const comparison = availableEntities.find((row) => row.codigo === values.comparison && row.id !== primary.id)

      const metricResult = await client.query<ComponentRow>(`
        select distinct on (c.id) c.id, c.codigo, c.tipo, ce.nome,
          null::uuid as parent_id, ce.ordem::integer as ordem_exibicao,
          ce.descricao, ce.fonte, ce.unidade_medida
        from componente c
        join pesquisa p on p.id = c.pesquisa_id
        join componente_edicao ce on ce.componente_id = c.id and ce.edicao_id = any($2::uuid[])
        join edicao e on e.id = ce.edicao_id
        join carga_importacao ci on ci.id = ce.carga_importacao_id and ci.status = 'SUCESSO'
        where p.codigo = $1 and c.tipo = any($3::varchar[])
        order by c.id, e.ano desc, ci.concluida_em desc
      `, [config.research, editionIds, config.metricTypes])
      const metrics = metricResult.rows.sort((a, b) => {
        const order = config.metricTypes.indexOf(a.tipo as never) - config.metricTypes.indexOf(b.tipo as never)
        return order || (a.ordem_exibicao ?? 9999) - (b.ordem_exibicao ?? 9999) || a.nome.localeCompare(b.nome, 'pt-BR')
      })
      const metric = metrics.find((row) => row.codigo === values.metric) ?? metrics.find((row) => row.tipo === 'GERAL') ?? metrics[0]
      if (!metric) throw new Error('Nenhum indicador disponível para o painel.')

      const allResultsQuery = await client.query<ResultRow & { edicao_id: string }>(`
        select t.id, t.codigo, t.sigla, t.nome, t.tipo, t.parent_id, rr.edicao_id,
          rr.ano_referencia, rr.nota_normalizada::float8 as nota, rr.posicao
        from resultado_ranking rr
        join territorio t on t.id = rr.territorio_id
        where rr.edicao_id = any($1::uuid[]) and rr.componente_id = $2
          and t.tipo = any($3::varchar[])
      `, [
        editionIds,
        metric.id,
        kind === 'ibid'
          ? [config.entityType, 'REGIAO']
          : kind === 'clp-municipios'
            ? [config.entityType, 'UF']
            : [config.entityType],
      ])

      // Cada ano usa uma única edição, para não misturar posições de publicações diferentes:
      // a edição daquele próprio ano, ou, se não houver, a mais recente que traga o ano.
      const editionYearById = new Map(editions.map((row) => [row.id, row.ano]))
      const editionIdByYear = new Map<number, string>()
      for (const row of allResultsQuery.rows) {
        if (row.tipo !== config.entityType) continue
        const chosen = editionIdByYear.get(row.ano_referencia)
        const chosenYear = chosen ? editionYearById.get(chosen) : undefined
        if (prefersEdition(editionYearById.get(row.edicao_id)!, chosenYear, row.ano_referencia)) {
          editionIdByYear.set(row.ano_referencia, row.edicao_id)
        }
      }
      const allResults = allResultsQuery.rows
        .filter((row) => editionIdByYear.get(row.ano_referencia) === row.edicao_id)
        .map(({ edicao_id: _editionId, ...row }) => ({ ...row, nota: numberValue(row.nota) }))
      // Alguns componentes (ex.: pilares do IBID) trazem a posição de um único ano; nos demais,
      // a posição nacional é calculada pela nota do próprio ano.
      for (const row of allResults) {
        if (row.posicao !== null || row.nota === null || row.tipo !== config.entityType) continue
        row.posicao = valueRank(
          allResults.filter((other) => other.tipo === config.entityType && other.ano_referencia === row.ano_referencia),
          row.id,
        ) ?? null
      }
      const entityResults = allResults.filter((row) => row.tipo === config.entityType)
      const years = [...new Set(entityResults.map((row) => row.ano_referencia))].sort((a, b) => a - b)
      const selectedYear = years.includes(Number(values.year)) ? Number(values.year) : years.at(-1)
      if (!selectedYear) throw new Error(`Não há resultados para ${metric.nome}.`)
      const edition = editions.find((row) => row.id === editionIdByYear.get(selectedYear)) ?? latestEdition

      const selectedRegion = regions.find((row) => row.id === primary.parent_id)
        ?? regions.find((row) => row.codigo === values.region)
      const scopeTerritory = kind === 'clp-municipios' ? selectedState : selectedRegion
      const comparisonScopeTerritory = comparison
        ? kind === 'clp-municipios'
          ? selectedState
          : regions.find((row) => row.id === comparison.parent_id)
        : undefined
      const hasDistinctComparisonScope = Boolean(
        comparisonScopeTerritory && comparisonScopeTerritory.id !== scopeTerritory?.id,
      )
      const scopeName = scopeTerritory?.nome ?? 'Brasil'
      const peerIds = new Set(allTerritories.filter((row) => row.tipo === config.entityType && row.parent_id === scopeTerritory?.id).map((row) => row.id))
      const selectedPeers = entityResults.filter((row) => row.ano_referencia === selectedYear && peerIds.has(row.id))
      const selectedEntities = entityResults.filter((row) => row.ano_referencia === selectedYear)
      const selectedOfficialRegion = kind === 'ibid'
        ? allResults.find((row) => row.tipo === 'REGIAO' && row.codigo === selectedRegion?.codigo && row.ano_referencia === selectedYear)
        : undefined
      const metricLabel = titleForMetric(metric, kind)

      const seriesByTerritory = (territory: TerritoryRow | undefined) => years.map((year) => {
        if (!territory) return null
        return entityResults.find((row) => row.id === territory.id && row.ano_referencia === year)?.nota ?? null
      })
      const nationalAverageSeries = years.map((year) => (
        average(entityResults.filter((row) => row.ano_referencia === year))
      ))
      const seriesByScope = (scope: TerritoryRow | undefined) => {
        const scopedPeerIds = new Set(
          allTerritories
            .filter((row) => row.tipo === config.entityType && row.parent_id === scope?.id)
            .map((row) => row.id),
        )

        return years.map((year) => {
          const officialRegion = kind === 'ibid'
            ? allResults.find((row) => row.tipo === 'REGIAO' && row.codigo === scope?.codigo && row.ano_referencia === year)
            : undefined
          if (officialRegion?.nota !== null && officialRegion?.nota !== undefined) return officialRegion.nota
          return average(entityResults.filter((row) => row.ano_referencia === year && scopedPeerIds.has(row.id)))
        })
      }
      const regionalSeries = seriesByScope(scopeTerritory)
      const comparisonRegionalSeries = hasDistinctComparisonScope ? seriesByScope(comparisonScopeTerritory) : []
      const allChartValues = [
        ...seriesByTerritory(primary),
        ...seriesByTerritory(comparison),
        ...nationalAverageSeries,
        ...regionalSeries,
        ...comparisonRegionalSeries,
      ]
        .filter((value): value is number => value !== null)
      const rawMax = Math.max(...allChartValues, kind === 'ibid' ? 1 : 100)
      const yMax = kind === 'ibid' ? Math.min(1, Math.ceil(rawMax * 10) / 10) : Math.ceil(rawMax / 10) * 10

      const structureResult = await client.query<{ id: string }>(`
        select e.id
        from estrutura e
        join carga_importacao ci on ci.id = e.carga_importacao_id and ci.status = 'SUCESSO'
        where e.edicao_id = $1 and ($2 <> 'IBID' or e.codigo = 'IBID')
          and ($2 = 'IBID' or e.codigo = 'PADRAO')
        order by (select count(*) from estrutura_componente ec where ec.estrutura_id = e.id) desc,
          ci.concluida_em desc
        limit 1
      `, [edition.id, config.research])
      const structureId = structureResult.rows[0]?.id
      let components: ComponentRow[] = []
      let details: DetailRow[] = []
      let highlights: HighlightGroup[] = []
      let insightGroups: InsightGroup[] = []
      if (structureId) {
        const componentResult = await client.query<ComponentRow>(`
          select c.id, c.codigo, c.tipo, ce.nome, ec.parent_componente_id as parent_id,
            ec.ordem_exibicao, ce.descricao, ce.fonte, ce.unidade_medida,
            -- Algumas cargas da mesma edição não trazem o ano; usa o de outra carga quando houver.
            coalesce(ce.ultimo_ano_disponivel, (
              select max(other.ultimo_ano_disponivel) from componente_edicao other
              where other.componente_id = c.id and other.edicao_id = e.edicao_id
            )) as ultimo_ano_disponivel
          from estrutura_componente ec
          join componente c on c.id = ec.componente_id
          join estrutura e on e.id = ec.estrutura_id
          left join componente_edicao ce on ce.componente_id = c.id
            and ce.edicao_id = e.edicao_id and ce.carga_importacao_id = e.carga_importacao_id
          where ec.estrutura_id = $1
          order by ec.ordem_exibicao nulls last, c.codigo
        `, [structureId])
        components = componentResult.rows
        const componentIds = components.map((component) => component.id)
        const detailTerritoryIds = new Set(peerIds)
        detailTerritoryIds.add(primary.id)
        if (comparison) detailTerritoryIds.add(comparison.id)
        if (comparisonScopeTerritory) {
          allTerritories
            .filter((row) => row.tipo === config.entityType && row.parent_id === comparisonScopeTerritory.id)
            .forEach((row) => detailTerritoryIds.add(row.id))
        }
        if (kind === 'ibid' && scopeTerritory?.id) detailTerritoryIds.add(scopeTerritory.id)
        if (kind === 'ibid' && comparisonScopeTerritory?.id) detailTerritoryIds.add(comparisonScopeTerritory.id)
        const detailResult = kind === 'ibid'
          // O IBID só traz a posição dos pilares em alguns anos: nos demais, ela sai da ordem das notas entre os estados.
          ? await client.query<DetailResultRow>(`
              select componente_id, id, nota, posicao from (
                select rr.componente_id, rr.territorio_id as id, rr.nota_normalizada::float8 as nota,
                  coalesce(rr.posicao, case when t.tipo = $5 and rr.nota_normalizada is not null then
                    rank() over (
                      partition by rr.componente_id, t.tipo = $5, rr.nota_normalizada is null
                      order by rr.nota_normalizada desc
                    )
                  end)::integer as posicao
                from resultado_ranking rr
                join territorio t on t.id = rr.territorio_id
                where rr.edicao_id = $1 and rr.componente_id = any($2::uuid[])
                  and rr.ano_referencia = $3
              ) ranked
              where id = any($4::uuid[])
            `, [edition.id, componentIds, selectedYear, [...detailTerritoryIds], config.entityType])
          : await client.query<DetailResultRow>(`
              select rr.componente_id, rr.territorio_id as id,
                rr.nota_normalizada::float8 as nota, rr.posicao
              from resultado_ranking rr
              where rr.edicao_id = $1 and rr.componente_id = any($2::uuid[])
                and rr.ano_referencia = $3
                and rr.territorio_id = any($4::uuid[])
            `, [edition.id, componentIds, selectedYear, [...detailTerritoryIds]])
        const detailRows = detailResult.rows.map((row) => ({ ...row, nota: numberValue(row.nota) }))
        details = buildDetails(
          components,
          detailRows,
          primary,
          scopeTerritory?.id,
          comparison,
          comparisonScopeTerritory?.id,
          metric.id,
          kind,
          selectedYear,
          allTerritories,
        )

        const highlightResult = await client.query<DetailResultRow>(`
          select rr.componente_id, rr.territorio_id as id, rr.ano_referencia,
            rr.nota_normalizada::float8 as nota, rr.posicao, rr.delta_posicao
          from resultado_ranking rr
          where rr.edicao_id = $1 and rr.componente_id = any($2::uuid[])
            and rr.ano_referencia <= $3 and rr.territorio_id = $4
          order by rr.ano_referencia
        `, [edition.id, componentIds, selectedYear, primary.id])
        highlights = buildHighlights(components, highlightResult.rows, selectedYear, kind)

        const insightLevelsForMetric = componentsForMetric(components, metric.id)
        if (insightLevelsForMetric.length) {
          // Agregado no banco: média nacional e total por componente/ano/edição, com nota e posição do principal e da comparação.
          // Alguns anos (ex.: IBID antes de 2025) não têm posição oficial; nesses, a posição sai da ordem das notas.
          const insightResult = await client.query<InsightResultRow>(`
            with base as (
              select rr.componente_id, rr.edicao_id, rr.ano_referencia, rr.territorio_id, rr.nota_normalizada, rr.posicao
              from resultado_ranking rr
              join territorio t on t.id = rr.territorio_id
              where rr.edicao_id = any($1::uuid[]) and rr.componente_id = any($2::uuid[]) and t.tipo = $3
            ), grouped as (
              select componente_id, edicao_id, ano_referencia,
                avg(nota_normalizada)::float8 as media,
                count(nota_normalizada)::int as total,
                max(nota_normalizada) filter (where territorio_id = $4) as nota,
                max(posicao) filter (where territorio_id = $4) as posicao_oficial,
                max(nota_normalizada) filter (where territorio_id = $5) as nota_comparacao,
                max(posicao) filter (where territorio_id = $5) as posicao_comparacao_oficial
              from base
              group by componente_id, edicao_id, ano_referencia
            )
            select g.componente_id, g.edicao_id, g.ano_referencia, g.media, g.total, g.nota::float8 as nota, g.nota_comparacao::float8 as nota_comparacao,
              coalesce(g.posicao_oficial, case when g.nota is not null then 1 + (
                select count(*) from base b
                where b.componente_id = g.componente_id and b.edicao_id = g.edicao_id
                  and b.ano_referencia = g.ano_referencia and b.nota_normalizada > g.nota
              ) end)::int as posicao,
              coalesce(g.posicao_comparacao_oficial, case when g.nota_comparacao is not null then 1 + (
                select count(*) from base b
                where b.componente_id = g.componente_id and b.edicao_id = g.edicao_id
                  and b.ano_referencia = g.ano_referencia and b.nota_normalizada > g.nota_comparacao
              ) end)::int as posicao_comparacao
            from grouped g
          `, [
            editionIds,
            insightLevelsForMetric.flatMap((entry) => entry.items.map((item) => item.id)),
            config.entityType,
            primary.id,
            comparison?.id ?? null,
          ])
          // Níveis sem nenhum dado (ex.: indicadores do IBID) ficam de fora.
          insightGroups = insightLevelsForMetric.flatMap(({ level, items }) => {
            const insights = buildInsightItems(items, insightResult.rows, editionYearById, years, selectedYear)
            return insights.length ? [{ level: typeLabels[level] as InsightGroup['level'], items: insights }] : []
          })
        }
      }

      const stateOptions = availableStates.map((state) => kind === 'clp-municipios'
        ? {
            label: `${state.nome} · ${municipalities.filter((municipality) => municipality.parent_id === state.id).length} municípios`,
            value: state.codigo,
          }
        : toOption(state))
      const primaryOptions = availableEntities.map(toOption)
      const regionOptions = regions.map((region) => ({
        label: `${region.nome} · ${states.filter((state) => state.parent_id === region.id).length} estados`,
        value: region.codigo,
      }))
      const metricOptions = buildMetricOptions(metrics, components, config.metricTypes, kind)
      const filters: FilterDefinition[] = kind === 'clp-municipios'
        ? [
            { id: 'state', label: 'Estado', value: selectedState.codigo, options: stateOptions },
            { id: 'primary', label: 'Município principal', value: primary.codigo, options: primaryOptions },
            { id: 'comparison', label: 'Comparação com o município', value: comparison?.codigo ?? '', options: [{ label: 'Selecione um município', value: '' }, ...primaryOptions.filter((option) => option.value !== primary.codigo)] },
            { id: 'year', label: 'Ano', value: String(selectedYear), options: years.slice().reverse().map((year) => ({ label: String(year), value: String(year) })) },
            { id: 'metric', label: 'Métrica', value: metric.codigo, options: metricOptions },
          ]
        : [
            { id: 'primary', label: 'Estado principal', value: primary.codigo, options: stateOptions },
            { id: 'comparison', label: 'Comparação com', value: comparison?.codigo ?? '', options: [{ label: 'Selecione um estado', value: '' }, ...stateOptions.filter((option) => option.value !== primary.codigo)] },
            { id: 'region', label: 'Região', value: selectedRegion?.codigo ?? '', options: regionOptions, disabled: true },
            { id: 'year', label: 'Ano', value: String(selectedYear), options: years.slice().reverse().map((year) => ({ label: String(year), value: String(year) })) },
            { id: 'metric', label: 'Métrica', value: metric.codigo, options: metricOptions },
          ]

      const selectedStateResults = allResults.filter(
        (row) => row.tipo === 'UF' && row.ano_referencia === selectedYear,
      )
      const stateRanking = kind === 'clp-municipios'
        ? buildMunicipalStateRanking(states, municipalities, selectedEntities)
        : selectedStateResults.some((row) => row.nota !== null)
          ? buildStateRanking(states, selectedStateResults)
          : buildStateRanking(states, selectedEntities)

      return {
        kind,
        meta: {
          updatedAt: new Date(Math.max(...editions.map((row) => new Date(row.updated_at).getTime()))).toISOString(),
          dataPeriod: years.length === 1 ? String(years[0]) : `${years[0]}–${years.at(-1)}`,
          source: config.source,
        },
        filters,
        summary: makeSummary(kind, metricLabel, selectedYear, primary, comparison, entityResults, selectedPeers, scopeName, selectedOfficialRegion?.nota),
        chart: {
          years,
          primary: seriesByTerritory(primary),
          comparison: seriesByTerritory(comparison),
          nationalAverage: nationalAverageSeries,
          regional: regionalSeries,
          comparisonRegional: comparisonRegionalSeries,
          primaryLabel: primary.nome,
          comparisonLabel: comparison?.nome ?? 'Comparação',
          regionalLabel: kind === 'clp-municipios' ? `Média de ${scopeName}` : `Média do ${scopeName}`,
          comparisonRegionalLabel: comparisonScopeTerritory
            ? `Média do ${comparisonScopeTerritory.nome}`
            : '',
          yMax,
        },
        rankingLabels: {
          national: kind === 'clp-municipios' ? 'Top 5 Brasil' : 'Top 5 Brasil',
          regional: kind === 'clp-municipios' ? `Top 5 ${scopeName}` : `Top 5 ${scopeName}`,
        },
        nationalRanking: ranking(selectedEntities),
        regionalRanking: scopedRanking(selectedPeers),
        stateRanking,
        municipalityRanking: kind === 'clp-municipios' ? buildMunicipalityRanking(availableEntities, selectedEntities) : [],
        history: historyFor(primary, entityResults, allTerritories),
        comparisonHistory: historyFor(comparison, entityResults, allTerritories),
        highlights,
        insightGroups,
        metricLevel: (insightLevels as readonly string[]).includes(metric.tipo) ? typeLabels[metric.tipo] as InsightGroup['level'] : undefined,
        details,
      }
    } finally {
      client.release()
    }
  }
}
