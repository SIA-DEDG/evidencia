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
import type { DashboardDataset, DashboardKind } from '../types/dashboard'

interface SeriesDatum {
  year: number
  primary: number | null
  comparison: number | null
  regional: number | null
  comparisonRegional: number | null
  nationalAverage: number | null
}

function SeriesTooltip({ active, label, payload }: TooltipContentProps) {
  if (!active || !payload.length) return null

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)}>
          <span style={{ backgroundColor: entry.color }} />
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR') : '—'}
        </p>
      ))}
    </div>
  )
}

/** Bolinha preenchida com a cor da linha e contorno branco; o tracejado da linha não passa para o contorno. */
function lineDot(color: string, r = 4) {
  return { fill: color, r, stroke: '#ffffff', strokeDasharray: 'none', strokeWidth: 1.5 }
}

export function SeriesChart({ chart, hasComparison, kind, metricLabel, source }: { chart: DashboardDataset['chart']; hasComparison: boolean; kind: DashboardKind; metricLabel: string; source: string }) {
  const isIbid = kind === 'ibid'
  const period = chart.years.length === 1 ? String(chart.years[0]) : `${chart.years[0]}–${chart.years.at(-1)}`
  const colors = getDashboardChartColors(kind)
  const data: SeriesDatum[] = chart.years.map((year, index) => ({
    year,
    primary: chart.primary[index] ?? null,
    comparison: chart.comparison[index] ?? null,
    regional: chart.regional[index] ?? null,
    comparisonRegional: chart.comparisonRegional[index] ?? null,
    nationalAverage: chart.nationalAverage[index] ?? null,
  }))
  const commonLineProps = {
    strokeWidth: 3,
    type: 'monotone' as const,
  }

  return (
    <section className="series-chart min-w-0">
      <h2 className="section-title">Série Histórica ({period})</h2>
      {isIbid ? (
        <p className="section-description">Nota Geral (IBID) é um indicador sintético que varia de 0 a 1 e agrega indicadores de naturezas e escalas distintas.</p>
      ) : (
        <p className="section-description">A Nota Geral - CLP é obtida por normalização e ponderação de indicadores que variam de 0 a 100.</p>
      )}
      <div className="chart-canvas min-w-0">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart accessibilityLayer data={data} margin={{ bottom: 0, left: 0, right: 0, top: 8 }}>
            <CartesianGrid stroke="rgba(191,208,224,.62)" vertical={false} />
            <XAxis axisLine={{ stroke: '#bfbfbf' }} dataKey="year" tick={{ fill: '#54555a', fontSize: 12 }} tickMargin={10} tickLine={false} />
            <YAxis axisLine={false} domain={[0, chart.yMax]} width={34} tick={{ fill: '#54555a', fontSize: 12 }} tickLine={false} />
            <Tooltip content={SeriesTooltip} cursor={{ stroke: '#bfd0e0', strokeDasharray: '3 3' }} />
            <Legend iconSize={17} iconType="plainline" wrapperStyle={{ color: '#404040', fontSize: 12, paddingTop: 20 }} />
            <Line {...commonLineProps} activeDot={lineDot(colors.primary, 6)} dataKey="primary" dot={lineDot(colors.primary)} name={chart.primaryLabel} stroke={colors.primary} />
            {hasComparison && <Line {...commonLineProps} activeDot={lineDot(colors.comparison, 6)} dataKey="comparison" dot={lineDot(colors.comparison)} name={chart.comparisonLabel} stroke={colors.comparison} />}
            <Line {...commonLineProps} activeDot={lineDot(colors.regional, 5)} dataKey="regional" dot={lineDot(colors.regional, 3)} name={chart.regionalLabel} stroke={colors.regional} strokeDasharray="4 4" strokeWidth={2} />
            {hasComparison && chart.comparisonRegional.some((value) => value !== null) && (
              <Line {...commonLineProps} activeDot={lineDot('#d97706', 5)} dataKey="comparisonRegional" dot={lineDot('#d97706', 3)} name={chart.comparisonRegionalLabel} stroke="#d97706" strokeDasharray="4 4" strokeWidth={2} />
            )}
            <Line {...commonLineProps} activeDot={lineDot(colors.national, 5)} dataKey="nationalAverage" dot={lineDot(colors.national, 3)} name="Média do Brasil" stroke={colors.national} strokeDasharray="7 4" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="source-line">Fonte: {source} · Descrição: {metricLabel}</p>
    </section>
  )
}
