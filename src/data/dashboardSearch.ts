import type { DashboardDataset, DashboardKind, FilterDefinition, SelectOption } from '../types/dashboard'
import type { PageId } from '../components/Header'

export interface DashboardSearchInterpretation {
  kind: DashboardKind | 'sobre'
  filters: Record<string, string>
  matchedFilters: string[]
}

export function normalizeSearchText(value: string) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function editDistance(a: string, b: string) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length]
}

function tokenSimilarity(a: string, b: string) {
  if (a === b) return 1
  if (a.length < 4 || b.length < 4) return 0
  if (a.startsWith(b) || b.startsWith(a)) return 0.92
  return 1 - editDistance(a, b) / Math.max(a.length, b.length)
}

function optionAliases(option: SelectOption) {
  const cleanLabel = option.label.split('·')[0].split('(')[0].trim()
  const aliases = new Set([normalizeSearchText(cleanLabel)])
  const acronym = option.label.match(/\(([A-Z]{2,3})\)/)?.[1]
  if (acronym) aliases.add(normalizeSearchText(acronym))
  if (/^[a-zA-Z]{1,3}$/.test(option.value)) aliases.add(normalizeSearchText(option.value))
  return [...aliases].filter(Boolean)
}

function optionMentionScore(query: string, option: SelectOption) {
  const queryTokens = query.split(' ').filter(Boolean)
  let best = 0
  for (const alias of optionAliases(option)) {
    const exactPattern = new RegExp(`(?:^| )${alias.replace(/ /g, ' +')}(?: |$)`)
    if (exactPattern.test(query)) best = Math.max(best, 100 + alias.length)
    if (!alias.includes(' ')) {
      for (const token of queryTokens) {
        const similarity = tokenSimilarity(alias, token)
        if (similarity >= 0.6) best = Math.max(best, similarity * 80)
      }
    }
  }
  return best
}

function findMentionedOptions(query: string, filter: FilterDefinition) {
  return filter.options
    .map((option) => ({ option, score: optionMentionScore(query, option) }))
    .filter(({ option, score }) => option.value && score > 0)
    .sort((a, b) => b.score - a.score)
}

function metricScore(query: string, option: SelectOption) {
  const normalizedLabel = normalizeSearchText(option.label)
  const specificLabel = normalizedLabel
    .replace(/^(nota geral|grupo|pilar|dimensao|indicador) /, '')
    .replace(/\b(ibid|clp)\b/g, '')
    .trim()
  const queryTokens = query.split(' ').filter(Boolean)
  const aliases = [normalizedLabel, specificLabel].filter(Boolean)
  let score = 0
  for (const alias of aliases) {
    if (query.includes(alias)) score = Math.max(score, 120 + alias.length)
    const aliasTokens = alias.split(' ').filter((token) => token.length >= 4)
    if (aliasTokens.length && aliasTokens.every((aliasToken) => queryTokens.some((token) => tokenSimilarity(aliasToken, token) >= 0.8))) {
      score = Math.max(score, 80 + aliasTokens.length * 5 - alias.length / 100)
    }
    for (const aliasToken of aliasTokens.filter((token) => token.length >= 5)) {
      const bestTokenMatch = queryTokens.reduce((best, token) => Math.max(best, tokenSimilarity(aliasToken, token)), 0)
      if (bestTokenMatch >= 0.82) score = Math.max(score, 65 + bestTokenMatch * 15 + aliasToken.length / 100)
    }
  }
  return score
}

export function detectDashboardKind(command: string, currentPage: PageId): DashboardKind | 'sobre' {
  const query = normalizeSearchText(command)
  if (/\b(sobre|inicio|apresentacao)\b/.test(query) && !/\b(ibid|clp)\b/.test(query)) return 'sobre'
  if (/\bibid\b/.test(query)) return 'ibid'
  if (/\b(municipio|municipios|municipal|cidade|cidades)\b/.test(query)) return 'clp-municipios'
  if (/\bclp\b/.test(query)) return currentPage.startsWith('clp') ? currentPage : 'clp-estados'
  return currentPage === 'sobre' ? 'ibid' : currentPage
}

export function interpretDashboardSearch(command: string, dashboard: DashboardDataset): DashboardSearchInterpretation {
  const query = normalizeSearchText(command)
  const filters = Object.fromEntries(dashboard.filters.map((filter) => [filter.id, filter.value]))
  const matchedFilters: string[] = []
  const filterById = (id: string) => dashboard.filters.find((filter) => filter.id === id)

  const stateFilter = filterById('state')
  if (stateFilter) {
    const match = findMentionedOptions(query, stateFilter)[0]
    if (match) {
      filters.state = match.option.value
      matchedFilters.push(match.option.label)
    }
  }

  const regionFilter = filterById('region')
  if (regionFilter) {
    const match = findMentionedOptions(query, regionFilter)[0]
    if (match) {
      filters.region = match.option.value
      matchedFilters.push(match.option.label.split('·')[0].trim())
    }
  }

  const yearFilter = filterById('year')
  const requestedYear = query.match(/\b(?:19|20)\d{2}\b/)?.[0]
  if (yearFilter && requestedYear && yearFilter.options.some((option) => option.value === requestedYear)) {
    filters.year = requestedYear
    matchedFilters.push(requestedYear)
  }

  const primaryFilter = filterById('primary')
  const comparisonFilter = filterById('comparison')
  if (primaryFilter) {
    const primaryMatches = findMentionedOptions(query, primaryFilter)
    const comparisonMatches = comparisonFilter ? findMentionedOptions(query, comparisonFilter) : []
    const allTerritoryMatches = [...primaryMatches, ...comparisonMatches]
    const exactTerritoryMatches = allTerritoryMatches.filter((match) => match.score >= 100)
    const selectedTerritoryMatches = exactTerritoryMatches.length
      ? exactTerritoryMatches
      : allTerritoryMatches.slice(0, 1)
    const territoryMatches = new Map<string, SelectOption>()
    for (const match of selectedTerritoryMatches) territoryMatches.set(match.option.value, match.option)
    const mentioned = [...territoryMatches.values()].sort((a, b) => {
      const positionsA = optionAliases(a).map((alias) => query.indexOf(alias)).filter((index) => index >= 0)
      const positionsB = optionAliases(b).map((alias) => query.indexOf(alias)).filter((index) => index >= 0)
      const indexA = positionsA.length ? Math.min(...positionsA) : Number.MAX_SAFE_INTEGER
      const indexB = positionsB.length ? Math.min(...positionsB) : Number.MAX_SAFE_INTEGER
      return indexA - indexB
    })
    if (mentioned[0]) {
      filters.primary = mentioned[0].value
      matchedFilters.push(mentioned[0].label)
      if (regionFilter && !matchedFilters.some((item) => regionFilter.options.some((option) => item.startsWith(option.label.split('·')[0].trim())))) {
        delete filters.region
      }
    }
    if (mentioned[1] && comparisonFilter) {
      filters.comparison = mentioned[1].value
      matchedFilters.push(`vs ${mentioned[1].label}`)
    }
  }

  const metricFilter = filterById('metric')
  if (metricFilter) {
    const metric = metricFilter.options
      .map((option) => ({ option, score: metricScore(query, option) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)[0]
    if (metric) {
      filters.metric = metric.option.value
      matchedFilters.push(metric.option.label)
    }
  }

  return { kind: dashboard.kind, filters, matchedFilters }
}
