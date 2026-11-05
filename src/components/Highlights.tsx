import { useEffect, useId, useMemo, useState } from 'react'
import {
  BookOpen,
  Briefcase,
  ChartColumn,
  ChevronDown,
  Coins,
  HeartPulse,
  Landmark,
  Leaf,
  Lightbulb,
  Medal,
  Palette,
  Route,
  Shield,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { HighlightGroup, HighlightItem } from '../types/dashboard'

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

const visibleCount = 3

const levelOrder: Record<HighlightLevel, number> = { geral: 0, pilar: 1, dimensao: 2, indicador: 3 }
const levelLabels: Array<[HighlightLevel, string]> = [
  ['geral', 'Nota geral'],
  ['pilar', 'Pilares'],
  ['dimensao', 'Dimensões'],
  ['indicador', 'Indicadores'],
]

const iconRules: Array<[RegExp, LucideIcon]> = [
  [/nota geral/i, Trophy],
  [/instituiç|máquina|funcionamento|transparência|administrativ/i, Landmark],
  [/educaç|ensino|escolar|frequência/i, BookOpen],
  [/capital humano|qualificação|escolaridade|trabalhador/i, User],
  [/fiscal|investimento|pib|inadimpl|custo|economia(?! criativa)/i, Coins],
  [/conhecimento|tecnolog|inovaç|telecom|4g|digital|dinamismo/i, Lightbulb],
  [/infraestrutura|rodovia|saneamento|lixo/i, Route],
  [/negócio|mercado|empresa|emprego|inserção/i, Briefcase],
  [/criativ|cultura/i, Palette],
  [/saúde|mortalidade/i, HeartPulse],
  [/segurança/i, Shield],
  [/social/i, Users],
  [/ambient|áreas recuperadas|meio ambiente/i, Leaf],
]

function iconFor(item: BandHighlight) {
  const subject = item.level === 'geral' ? 'nota geral' : item.level === 'pilar' ? item.title : item.pillarTitle ?? item.title
  return iconRules.find(([pattern]) => pattern.test(subject))?.[1] ?? ChartColumn
}

function kindLabel(item: BandHighlight) {
  if (item.level === 'geral') return 'Nota geral'
  if (item.level === 'pilar') return 'Pilar'
  const label = item.level === 'dimensao' ? 'Dimensão' : 'Indicador'
  return item.pillarTitle ? `${label} · ${item.pillarTitle}` : label
}

const positions = (count: number) => `${count} ${count === 1 ? 'posição' : 'posições'}`

/** Visão rápida: nota geral, depois quem entrou no topo, depois as maiores variações; indicadores por último. */
export function prioritizeHighlights(items: BandHighlight[]) {
  const weight = (item: BandHighlight) => levelOrder[item.level] * 10000
    - (item.topStatus === 'entered' ? 5000 : 0)
    - Math.abs(item.change)
  return [...items].sort((a, b) => weight(a) - weight(b))
}

export function highlightsFromGroups(groups: HighlightGroup[]): BandHighlight[] {
  return groups.flatMap((group) => group.items.map((item) => ({
    ...item,
    level: (group.id in levelOrder ? group.id : 'indicador') as HighlightLevel,
  })))
}

function TopChip({ topTier, topStatus }: Pick<HighlightItem, 'topTier' | 'topStatus'>) {
  if (!topTier) return null
  return (
    <span className="band-chip band-chip-top">
      <Medal aria-hidden="true" size={12} />
      {topStatus === 'entered' ? 'Entrou no' : 'Segue no'} top {topTier}
    </span>
  )
}

function ChangeChip({ change }: { change: number }) {
  if (change > 0) return <span className="band-chip band-chip-up"><TrendingUp aria-hidden="true" size={12} />{positions(change)}</span>
  if (change < 0) return <span className="band-chip band-chip-down"><TrendingDown aria-hidden="true" size={12} />{positions(-change)}</span>
  return null
}

function CounterpartLine({ counterpart }: { counterpart: HighlightCounterpart }) {
  const movement = counterpart.change > 0
    ? `subiu ${positions(counterpart.change)}`
    : counterpart.change < 0 ? `caiu ${positions(-counterpart.change)}` : 'segue'
  const top = counterpart.topTier
    ? ` e ${counterpart.topStatus === 'entered' ? 'entrou no' : 'segue no'} top ${counterpart.topTier}`
    : ''
  return <p className="band-move-pair">No {counterpart.study}, <strong>{counterpart.title}</strong> {movement}{top}</p>
}

function MoveCard({ item }: { item: BandHighlight }) {
  const Icon = iconFor(item)
  return (
    <article className="band-move">
      <div className="band-move-rank">
        <strong>{item.currentPosition}º</strong>
        <span>no Brasil</span>
      </div>
      <div className="band-move-body">
        <p className="band-move-kind">
          <Icon aria-hidden="true" size={14} />
          {item.study && <b>{item.study}</b>}
          <span>{kindLabel(item)}</span>
        </p>
        <h3>{item.title}</h3>
        <div className="band-move-chips">
          <ChangeChip change={item.change} />
          <TopChip topStatus={item.topStatus} topTier={item.topTier} />
          {item.change !== 0 && <span className="band-move-was">era {item.previousPosition}º</span>}
        </div>
        {item.counterpart && <CounterpartLine counterpart={item.counterpart} />}
      </div>
    </article>
  )
}

/** Faixa de destaques do topo das abas: as mudanças grandes do ano, com as principais à mostra. */
export function HighlightsBand({ items, place, year }: { items: BandHighlight[]; place: string; year: number }) {
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const ordered = useMemo(() => prioritizeHighlights(items), [items])

  useEffect(() => setExpanded(false), [items])

  if (!ordered.length) return null

  const ups = ordered.filter((item) => item.change > 0).length
  const downs = ordered.filter((item) => item.change < 0).length
  const tops = ordered.filter((item) => item.topTier).length
  const groups = levelLabels
    .map(([level, label]) => [label, ordered.filter((item) => item.level === level)] as const)
    .filter(([, list]) => list.length)

  return (
    <section aria-labelledby={`${id}-title`} className="highlights-band">
      <div aria-hidden="true" className="highlights-band-pixels"><span /><span /><span /><span /></div>
      <div className="highlights-band-side">
        <p className="highlights-band-badge">Destaques {year}</p>
        <h2 id={`${id}-title`}>O que mudou para <span>{place}</span></h2>
        <p>Mudanças grandes no ranking Brasil, de {year - 1} para {year}.</p>
        <div aria-label="Resumo dos destaques" className="highlights-band-summary">
          {ups > 0 && <span className="band-chip band-chip-up"><TrendingUp aria-hidden="true" size={12} />{ups} {ups === 1 ? 'subiu' : 'subiram'}</span>}
          {downs > 0 && <span className="band-chip band-chip-down"><TrendingDown aria-hidden="true" size={12} />{downs} {downs === 1 ? 'caiu' : 'caíram'}</span>}
          {tops > 0 && <span className="band-chip band-chip-top"><Medal aria-hidden="true" size={12} />{tops} no topo</span>}
        </div>
        <details className="highlights-band-criteria">
          <summary>Como escolhemos</summary>
          <p>Entram os itens que mudaram mais de 3 posições no ranking Brasil em relação ao ano anterior e os que entraram ou seguem entre os top 10, 5 ou 3.</p>
        </details>
        {ordered.length > visibleCount && (
          <button aria-controls={`${id}-moves`} aria-expanded={expanded} className="highlights-band-toggle" onClick={() => setExpanded((value) => !value)} type="button">
            {expanded ? 'Mostrar só os principais' : `Ver todos os ${ordered.length} destaques`}
            <ChevronDown aria-hidden="true" className={expanded ? 'rotate-180' : ''} size={16} />
          </button>
        )}
      </div>
      <div className="highlights-band-main" id={`${id}-moves`}>
        {expanded
          ? groups.map(([label, list]) => (
            <div className="highlights-band-group" key={label}>
              <h3>{label} · {list.length}</h3>
              <div className="highlights-band-moves">{list.map((item) => <MoveCard item={item} key={`${item.study ?? ''}${item.id}`} />)}</div>
            </div>
          ))
          : <div className="highlights-band-moves">{ordered.slice(0, visibleCount).map((item) => <MoveCard item={item} key={`${item.study ?? ''}${item.id}`} />)}</div>}
      </div>
    </section>
  )
}

export function Highlights({ groups, primaryName }: { groups: HighlightGroup[]; primaryName: string }) {
  const items = useMemo(() => highlightsFromGroups(groups), [groups])
  const year = items[0]?.year
  if (!year) return null
  return <HighlightsBand items={items} place={primaryName} year={year} />
}
