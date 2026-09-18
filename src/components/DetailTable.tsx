import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Info } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { formatIndicatorUnit } from '../data/indicatorUnit'
import type { DashboardKind, DetailRow } from '../types/dashboard'

interface DetailTableProps {
  comparisonLabel?: string
  comparisonRegionalLabel?: string
  kind: DashboardKind
  primaryLabel: string
  primaryRegionalLabel: string
  rows: DetailRow[]
  showComparison?: boolean
}

function expandableRowIds(rows: DetailRow[]) {
  const ids: string[] = []

  function visit(items: DetailRow[]) {
    items.forEach((row) => {
      if (!row.children?.length) return
      ids.push(row.id)
      visit(row.children)
    })
  }

  visit(rows)
  return ids
}

function cellValue(value?: string) {
  return value?.trim() ? value : '—'
}

const levelArticles: Record<DetailRow['level'], string> = {
  Grupo: 'do grupo',
  Pilar: 'do pilar',
  Dimensão: 'da dimensão',
  Indicador: 'do indicador',
}

function LevelBadges({ row }: { row: DetailRow }) {
  return (
    <span className="level-badge-stack">
      <span className="level-badge">{row.level}</span>
    </span>
  )
}

function UpdateNote({ row }: { row: DetailRow }) {
  if (!row.updateYear) return null
  return <span className="detail-update-note">Última atualização {levelArticles[row.level]} em {row.updateYear}</span>
}

