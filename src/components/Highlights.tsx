import { useEffect, useMemo, useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type { DashboardKind, HighlightDirection, HighlightGroup, HighlightItem } from '../types/dashboard'

interface HighlightsProps {
  groups: HighlightGroup[]
  kind: DashboardKind
  primaryName: string
}

const collapsedItemsPerColumn = 3

interface HighlightMacro {
  id: string
  label: string
  indicators: HighlightItem[]
  pillars: HighlightItem[]
}

function rowsOfIndicators(items: HighlightItem[]) {
  return Array.from(
    { length: Math.ceil(items.length / 4) },
    (_, index) => items.slice(index * 4, index * 4 + 4),
  )
}

function MovementIcon({ direction }: { direction: HighlightDirection }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="highlight-icon"
      height={26}
      src={`/assets/highlight-${direction === 'stable' ? 'equal' : direction}.svg`}
      width={26}
    />
  )
}

function HighlightCard({ item, primaryName, showTitle = true }: { item: HighlightItem; primaryName: string; showTitle?: boolean }) {
  const rankingTrail = item.previousPosition
    ? `${item.previousPosition}º → ${item.currentPosition}º`
    : `${item.currentPosition}º`
  const badge = item.change === 0
    ? `${item.currentPosition}º`
    : `${item.change > 0 ? '+' : ''}${item.change}`

  return (
    <article className="highlight-card">
      <MovementIcon direction={item.direction} />
      <div className="highlight-card-copy">
        {showTitle && <h3>{item.title}</h3>}
        <p>
          {primaryName}{' '}
          {item.change !== 0 && (
            <>
              {item.change > 0 ? 'subiu ' : 'caiu '}
              <span className={`highlight-movement-${item.direction}`}>
                {Math.abs(item.change)} {Math.abs(item.change) === 1 ? 'posição' : 'posições'}
              </span>
              {item.topTier ? ' e ' : ' '}
            </>
          )}
          {item.topTier && (
            <>
              {item.topStatus === 'entered' ? 'entrou para o ' : 'segue no '}
              <span className={item.direction === 'stable' ? 'highlight-top-stable' : ''}>top {item.topTier}</span>{' '}
            </>
          )}
          no ranking Brasil · {rankingTrail} · {item.year}
        </p>
      </div>
      <strong className={`highlight-badge highlight-badge-${item.direction}`}>{badge}</strong>
    </article>
  )
}

