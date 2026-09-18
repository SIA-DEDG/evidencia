import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
  type TooltipContentProps,
} from 'recharts'
import type { ComparisonDataset, DashboardDataset, DetailRow, SelectOption } from '../types/dashboard'

interface ComparisonPageProps {
  data: ComparisonDataset
  onFiltersChange(values: Record<string, string>): void
}

interface ComparisonDatum {
  year: number
  ibid: number | null
  clp: number | null
  ibidRaw: number | null
  clpRaw: number | null
  ibidLabel: string | null
  clpLabel: string | null
  ibidPosition: number | null
  clpPosition: number | null
  total: number | null
}

interface ConceptDefinition {
  id: string
  title: string
  terms: string[]
}

interface ConceptRow extends ConceptDefinition {
  ibid?: DetailRow
  clp?: DetailRow
}

interface ConceptChildRow {
  id: string
  title: string
  ibid?: DetailRow
  clp?: DetailRow
}

const colors = {
  ibid: '#034ea2',
  clp: '#8db2ff',
}

const concepts: ConceptDefinition[] = [
  { id: 'sustentabilidade', title: 'Sustentabilidade Ambiental', terms: ['sustentabilidade'] },
  { id: 'capital-humano', title: 'Capital Humano', terms: ['capital humano'] },
  { id: 'educacao', title: 'Educação', terms: ['educacao'] },
  { id: 'maquina-publica', title: 'Eficiência da Máquina Pública', terms: ['maquina publica', 'gestao publica', 'instituicoes'] },
  { id: 'infraestrutura', title: 'Infraestrutura', terms: ['infraestrutura'] },
]

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function filter(data: DashboardDataset, id: string) {
  return data.filters.find((item) => item.id === id)
}

function commonOptions(first: SelectOption[], second: SelectOption[]) {
  const secondValues = new Set(second.map((option) => option.value))
  return first.filter((option) => secondValues.has(option.value))
}

function scoreToCommonScale(kind: 'ibid' | 'clp', value: number | null) {
  if (value === null) return null
  return kind === 'ibid' ? value * 100 : value
}

function rawScore(value: number | null, decimals: number) {
  return value === null ? '—' : value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function rankLabel(position: number | null, total: number | null) {
  return position && total ? `${position}º/${total}º` : '—'
}

function comparisonData(data: ComparisonDataset): ComparisonDatum[] {
  const years = [...new Set([...data.ibid.chart.years, ...data.clp.chart.years])].sort((a, b) => a - b)
  const ibidScores = new Map(data.ibid.chart.years.map((year, index) => [year, data.ibid.chart.primary[index] ?? null]))
  const clpScores = new Map(data.clp.chart.years.map((year, index) => [year, data.clp.chart.primary[index] ?? null]))
  const ibidHistory = new Map(data.ibid.history.map((item) => [item.year, item]))
  const clpHistory = new Map(data.clp.history.map((item) => [item.year, item]))

  return years.map((year) => {
    const ibidRaw = ibidScores.get(year) ?? null
    const clpRaw = clpScores.get(year) ?? null
    const ibidRank = ibidHistory.get(year)
    const clpRank = clpHistory.get(year)
    return {
      year,
      ibid: scoreToCommonScale('ibid', ibidRaw),
      clp: scoreToCommonScale('clp', clpRaw),
      ibidRaw,
      clpRaw,
      ibidLabel: ibidRaw === null ? null : `${ibidRank?.national ?? '—'}|${rawScore(ibidRaw, 3)}`,
      clpLabel: clpRaw === null ? null : `${clpRank?.national ?? '—'}|${rawScore(clpRaw, 2)}`,
      ibidPosition: ibidRank?.national ?? null,
      clpPosition: clpRank?.national ?? null,
      total: ibidRank?.nationalTotal ?? clpRank?.nationalTotal ?? null,
    }
  })
}

function ChartTooltip({ active, label, payload }: TooltipContentProps) {
  if (!active || !payload.length) return null
  const datum = payload[0]?.payload as ComparisonDatum | undefined

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => {
        const isIbid = entry.dataKey === 'ibid' || entry.dataKey === 'ibidPosition'
        const position = isIbid ? datum?.ibidPosition : datum?.clpPosition
        const value = isIbid ? datum?.ibidRaw : datum?.clpRaw
        const decimals = isIbid ? 3 : 2
        return (
          <p key={String(entry.dataKey)}>
            <span style={{ backgroundColor: entry.color }} />
            {entry.name}: {String(entry.dataKey).includes('Position')
              ? position ? `${position}º lugar` : '—'
              : rawScore(value ?? null, decimals)}
          </p>
        )
      })}
    </div>
  )
}