export function DetailTable({
  comparisonLabel,
  comparisonRegionalLabel,
  kind,
  primaryLabel,
  primaryRegionalLabel,
  rows,
  showComparison = false,
}: DetailTableProps) {
  const municipal = kind === 'clp-municipios'
  const hierarchyLabel = kind === 'ibid' ? 'Grupo / Pilar / Dimensão / Indicador' : municipal ? 'Dimensão / Pilar / Indicador' : 'Pilar / Indicador'
  const regionalScope = municipal ? 'Estado' : 'Região'
  const comparisonEnabled = showComparison && Boolean(comparisonLabel)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [mobileScope, setMobileScope] = useState<'national' | 'regional'>('national')
  const [mobileTerritory, setMobileTerritory] = useState<'primary' | 'comparison'>('primary')
  const [openDetails, setOpenDetails] = useState<Set<string>>(() => new Set())
  const expandableIds = useMemo(() => expandableRowIds(rows), [rows])
  const allExpanded = expandableIds.length > 0 && expandableIds.every((id) => expanded.has(id))

  useEffect(() => {
    setExpanded(new Set())
    setOpenDetails(new Set())
  }, [rows])

  useEffect(() => {
    if (!comparisonEnabled) setMobileTerritory('primary')
  }, [comparisonEnabled])

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(expandableIds))
  }

  function toggleDetails(id: string) {
    setOpenDetails((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function renderRows(items: DetailRow[], depth = 0, visibleIndex = { value: 0 }): React.ReactNode {
    return items.map((row) => {
      const isExpanded = expanded.has(row.id)
      const hasChildren = Boolean(row.children?.length)
      const striped = visibleIndex.value++ % 2 === 0

      return (
        <Fragment key={row.id}>
          <tr className={`detail-row detail-row-depth-${Math.min(depth, 3)}${striped ? ' detail-row-striped' : ''}`}>
            <td className="detail-hierarchy-cell" style={{ paddingLeft: `${14 + depth * 22}px` }}>
              <button aria-expanded={hasChildren ? isExpanded : undefined} className="detail-row-trigger" disabled={!hasChildren} onClick={() => hasChildren && toggle(row.id)} type="button">
                <span className="detail-chevron" aria-hidden="true">
                  {hasChildren ? (isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : null}
                </span>
                <LevelBadges row={row} />
                <span className="detail-row-title-group">
                  <span className="detail-row-title">{row.title}</span>
                  <UpdateNote row={row} />
                </span>
              </button>
            </td>
            <td>{cellValue(row.nationalRank)}</td>
            <td>{cellValue(row.nationalScore)}</td>
            <td>{cellValue(row.regionalRank)}</td>
            <td>{cellValue(row.regionalScore)}</td>
            {comparisonEnabled && (
              <>
                <td>{cellValue(row.comparisonNationalRank)}</td>
                <td>{cellValue(row.comparisonNationalScore)}</td>
                <td>{cellValue(row.comparisonRegionalRank)}</td>
                <td>{cellValue(row.comparisonRegionalScore)}</td>
              </>
            )}
            <td>{cellValue(row.year)}</td>
            <td className="detail-text-cell" title={row.description}>{cellValue(row.description)}</td>
            <td className="detail-text-cell" title={row.unit}>{formatIndicatorUnit(row.unit)}</td>
            <td className="detail-text-cell" title={row.source}>{cellValue(row.source)}</td>
          </tr>
          {hasChildren && isExpanded && renderRows(row.children!, depth + 1, visibleIndex)}
        </Fragment>
      )
    })
  }

  function renderMobileRows(items: DetailRow[], depth = 0, visibleIndex = { value: 0 }): React.ReactNode {
    return items.map((row) => {
      const isExpanded = expanded.has(row.id)
      const isDetailsOpen = openDetails.has(row.id)
      const hasChildren = Boolean(row.children?.length)
      const striped = visibleIndex.value++ % 2 === 0
      const hasMoreInformation = Boolean(row.year?.trim() || row.description?.trim() || row.unit?.trim() || row.source?.trim())
      const comparisonSelected = comparisonEnabled && mobileTerritory === 'comparison'
      const rank = comparisonSelected
        ? mobileScope === 'national' ? row.comparisonNationalRank : row.comparisonRegionalRank
        : mobileScope === 'national' ? row.nationalRank : row.regionalRank
      const score = comparisonSelected
        ? mobileScope === 'national' ? row.comparisonNationalScore : row.comparisonRegionalScore
        : mobileScope === 'national' ? row.nationalScore : row.regionalScore

      return (
        <Fragment key={row.id}>
          <tr className={`detail-mobile-table-row detail-mobile-table-row-depth-${Math.min(depth, 3)}${striped ? ' detail-mobile-table-row-striped' : ''}`}>
            <th scope="row" style={{ paddingLeft: `${6 + depth * 6}px` }}>
              <div className="detail-mobile-hierarchy">
                <button
                  aria-expanded={hasChildren ? isExpanded : undefined}
                  aria-label={hasChildren ? `${isExpanded ? 'Recolher' : 'Expandir'} ${row.title}` : undefined}
                  className="detail-mobile-hierarchy-trigger"
                  disabled={!hasChildren}
                  onClick={() => hasChildren && toggle(row.id)}
                  type="button"
                >
                  <span className="detail-chevron" aria-hidden="true">
                    {hasChildren ? (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}
                  </span>
                  <span className="detail-mobile-title-group">
                    <LevelBadges row={row} />
                    <span className="detail-mobile-row-title">{row.title}</span>
                    <UpdateNote row={row} />
                  </span>
                </button>
                {hasMoreInformation && (
                  <button aria-expanded={isDetailsOpen} aria-label={`${isDetailsOpen ? 'Ocultar' : 'Ver'} detalhes de ${row.title}`} className="detail-mobile-info" onClick={() => toggleDetails(row.id)} type="button">
                    <Info aria-hidden="true" size={15} />
                  </button>
                )}
              </div>
            </th>
            <td>{cellValue(rank)}</td>
            <td>{cellValue(score)}</td>
          </tr>
          {isDetailsOpen && (
            <tr className="detail-mobile-details-row">
              <td colSpan={3}>
                <dl>
                  <div><dt>Ano</dt><dd>{cellValue(row.year)}</dd></div>
                  <div><dt>Descrição</dt><dd>{cellValue(row.description)}</dd></div>
                  <div><dt>Unidade do indicador</dt><dd title={row.unit}>{formatIndicatorUnit(row.unit)}</dd></div>
                  <div><dt>Fonte</dt><dd>{cellValue(row.source)}</dd></div>
                </dl>
              </td>
            </tr>
          )}
          {hasChildren && isExpanded && renderMobileRows(row.children!, depth + 1, visibleIndex)}
        </Fragment>
      )
    })
  }

  return (
    <section className="detail-table-section">
      <div className="detail-table-heading">
        <div>
          <h2 className="section-title">Tabela Detalhada - {primaryLabel}{comparisonEnabled ? ` × ${comparisonLabel}` : ''}</h2>
          <p className="section-description">{hierarchyLabel}</p>
        </div>
        {expandableIds.length > 0 && (
          <button className="detail-expand-control" onClick={toggleAll} type="button">
            {allExpanded ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
            {allExpanded ? 'Recolher tudo' : 'Expandir tudo'}
          </button>
        )}
      </div>

      <div aria-label={`Tabela detalhada de ${primaryLabel}`} className="detail-table-shell" role="region" tabIndex={0}>
        <table className={comparisonEnabled ? 'detail-table detail-table-comparison' : 'detail-table'}>
          <colgroup>
            <col className="detail-col-hierarchy" />
            <col className="detail-col-rank" /><col className="detail-col-score" /><col className="detail-col-rank" /><col className="detail-col-score" />
            {comparisonEnabled && <><col className="detail-col-rank" /><col className="detail-col-score" /><col className="detail-col-rank" /><col className="detail-col-score" /></>}
            <col className="detail-col-year" />
            <col className="detail-col-description" />
            <col className="detail-col-unit" />
            <col className="detail-col-source" />
          </colgroup>
          <thead>
            {comparisonEnabled ? (
              <>
                <tr className="detail-group-header">
                  <th className="detail-hierarchy-header" rowSpan={2} scope="col">{hierarchyLabel}</th>
                  <th colSpan={4} scope="colgroup">{primaryLabel} · {primaryRegionalLabel}</th>
                  <th colSpan={4} scope="colgroup">{comparisonLabel} · {comparisonRegionalLabel}</th>
                  <th rowSpan={2} scope="col">Ano</th>
                  <th rowSpan={2} scope="col">Descrição</th>
                  <th rowSpan={2} scope="col" title="Unidade original do indicador (mil, mi, bi, %, R$ etc.). As notas de ranking são normalizadas.">Unidade</th>
                  <th rowSpan={2} scope="col">Fonte</th>
                </tr>
                <tr>
                  <th scope="col">Ranking Brasil</th><th scope="col">Nota no Brasil</th><th scope="col">Ranking {regionalScope}</th><th scope="col">Nota média {regionalScope}</th>
                  <th scope="col">Ranking Brasil</th><th scope="col">Nota no Brasil</th><th scope="col">Ranking {regionalScope}</th><th scope="col">Nota média {regionalScope}</th>
                </tr>
              </>
            ) : (
              <tr>
                <th className="detail-hierarchy-header" scope="col">{hierarchyLabel}</th>
                <th scope="col">Ranking Brasil</th><th scope="col">Nota no Brasil</th><th scope="col">Ranking {regionalScope}</th><th scope="col">Nota média {regionalScope}</th>
                <th scope="col">Ano</th><th scope="col">Descrição</th><th scope="col" title="Unidade original do indicador (mil, mi, bi, %, R$ etc.). As notas de ranking são normalizadas.">Unidade</th><th scope="col">Fonte</th>
              </tr>
            )}
          </thead>
          <tbody>{renderRows(rows)}</tbody>
        </table>
      </div>

      <div className="detail-mobile-table-view">
        {comparisonEnabled && (
          <div className="detail-mobile-territory" role="group" aria-label="Território exibido">
            <button aria-pressed={mobileTerritory === 'primary'} className={mobileTerritory === 'primary' ? 'active' : ''} onClick={() => setMobileTerritory('primary')} type="button">{primaryLabel}</button>
            <button aria-pressed={mobileTerritory === 'comparison'} className={mobileTerritory === 'comparison' ? 'active' : ''} onClick={() => setMobileTerritory('comparison')} type="button">{comparisonLabel}</button>
          </div>
        )}
        <div className="detail-mobile-toolbar">
          <span>Exibir dados de</span>
          <div aria-label="Escopo dos dados" className="detail-mobile-scope" role="group">
            <button aria-pressed={mobileScope === 'national'} className={mobileScope === 'national' ? 'active' : ''} onClick={() => setMobileScope('national')} type="button">Brasil</button>
            <button aria-pressed={mobileScope === 'regional'} className={mobileScope === 'regional' ? 'active' : ''} onClick={() => setMobileScope('regional')} type="button">{regionalScope}</button>
          </div>
        </div>
        <div className="detail-mobile-table-shell">
          <table className="detail-mobile-table">
            <caption className="sr-only">Dados detalhados de {mobileTerritory === 'comparison' ? comparisonLabel : primaryLabel}</caption>
            <colgroup><col /><col className="detail-mobile-rank-col" /><col className="detail-mobile-score-col" /></colgroup>
            <thead><tr><th scope="col">Indicador</th><th scope="col">Rank.</th><th scope="col">Nota</th></tr></thead>
            <tbody>{renderMobileRows(rows)}</tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
