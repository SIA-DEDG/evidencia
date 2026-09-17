import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  usePlotArea,
  useXAxisScale,
  type LabelProps,
  type TooltipContentProps,
} from 'recharts'
import { useState } from 'react'
import { getDashboardChartColors } from '../data/chartColors'
import { normalizeSearchText } from '../data/dashboardSearch'
import type { ComponentInsight, DashboardKind, InsightGroup } from '../types/dashboard'

const POSITIVE_COLOR = '#16a34a'
const NEGATIVE_COLOR = '#dc2626'
const PREVIOUS_COLOR = '#a3a7ae'
/** O radar só é legível entre 3 e 10 eixos; fora disso o perfil vira barras horizontais. */
const RADAR_MIN_ITEMS = 3
const RADAR_MAX_ITEMS = 10
/** Perfil e Forças e Fraquezas mostram até 10 linhas; o restante fica acessível pela rolagem. */
const VISIBLE_ROWS = 10

function formatScore(value: number | null | undefined, decimals: number) {
  return typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—'
}

function formatSigned(value: number, decimals: number) {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatScore(Math.abs(value), decimals)}`
}

/** Teto do eixo de nota: IBID vai de 0 a 1 e CLP de 0 a 100. */
function scoreCeiling(kind: DashboardKind, values: Array<number | null>) {
  const max = Math.max(0, ...values.filter((value): value is number => value !== null))
  return kind === 'ibid' ? Math.min(1, Math.ceil(max * 10) / 10 || 0.1) : Math.min(100, Math.ceil(max / 10) * 10 || 10)
}

function wrapLabel(label: string, maxLength = 16) {
  const lines: string[] = []
  for (const word of label.split(' ')) {
    const last = lines.at(-1)
    if (last && `${last} ${word}`.length <= maxLength) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

function matchesSearch(name: string, query: string | undefined) {
  const term = normalizeSearchText(query ?? '')
  return !term || normalizeSearchText(name).includes(term)
}

function truncate(label: string, maxLength: number) {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label
}

/** Rótulo do eixo de categorias com nome longo cortado e o nome inteiro no hover. */
function CategoryTick({ payload, x, y }: { payload?: { value: string }; x?: number | string; y?: number | string }) {
  const label = String(payload?.value ?? '')
  return (
    <text dominantBaseline="central" fill="#404040" fontSize={12} textAnchor="end" x={Number(x) - 6} y={Number(y)}>
      <title>{label}</title>
      {truncate(label, 30)}
    </text>
  )
}

export const levelPlural: Record<InsightGroup['level'], string> = {
  Pilar: 'Pilares',
  Dimensão: 'Dimensões',
  Indicador: 'Indicadores',
}

function ScoreTooltip({ active, label, payload, decimals }: TooltipContentProps & { decimals: number }) {
  if (!active || !payload.length) return null
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)}>
          <span style={{ backgroundColor: entry.color }} />
          {entry.name}: {formatScore(entry.value as number | null, decimals)}
        </p>
      ))}
    </div>
  )
}

export interface InsightChartProps {
  comparisonLabel: string
  decimals: number
  hasComparison: boolean
  items: ComponentInsight[]
  kind: DashboardKind
  level: InsightGroup['level']
  metricLabel: string
  primaryLabel: string
  /** Filtra os itens pelo nome (sem diferenciar acentos e maiúsculas). */
  searchQuery?: string
  source: string
  year: string
}

export function InsightProfileChart({ comparisonLabel, decimals, hasComparison, items: allItems, kind, level, metricLabel, primaryLabel, searchQuery, source, year }: InsightChartProps) {
  const colors = getDashboardChartColors(kind)
  // Só entram os itens com alguma nota no ano selecionado; os que não existem naquele ano ficam de fora.
  const scoredItems = allItems.filter((item) => item.score !== null || item.comparisonScore !== null || item.nationalAverage !== null)
  const items = scoredItems.filter((item) => matchesSearch(item.name, searchQuery))
  const searching = items.length !== scoredItems.length
  const showComparison = hasComparison && items.some((item) => item.comparisonScore !== null)
  // A escala considera todos os itens para não mudar enquanto a busca filtra.
  const ceiling = scoreCeiling(kind, scoredItems.flatMap((item) => [item.score, item.comparisonScore, item.nationalAverage]))
  // O tipo de gráfico segue o total do nível; a busca só troca para barras quando sobram poucos eixos.
  const useRadar = scoredItems.length >= RADAR_MIN_ITEMS && scoredItems.length <= RADAR_MAX_ITEMS && items.length >= RADAR_MIN_ITEMS
  const data = items.map((item) => ({ name: item.name, primary: item.score, comparison: item.comparisonScore, national: item.nationalAverage }))
  const scope = items.length === 1 ? ` · ${items[0].name}` : ` por ${level.toLowerCase()}`
  const rowHeight = showComparison ? 42 : 32
  const barHeight = Math.max(searching ? 120 : 220, 72 + items.length * rowHeight)

  return (
    <section className="pillar-chart min-w-0">
      <h2 className="section-title">Perfil por {level}</h2>
      <p className="section-description">
        Comparação entre {primaryLabel}{showComparison ? `, ${comparisonLabel}` : ''} e média nacional{scope} ({year})
      </p>
      {items.length === 0 ? (
        <div className="chart-empty">
          {scoredItems.length === 0 ? `Não há ${levelPlural[level].toLowerCase()} com nota em ${year}.` : `Nenhum resultado para “${searchQuery?.trim()}”.`}
        </div>
      ) : (
      <div className={useRadar ? undefined : 'insight-rows-scroll'} style={useRadar ? undefined : { maxHeight: 72 + VISIBLE_ROWS * rowHeight }}>
      <div className="pillar-chart-canvas" style={useRadar ? undefined : { height: barHeight }}>
        <ResponsiveContainer height="100%" width="100%">
          {useRadar ? (
            <RadarChart accessibilityLayer data={data} margin={{ bottom: 8, left: 48, right: 48, top: 8 }} outerRadius="72%">
              <PolarGrid stroke="#dbe5f0" />
              <PolarAngleAxis
                dataKey="name"
                tick={({ payload, x, y, textAnchor }) => (
                  <text fill="#404040" fontSize={11} textAnchor={textAnchor} x={x} y={y}>
                    <title>{String(payload?.value ?? '')}</title>
                    {wrapLabel(truncate(String(payload?.value ?? ''), 40)).map((line, index) => <tspan dy={index === 0 ? 0 : 13} key={line} x={x}>{line}</tspan>)}
                  </text>
                )}
              />
              <PolarRadiusAxis angle={90} axisLine={false} domain={[0, ceiling]} tick={{ fill: '#717379', fontSize: 10 }} tickCount={5} />
              <Tooltip content={(props) => <ScoreTooltip {...props} decimals={decimals} />} />
              <Radar dataKey="national" fill="none" name="Média do Brasil" stroke={colors.national} strokeDasharray="5 4" strokeWidth={2} />
              {showComparison && <Radar dataKey="comparison" dot={{ r: 3 }} fill={colors.comparison} fillOpacity={0.25} name={comparisonLabel} stroke={colors.comparison} strokeWidth={2} />}
              <Radar dataKey="primary" dot={{ r: 3 }} fill={colors.primary} fillOpacity={0.2} name={primaryLabel} stroke={colors.primary} strokeWidth={2.5} />
              <Legend iconSize={14} wrapperStyle={{ color: '#404040', fontSize: 12, paddingTop: 8 }} />
            </RadarChart>
          ) : (
            <BarChart accessibilityLayer barGap={2} data={data} layout="vertical" margin={{ bottom: 0, left: 0, right: 16, top: 8 }}>
              <CartesianGrid horizontal={false} stroke="rgba(191,208,224,.62)" />
              <XAxis axisLine={false} domain={[0, ceiling]} tick={{ fill: '#54555a', fontSize: 11 }} tickLine={false} type="number" />
              <YAxis axisLine={false} dataKey="name" interval={0} tick={<CategoryTick />} tickLine={false} type="category" width={200} />
              <Tooltip content={(props) => <ScoreTooltip {...props} decimals={decimals} />} cursor={{ fill: 'rgba(3, 78, 162, .05)' }} />
              <Legend iconSize={12} iconType="square" verticalAlign="top" wrapperStyle={{ color: '#404040', fontSize: 12, paddingBottom: 8 }} />
              <Bar dataKey="primary" fill={colors.primary} maxBarSize={12} name={primaryLabel} />
              {showComparison && <Bar dataKey="comparison" fill={colors.comparison} maxBarSize={12} name={comparisonLabel} />}
              <Bar dataKey="national" fill={colors.national} fillOpacity={0.55} maxBarSize={12} name="Média do Brasil" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      </div>
      )}
      <p className="source-line">Fonte: {source} · Descrição: {metricLabel}</p>
    </section>
  )
}

interface GapDatum {
  name: string
  gap: number | null
  comparisonGap: number | null
  score: number | null
  comparisonScore: number | null
  nationalAverage: number
}

function GapTooltip({ active, payload, comparisonLabel, decimals, primaryLabel, showComparison }: TooltipContentProps & { comparisonLabel: string; decimals: number; primaryLabel: string; showComparison: boolean }) {
  if (!active || !payload.length) return null
  const datum = payload[0]?.payload as GapDatum | undefined
  if (!datum) return null
  const scoreLine = (label: string, score: number | null, gap: number | null) => `${label}: ${formatScore(score, decimals)}${gap === null ? '' : ` (${formatSigned(gap, decimals)})`}`
  return (
    <div className="chart-tooltip">
      <strong>{datum.name}</strong>
      {showComparison ? (
        <>
          <p>{scoreLine(primaryLabel, datum.score, datum.gap)}</p>
          <p>{scoreLine(comparisonLabel, datum.comparisonScore, datum.comparisonGap)}</p>
        </>
      ) : (
        <>
          <p>Nota: {formatScore(datum.score, decimals)}</p>
          {datum.gap !== null && <p>Diferença: {formatSigned(datum.gap, decimals)}</p>}
        </>
      )}
      <p>Média do Brasil: {formatScore(datum.nationalAverage, decimals)}</p>
    </div>
  )
}

function GapLabel({ decimals, value, viewBox }: LabelProps & { decimals: number }) {
  if (typeof value !== 'number' || !viewBox || !('x' in viewBox) || !('width' in viewBox)) return <></>
  const x = Number(viewBox.x)
  const width = Number(viewBox.width)
  const y = Number(viewBox.y) + Number(viewBox.height) / 2
  const left = Math.min(x, x + width)
  const right = Math.max(x, x + width)
  const positive = value >= 0
  return (
    <text dominantBaseline="central" fill={positive ? POSITIVE_COLOR : NEGATIVE_COLOR} fontSize={12} fontWeight={600} textAnchor={positive ? 'start' : 'end'} x={positive ? right + 6 : left - 6} y={y}>
      {formatSigned(value, decimals)}
    </text>
  )
}

export function InsightGapChart({ comparisonLabel, decimals, hasComparison, items, kind, metricLabel, primaryLabel, searchQuery, source, year }: InsightChartProps) {
  const colors = getDashboardChartColors(kind)
  const showComparison = hasComparison && items.some((item) => item.comparisonScore !== null && item.nationalAverage !== null)
  const allData: GapDatum[] = items.flatMap((item) => {
    if (item.nationalAverage === null || (item.score === null && (!showComparison || item.comparisonScore === null))) return []
    const gapOf = (score: number | null) => score === null ? null : score - item.nationalAverage!
    return [{
      name: item.name,
      gap: gapOf(item.score),
      comparisonGap: showComparison ? gapOf(item.comparisonScore) : null,
      score: item.score,
      comparisonScore: item.comparisonScore,
      nationalAverage: item.nationalAverage,
    }]
  })
  const data = allData.filter((item) => matchesSearch(item.name, searchQuery))
  // A escala considera todos os itens para não mudar enquanto a busca filtra.
  const gaps = allData.flatMap((item) => [item.gap, item.comparisonGap]).filter((gap): gap is number => gap !== null)
  const maxGap = Math.max(...gaps.map(Math.abs), kind === 'ibid' ? 0.01 : 1)
  // Folga de 25% para caber o rótulo na ponta da barra.
  const limit = maxGap * 1.25
  const gapOverhead = showComparison ? 96 : 64
  const gapRowHeight = showComparison ? 50 : 34
  const labelList = (dataKey: keyof GapDatum) => <LabelList content={(props) => <GapLabel {...props} decimals={decimals} />} dataKey={dataKey} />

  return (
    <section className="pillar-chart min-w-0">
      <h2 className="section-title">Forças e Fraquezas</h2>
      <p className="section-description">
        Diferença da nota de {primaryLabel}{showComparison ? ` e ${comparisonLabel}` : ''} em relação à média do Brasil ({year})
      </p>
      {data.length === 0 ? (
        <div className="chart-empty">
          {allData.length === 0 ? 'Não há notas disponíveis para comparar com a média do Brasil.' : `Nenhum resultado para “${searchQuery?.trim()}”.`}
        </div>
      ) : (
        <div className="insight-rows-scroll" style={{ maxHeight: gapOverhead + VISIBLE_ROWS * gapRowHeight }}>
        <div className="pillar-chart-canvas" style={{ height: Math.max(160, gapOverhead + data.length * gapRowHeight) }}>
          <ResponsiveContainer height="100%" width="100%">
            <BarChart accessibilityLayer barGap={2} data={data} layout="vertical" margin={{ bottom: 0, left: 0, right: 16, top: 20 }}>
              <CartesianGrid horizontal={false} stroke="rgba(191,208,224,.62)" />
              <XAxis
                axisLine={false}
                domain={[-limit, limit]}
                tick={{ fill: '#54555a', fontSize: 11 }}
                tickFormatter={(value: number) => formatScore(value, kind === 'ibid' ? 2 : 0)}
                tickLine={false}
                type="number"
              />
              <YAxis axisLine={false} dataKey="name" interval={0} tick={<CategoryTick />} tickLine={false} type="category" width={200} />
              <ReferenceLine label={{ fill: '#404040', fontSize: 11, position: 'top', value: 'Média Brasil' }} stroke="#8a8f98" x={0} />
              <Tooltip
                content={(props) => <GapTooltip {...props} comparisonLabel={comparisonLabel} decimals={decimals} primaryLabel={primaryLabel} showComparison={showComparison} />}
                cursor={{ fill: 'rgba(3, 78, 162, .05)' }}
              />
              {showComparison && <Legend iconSize={12} iconType="square" itemSorter={null} verticalAlign="top" wrapperStyle={{ color: '#404040', fontSize: 12, paddingBottom: 12 }} />}
              {showComparison ? (
                [
                  <Bar dataKey="gap" fill={colors.primary} key="gap" maxBarSize={16} name={primaryLabel}>{labelList('gap')}</Bar>,
                  <Bar dataKey="comparisonGap" fill={colors.comparison} key="comparisonGap" maxBarSize={16} name={comparisonLabel}>{labelList('comparisonGap')}</Bar>,
                ]
              ) : (
                <Bar dataKey="gap" maxBarSize={18} name="Diferença">
                  {data.map((item) => <Cell fill={(item.gap ?? 0) >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR} key={item.name} />)}
                  {labelList('gap')}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        </div>
      )}
      <p className="source-line">Fonte: {source} · Descrição: {metricLabel}</p>
    </section>
  )
}

function mixColor(from: string, to: string, amount: number) {
  const parse = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16))
  const [a, b] = [parse(from), parse(to)]
  return `rgb(${a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount)).join(',')})`
}

/** Há comparação de posição quando algum item tem posição do território de comparação em algum ano. */
function hasComparisonPositions({ hasComparison, items }: Pick<InsightChartProps, 'hasComparison' | 'items'>) {
  return hasComparison && items.some((item) => item.history.some((point) => point.comparisonPosition !== null))
}

export function InsightPositionHeatmap({ comparisonLabel, hasComparison, items, kind, level, metricLabel, primaryLabel, source }: InsightChartProps) {
  const colors = getDashboardChartColors(kind)
  const municipal = kind === 'clp-municipios'
  const best = municipal ? '#3b2270' : '#0b4a9a'
  const worst = municipal ? '#efeaf8' : '#e3edf8'
  const showComparison = hasComparisonPositions({ hasComparison, items })
  const years = items[0]?.history.map((point) => point.year) ?? []
  const period = years.length > 1 ? `de ${years[0]} a ${years.at(-1)}` : years[0] ? `em ${years[0]}` : ''
  const territories = [
    { key: 'position' as const, label: primaryLabel, color: colors.primary },
    ...(showComparison ? [{ key: 'comparisonPosition' as const, label: comparisonLabel, color: colors.comparison }] : []),
  ]

  return (
    <section className="pillar-chart min-w-0">
      <h2 className="section-title">Evolução da Posição por {level}</h2>
      <p className="section-description">
        Ranking de {primaryLabel}{showComparison ? ` e ${comparisonLabel}` : ''} por {level.toLowerCase()}{period ? `, ${period}` : ''}
      </p>
      <div aria-label={`Tabela de posição por ${level.toLowerCase()} e ano`} className="pillar-heatmap-scroll" role="region" tabIndex={0}>
        <table className="pillar-heatmap">
          <thead>
            <tr>
              <th scope="col">{level}</th>
              {showComparison && <th scope="col">Território</th>}
              {years.map((year) => <th key={year} scope="col">{year}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.flatMap((item, itemIndex) => territories.map((territory, territoryIndex) => (
              <tr className={showComparison && territoryIndex === 0 && itemIndex > 0 ? 'pillar-heatmap-group-start' : undefined} key={`${item.id}:${territory.key}`}>
                {territoryIndex === 0 && <th rowSpan={territories.length} scope="rowgroup" title={item.name}>{item.name}</th>}
                {showComparison && (
                  <td className="pillar-heatmap-territory" style={{ color: territory.color }} title={territory.label}>{territory.label}</td>
                )}
                {item.history.map((point) => {
                  const position = point[territory.key]
                  if (position === null) return <td className="pillar-heatmap-empty" key={point.year}>—</td>
                  const amount = point.total > 1 ? (position - 1) / (point.total - 1) : 0
                  return (
                    <td
                      key={point.year}
                      style={{ backgroundColor: mixColor(best, worst, amount), color: amount < 0.55 ? '#ffffff' : '#1f2937' }}
                      title={`${item.name} · ${territory.label} · ${point.year}: ${position}º de ${point.total}`}
                    >
                      {position}º
                    </td>
                  )
                })}
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <div className="pillar-heatmap-legend" aria-hidden="true">
        <span>Melhor posição</span>
        <span className="pillar-heatmap-gradient" style={{ backgroundImage: `linear-gradient(to right, ${best}, ${worst})` }} />
        <span>Pior posição</span>
      </div>
      <p className="source-line">Fonte: {source} · Descrição: {metricLabel}</p>
    </section>
  )
}

const UNCHANGED_COLOR = '#54555a'
const POSITION_ROW_HEIGHT = 30
const POSITION_COMPARISON_ROW_HEIGHT = 26

interface PositionChangeDatum {
  key: string
  name: string
  territory: string
  territoryColor: string
  isComparison: boolean
  /** Último item do grupo (território de comparação) quando há comparação. */
  closesGroup: boolean
  from: number | null
  to: number | null
  fromTotal: number
  toTotal: number
  /** Valor só para a barra existir na linha; o desenho real usa a escala do eixo. */
  anchor: number | null
}

function changeColor(from: number | null, to: number | null) {
  if (from === null || to === null || from === to) return UNCHANGED_COLOR
  return to < from ? POSITIVE_COLOR : NEGATIVE_COLOR
}

function describeChange(from: number | null, to: number | null) {
  if (from === null || to === null) return 'Sem posição em um dos anos'
  const diff = from - to
  if (diff === 0) return 'Manteve a posição'
  const places = Math.abs(diff)
  return `${diff > 0 ? 'Subiu' : 'Caiu'} ${places} ${places === 1 ? 'posição' : 'posições'}`
}

function PositionChangeTooltip({ active, payload, fromYear, showComparison, toYear }: TooltipContentProps & { fromYear: number; showComparison: boolean; toYear: number }) {
  if (!active || !payload.length) return null
  const datum = payload[0]?.payload as PositionChangeDatum | undefined
  if (!datum) return null
  return (
    <div className="chart-tooltip">
      <strong>{datum.name}{showComparison ? ` · ${datum.territory}` : ''}</strong>
      <p><span style={{ backgroundColor: PREVIOUS_COLOR }} />{fromYear}: {datum.from === null ? 'sem posição' : `${datum.from}º de ${datum.fromTotal}`}</p>
      <p><span style={{ backgroundColor: changeColor(datum.from, datum.to) }} />{toYear}: {datum.to === null ? 'sem posição' : `${datum.to}º de ${datum.toTotal}`}</p>
      <p>{describeChange(datum.from, datum.to)}</p>
    </div>
  )
}

/** Desenha o "haltere" da linha: posição no ano inicial, no ano final e o traço entre elas. */
function PositionChangeShape({ height, payload, y }: { height?: number; payload?: PositionChangeDatum; y?: number }) {
  const scale = useXAxisScale()
  if (!scale || !payload || y === undefined || height === undefined) return null
  const cy = y + height / 2
  const { from, to } = payload
  const fromX = from === null ? undefined : scale(from)
  const toX = to === null ? undefined : scale(to)
  const color = changeColor(from, to)
  const radius = payload.isComparison ? 5 : 6

  if (fromX === undefined || toX === undefined || from === to) {
    const x = toX ?? fromX
    if (x === undefined) return null
    const current = toX !== undefined
    return (
      <g>
        <circle cx={x} cy={cy} fill={current ? color : PREVIOUS_COLOR} r={radius} />
        <text dominantBaseline="central" fill={current ? color : '#717379'} fontSize={11} fontWeight={current ? 700 : 400} x={x + radius + 4} y={cy}>
          {current ? to : from}º
        </text>
      </g>
    )
  }

  // Rótulos sempre para fora: o ponto da esquerda leva o texto à esquerda e o outro, à direita.
  const fromOnLeft = fromX < toX
  const offset = radius + 4
  return (
    <g>
      <line stroke="#404040" strokeWidth={1.5} x1={fromX} x2={toX} y1={cy} y2={cy} />
      <circle cx={fromX} cy={cy} fill={PREVIOUS_COLOR} r={radius} />
      <circle cx={toX} cy={cy} fill={color} r={radius} />
      <text dominantBaseline="central" fill="#717379" fontSize={11} textAnchor={fromOnLeft ? 'end' : 'start'} x={fromOnLeft ? fromX - offset : fromX + offset} y={cy}>{from}º</text>
      <text dominantBaseline="central" fill={color} fontSize={11} fontWeight={700} textAnchor={fromOnLeft ? 'start' : 'end'} x={fromOnLeft ? toX + offset : toX - offset} y={cy}>{to}º</text>
    </g>
  )
}

/**
 * Rótulo das linhas. Sem comparação é o nome do item; com comparação o nome fica à esquerda,
 * centralizado no grupo, e cada linha leva o nome do território junto ao eixo.
 */
function PositionChangeTick({ payload, rows, x, y }: { payload?: { value: string }; rows: Map<string, PositionChangeDatum>; x?: number | string; y?: number | string }) {
  const plotArea = usePlotArea()
  const row = rows.get(String(payload?.value ?? ''))
  if (!row) return null
  const tickX = Number(x)
  const tickY = Number(y)
  const comparison = rows.size > 0 && [...rows.values()].some((item) => item.isComparison)
  if (!comparison) return <CategoryTick payload={{ value: row.name }} x={tickX} y={tickY} />

  const band = plotArea ? plotArea.height / rows.size : POSITION_COMPARISON_ROW_HEIGHT
  return (
    <g>
      {!row.isComparison && (
        <text dominantBaseline="central" fill="#262626" fontSize={12} fontWeight={500} x={4} y={tickY + band / 2}>
          <title>{row.name}</title>
          {truncate(row.name, 30)}
        </text>
      )}
      <text dominantBaseline="central" fill={row.territoryColor} fontSize={11} fontWeight={600} textAnchor="end" x={tickX - 6} y={tickY}>
        <title>{row.territory}</title>
        {truncate(row.territory, 16)}
      </text>
      {row.closesGroup && plotArea && (
        <line stroke="#e5ebf2" x1={0} x2={plotArea.x + plotArea.width} y1={tickY + band / 2} y2={tickY + band / 2} />
      )}
    </g>
  )
}

/** Marcas do eixo de posição: 1º e múltiplos de um passo "redondo" com até ~6 divisões. */
function positionTicks(max: number) {
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].find((candidate) => max / candidate <= 6) ?? Math.ceil(max / 6)
  const ticks = [1]
  for (let tick = step; tick <= max; tick += step) if (tick > 1) ticks.push(tick)
  return ticks
}

/** Anos em que algum item do nível tem posição (do principal ou, havendo comparação, do território comparado). */
function positionChangeYears({ hasComparison, items }: Pick<InsightChartProps, 'hasComparison' | 'items'>) {
  const showComparison = hasComparisonPositions({ hasComparison, items })
  return (items[0]?.history ?? [])
    .map((point) => point.year)
    .filter((year) => items.some((item) => item.history.some((point) => point.year === year && (point.position !== null || (showComparison && point.comparisonPosition !== null)))))
}

/** A variação só aparece para pilares e dimensões e quando há ao menos dois anos com posição. */
export function canShowPositionChange(props: Pick<InsightChartProps, 'hasComparison' | 'items' | 'level'>) {
  return props.level !== 'Indicador' && positionChangeYears(props).length > 1
}

export function InsightPositionChangeChart({ comparisonLabel, hasComparison, items, kind, level, metricLabel, primaryLabel, source }: InsightChartProps) {
  const colors = getDashboardChartColors(kind)
  const showComparison = hasComparisonPositions({ hasComparison, items })
  const years = positionChangeYears({ hasComparison, items })
  const [selection, setSelection] = useState<{ from?: number; to?: number }>({})
  // Padrão: os dois últimos anos disponíveis; seleções que deixam de existir (troca de filtro/nível) voltam ao padrão.
  const toYear = selection.to !== undefined && years.includes(selection.to) ? selection.to : years.at(-1)
  const fromCandidates = years.filter((year) => toYear === undefined || year < toYear)
  const fromYear = selection.from !== undefined && fromCandidates.includes(selection.from) ? selection.from : fromCandidates.at(-1)

  const territories = [
    { key: 'position' as const, label: primaryLabel, color: colors.primary },
    ...(showComparison ? [{ key: 'comparisonPosition' as const, label: comparisonLabel, color: colors.comparison }] : []),
  ]
  const data: PositionChangeDatum[] = fromYear === undefined || toYear === undefined ? [] : items.flatMap((item) => {
    const start = item.history.find((point) => point.year === fromYear)
    const end = item.history.find((point) => point.year === toYear)
    const rows = territories.map((territory, index): PositionChangeDatum => {
      const from = start?.[territory.key] ?? null
      const to = end?.[territory.key] ?? null
      return {
        key: `${item.id}:${territory.key}`,
        name: item.name,
        territory: territory.label,
        territoryColor: territory.color,
        isComparison: index > 0,
        closesGroup: showComparison && index === territories.length - 1,
        from,
        to,
        fromTotal: start?.total ?? 0,
        toTotal: end?.total ?? 0,
        anchor: to ?? from,
      }
    })
    return rows.some((row) => row.anchor !== null) ? rows : []
  })
  if (data.length) data[data.length - 1].closesGroup = false
  const rowsByKey = new Map(data.map((row) => [row.key, row]))
  const maxPosition = Math.max(1, ...data.flatMap((row) => [row.fromTotal, row.toTotal, row.from ?? 0, row.to ?? 0]))
  const rowHeight = showComparison ? POSITION_COMPARISON_ROW_HEIGHT : POSITION_ROW_HEIGHT
  const axisWidth = showComparison ? 290 : 200
  const legend = [
    { color: PREVIOUS_COLOR, label: `Posição em ${fromYear}` },
    { color: POSITIVE_COLOR, label: 'Subiu' },
    { color: NEGATIVE_COLOR, label: 'Caiu' },
    ...(data.some((row) => row.from !== null && row.from === row.to) ? [{ color: UNCHANGED_COLOR, label: 'Manteve' }] : []),
  ]

  // Ao avançar o ano inicial, o final acompanha para continuar depois dele.
  function changeFrom(value: number) {
    setSelection({ from: value, to: toYear !== undefined && toYear > value ? toYear : years.find((year) => year > value) })
  }

  if (!canShowPositionChange({ hasComparison, items, level }) || fromYear === undefined || toYear === undefined || data.length === 0) return null

  return (
    <section className="pillar-chart min-w-0">
      <div className="position-change-header">
        <div className="min-w-0">
          <h2 className="section-title">Variação de Posição por {level}</h2>
          <p className="section-description">
            Mudança de colocação de {primaryLabel}{showComparison ? ` e ${comparisonLabel}` : ''} entre {fromYear} e {toYear}
          </p>
        </div>
        <div className="position-change-controls">
          <div className="position-change-years">
            <label htmlFor="position-change-from">De</label>
            <select className="field-select position-change-select" id="position-change-from" onChange={(event) => changeFrom(Number(event.target.value))} value={fromYear}>
              {years.slice(0, -1).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <span aria-hidden="true">→</span>
            <label htmlFor="position-change-to">Até</label>
            <select className="field-select position-change-select" id="position-change-to" onChange={(event) => setSelection({ from: fromYear, to: Number(event.target.value) })} value={toYear}>
              {years.filter((year) => year > fromYear).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <ul className="position-change-legend">
            {legend.map((entry) => <li key={entry.label}><span style={{ backgroundColor: entry.color }} />{entry.label}</li>)}
          </ul>
        </div>
      </div>
      <div className="position-change-scroll">
        <div style={{ height: 34 + data.length * rowHeight }}>
          <ResponsiveContainer height="100%" width="100%">
            <BarChart accessibilityLayer data={data} layout="vertical" margin={{ bottom: 0, left: 0, right: 8, top: 4 }}>
              <CartesianGrid horizontal={false} stroke="rgba(191,208,224,.62)" />
              <XAxis
                allowDecimals={false}
                axisLine={false}
                domain={[1, maxPosition]}
                padding={{ left: 32, right: 32 }}
                tick={{ fill: '#54555a', fontSize: 11 }}
                tickFormatter={(value: number) => `${value}º`}
                tickLine={false}
                ticks={positionTicks(maxPosition)}
                type="number"
              />
              <YAxis
                axisLine={false}
                dataKey="key"
                interval={0}
                tick={<PositionChangeTick rows={rowsByKey} />}
                tickLine={false}
                type="category"
                width={axisWidth}
              />
              <Tooltip
                content={(props) => <PositionChangeTooltip {...props} fromYear={fromYear} showComparison={showComparison} toYear={toYear} />}
                cursor={{ fill: 'rgba(3, 78, 162, .05)' }}
              />
              <Bar dataKey="anchor" isAnimationActive={false} name="Posição" shape={<PositionChangeShape />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="source-line">Fonte: {source} · Descrição: {metricLabel}</p>
    </section>
  )
}
