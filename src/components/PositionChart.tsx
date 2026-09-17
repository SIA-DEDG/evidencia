import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { getDashboardChartColors } from '../data/chartColors'
import type { DashboardKind, RankingHistoryItem } from '../types/dashboard'

interface PositionDatum {
  year: number
  primary: number | null
  comparison: number | null
  total: number | null
}

function PositionTooltip({ active, label, payload }: TooltipContentProps) {
  if (!active || !payload.length) return null
  const total = (payload[0]?.payload as PositionDatum | undefined)?.total

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)}>
          <span style={{ backgroundColor: entry.color }} />
          {entry.name}: {typeof entry.value === 'number' ? `${entry.value}º lugar${total ? ` de ${total}` : ''}` : '—'}
        </p>
      ))}
    </div>
  )
}

interface PositionChartProps {
  comparison: RankingHistoryItem[]
  comparisonLabel: string
  hasComparison: boolean
  kind: DashboardKind
  metricLabel: string
  primary: RankingHistoryItem[]
  primaryLabel: string
  source: string
}

/** Bolinha preenchida com a cor da linha e contorno branco; o tracejado da linha não passa para o contorno. */
function lineDot(color: string, r = 4) {
  return { fill: color, r, stroke: '#ffffff', strokeDasharray: 'none', strokeWidth: 1.5 }
}

export function PositionChart({ comparison, comparisonLabel, hasComparison, kind, metricLabel, primary, primaryLabel, source }: PositionChartProps) {
  const colors = getDashboardChartColors(kind)
  const years = [...new Set([...primary, ...(hasComparison ? comparison : [])].map((item) => item.year))].sort((a, b) => a - b)
  const primaryByYear = new Map(primary.map((item) => [item.year, item]))
  const comparisonByYear = new Map(comparison.map((item) => [item.year, item]))
  const data: PositionDatum[] = years.map((year) => ({
    year,
    primary: primaryByYear.get(year)?.national ?? null,
    comparison: hasComparison ? comparisonByYear.get(year)?.national ?? null : null,
    total: primaryByYear.get(year)?.nationalTotal ?? comparisonByYear.get(year)?.nationalTotal ?? null,
  }))
  const maxTotal = Math.max(1, ...data.map((item) => item.total ?? 0))
  const period = years.length === 0 ? '' : years.length === 1 ? String(years[0]) : `${years[0]}–${years.at(-1)}`
  const commonLineProps = {
    connectNulls: true,
    strokeWidth: 3,
    type: 'monotone' as const,
  }

  return (
    <section className="series-chart position-chart min-w-0">
      <h2 className="section-title">Posição no Ranking{period ? ` (${period})` : ''}</h2>
      <p className="section-description">Posição no ranking nacional ao longo dos anos. Quanto mais alto no gráfico, melhor a colocação.</p>
      {data.length === 0 ? (
        <div className="chart-empty">Não há histórico de posição disponível.</div>
      ) : (
        <div className="chart-canvas min-w-0">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart accessibilityLayer data={data} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
              <CartesianGrid stroke="rgba(191,208,224,.62)" vertical={false} />
              <XAxis axisLine={{ stroke: '#bfbfbf' }} dataKey="year" tick={{ fill: '#54555a', fontSize: 12 }} tickMargin={10} tickLine={false} />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                domain={[1, maxTotal]}
                reversed
                tick={{ fill: '#54555a', fontSize: 12 }}
                tickFormatter={(value: number) => `${value}º`}
                tickLine={false}
                width={40}
              />
              <Tooltip content={PositionTooltip} cursor={{ stroke: '#bfd0e0', strokeDasharray: '3 3' }} />
              <Legend iconSize={17} iconType="plainline" wrapperStyle={{ color: '#404040', fontSize: 12, paddingTop: 20 }} />
              <Line {...commonLineProps} activeDot={lineDot(colors.primary, 6)} dataKey="primary" dot={lineDot(colors.primary)} name={primaryLabel} stroke={colors.primary} />
              {hasComparison && <Line {...commonLineProps} activeDot={lineDot(colors.comparison, 6)} dataKey="comparison" dot={lineDot(colors.comparison)} name={comparisonLabel} stroke={colors.comparison} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="source-line">Fonte: {source} · Descrição: {metricLabel}</p>
    </section>
  )
}
