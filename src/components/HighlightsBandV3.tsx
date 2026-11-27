import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowRight, Info, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import type { BandHighlight } from './Highlights'
import './HighlightsBandV3.css'

type Filter = 'all' | 'up' | 'down' | 'top'

interface HighlightsBandV3Props {
  items: BandHighlight[]
  place: string
  year: number
}

const cardLimit = 3

function category(item: BandHighlight) {
  if (item.level === 'geral') return 'Nota geral'
  if (item.level === 'pilar') return 'Pilar'
  return item.level === 'dimensao' ? 'Dimensão' : 'Indicador'
}

function HighlightCard({ item }: { item: BandHighlight }) {
  return (
    <article className={`highlight-v3-card${item.change < 0 ? ' is-down' : ''}`}>
      <div className="highlight-v3-card-heading">
        <span>{item.study ? `${item.study} · ` : ''}{category(item)}</span>
        {item.topTier && <span className="highlight-v3-top-badge">Top {item.topTier}</span>}
      </div>
      <h3>{item.title}</h3>
      <div className="highlight-v3-positions">
        {item.previousPosition > 0 && <><span>{item.previousPosition}º</span><span aria-label="para">→</span></>}
        <strong>{item.currentPosition}º</strong><span>no Brasil</span>
      </div>
      <div className="highlight-v3-change">
        {item.change > 0 ? <TrendingUp aria-hidden="true" size={12} /> : item.change < 0 ? <TrendingDown aria-hidden="true" size={12} /> : <Trophy aria-hidden="true" size={12} />}
        {item.change === 0 ? 'Permaneceu no topo' : `${Math.abs(item.change)} ${Math.abs(item.change) === 1 ? 'posição' : 'posições'}`}
      </div>
      {item.counterpart && <p className="highlight-v3-counterpart">No {item.counterpart.study}: {item.counterpart.title}</p>}
    </article>
  )
}

export function HighlightsBandV3({ items, place, year }: HighlightsBandV3Props) {
  const id = useId()
  const [filter, setFilter] = useState<Filter>('all')
  const [showAll, setShowAll] = useState(false)
  const ordered = useMemo(() => [...items].sort((a, b) => {
    const rank = (item: BandHighlight) => (item.level === 'geral' ? 0 : item.level === 'pilar' ? 1 : item.level === 'dimensao' ? 2 : 3) * 10000 - (item.topStatus === 'entered' ? 5000 : 0) - Math.abs(item.change)
    return rank(a) - rank(b)
  }), [items])

  useEffect(() => { setFilter('all'); setShowAll(false) }, [items])
  if (!ordered.length) return null

  const counts = {
    all: ordered.length,
    up: ordered.filter((item) => item.change > 0).length,
    down: ordered.filter((item) => item.change < 0).length,
    top: ordered.filter((item) => Boolean(item.topTier)).length,
  }
  const filtered = ordered.filter((item) => filter === 'all' || (filter === 'up' && item.change > 0) || (filter === 'down' && item.change < 0) || (filter === 'top' && Boolean(item.topTier)))
  const shown = showAll ? filtered : filtered.slice(0, cardLimit)
  const remaining = filtered.length - cardLimit
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todos' }, { id: 'up', label: 'Subiram' }, { id: 'down', label: 'Caíram' }, { id: 'top', label: 'No topo' },
  ]

  return (
    <section aria-labelledby={`${id}-title`} className="highlight-v3">
      <div aria-hidden="true" className="highlight-v3-pixels"><i /><i /><i /><i /></div>
      <div className="highlight-v3-intro">
        <p className="highlight-v3-eyebrow">Destaques {year}</p>
        <h2 id={`${id}-title`}>O que mudou para {place}</h2>
        <div className="highlight-v3-criteria">
          <button aria-describedby={`${id}-criteria`} aria-label="Critérios de destaques" type="button"><Info aria-hidden="true" size={18} /></button>
          <span id={`${id}-criteria`} role="tooltip">Entram os itens que mudaram mais de 3 posições no ranking Brasil em relação ao ano anterior e os que entraram ou seguem entre os top 10, 5 ou 3 nacional.</span>
        </div>
        <p>Maiores mudanças no ranking nacional entre {year - 1} e {year}.</p>
        <div aria-label="Filtrar destaques" className="highlight-v3-filters" role="group">
          {filters.map(({ id: key, label }) => (
            <button aria-pressed={filter === key} className={filter === key ? 'is-active' : ''} key={key} onClick={() => { setFilter(key); setShowAll(false) }} type="button">
              {key === 'top' && <Trophy aria-hidden="true" size={14} />}{label}<span>{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="highlight-v3-cards">
        {shown.map((item) => <HighlightCard item={item} key={`${item.study ?? ''}${item.id}`} />)}
        {remaining > 0 && (
          <button aria-expanded={showAll} className="highlight-v3-more" onClick={() => setShowAll((value) => !value)} type="button">
            <strong>{showAll ? '−' : `+${remaining}`}</strong>
            <span>{showAll ? 'Mostrar menos' : 'Ver os outros destaques'} <ArrowRight aria-hidden="true" size={14} /></span>
          </button>
        )}
      </div>
    </section>
  )
}
