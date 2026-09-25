import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { comparisonHighlightMacros, type ComparisonHighlightPair, type ComparisonHighlightSide } from '../data/comparisonRelations'
import type { ComparisonDataset } from '../types/dashboard'
import { HighlightCard } from './Highlights'

function StudyHighlight({ side, study, primaryName }: {
  side: ComparisonHighlightSide
  study: 'IBID' | 'CLP'
  primaryName: string
}) {
  if (!side.highlight) return null
  return (
    <div className="comparison-highlight-study">
      <h3><span>{study}</span>{side.title}</h3>
      <HighlightCard item={side.highlight} primaryName={primaryName} showTitle={false} />
    </div>
  )
}

function HighlightPair({ pair, primaryName }: { pair: ComparisonHighlightPair; primaryName: string }) {
  if (!pair.ibid.highlight && !pair.clp.highlight) return null
  return (
    <div className="comparison-highlight-pair">
      <div className={pair.ibid.highlight && pair.clp.highlight ? 'comparison-highlight-columns' : 'comparison-highlight-columns comparison-highlight-columns-single'}>
        <StudyHighlight primaryName={primaryName} side={pair.ibid} study="IBID" />
        <StudyHighlight primaryName={primaryName} side={pair.clp} study="CLP" />
      </div>
      {pair.note && <p className="comparison-highlight-note">{pair.note}</p>}
    </div>
  )
}

export function ComparisonHighlights({ data, primaryName }: { data: ComparisonDataset; primaryName: string }) {
  const id = useId()
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const macros = useMemo(() => comparisonHighlightMacros(data), [data])
  const expandable = macros.filter((macro) => macro.indicators.length)
  const allExpanded = expandable.length > 0 && expandable.every((macro) => expanded.has(macro.id))
  const visibleMacros = showAll ? macros : macros.slice(0, 3)
  const year = Number(data.ibid.filters.find((filter) => filter.id === 'year')?.value)

  useEffect(() => { setShowAll(false); setExpanded(new Set()) }, [data])

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (!macros.length) return null

  return (
    <section aria-labelledby={`${id}-title`} className="highlights-panel comparison-highlights">
      <div className="highlights-heading">
        <div className="highlights-heading-copy">
          <h2 id={`${id}-title`}>Destaques</h2>
          <p>{primaryName} · {year - 1} → {year}. Pilares e indicadores relacionados do IBID e CLP. Comparação com o ano imediatamente anterior: variação de mais de 3 posições no ranking Brasil ou entrada ou permanência entre os top 10, top 5 ou top 3.</p>
        </div>
        {expandable.length > 0 && (
          <button className="detail-expand-control highlights-expand-control" onClick={() => { setShowAll(!allExpanded); setExpanded(allExpanded ? new Set() : new Set(expandable.map((macro) => macro.id))) }} type="button">
            {allExpanded ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
            {allExpanded ? 'Compactar tudo' : 'Expandir tudo'}
          </button>
        )}
      </div>
      <div className="highlight-macros" id={`${id}-groups`}>
        {visibleMacros.map((macro) => {
          const hasIndicators = macro.indicators.length > 0
          const open = hasIndicators && expanded.has(macro.id)
          const contentId = `${id}-${macro.id}`
          return (
            <section className="highlight-macro" key={macro.id}>
              <button aria-controls={hasIndicators ? contentId : undefined} aria-expanded={hasIndicators ? open : undefined} className="highlight-macro-toggle highlight-macro-toggle-spaced" disabled={!hasIndicators} onClick={() => toggle(macro.id)} type="button">
                <span className="highlight-macro-heading"><span>Pilares relacionados</span><strong>{macro.ibid.title === macro.clp.title ? macro.ibid.title : `${macro.ibid.title} × ${macro.clp.title}`}</strong></span>
                {hasIndicators && <span className="highlight-macro-action">{open ? 'Ocultar indicadores' : `Ver indicadores (${macro.indicators.length})`}<ChevronDown aria-hidden="true" className={open ? 'rotate-180' : '-rotate-90'} size={18} /></span>}
              </button>
              <HighlightPair pair={macro} primaryName={primaryName} />
              {hasIndicators && <div className="comparison-highlight-indicators" hidden={!open} id={contentId}>
                <h4 className="highlight-micro-heading">Indicadores relacionados</h4>
                {macro.indicators.map((pair) => <HighlightPair key={pair.id} pair={pair} primaryName={primaryName} />)}
              </div>}
            </section>
          )
        })}
      </div>
      {macros.length > 3 && (
        <button aria-controls={`${id}-groups`} aria-expanded={showAll} className="highlights-toggle" onClick={() => setShowAll(!showAll)} type="button">
          {showAll ? 'Ver menos destaques' : 'Ver mais destaques'}<ChevronDown aria-hidden="true" className={showAll ? 'rotate-180' : ''} size={16} />
        </button>
      )}
    </section>
  )
}
