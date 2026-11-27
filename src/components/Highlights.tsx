import { useMemo } from 'react'
import type { HighlightGroup, HighlightItem } from '../types/dashboard'
import { HighlightsBandV3 } from './HighlightsBandV3'

export type HighlightLevel = 'geral' | 'pilar' | 'dimensao' | 'indicador'
export type HighlightStudy = 'IBID' | 'CLP'

export interface HighlightCounterpart {
  study: HighlightStudy
  title: string
  change: number
  topTier?: HighlightItem['topTier']
  topStatus?: HighlightItem['topStatus']
}

/** Uma mudança grande pronta para a faixa de destaques. */
export interface BandHighlight extends HighlightItem {
  level: HighlightLevel
  study?: HighlightStudy
  counterpart?: HighlightCounterpart
}

export function highlightsFromGroups(groups: HighlightGroup[]): BandHighlight[] {
  return groups.flatMap((group) => group.items.map((item) => ({
    ...item,
    level: (group.id in levelOrder ? group.id : 'indicador') as HighlightLevel,
  })))
}

export function HighlightsBand({ items, place, year }: { items: BandHighlight[]; place: string; year: number }) {
  return <HighlightsBandV3 items={items} place={place} year={year} />
}

export function Highlights({ groups, primaryName }: { groups: HighlightGroup[]; primaryName: string }) {
  const items = useMemo(() => highlightsFromGroups(groups), [groups])
  const year = items[0]?.year
  if (!year) return null
  return <HighlightsBand items={items} place={primaryName} year={year} />
}
