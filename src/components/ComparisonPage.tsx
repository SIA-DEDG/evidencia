import { ChevronDown, ChevronRight, Info } from 'lucide-react'
import { Fragment, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
  type TooltipContentProps,
} from 'recharts'
import { BrazilMap } from './BrazilMap'
import { FilterDrawer } from './FilterDrawer'
import { generalMetricValue, pillarRelation, pillarRelationLabel, pillarRelations, type PillarRelation } from '../data/studyRelations'
import type { ComparisonDataset, DashboardDataset, DetailRow, RankingItem, SelectOption } from '../types/dashboard'

interface ComparisonPageProps {
  data: ComparisonDataset
  onFiltersChange(values: Record<string, string>): void
}

interface ComparisonDatum {
  year: number
  ibidPlot: number | null
  clpPlot: number | null
  ibidRaw: number | null
  clpRaw: number | null
  ibidLabel: string | null
  clpLabel: string | null
  ibidPosition: number | null
  clpPosition: number | null
  total: number | null
}

interface ConceptRow {
  id: string
  relation: PillarRelation
  ibid?: DetailRow
  clp?: DetailRow
}

interface ConceptChildRow {
  id: string
  ibidTitle: string
  clpTitle: string
  note: string
  source: string
  ibid?: DetailRow
  clp?: DetailRow
}

const colors = {
  ibid: '#034ea2',
  clp: '#8db2ff',
}

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

