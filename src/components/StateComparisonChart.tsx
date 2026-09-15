import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
  type TooltipContentProps,
} from 'recharts'
import { getDashboardChartColors } from '../data/chartColors'
import type { DashboardKind, RankingItem } from '../types/dashboard'

export type ComparisonRankingItem = RankingItem & {
  /** Linha extra exibida no tooltip (ex.: posição nacional). */
  detail?: string
}

interface StateComparisonChartProps {
  /** Código (ou nome, quando não houver código) do item de comparação. */
  comparisonState?: string
  decimals?: number
  /** Nome no plural usado nas mensagens, ex.: "estados" ou "municípios". */
  entityPlural?: string
  idPrefix?: string
  kind: DashboardKind
  legendLabel?: string
  /** Nomes longos: rótulos inclinados e barras com largura mínima. */
  longLabels?: boolean
  metricLabel: string
  /** Código (ou nome, quando não houver código) do item principal. */
  primaryState?: string
  ranking: ComparisonRankingItem[]
  source: string
  title?: string
  year: string
}

interface StateChartDatum extends ComparisonRankingItem {
  displayName: string
}

interface DiagonalPatternProps {
  backgroundColor: string
  id: string
  lineColor: string
}

function DiagonalPattern({ backgroundColor, id, lineColor }: DiagonalPatternProps) {
  return (
    <pattern height="10" id={id} patternTransform="rotate(45)" patternUnits="userSpaceOnUse" width="10">
      <rect fill={backgroundColor} height="10" width="10" />
      <line stroke={lineColor} strokeWidth="4" x1="0" x2="0" y1="0" y2="10" />
    </pattern>
  )
}

function StateTooltip({ active, payload, scoreDecimals }: TooltipContentProps & { scoreDecimals: number }) {
  if (!active || !payload.length) return null
  const datum = payload[0]?.payload as StateChartDatum | undefined
  if (!datum) return null

  return (
    <div className="chart-tooltip">
      <strong>{datum.position}º · {datum.name}</strong>
      <p>Nota: {datum.value.toFixed(scoreDecimals)}{datum.wasNull ? ' · valor nulo considerado 0' : ''}</p>
      {datum.detail && <p>{datum.detail}</p>}
    </div>
  )
}

function StateBarLabel({ index, labelColor, ranking, scoreDecimals, viewBox }: LabelProps & { labelColor: string; ranking: StateChartDatum[]; scoreDecimals: number }) {
  if (index === undefined || !viewBox || !('x' in viewBox) || !('y' in viewBox) || !('width' in viewBox)) return <></>
  const item = ranking[index]
  if (!item) return <></>
  const x = Number(viewBox.x) + Number(viewBox.width) / 2
  const y = Number(viewBox.y)

  return (
    <g aria-hidden="true">
      <text fill={labelColor} fontFamily="Inter, Arial, sans-serif" fontSize={14} fontWeight={700} textAnchor="middle" x={x} y={y - 28}>{item.position}º</text>
      <text fill={item.wasNull ? '#bd2830' : '#4f5055'} fontFamily="Inter, Arial, sans-serif" fontSize={12} fontWeight={500} textAnchor="middle" x={x} y={y - 10}>
        {item.value.toFixed(scoreDecimals)}{item.wasNull ? '*' : ''}
      </text>
    </g>
  )
}

function SlantedTick({ payload, x, y }: { payload?: { value: string }; x?: number; y?: number }) {
  const label = payload?.value ?? ''
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <title>{label}</title>
      <text fill="#54555a" fontSize={12} textAnchor="end" transform="rotate(-40)" x={-4} y={8}>
        {label.length > 22 ? `${label.slice(0, 21)}…` : label}
      </text>
    </g>
  )
}

interface StateHistogramProps {
  comparisonState?: string
  data: StateChartDatum[]
  entityPlural: string
  hintId: string
  kind: DashboardKind
  longLabels: boolean
  patternPrefix: string
  primaryState?: string
  scoreDecimals: number
  yMax: number
}