export function Highlights({ groups, kind, primaryName }: HighlightsProps) {
  const [expanded, setExpanded] = useState(false)
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(() => new Set())
  const studyName = kind === 'ibid' ? 'IBID' : 'CLP'
  const usesPillarLayout = kind.startsWith('clp')

  useEffect(() => {
    setExpanded(false)
    setExpandedPillars(new Set())
  }, [groups, kind, primaryName])

  function togglePillar(pillarId: string) {
    setExpandedPillars((current) => {
      const next = new Set(current)
      if (next.has(pillarId)) next.delete(pillarId)
      else next.add(pillarId)
      return next
    })
  }

  const { indicatorGroups, structuralGroups, hasHiddenItems } = useMemo(() => {
    const allStructural = groups.filter((group) => group.id !== 'indicador')
    const allIndicators = groups.filter((group) => group.id === 'indicador')

    if (usesPillarLayout) {
      return {
        structuralGroups: allStructural,
        indicatorGroups: allIndicators,
        hasHiddenItems: false,
      }
    }

    const structuralLimit = kind === 'ibid' && allIndicators.length === 0
      ? collapsedItemsPerColumn * 2
      : collapsedItemsPerColumn

    const limitColumn = (columnGroups: HighlightGroup[], limit: number) => {
      if (expanded) return columnGroups
      let remaining = limit
      return columnGroups.flatMap((group) => {
        if (remaining === 0) return []
        const items = group.items.slice(0, remaining)
        remaining -= items.length
        return items.length ? [{ ...group, items }] : []
      })
    }

    return {
      structuralGroups: limitColumn(allStructural, structuralLimit),
      indicatorGroups: limitColumn(allIndicators, collapsedItemsPerColumn),
      hasHiddenItems: allStructural.reduce((total, group) => total + group.items.length, 0) > structuralLimit
        || allIndicators.reduce((total, group) => total + group.items.length, 0) > collapsedItemsPerColumn,
    }
  }, [expanded, groups, kind, usesPillarLayout])
  const { macros, standaloneGroups } = useMemo(() => {
    const macroMap = new Map<string, HighlightMacro>()
    const pillarGroups = structuralGroups.filter((group) => group.id === 'pilar')

    const ensureMacro = (item: HighlightItem) => {
      const id = item.pillarId ?? 'unassigned'
      const existing = macroMap.get(id)
      if (existing) return existing

      const macro: HighlightMacro = {
        id,
        label: item.pillarTitle ?? 'Outros indicadores',
        indicators: [],
        pillars: [],
      }
      macroMap.set(id, macro)
      return macro
    }

    pillarGroups.forEach((group) => {
      group.items.forEach((item) => ensureMacro(item).pillars.push(item))
    })
    indicatorGroups.forEach((group) => {
      group.items.forEach((item) => ensureMacro(item).indicators.push(item))
    })

    return {
      macros: [...macroMap.values()],
      standaloneGroups: structuralGroups.filter((group) => group.id !== 'pilar'),
    }
  }, [indicatorGroups, structuralGroups])
  const visibleMacros = expanded ? macros : macros.slice(0, collapsedItemsPerColumn)
  const shouldShowToggle = usesPillarLayout ? macros.length > collapsedItemsPerColumn : hasHiddenItems
  const expandableMacroIds = macros.filter((macro) => macro.indicators.length > 0).map((macro) => macro.id)
  const allPillarsExpanded = expandableMacroIds.length > 0
    && expandableMacroIds.every((id) => expandedPillars.has(id))

  function toggleAllPillars() {
    if (allPillarsExpanded) {
      // Compactar tudo também recolhe a lista, como "Ver menos destaques".
      setExpandedPillars(new Set())
      setExpanded(false)
      return
    }

    setExpanded(true)
    setExpandedPillars(new Set(expandableMacroIds))
  }

  return (
    <section className="highlights-panel" aria-labelledby="highlights-title">
      <div className="highlights-heading">
        <div className="highlights-heading-copy">
          <h2 id="highlights-title">Destaques</h2>
          <p>
            Esta seção reúne as posições de {primaryName} no {studyName} que merecem atenção especial, segundo os seguintes critérios: variação de mais de 3 posições (subida ou queda) no ranking Brasil; entrada ou permanência entre os top 10, top 5 ou top 3 do ranking nacional.
          </p>
        </div>
        {usesPillarLayout && expandableMacroIds.length > 0 && (
          <button className="detail-expand-control highlights-expand-control" onClick={toggleAllPillars} type="button">
            {allPillarsExpanded ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
            {allPillarsExpanded ? 'Compactar tudo' : 'Expandir tudo'}
          </button>
        )}
      </div>

      {groups.length && usesPillarLayout ? (
        <div className="highlight-macros" id="highlight-groups">
          {standaloneGroups.map((group) => (
            <div className="highlight-group" key={group.id}>
              <h3>{group.label}</h3>
              <div className="highlight-list">
                {group.items.map((item) => <HighlightCard item={item} key={item.id} primaryName={primaryName} />)}
              </div>
            </div>
          ))}

          {visibleMacros.map((macro) => {
            const hasIndicators = macro.indicators.length > 0
            const pillarExpanded = hasIndicators && expandedPillars.has(macro.id)
            const contentId = `highlight-macro-content-${macro.id}`

            return (
              <section className="highlight-macro" key={macro.id}>
                <button
                  aria-controls={hasIndicators ? contentId : undefined}
                  aria-expanded={hasIndicators ? pillarExpanded : undefined}
                  className={`highlight-macro-toggle ${macro.pillars.length > 0 || (pillarExpanded && macro.indicators.length > 0) ? 'highlight-macro-toggle-spaced' : ''}`}
                  disabled={!hasIndicators}
                  onClick={() => togglePillar(macro.id)}
                  type="button"
                >
                  <span className="highlight-macro-heading">
                    <span>Pilar</span>
                    <strong>{macro.label}</strong>
                  </span>
                  {hasIndicators && (
                    <span className="highlight-macro-action">
                      {pillarExpanded ? 'Ocultar indicadores' : 'Ver indicadores'}
                      <img
                        alt=""
                        aria-hidden="true"
                        className={pillarExpanded ? 'rotate-180' : '-rotate-90'}
                        height={18}
                        src={`/assets/highlight-chevron-${kind === 'clp-municipios' ? 'purple' : 'blue'}.svg`}
                        width={18}
                      />
                    </span>
                  )}
                </button>

                {macro.pillars.map((item) => (
                  <div className={`highlight-macro-card ${pillarExpanded && macro.indicators.length > 0 ? '' : 'highlight-macro-card-last'}`} key={item.id}>
                    <HighlightCard item={item} primaryName={primaryName} showTitle={false} />
                  </div>
                ))}

                <div hidden={!pillarExpanded} id={contentId}>
                  {macro.indicators.length > 0 && (
                    <div>
                      <h4 className="highlight-micro-heading">Indicadores</h4>
                      <div className="highlight-micro-rows">
                        {rowsOfIndicators(macro.indicators).map((row) => (
                          <div className={`highlight-micro-grid highlight-micro-grid-${row.length}`} key={row[0].id}>
                            {row.map((item) => <HighlightCard item={item} key={item.id} primaryName={primaryName} />)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      ) : groups.length ? (
        <div className={indicatorGroups.length ? 'highlight-groups' : 'highlight-groups highlight-groups-single'} id="highlight-groups">
          <div className="highlight-column">
            {structuralGroups.map((group) => (
              <div className="highlight-group" key={group.id}>
                <h3>{group.label}</h3>
                <div className="highlight-list">
                  {group.items.map((item) => <HighlightCard item={item} key={item.id} primaryName={primaryName} />)}
                </div>
              </div>
            ))}
          </div>
          {indicatorGroups.length > 0 && (
            <div className="highlight-column">
              {indicatorGroups.map((group) => (
                <div className="highlight-group" key={group.id}>
                  <h3>{group.label}</h3>
                  <div className="highlight-list">
                    {group.items.map((item) => <HighlightCard item={item} key={item.id} primaryName={primaryName} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="highlights-empty">Nenhuma posição atende aos critérios de destaque no ano selecionado.</p>
      )}

      {shouldShowToggle && (
        <button aria-controls="highlight-groups" aria-expanded={expanded} className="highlights-toggle" onClick={() => setExpanded((value) => !value)} type="button">
          {expanded ? 'Ver menos destaques' : 'Ver mais destaques'}
          <img alt="" aria-hidden="true" className={expanded ? 'rotate-180' : ''} height={16} src={`/assets/highlight-chevron-${kind === 'clp-municipios' ? 'purple' : 'blue'}.svg`} width={16} />
        </button>
      )}
    </section>
  )
}