// IBID vai de 0 a 1 e CLP de 0 a 100: os gráficos plotam ambos em 0–100, mas rótulos,
// eixos e tooltips exibem sempre a nota original de cada estudo.
function scoreToPlotScale(kind: 'ibid' | 'clp', value: number | null) {
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
      ibidPlot: scoreToPlotScale('ibid', ibidRaw),
      clpPlot: scoreToPlotScale('clp', clpRaw),
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
        const isIbid = String(entry.dataKey).startsWith('ibid')
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

function StudySummaryCard({ data, label, metricName }: { data: DashboardDataset; label: 'IBID' | 'CLP'; metricName: string }) {
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
      <p className="truncate text-xs text-muted">{metricName} · {label}</p>
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

function TopStatesCard({ data, metricName }: { data: DashboardDataset; metricName: string }) {
  const [first, ...remaining] = data.nationalRanking.slice(0, 5)
  return (
    <article className="summary-card ranking-summary comparison-top-card">
      <p className="eyebrow truncate">Top 5 Brasil · {metricName} CLP</p>
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

interface StatePoint {
  code: string
  sigla: string
  name: string
  ibid: number
  clp: number
  ibidPosition: number
  clpPosition: number
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function statePoints(data: ComparisonDataset): StatePoint[] {
  const clpByCode = new Map((data.clp.stateRanking ?? []).map((item) => [item.code, item]))
  return (data.ibid.stateRanking ?? []).flatMap((ibid) => {
    const clp = clpByCode.get(ibid.code)
    if (!ibid.code || !clp || ibid.wasNull || clp.wasNull) return []
    return [{
      code: ibid.code,
      sigla: ibid.name.toUpperCase(),
      name: ibid.label ?? ibid.name,
      ibid: ibid.value,
      clp: clp.value,
      ibidPosition: ibid.position,
      clpPosition: clp.position,
    }]
  })
}

function ScatterTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as StatePoint | undefined
  if (!active || !point) return null
  return (
    <div className="chart-tooltip">
      <strong>{point.name} ({point.sigla})</strong>
      <p><span style={{ backgroundColor: colors.ibid }} />IBID: {rawScore(point.ibid, 3)} · {point.ibidPosition}º lugar</p>
      <p><span style={{ backgroundColor: colors.clp }} />CLP: {rawScore(point.clp, 2)} · {point.clpPosition}º lugar</p>
    </div>
  )
}

function SiglaLabel({ selected = false, value, x, y }: LabelProps & { selected?: boolean }) {
  if (typeof x !== 'number' || typeof y !== 'number') return null
  return selected
    ? <text fill="#041d3b" fontSize="13" fontWeight="700" paintOrder="stroke" stroke="#fff" strokeWidth={3} textAnchor="middle" x={x} y={y - 12}>{value}</text>
    : <text fill="#54555a" fontSize="10" textAnchor="middle" x={x} y={y - 8}>{value}</text>
}

function SelectedPoint({ cx, cy }: { cx?: number; cy?: number }) {
  if (typeof cx !== 'number' || typeof cy !== 'number') return null
  return <circle cx={cx} cy={cy} fill="#041d3b" r={7} stroke="#fff" strokeWidth={2} />
}

function AgreementScatter({ data, onSelect, selectedState, stateName, year }: {
  data: ComparisonDataset
  onSelect: (code: string) => void
  selectedState: string
  stateName: string
  year: string
}) {
  const points = useMemo(() => statePoints(data), [data])
  if (!points.length) return null
  const ibidMedian = median(points.map((point) => point.ibid))
  const clpMedian = median(points.map((point) => point.clp))
  const ibidDomainMax = Math.min(1, Math.ceil((Math.max(...points.map((point) => point.ibid)) + 0.05) * 10) / 10)
  const clpDomainMax = Math.min(100, Math.ceil((Math.max(...points.map((point) => point.clp)) + 5) / 10) * 10)
  const selected = points.find((point) => point.code === selectedState)
  const quadrant = selected
    ? selected.ibid >= ibidMedian
      ? selected.clp >= clpMedian ? 'acima da mediana nos dois estudos' : 'acima da mediana no IBID e abaixo no CLP'
      : selected.clp >= clpMedian ? 'abaixo da mediana no IBID e acima no CLP' : 'abaixo da mediana nos dois estudos'
    : null

  return (
    <section className="series-chart min-w-0">
      <h2 className="section-title">IBID × CLP entre os estados {year ? `(${year})` : ''}</h2>
      <p className="section-description">
        Cada ponto é um estado; as linhas tracejadas marcam a mediana de cada estudo.
        {quadrant ? ` ${stateName} está ${quadrant}.` : ''} Clique em um ponto para selecionar o estado.
      </p>
      <div className="comparison-scatter-canvas min-w-0">
        <ResponsiveContainer height="100%" width="100%">
          <ScatterChart accessibilityLayer margin={{ bottom: 24, left: 8, right: 16, top: 16 }}>
            <CartesianGrid stroke="rgba(191,208,224,.62)" />
            <XAxis
              axisLine={{ stroke: '#bfbfbf' }}
              dataKey="ibid"
              domain={[0, ibidDomainMax]}
              label={{ fill: colors.ibid, fontSize: 12, fontWeight: 600, position: 'bottom', value: 'Nota IBID (0–1)' }}
              name="IBID"
              tick={{ fill: '#54555a', fontSize: 12 }}
              tickFormatter={(value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
              tickLine={false}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey="clp"
              domain={[0, clpDomainMax]}
              label={{ angle: -90, fill: '#5b7fc7', fontSize: 12, fontWeight: 600, position: 'insideLeft', value: 'Nota CLP (0–100)' }}
              name="CLP"
              tick={{ fill: '#54555a', fontSize: 12 }}
              tickLine={false}
              type="number"
              width={48}
            />
            <ReferenceLine stroke="#9aa9bb" strokeDasharray="4 4" x={ibidMedian} />
            <ReferenceLine stroke="#9aa9bb" strokeDasharray="4 4" y={clpMedian} />
            <Tooltip content={ScatterTooltip} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter
              data={points.filter((point) => point.code !== selectedState)}
              fill={colors.ibid}
              fillOpacity={0.55}
              isAnimationActive={false}
              onClick={(point) => onSelect((point as unknown as StatePoint).code)}
              style={{ cursor: 'pointer' }}
            >
              <LabelList content={<SiglaLabel />} dataKey="sigla" />
            </Scatter>
            {selected && (
              <Scatter data={[selected]} fill="#041d3b" isAnimationActive={false} shape={<SelectedPoint />}>
                <LabelList content={<SiglaLabel selected />} dataKey="sigla" />
              </Scatter>
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="source-line">Fontes: {data.ibid.meta.source} · {data.clp.meta.source}</p>
    </section>
  )
}

function rankNumber(value?: string) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : null
}

function PillarDumbbell({ data, stateName }: { data: ComparisonDataset; stateName: string }) {
  const total = Math.max(27, ...(data.ibid.stateRanking ?? []).map((item) => item.position))
  const rows = conceptRows(data).map((concept) => ({
    id: concept.id,
    title: pairTitle(concept.relation.ibidPillar, concept.relation.clpPillar),
    ibid: rankNumber(concept.ibid?.nationalRank),
    clp: rankNumber(concept.clp?.nationalRank),
  }))
  const offset = (position: number) => ((position - 1) / (total - 1)) * 100
  const ticks = [...new Set([1, 5, 10, 15, 20, 25, total])].filter((value) => value <= total)

  return (
    <section className="min-w-0">
      <h2 className="section-title">Posição por pilar nos dois estudos</h2>
      <p className="section-description">
        Posição de {stateName} no ranking Brasil em cada par de pilares relacionados (IBID × CLP). Quanto mais longo o traço, mais os estudos discordam; mais à esquerda, melhor a colocação.
      </p>
      <div className="comparison-dumbbell" role="list">
        {rows.map((row) => {
          const gap = row.ibid !== null && row.clp !== null ? Math.abs(row.ibid - row.clp) : null
          return (
            <div className="comparison-dumbbell-row" key={row.id} role="listitem">
              <span className="comparison-dumbbell-title">{row.title}</span>
              <div aria-label={`${row.title}: IBID ${row.ibid ?? '—'}º, CLP ${row.clp ?? '—'}º`} className="comparison-dumbbell-track" role="img">
                {row.ibid !== null && row.clp !== null && (
                  <span
                    className="comparison-dumbbell-bar"
                    style={{ left: `${offset(Math.min(row.ibid, row.clp))}%`, width: `${offset(Math.max(row.ibid, row.clp)) - offset(Math.min(row.ibid, row.clp))}%` }}
                  />
                )}
                {row.clp !== null && <span className="comparison-dumbbell-dot" style={{ backgroundColor: colors.clp, left: `${offset(row.clp)}%` }}><b>{row.clp}º</b></span>}
                {row.ibid !== null && <span className="comparison-dumbbell-dot" style={{ backgroundColor: colors.ibid, left: `${offset(row.ibid)}%` }}><b>{row.ibid}º</b></span>}
              </div>
              <span className="comparison-dumbbell-gap">{gap === null ? '—' : gap === 0 ? 'igual' : `${gap} pos.`}</span>
            </div>
          )
        })}
        <div aria-hidden="true" className="comparison-dumbbell-row comparison-dumbbell-axis">
          <span />
          <div className="comparison-dumbbell-track">
            {ticks.map((tick) => <span key={tick} style={{ left: `${offset(tick)}%` }}>{tick}º</span>)}
          </div>
          <span className="comparison-dumbbell-gap">Diferença</span>
        </div>
      </div>
      <ul className="comparison-dumbbell-legend">
        <li><span style={{ backgroundColor: colors.ibid }} />IBID</li>
        <li><span style={{ backgroundColor: colors.clp }} />CLP</li>
      </ul>
    </section>
  )
}

function stripNumber(title: string) {
  return title.replace(/^\d+(?:\.\d+)*\.?\s*/, '')
}

function findByName(rows: DetailRow[], name: string) {
  const target = normalize(name)
  const queue = [...rows]
  while (queue.length) {
    const row = queue.shift()!
    if (normalize(stripNumber(row.title)) === target) return row
    if (row.children) queue.push(...row.children)
  }
  return undefined
}

function pairTitle(ibid: string, clp: string) {
  return normalize(ibid) === normalize(clp) ? ibid : `${ibid} × ${clp}`
}

/** Pares de pilares exibidos: todos nas notas gerais, ou só o par escolhido no filtro. */
function conceptRows(data: ComparisonDataset): ConceptRow[] {
  const selected = pillarRelation(data.relation)
  return (selected ? [selected] : pillarRelations).map((relation) => ({
    id: relation.id,
    relation,
    ibid: findByName(data.ibid.details, relation.ibidPillar),
    clp: findByName(data.clp.details, relation.clpPillar),
  }))
}

function childRows(concept: ConceptRow): ConceptChildRow[] {
  return concept.relation.indicators.map((indicator) => ({
    id: `${concept.id}-${normalize(indicator.clp)}`,
    ibidTitle: indicator.ibid,
    clpTitle: indicator.clp,
    note: indicator.note,
    source: indicator.source,
    ibid: findByName(concept.ibid ? [concept.ibid] : [], indicator.ibid),
    clp: findByName(concept.clp ? [concept.clp] : [], indicator.clp),
  }))
}

function scoreCell(row?: DetailRow) {
  if (!row) return <span className="comparison-empty-cell">—</span>
  const hasRank = Boolean(row.nationalRank && row.nationalRank !== '—')
  const hasScore = Boolean(row.nationalScore && row.nationalScore !== '—')
  if (!hasRank && !hasScore) return <span className="comparison-empty-cell">sem nota</span>
  return (
    <span className="comparison-table-value">
      <strong>{row.nationalRank || '—'}</strong>
      <small>{hasScore ? `nota ${row.nationalScore}` : ''}</small>
    </span>
  )
}

function PairName({ clp, ibid }: { clp: string; ibid: string }) {
  if (normalize(ibid) === normalize(clp)) return <>{ibid}</>
  return (
    <span className="comparison-pair-name">
      <span><b>IBID</b> {ibid}</span>
      <span><b>CLP</b> {clp}</span>
    </span>
  )
}

function ComparisonTable({ data, stateName }: { data: ComparisonDataset; stateName: string }) {
  const rows = conceptRows(data)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rows[0]?.id ?? '']))
  const [mobileStudy, setMobileStudy] = useState<'ibid' | 'clp'>('ibid')
  const [openDetails, setOpenDetails] = useState<Set<string>>(() => new Set())
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
          title: mobileStudy === 'ibid' ? child.ibidTitle : child.clpTitle,
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
          <p className="section-description">
            Pilares e indicadores que medem a mesma coisa nos dois estudos, relacionados por mesma fonte e mesma medida.
            O IBID não publica nota por indicador, só por pilar.
          </p>
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
            <tr><th className="detail-hierarchy-header">Pilar / indicador relacionado</th><th>IBID</th><th>CLP</th><th>Fonte</th></tr>
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
                title: `${index + 1}. ${mobileStudy === 'ibid' ? row.relation.ibidPillar : row.relation.clpPillar}`,
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
  const sources = [...new Set(row.relation.indicators.map((indicator) => indicator.source))].join(' · ')
  return (
    <>
      <tr className={`detail-row${index % 2 === 0 ? ' detail-row-striped' : ''}`}>
        <td className="detail-hierarchy-cell">
          <button aria-expanded={canExpand ? isExpanded : undefined} className="detail-row-trigger" disabled={!canExpand} onClick={onToggle} type="button">
            <span className="detail-chevron" aria-hidden="true">{canExpand ? isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}</span>
            <span className="level-badge">Pilar</span>
            <span className="detail-row-title">{index + 1}. <PairName clp={row.relation.clpPillar} ibid={row.relation.ibidPillar} /></span>
          </button>
        </td>
        <td>{scoreCell(row.ibid)}</td>
        <td>{scoreCell(row.clp)}</td>
        <td className="detail-text-cell comparison-source-cell" title={sources}>{sources}</td>
      </tr>
      {isExpanded && childrenRows.map((child) => (
        <tr className="detail-row" key={child.id}>
          <td className="detail-hierarchy-cell comparison-child-cell">
            <span className="detail-row-trigger">
              <span className="detail-chevron" />
              <span className="level-badge">Indicador</span>
              <span className="detail-row-title">
                <PairName clp={child.clpTitle} ibid={child.ibidTitle} />
                <small className="comparison-pair-note">{child.note}</small>
              </span>
            </span>
          </td>
          <td>{scoreCell(child.ibid)}</td>
          <td>{scoreCell(child.clp)}</td>
          <td className="detail-text-cell comparison-source-cell" title={child.source}>{child.source}</td>
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
  const filterPanelRef = useRef<HTMLElement>(null)
  const [mapStudy, setMapStudy] = useState<'ibid' | 'clp'>('ibid')
  const mapData = mapStudy === 'ibid' ? data.ibid : data.clp
  const ibidByState = useMemo(() => new Map((data.ibid.stateRanking ?? []).map((item) => [item.code, item])), [data.ibid])
  const clpByState = useMemo(() => new Map((data.clp.stateRanking ?? []).map((item) => [item.code, item])), [data.clp])
  const relation = pillarRelation(data.relation)
  const ibidMetricName = relation ? `Pilar ${relation.ibidPillar}` : 'Nota Geral'
  const clpMetricName = relation ? `Pilar ${relation.clpPillar}` : 'Nota Geral'
  const seriesSubject = relation
    ? `das notas dos pilares ${relation.ibidPillar} (IBID) e ${relation.clpPillar} (CLP)`
    : 'das notas gerais'

  function mapTooltipLines(item: RankingItem) {
    const line = (label: string, entry: RankingItem | undefined, decimals: number) =>
      !entry || entry.wasNull ? `${label}: sem dado` : `${label}: ${rawScore(entry.value, decimals)} · ${entry.position}º lugar`
    return [line('IBID', ibidByState.get(item.code), 3), line('CLP', clpByState.get(item.code), 2)]
  }

  function updateFilter(id: 'primary' | 'year' | 'metric', value: string) {
    onFiltersChange({
      primary: id === 'primary' ? value : selectedState,
      year: id === 'year' ? value : selectedYear,
      metric: id === 'metric' ? value : data.relation ?? generalMetricValue,
    })
  }

  const filterFields = (
    <>
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
      <select className="field-select" onChange={(event) => updateFilter('metric', event.target.value)} value={data.relation ?? generalMetricValue}>
        <option value={generalMetricValue}>Notas Gerais · IBID e CLP</option>
        <optgroup label="Pilares relacionados">
          {pillarRelations.map((item) => <option key={item.id} value={item.id}>{pillarRelationLabel(item)}</option>)}
        </optgroup>
      </select>
    </label>
    </>
  )

  return (
    <main className="page-shell dashboard-comparativo">
      <FilterDrawer targetRef={filterPanelRef} title="Filtros do comparativo">
        <div className="filter-drawer-fields">{filterFields}</div>
      </FilterDrawer>
      <div className="dashboard-intro">
        <div className="max-w-[977px]">
          <h1 className="text-xl font-semibold text-brand-700">Comparativo entre os estudos</h1>
          <p>Um estado sob duas óticas — IBID e CLP</p>
        </div>
      </div>

      <div className="dashboard-filter-intro">
        <h2>Painel comparativo dos estados</h2>
        <p>Escolha um estado, um ano e a métrica: as notas gerais ou um par de pilares que medem a mesma coisa nos dois estudos.</p>
      </div>

      <section className="filter-panel mt-5" aria-label="Filtros do comparativo" ref={filterPanelRef}>
        <div className="filter-layout comparison-filter-layout">
          {filterFields}
        </div>
      </section>

      <section className="summary-grid comparison-summary-grid" aria-label="Resumo comparativo">
        <StudySummaryCard data={data.ibid} label="IBID" metricName={ibidMetricName} />
        <StudySummaryCard data={data.clp} label="CLP" metricName={clpMetricName} />
        <TopStatesCard data={data.clp} metricName={clpMetricName} />
      </section>

      <div className="dashboard-results-panel">
        <div className="dashboard-visual-grid">
          <div className="dashboard-visual-charts">
          <section className="series-chart min-w-0">
            <h2 className="section-title">Série Histórica {period ? `(${period})` : ''}</h2>
            <p className="section-description">Evolução {seriesSubject} de {stateName}. IBID no eixo esquerdo (0–1) e CLP no eixo direito (0–100).</p>
            <div className="chart-canvas min-w-0">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart accessibilityLayer data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid stroke="rgba(191,208,224,.62)" vertical={false} />
                  <XAxis axisLine={{ stroke: '#bfbfbf' }} dataKey="year" tick={{ fill: '#54555a', fontSize: 12 }} tickMargin={10} tickLine={false} />
                  <YAxis
                    axisLine={false}
                    domain={[0, 100]}
                    tick={{ fill: colors.ibid, fontSize: 12 }}
                    tickFormatter={(value: number) => (value / 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                    tickLine={false}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    width={34}
                    yAxisId="score"
                  />
                  <YAxis
                    axisLine={false}
                    domain={[0, 100]}
                    orientation="right"
                    tick={{ fill: colors.clp, fontSize: 12 }}
                    tickLine={false}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    width={34}
                    yAxisId="clp-reference"
                  />
                  <Tooltip content={ChartTooltip} cursor={{ stroke: '#bfd0e0', strokeDasharray: '3 3' }} />
                  <Legend iconSize={17} iconType="plainline" wrapperStyle={{ color: '#404040', fontSize: 12, paddingTop: 20 }} />
                  <Line connectNulls dataKey="ibidPlot" dot={{ fill: colors.ibid, r: 3, stroke: '#fff', strokeWidth: 1 }} isAnimationActive={false} name="IBID" stroke={colors.ibid} strokeWidth={3} type="monotone" yAxisId="score" />
                  <Line connectNulls dataKey="clpPlot" dot={{ fill: colors.clp, r: 3, stroke: '#fff', strokeWidth: 1 }} isAnimationActive={false} name="CLP" stroke={colors.clp} strokeWidth={3} type="monotone" yAxisId="clp-reference" />
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

          <div className="comparison-map min-w-0">
            <div className="comparison-map-toggle" role="group" aria-label="Estudo exibido no mapa">
              {(['ibid', 'clp'] as const).map((study) => (
                <button aria-pressed={mapStudy === study} key={study} onClick={() => setMapStudy(study)} type="button">
                  {study.toUpperCase()}
                </button>
              ))}
            </div>
            <BrazilMap
              decimals={mapStudy === 'ibid' ? 3 : 2}
              kind={mapData.kind}
              metricLabel={mapStudy === 'ibid' ? ibidMetricName : clpMetricName}
              onSelect={(code) => updateFilter('primary', code)}
              ranking={mapData.stateRanking ?? []}
              selectedCode={selectedState}
              tooltipLines={mapTooltipLines}
              year={selectedYear}
            />
          </div>
        </div>
      </div>

      <div className="dashboard-results-panel">
        <section className="min-w-0">
          <h2 className="section-title">Comparativo de posição e nota entre os estudos</h2>
          <p className="section-description">{stateName} · Nota geral e posição no ranking por ano. As barras usam uma escala comum; os rótulos mostram a nota original (IBID 0–1, CLP 0–100).</p>
          <p className="state-comparison-scroll-hint">Deslize para ver todos os anos</p>
          <div className="state-comparison-scroll" role="region" aria-label="Comparação anual entre IBID e CLP" tabIndex={0}>
            <div className="state-comparison-canvas">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart accessibilityLayer barCategoryGap="20%" barGap={12} data={chartData} margin={{ left: 0, right: 8, top: 42 }}>
                  <XAxis axisLine={{ stroke: '#bfbfbf' }} dataKey="year" tick={{ fill: '#54555a', fontSize: 12 }} tickMargin={10} tickLine={false} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip content={ChartTooltip} cursor={{ fill: '#eef6ff' }} />
                  <Legend iconSize={17} iconType="plainline" wrapperStyle={{ color: '#404040', fontSize: 12, paddingTop: 20 }} />
                  <Bar dataKey="ibidPlot" fill={colors.ibid} isAnimationActive={false} maxBarSize={28} name="IBID">
                    <LabelList content={<PositionLabel />} dataKey="ibidLabel" />
                  </Bar>
                  <Bar dataKey="clpPlot" fill={colors.clp} isAnimationActive={false} maxBarSize={28} name="CLP">
                    <LabelList content={<PositionLabel />} dataKey="clpLabel" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="source-line">Fontes: {data.ibid.meta.source} · {data.clp.meta.source}</p>
        </section>
      </div>

      <div className="dashboard-results-panel">
        <AgreementScatter data={data} onSelect={(code) => updateFilter('primary', code)} selectedState={selectedState} stateName={stateName} year={selectedYear} />
      </div>

      <div className="dashboard-results-panel">
        <PillarDumbbell data={data} stateName={stateName} />
      </div>

      <div className="dashboard-results-panel">
        <ComparisonTable data={data} stateName={stateName} />
      </div>
    </main>
  )
}