function StateHistogram({ comparisonState, data, entityPlural, hintId, kind, longLabels, patternPrefix, primaryState, scoreDecimals, yMax }: StateHistogramProps) {
  const colors = getDashboardChartColors(kind)
  const keyOf = (item: StateChartDatum) => item.code ?? item.name

  function highlightColor(key: string) {
    if (key === primaryState) return colors.primary
    if (key === comparisonState) return colors.comparison
    return undefined
  }

  function patternId(key: string) {
    return `${patternPrefix}-${key === primaryState ? 'primary' : 'comparison'}`
  }

  return (
    <>
      <p className="state-comparison-scroll-hint" id={hintId}>Deslize horizontalmente para ver todos os {entityPlural}.</p>
      <div
        aria-describedby={hintId}
        aria-label={`Gráfico do ranking dos ${entityPlural}`}
        className="state-comparison-scroll"
        role="region"
        tabIndex={0}
      >
        <div
          className="state-comparison-canvas"
          style={longLabels ? { height: 340, minWidth: Math.max(1080, data.length * 56) } : undefined}
        >
          <ResponsiveContainer height="100%" width="100%">
            <BarChart accessibilityLayer data={data} margin={{ bottom: 0, left: longLabels ? 40 : 0, right: 0, top: 44 }}>
              <defs>
                <DiagonalPattern backgroundColor={colors.primary} id={`${patternPrefix}-primary`} lineColor="#ffffff" />
                <DiagonalPattern backgroundColor={colors.comparison} id={`${patternPrefix}-comparison`} lineColor="#ffffff" />
              </defs>
              {longLabels ? (
                <XAxis axisLine={false} dataKey="displayName" height={92} interval={0} tick={<SlantedTick />} tickLine={false} />
              ) : (
                <XAxis axisLine={false} dataKey="displayName" height={25} interval={0} tick={{ fill: '#54555a', fontSize: 12 }} tickMargin={10} tickLine={false} />
              )}
              <YAxis axisLine={false} domain={[0, yMax]} hide />
              <Tooltip content={(props) => <StateTooltip {...props} scoreDecimals={scoreDecimals} />} cursor={{ fill: 'rgba(3, 78, 162, .05)' }} />
              <Bar dataKey="value" fill={colors.bar} maxBarSize={30} name="Nota">
                {data.map((item) => {
                  const key = keyOf(item)
                  const selectedColor = highlightColor(key)
                  return (
                    <Cell
                      fill={selectedColor ? `url(#${patternId(key)})` : colors.bar}
                      key={key}
                      stroke={selectedColor ? '#ffffff' : 'none'}
                      strokeWidth={selectedColor ? 3 : 0}
                    />
                  )
                })}
                <LabelList content={(props) => <StateBarLabel {...props} labelColor={kind === 'clp-municipios' ? colors.bar : '#012e66'} ranking={data} scoreDecimals={scoreDecimals} />} dataKey="value" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
}

export function StateComparisonChart({
  comparisonState,
  decimals,
  entityPlural = 'estados',
  idPrefix = 'state-comparison',
  kind,
  legendLabel,
  longLabels = false,
  metricLabel,
  primaryState,
  ranking,
  source,
  title = 'Comparativo com os Estados',
  year,
}: StateComparisonChartProps) {
  const inferredDecimals = Math.min(3, Math.max(0, ...ranking.map((item) => String(item.value).split('.')[1]?.length ?? 0)))
  const scoreDecimals = decimals ?? inferredDecimals
  const data: StateChartDatum[] = ranking.map((item) => ({ ...item, displayName: `${item.name}${item.wasNull ? '*' : ''}` }))
  const chartMax = Math.max(0, ...data.map((item) => item.value)) || 1
  const titleId = `${idPrefix}-title`

  if (ranking.length === 0) {
    return (
      <section className="state-comparison-chart" aria-labelledby={titleId}>
        <div>
          <h2 className="section-title" id={titleId}>{title}</h2>
          <p className="section-description">{metricLabel} ({year})</p>
        </div>
        <div className="mt-6 rounded-[10px] border border-line bg-canvas px-4 py-8 text-center text-sm text-muted dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Não há {entityPlural} disponíveis para a métrica e o ano selecionados.
        </div>
      </section>
    )
  }

  return (
    <section className="state-comparison-chart" aria-labelledby={titleId}>
      <div>
        <h2 className="section-title" id={titleId}>{title}</h2>
        <p className="section-description">{metricLabel} ({year})</p>
      </div>
      <StateHistogram
        comparisonState={comparisonState}
        data={data}
        entityPlural={entityPlural}
        hintId={`${idPrefix}-scroll-hint`}
        kind={kind}
        longLabels={longLabels}
        patternPrefix={`${idPrefix}-${kind}`}
        primaryState={primaryState}
        scoreDecimals={scoreDecimals}
        yMax={chartMax}
      />
      <div className="state-comparison-legend" aria-hidden="true">
        <span />
        {legendLabel ?? (kind === 'clp-municipios' ? 'Nota' : 'Unidade Federativa (UF)')}
      </div>
      <div className="source-line state-comparison-source">
        Fonte: {source} · Descrição: {metricLabel}
      </div>
    </section>
  )
}