function StudySummaryCard({ data, label }: { data: DashboardDataset; label: 'IBID' | 'CLP' }) {
  const selectedYear = Number(filter(data, 'year')?.value)
  const values = data.chart.years.flatMap((year, index) => {
    const value = data.chart.primary[index]
    if (value === null || value === undefined) return []
    const history = data.history.find((item) => item.year === year)
    return [{ year, value, position: history?.national ?? null, total: history?.nationalTotal ?? null }]
  })
  const current = values.find((item) => item.year === selectedYear) ?? values.at(-1)
  const worst = values.reduce<(typeof values)[number] | undefined>((result, item) => !result || item.value < result.value ? item : result, undefined)
  const best = values.reduce<(typeof values)[number] | undefined>((result, item) => !result || item.value > result.value ? item : result, undefined)
  const decimals = label === 'IBID' ? 3 : 2
  const stats = [
    { caption: `Nota · ${current?.year ?? selectedYear}`, value: current },
    { caption: `Pior nota · ${worst?.year ?? '—'}`, value: worst },
    { caption: `Melhor nota · ${best?.year ?? '—'}`, value: best },
  ]

  return (
    <article className="summary-card comparison-summary-card">
      <p className="eyebrow">Estudo</p>
      <h3 className="truncate text-base font-semibold text-brand-700">{label}</h3>
      <p className="truncate text-xs text-muted">Nota Geral · {label}</p>
      <div className="comparison-summary-stats">
        {stats.map((stat) => (
          <div key={stat.caption}>
            <p className="comparison-rank">
              <strong>{rankLabel(stat.value?.position ?? null, stat.value?.total ?? null).split('/')[0]}</strong>
              {stat.value?.total ? <span>/{stat.value.total}º</span> : null}
              <small>nota {rawScore(stat.value?.value ?? null, decimals)}</small>
            </p>
            <span className="comparison-stat-caption">{stat.caption}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function TopStatesCard({ data }: { data: DashboardDataset }) {
  const [first, ...remaining] = data.nationalRanking.slice(0, 5)
  return (
    <article className="summary-card ranking-summary comparison-top-card">
      <p className="eyebrow truncate">Top 5 Brasil · Nota Geral CLP</p>
      {first && (
        <div className="mt-[10px] flex items-baseline gap-1">
          <strong className="text-base leading-none text-brand-700">{first.position}º {first.name}</strong>
          <span className="text-[10px] text-muted">nota {rawScore(first.value, 2)}</span>
        </div>
      )}
      <div className="mt-[10px] grid grid-flow-col grid-cols-2 grid-rows-2 gap-x-4 gap-y-[6px]">
        {remaining.map((item) => (
          <div className="flex items-baseline gap-1" key={item.code ?? item.name}>
            <strong className="text-xs leading-none text-brand-700">{item.position}º {item.name}</strong>
            <span className="text-[9px] text-muted">{rawScore(item.value, 2)}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function PositionLabel({ value, width, x, y }: LabelProps) {
  if (value === null || value === undefined || typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number') return null
  const [position, score] = String(value).split('|')
  return (
    <text fill="#034ea2" fontFamily="Inter, Arial, sans-serif" fontSize="14" textAnchor="middle" x={x + width / 2} y={Math.max(16, y - 28)}>
      <tspan fontWeight="700" x={x + width / 2}>{position === '—' ? position : `${position}º`}</tspan>
      <tspan fontSize="12" x={x + width / 2} dy="18">{score}</tspan>
    </text>
  )
}

function findConcept(rows: DetailRow[], definition: ConceptDefinition) {
  const queue = [...rows]
  while (queue.length) {
    const row = queue.shift()!
    const title = normalize(row.title)
    if (definition.terms.some((term) => title.includes(term))) return row
    if (row.children) queue.push(...row.children)
  }
  return undefined
}

function scoreCell(row?: DetailRow) {
  if (!row) return <span className="comparison-empty-cell">—</span>
  return (
    <span className="comparison-table-value">
      <strong>{row.nationalRank || '—'}</strong>
      <small>{row.nationalScore && row.nationalScore !== '—' ? `nota ${row.nationalScore}` : ''}</small>
    </span>
  )
}

function childRows(concept: ConceptRow) {
  const rows: ConceptChildRow[] = []
  const ibidChildren = concept.ibid?.children ?? []
  const clpChildren = concept.clp?.children ?? []
  const usedClp = new Set<string>()

  for (const ibid of ibidChildren.slice(0, 4)) {
    const ibidTitle = normalize(ibid.title).replace(/^\d+(?:\.\d+)*\s*/, '')
    const clp = clpChildren.find((candidate) => {
      const clpTitle = normalize(candidate.title).replace(/^\d+(?:\.\d+)*\s*/, '')
      return !usedClp.has(candidate.id) && (clpTitle.includes(ibidTitle) || ibidTitle.includes(clpTitle))
    })
    if (clp) usedClp.add(clp.id)
    rows.push({ id: `ibid-${ibid.id}`, title: ibid.title, ibid, clp })
  }
  for (const clp of clpChildren.filter((item) => !usedClp.has(item.id)).slice(0, Math.max(0, 4 - rows.length))) {
    rows.push({ id: `clp-${clp.id}`, title: clp.title, clp })
  }
  return rows
}

function ComparisonTable({ data, stateName }: { data: ComparisonDataset; stateName: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['sustentabilidade']))
  const [mobileStudy, setMobileStudy] = useState<'ibid' | 'clp'>('ibid')
  const [openDetails, setOpenDetails] = useState<Set<string>>(() => new Set())
  const rows = concepts.map((concept) => ({
    ...concept,
    ibid: findConcept(data.ibid.details, concept),
    clp: findConcept(data.clp.details, concept),
  }))

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleDetails(id: string) {
    setOpenDetails((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function renderMobileRow({ depth = 0, id, row, title, type }: {
    depth?: number
    id: string
    row?: DetailRow
    title: string
    type: 'Pilar' | 'Indicador'
  }) {
    const isParent = type === 'Pilar'
    const isExpanded = expanded.has(id)
    const isDetailsOpen = openDetails.has(id)
    const children = isParent ? childRows(rows.find((item) => item.id === id)!) : []
    const hasChildren = children.length > 0
    const hasMoreInformation = Boolean(row?.description?.trim() || row?.source?.trim())

    return (
      <Fragment key={id}>
        <tr className={`detail-mobile-table-row${type === 'Pilar' ? ' detail-mobile-table-row-striped' : ''}`}>
          <th scope="row" style={{ paddingLeft: `${6 + depth * 6}px` }}>
            <div className="detail-mobile-hierarchy">
              <button
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-label={hasChildren ? `${isExpanded ? 'Recolher' : 'Expandir'} ${title}` : undefined}
                className="detail-mobile-hierarchy-trigger"
                disabled={!hasChildren}
                onClick={() => hasChildren && toggle(id)}
                type="button"
              >
                <span className="detail-chevron" aria-hidden="true">
                  {hasChildren ? (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}
                </span>
                <span className="detail-mobile-title-group">
                  <span className="level-badge">{type}</span>
                  <span className="detail-mobile-row-title">{title}</span>
                </span>
              </button>
              {hasMoreInformation && (
                <button aria-expanded={isDetailsOpen} aria-label={`${isDetailsOpen ? 'Ocultar' : 'Ver'} detalhes de ${title}`} className="detail-mobile-info" onClick={() => toggleDetails(id)} type="button">
                  <Info aria-hidden="true" size={15} />
                </button>
              )}
            </div>
          </th>
          <td>{row?.nationalRank || '—'}</td>
          <td>{row?.nationalScore || '—'}</td>
        </tr>
        {isDetailsOpen && (
          <tr className="detail-mobile-details-row">
            <td colSpan={3}>
              <dl>
                <div><dt>Descrição</dt><dd>{row?.description || '—'}</dd></div>
                <div><dt>Fonte</dt><dd>{row?.source || '—'}</dd></div>
              </dl>
            </td>
          </tr>
        )}
        {hasChildren && isExpanded && children.map((child) => renderMobileRow({
          depth: 1,
          id: `${mobileStudy}-${child.id}`,
          row: child[mobileStudy],
          title: child.title,
          type: 'Indicador',
        }))}
      </Fragment>
    )
  }

  return (
    <section className="comparison-table-section">
      <div className="detail-table-heading">
        <div>
          <h2 className="section-title">Tabela Detalhada · {stateName}</h2>
          <p className="section-description">Pilar / Indicador</p>
        </div>
      </div>
      <div className="detail-table-shell comparison-detail-table-shell" role="region" aria-label={`Conceitos comuns de ${stateName}`} tabIndex={0}>
        <table className="detail-table comparison-detail-table">
          <colgroup>
            <col className="comparison-col-concept" />
            <col className="comparison-col-value" />
            <col className="comparison-col-value" />
            <col className="comparison-col-source" />
          </colgroup>
          <thead>
            <tr><th className="detail-hierarchy-header">Conceito comum</th><th>IBID</th><th>CLP</th><th>Fonte</th></tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const children = childRows(row)
              const isExpanded = expanded.has(row.id)
              const canExpand = children.length > 0
              return (
                <FragmentRow
                  canExpand={canExpand}
                  childrenRows={children}
                  index={index}
                  isExpanded={isExpanded}
                  key={row.id}
                  onToggle={() => toggle(row.id)}
                  row={row}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="detail-mobile-table-view">
        <div className="detail-mobile-territory" role="group" aria-label="Estudo exibido">
          <button aria-pressed={mobileStudy === 'ibid'} className={mobileStudy === 'ibid' ? 'active' : ''} onClick={() => setMobileStudy('ibid')} type="button">IBID</button>
          <button aria-pressed={mobileStudy === 'clp'} className={mobileStudy === 'clp' ? 'active' : ''} onClick={() => setMobileStudy('clp')} type="button">CLP</button>
        </div>
        <div className="detail-mobile-table-shell">
          <table className="detail-mobile-table">
            <caption className="sr-only">Conceitos comuns de {stateName} no estudo {mobileStudy.toUpperCase()}</caption>
            <colgroup><col /><col className="detail-mobile-rank-col" /><col className="detail-mobile-score-col" /></colgroup>
            <thead><tr><th>Conceito</th><th>Rank.</th><th>Nota</th></tr></thead>
            <tbody>
              {rows.map((row, index) => renderMobileRow({
                id: row.id,
                row: row[mobileStudy],
                title: `${index + 1}. ${row.title}`,
                type: 'Pilar',
              }))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function FragmentRow({ canExpand, childrenRows, index, isExpanded, onToggle, row }: {
  canExpand: boolean
  childrenRows: ConceptChildRow[]
  index: number
  isExpanded: boolean
  onToggle(): void
  row: ConceptRow
}) {
  const source = [row.ibid?.source, row.clp?.source].filter(Boolean).join(' · ') || '—'
  return (
    <>
      <tr className={`detail-row${index % 2 === 0 ? ' detail-row-striped' : ''}`}>
        <td className="detail-hierarchy-cell">
          <button aria-expanded={canExpand ? isExpanded : undefined} className="detail-row-trigger" disabled={!canExpand} onClick={onToggle} type="button">
            <span className="detail-chevron" aria-hidden="true">{canExpand ? isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}</span>
            <span className="level-badge">Pilar</span>
            <span className="detail-row-title">{index + 1}. {row.title}</span>
          </button>
        </td>
        <td>{scoreCell(row.ibid)}</td>
        <td>{scoreCell(row.clp)}</td>
        <td className="detail-text-cell comparison-source-cell" title={source}>{source}</td>
      </tr>
      {isExpanded && childrenRows.map((child) => (
        <tr className="detail-row" key={child.id}>
          <td className="detail-hierarchy-cell comparison-child-cell">
            <span className="detail-row-trigger">
              <span className="detail-chevron" />
              <span className="level-badge">Indicador</span>
              <span className="detail-row-title">{child.title}</span>
            </span>
          </td>
          <td>{scoreCell(child.ibid)}</td>
          <td>{scoreCell(child.clp)}</td>
          <td className="detail-text-cell comparison-source-cell" title={child.ibid?.source ?? child.clp?.source}>{child.ibid?.source ?? child.clp?.source ?? '—'}</td>
        </tr>
      ))}
    </>
  )
}

export function ComparisonPage({ data, onFiltersChange }: ComparisonPageProps) {
  const ibidState = filter(data.ibid, 'primary')
  const clpState = filter(data.clp, 'primary')
  const ibidYear = filter(data.ibid, 'year')
  const clpYear = filter(data.clp, 'year')
  const states = commonOptions(ibidState?.options ?? [], clpState?.options ?? [])
  const years = commonOptions(ibidYear?.options ?? [], clpYear?.options ?? [])
  const selectedState = ibidState?.value ?? clpState?.value ?? ''
  const selectedYear = ibidYear?.value ?? clpYear?.value ?? ''
  const stateName = states.find((option) => option.value === selectedState)?.label ?? data.ibid.summary[0]?.title ?? selectedState
  const chartData = useMemo(() => comparisonData(data), [data])
  const period = chartData.length ? `${chartData[0].year}–${chartData.at(-1)?.year}` : ''
  const maxPosition = Math.max(27, ...chartData.map((item) => item.total ?? 0))

  function updateFilter(id: 'primary' | 'year', value: string) {
    onFiltersChange({ primary: id === 'primary' ? value : selectedState, year: id === 'year' ? value : selectedYear })
  }

  return (
    <main className="page-shell dashboard-comparativo">
      <div className="dashboard-intro">
        <div className="max-w-[977px]">
          <h1 className="text-xl font-semibold text-brand-700">Comparativo entre os estudos</h1>
          <p>Um estado sob duas óticas — IBID e CLP</p>
        </div>
      </div>

      <div className="dashboard-filter-intro">
        <h2>Painel comparativo dos estados</h2>
        <p>Escolha um estado e um ano para comparar sua nota geral, a posição no ranking e os conceitos relacionados nos dois estudos.</p>
      </div>

      <section className="filter-panel mt-5" aria-label="Filtros do comparativo">
        <div className="filter-layout comparison-filter-layout">
          <label className="min-w-0">
            <span className="field-label">Estado</span>
            <select className="field-select" onChange={(event) => updateFilter('primary', event.target.value)} value={selectedState}>
              {states.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="field-label">Ano</span>
            <select className="field-select" onChange={(event) => updateFilter('year', event.target.value)} value={selectedYear}>
              {years.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="field-label">Métrica</span>
            <select aria-readonly="true" className="field-select" disabled value="geral">
              <option value="geral">Notas Gerais · IBID e CLP</option>
            </select>
          </label>
        </div>
      </section>

      <section className="summary-grid comparison-summary-grid" aria-label="Resumo comparativo">
        <StudySummaryCard data={data.ibid} label="IBID" />
        <StudySummaryCard data={data.clp} label="CLP" />
        <TopStatesCard data={data.clp} />
      </section>

      <div className="dashboard-results-panel comparison-results-panel">
        <div className="comparison-chart-grid">
          <section className="series-chart min-w-0">
            <h2 className="section-title">Série Histórica {period ? `(${period})` : ''}</h2>
            <p className="section-description">Evolução das notas gerais de {stateName}, convertidas para uma escala comum de 0 a 100.</p>
            <div className="chart-canvas min-w-0">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart accessibilityLayer data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid stroke="rgba(191,208,224,.62)" vertical={false} />
                  <XAxis axisLine={{ stroke: '#bfbfbf' }} dataKey="year" tick={{ fill: '#54555a', fontSize: 12 }} tickMargin={10} tickLine={false} />
                  <YAxis axisLine={false} domain={[0, 100]} tick={{ fill: '#54555a', fontSize: 12 }} tickLine={false} width={34} />
                  <Tooltip content={ChartTooltip} cursor={{ stroke: '#bfd0e0', strokeDasharray: '3 3' }} />
                  <Legend iconSize={17} iconType="plainline" wrapperStyle={{ color: '#404040', fontSize: 12, paddingTop: 20 }} />
                  <Line connectNulls dataKey="ibid" dot={false} isAnimationActive={false} name="IBID" stroke={colors.ibid} strokeWidth={3} type="monotone" />
                  <Line connectNulls dataKey="clp" dot={false} isAnimationActive={false} name="CLP" stroke={colors.clp} strokeWidth={3} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="source-line">Fontes: {data.ibid.meta.source} · {data.clp.meta.source}</p>
          </section>

          <section className="series-chart min-w-0">
            <h2 className="section-title">Evolução de Posição no Ranking {period ? `(${period})` : ''}</h2>
            <p className="section-description">Posição de {stateName} no ranking Brasil em cada estudo.</p>
            <div className="chart-canvas min-w-0">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart accessibilityLayer data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid stroke="rgba(191,208,224,.62)" vertical={false} />
                  <XAxis axisLine={{ stroke: '#bfbfbf' }} dataKey="year" tick={{ fill: '#54555a', fontSize: 12 }} tickMargin={10} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} domain={[1, maxPosition]} reversed tick={{ fill: '#54555a', fontSize: 12 }} tickFormatter={(value: number) => `${value}º`} tickLine={false} width={38} />
                  <Tooltip content={ChartTooltip} cursor={{ stroke: '#bfd0e0', strokeDasharray: '3 3' }} />
                  <Legend iconSize={17} iconType="plainline" wrapperStyle={{ color: '#404040', fontSize: 12, paddingTop: 20 }} />
                  <Line connectNulls dataKey="ibidPosition" dot={{ fill: colors.ibid, r: 3, stroke: '#fff', strokeWidth: 1 }} isAnimationActive={false} name="Posição IBID" stroke={colors.ibid} strokeWidth={3} type="monotone" />
                  <Line connectNulls dataKey="clpPosition" dot={{ fill: colors.clp, r: 3, stroke: '#fff', strokeWidth: 1 }} isAnimationActive={false} name="Posição CLP" stroke={colors.clp} strokeWidth={3} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="source-line">Quanto menor a posição, melhor a colocação no ranking nacional.</p>
          </section>
        </div>

        <section className="comparison-bars-section">
          <h2 className="section-title">Comparativo de posição e nota entre os estudos</h2>
          <p className="section-description">{stateName} · Nota geral e posição no ranking por ano</p>
          <p className="state-comparison-scroll-hint">Deslize para ver todos os anos</p>
          <div className="state-comparison-scroll" role="region" aria-label="Comparação anual entre IBID e CLP" tabIndex={0}>
            <div className="state-comparison-canvas">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart accessibilityLayer barCategoryGap="24%" data={chartData} margin={{ left: 0, right: 8, top: 42 }}>
                  <XAxis axisLine={{ stroke: '#bfbfbf' }} dataKey="year" tick={{ fill: '#54555a', fontSize: 12 }} tickMargin={10} tickLine={false} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip content={ChartTooltip} cursor={{ fill: '#eef6ff' }} />
                  <Legend iconSize={17} iconType="plainline" wrapperStyle={{ color: '#404040', fontSize: 12, paddingTop: 20 }} />
                  <Bar dataKey="ibid" fill={colors.ibid} isAnimationActive={false} maxBarSize={28} name="IBID">
                    <LabelList content={<PositionLabel />} dataKey="ibidLabel" />
                  </Bar>
                  <Bar dataKey="clp" fill={colors.clp} isAnimationActive={false} maxBarSize={28} name="CLP">
                    <LabelList content={<PositionLabel />} dataKey="clpLabel" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="source-line">Fontes: {data.ibid.meta.source} · {data.clp.meta.source}</p>
        </section>

        <ComparisonTable data={data} stateName={stateName} />
      </div>
    </main>
  )
}
