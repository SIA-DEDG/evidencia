import { useMemo } from 'react'
import { comparisonHighlightMacros, type ComparisonHighlightSide } from '../data/comparisonRelations'
import type { ComparisonDataset } from '../types/dashboard'
import { HighlightsBand, type BandHighlight, type HighlightLevel, type HighlightStudy } from './Highlights'

/**
 * Cada mudança grande aparece uma vez, mesmo quando o pilar se relaciona com vários do outro estudo.
 * A linha do par fica só no cartão do IBID, para o mesmo par não ser contado duas vezes.
 */
function comparisonHighlights(data: ComparisonDataset): BandHighlight[] {
  const byStudyItem = new Map<string, BandHighlight>()
  const pairs = comparisonHighlightMacros(data).flatMap((macro) => [
    { pair: macro, level: 'pilar' as HighlightLevel },
    ...macro.indicators.map((pair) => ({ pair, level: 'indicador' as HighlightLevel })),
  ])

  for (const { pair, level } of pairs) {
    const sides: Array<[HighlightStudy, ComparisonHighlightSide, ComparisonHighlightSide]> = [
      ['IBID', pair.ibid, pair.clp],
      ['CLP', pair.clp, pair.ibid],
    ]
    for (const [study, side, other] of sides) {
      if (!side.highlight) continue
      const key = `${study}:${side.highlight.id}`
      const item = byStudyItem.get(key) ?? { ...side.highlight, level, study }
      if (study === 'IBID' && other.highlight && !item.counterpart) {
        item.counterpart = {
          study: 'CLP',
          title: other.highlight.title,
          change: other.highlight.change,
          topTier: other.highlight.topTier,
          topStatus: other.highlight.topStatus,
        }
      }
      byStudyItem.set(key, item)
    }
  }
  return [...byStudyItem.values()]
}

export function ComparisonHighlights({ data, primaryName }: { data: ComparisonDataset; primaryName: string }) {
  const items = useMemo(() => comparisonHighlights(data), [data])
  const year = Number(data.ibid.filters.find((filter) => filter.id === 'year')?.value)
  if (!year) return null
  return <HighlightsBand items={items} place={primaryName} year={year} />
}
