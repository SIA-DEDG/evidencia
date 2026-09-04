import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Info } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { DashboardKind, DetailRow } from '../types/dashboard'

interface DetailTableProps {
  kind: DashboardKind
  primaryLabel: string
  rows: DetailRow[]
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

export function DetailTable({ kind, primaryLabel, rows }: DetailTableProps) {
  const municipal = kind === 'clp-municipios'
  const hierarchyLabel = kind === 'ibid' ? 'Grupo / Pilar / Dimensão / Indicador' : municipal ? 'Dimensão / Pilar / Indicador' : 'Pilar / Indicador'
  const regionalScope = municipal ? 'Estado' : 'Região'
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [mobileScope, setMobileScope] = useState<'national' | 'regional'>('national')
  const [openDetails, setOpenDetails] = useState<Set<string>>(() => new Set())
  const expandableIds = useMemo(() => expandableRowIds(rows), [rows])
  const allExpanded = expandableIds.length > 0 && expandableIds.every((id) => expanded.has(id))

  useEffect(() => {
    setExpanded(new Set())
    setOpenDetails(new Set())
  }, [rows])

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

  function renderRows(items: DetailRow[], depth = 0): React.ReactNode {
    return items.map((row) => {
      const isExpanded = expanded.has(row.id)
      const hasChildren = Boolean(row.children?.length)
      return (
        <Fragment key={row.id}>
          <tr className={`detail-row detail-row-depth-${Math.min(depth, 3)}`}>
            <td className="detail-hierarchy-cell" style={{ paddingLeft: `${14 + depth * 22}px` }}>
              <button aria-expanded={hasChildren ? isExpanded : undefined} className="detail-row-trigger" disabled={!hasChildren} onClick={() => hasChildren && toggle(row.id)} type="button">
                <span className="detail-chevron" aria-hidden="true">
                  {hasChildren ? (isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : null}
                </span>
                <span className="level-badge">{row.level}</span>
                <span className="detail-row-title">{row.title}</span>
              </button>
            </td>
            <td>{cellValue(row.nationalRank)}</td>
            <td>{cellValue(row.nationalScore)}</td>
            <td>{cellValue(row.regionalRank)}</td>
            <td>{cellValue(row.regionalScore)}</td>
            <td>{cellValue(row.year)}</td>
            <td className="detail-text-cell" title={row.description}>{cellValue(row.description)}</td>
            <td className="detail-text-cell" title={row.source}>{cellValue(row.source)}</td>
          </tr>
          {hasChildren && isExpanded && renderRows(row.children!, depth + 1)}
        </Fragment>
      )
    })
  }

  function renderMobileRows(items: DetailRow[], depth = 0): React.ReactNode {
    return items.map((row) => {
      const isExpanded = expanded.has(row.id)
      const isDetailsOpen = openDetails.has(row.id)
      const hasChildren = Boolean(row.children?.length)
      const hasMoreInformation = Boolean(row.year?.trim() || row.description?.trim() || row.source?.trim())
      const rank = mobileScope === 'national' ? row.nationalRank : row.regionalRank
      const score = mobileScope === 'national' ? row.nationalScore : row.regionalScore

      return (
        <Fragment key={row.id}>
          <tr className={`detail-mobile-table-row detail-mobile-table-row-depth-${Math.min(depth, 3)}`}>
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
                    <span className="level-badge">{row.level}</span>
                    <span className="detail-mobile-row-title">{row.title}</span>
                  </span>
                </button>
                {hasMoreInformation && (
                  <button
                    aria-expanded={isDetailsOpen}
                    aria-label={`${isDetailsOpen ? 'Ocultar' : 'Ver'} detalhes de ${row.title}`}
                    className="detail-mobile-info"
                    onClick={() => toggleDetails(row.id)}
                    type="button"
                  >
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
                  <div><dt>Fonte</dt><dd>{cellValue(row.source)}</dd></div>
                </dl>
              </td>
            </tr>
          )}
          {hasChildren && isExpanded && renderMobileRows(row.children!, depth + 1)}
        </Fragment>
      )
    })
  }

  return (
    <section className="mt-5">
      <div className="detail-table-heading">
        <div>
          <h2 className="section-title">Tabela detalhada — {primaryLabel}</h2>
          <p className="section-description">Explore os dados por {hierarchyLabel.toLocaleLowerCase('pt-BR')}.</p>
        </div>
        {expandableIds.length > 0 && (
          <button className="detail-expand-control" onClick={toggleAll} type="button">
            {allExpanded ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
            {allExpanded ? 'Recolher tudo' : 'Expandir tudo'}
          </button>
        )}
      </div>
      <div aria-label={`Tabela detalhada de ${primaryLabel}`} className="detail-table-shell" role="region" tabIndex={0}>
        <table className="detail-table">
          <colgroup>
            <col className="detail-col-hierarchy" />
            <col className="detail-col-rank" />
            <col className="detail-col-score" />
            <col className="detail-col-rank" />
            <col className="detail-col-score" />
            <col className="detail-col-year" />
            <col className="detail-col-description" />
            <col className="detail-col-source" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{hierarchyLabel}</th>
              <th scope="col">Ranking Brasil</th>
              <th scope="col">Nota no Brasil</th>
              <th scope="col">Ranking {regionalScope}</th>
              <th scope="col">Nota média {regionalScope}</th>
              <th scope="col">Ano</th>
              <th scope="col">Descrição</th>
              <th scope="col">Fonte</th>
            </tr>
          </thead>
          <tbody>{renderRows(rows)}</tbody>
        </table>
      </div>
      <div className="detail-mobile-table-view">
        <div className="detail-mobile-toolbar">
          <span>Exibir dados de</span>
          <div aria-label="Escopo dos dados" className="detail-mobile-scope" role="group">
            <button aria-pressed={mobileScope === 'national'} className={mobileScope === 'national' ? 'active' : ''} onClick={() => setMobileScope('national')} type="button">Brasil</button>
            <button aria-pressed={mobileScope === 'regional'} className={mobileScope === 'regional' ? 'active' : ''} onClick={() => setMobileScope('regional')} type="button">{regionalScope}</button>
          </div>
        </div>
        <div className="detail-mobile-table-shell">
          <table className="detail-mobile-table">
            <caption className="sr-only">Dados detalhados de {primaryLabel} no escopo {mobileScope === 'national' ? 'Brasil' : regionalScope}</caption>
            <colgroup>
              <col />
              <col className="detail-mobile-rank-col" />
              <col className="detail-mobile-score-col" />
            </colgroup>
            <thead><tr><th scope="col">Indicador</th><th scope="col">Rank.</th><th scope="col">Nota</th></tr></thead>
            <tbody>{renderMobileRows(rows)}</tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
