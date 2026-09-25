import { pillarRelation, pillarRelations, type PillarRelation } from './studyRelations'
import type { ComparisonDataset, DetailRow, HighlightItem } from '../types/dashboard'

export interface ConceptRow {
  id: string
  relation: PillarRelation
  ibid?: DetailRow
  clp?: DetailRow
}

export interface ConceptChildRow {
  id: string
  ibidTitle: string
  clpTitle: string
  note: string
  source: string
  ibid?: DetailRow
  clp?: DetailRow
}

function normalizeName(value: string) {
  return value.replace(/^\d+(?:\.\d+)*\.?\s*/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR')
}

function findByName(rows: DetailRow[], name: string): DetailRow | undefined {
  const target = normalizeName(name)
  for (const row of rows) {
    if (normalizeName(row.title) === target) return row
    const child = findByName(row.children ?? [], name)
    if (child) return child
  }
}

/** A tabela e os destaques usam os mesmos pares, respeitando a métrica selecionada. */
export function conceptRows(data: ComparisonDataset): ConceptRow[] {
  const selected = pillarRelation(data.relation)
  return (selected ? [selected] : pillarRelations).map((relation) => ({
    id: relation.id,
    relation,
    ibid: findByName(data.ibid.details, relation.ibidPillar),
    clp: findByName(data.clp.details, relation.clpPillar),
  }))
}

export function childRows(concept: ConceptRow): ConceptChildRow[] {
  return concept.relation.indicators.map((indicator) => ({
    id: `${concept.id}-${normalizeName(indicator.clp)}`,
    ibidTitle: indicator.ibid,
    clpTitle: indicator.clp,
    note: indicator.note,
    source: indicator.source,
    ibid: findByName(concept.ibid ? [concept.ibid] : [], indicator.ibid),
    clp: findByName(concept.clp ? [concept.clp] : [], indicator.clp),
  }))
}

export interface ComparisonHighlightSide {
  title: string
  row?: DetailRow
  highlight?: HighlightItem
}

export interface ComparisonHighlightPair {
  id: string
  ibid: ComparisonHighlightSide
  clp: ComparisonHighlightSide
  note?: string
}

export interface ComparisonHighlightMacro extends ComparisonHighlightPair {
  indicators: ComparisonHighlightPair[]
}

export function comparisonHighlightMacros(data: ComparisonDataset): ComparisonHighlightMacro[] {
  const index = (study: 'ibid' | 'clp') => {
    const year = Number(data[study].filters.find((filter) => filter.id === 'year')?.value)
    return new Map(data[study].highlights.flatMap((group) => group.items)
      .filter((item) => item.year === year && item.previousYear === year - 1).map((item) => [item.id, item]))
  }
  const highlights = { ibid: index('ibid'), clp: index('clp') }
  const side = (study: 'ibid' | 'clp', title: string, row?: DetailRow): ComparisonHighlightSide => ({
    title,
    row,
    highlight: row ? highlights[study].get(row.id) : undefined,
  })

  return conceptRows(data).map((concept) => ({
    id: concept.id,
    ibid: side('ibid', concept.relation.ibidPillar, concept.ibid),
    clp: side('clp', concept.relation.clpPillar, concept.clp),
    indicators: childRows(concept).map((child) => ({
      id: child.id,
      note: child.note,
      ibid: side('ibid', child.ibidTitle, child.ibid),
      clp: side('clp', child.clpTitle, child.clp),
    })).filter((pair) => pair.ibid.highlight || pair.clp.highlight),
  })).filter((macro) => macro.ibid.highlight || macro.clp.highlight || macro.indicators.length > 0)
}
