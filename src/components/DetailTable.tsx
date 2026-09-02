import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import type { DashboardKind, DetailRow } from '../types/dashboard'

interface DetailTableProps {
  kind: DashboardKind
  primaryLabel: string
  rows: DetailRow[]
}

function firstExpandedBranch(rows: DetailRow[]) {
  const ids = new Set<string>()
  const first = rows[0]
  if (first?.children?.length) {
    ids.add(first.id)
    const firstChild = first.children[0]
    if (firstChild?.children?.length) ids.add(firstChild.id)
  }
  return ids
}

export function DetailTable({ kind, primaryLabel, rows }: DetailTableProps) {
  const municipal = kind === 'clp-municipios'
  const hierarchyLabel = kind === 'ibid' ? 'Grupo / Pilar / Dimensão / Indicador' : municipal ? 'Dimensão / Pilar / Indicador' : 'Pilar / Indicador'
  const regionalScope = municipal ? 'Estado' : 'Região'
  const [expanded, setExpanded] = useState<Set<string>>(() => firstExpandedBranch(rows))

  useEffect(() => {
    setExpanded(firstExpandedBranch(rows))
  }, [rows])

  function toggle(id: string) {
    setExpanded((current) => {
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
          <tr className={depth === 0 ? 'detail-row detail-row-root bg-[#eef6ff] dark:bg-slate-800/80' : 'detail-row detail-row-child bg-white/80 dark:bg-slate-900/70'}>
            <td style={{ paddingLeft: `${16 + depth * 22}px` }}>
              <button aria-expanded={hasChildren ? isExpanded : undefined} className="flex items-center gap-2 text-left" disabled={!hasChildren} onClick={() => hasChildren && toggle(row.id)} type="button">
                {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-[14px]" />}
                <span className="level-badge">{row.level}</span>
                <span className="font-medium">{row.title}</span>
              </button>
            </td>
            <td>{row.nationalRank ?? ''}</td>
            <td>{row.nationalScore ?? ''}</td>
            <td>{row.regionalRank ?? ''}</td><td>{row.regionalScore ?? ''}</td>
            <td>{row.year ?? ''}</td>
            <td>{row.description ?? ''}</td>
            <td>{row.source ?? ''}</td>
          </tr>
          {hasChildren && isExpanded && renderRows(row.children!, depth + 1)}
        </Fragment>
      )
    })
  }

  return (
    <section className="mt-5">
      <h2 className="section-title">Tabela Detalhada - {primaryLabel}</h2>
      <p className="section-description">{hierarchyLabel}</p>
      <div className="mt-5 overflow-x-auto rounded-t-lg border-b border-line dark:border-slate-700">
        <table className="detail-table">
          <colgroup>
            <col style={{ width: 360 }} />
            <col style={{ width: 147 }} />
            <col style={{ width: 144 }} />
            <col style={{ width: 158 }} />
            <col style={{ width: 154 }} />
            <col style={{ width: 63 }} />
            <col style={{ width: 154 }} />
            <col style={{ width: 212 }} />
          </colgroup>
          <thead>
            <tr>
              <th>{hierarchyLabel}</th>
              <th>Ranking Brasil</th>
              <th>Nota no Brasil</th>
              <th>Ranking {regionalScope}</th><th>Nota média {regionalScope}</th>
              <th>Ano</th>
              <th>Descrição</th>
              <th>Fonte</th>
            </tr>
          </thead>
          <tbody>{renderRows(rows)}</tbody>
        </table>
      </div>
    </section>
  )
}
