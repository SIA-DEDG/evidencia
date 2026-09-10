import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
  type TooltipContentProps,
} from 'recharts'
import type { DashboardKind, RankingItem } from '../types/dashboard'

type StateRankingItem = RankingItem & { wasNull?: boolean }

interface StateComparisonChartProps {
  decimals?: number
  kind: DashboardKind
  metricLabel: string
  ranking: StateRankingItem[]
  source: string
  year: string
}

interface StateChartDatum extends StateRankingItem {
  displayName: string
}

function StateTooltip({ active, payload, scoreDecimals }: TooltipContentProps & { scoreDecimals: number }) {
  if (!active || !payload.length) return null
  const datum = payload[0]?.payload as StateChartDatum | undefined
  if (!datum) return null

  return (
    <div className="chart-tooltip">
      <strong>{datum.position}º · {datum.name}</strong>
      <p>Nota: {datum.value.toFixed(scoreDecimals)}{datum.wasNull ? ' · valor nulo considerado 0' : ''}</p>
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

export function StateComparisonChart({ decimals, kind, metricLabel, ranking, source, year }: StateComparisonChartProps) {
  const accentColor = kind === 'clp-municipios' ? '#4d2f8a' : '#034ea2'
  const inferredDecimals = Math.min(3, Math.max(0, ...ranking.map((item) => String(item.value).split('.')[1]?.length ?? 0)))
  const scoreDecimals = decimals ?? inferredDecimals
  const data: StateChartDatum[] = ranking.map((item) => ({ ...item, displayName: `${item.name}${item.wasNull ? '*' : ''}` }))
  const chartMax = Math.max(0, ...data.map((item) => item.value)) || 1

  return (
    <section className="state-comparison-chart" aria-labelledby="state-comparison-title">
      <div>
        <h2 className="section-title" id="state-comparison-title">Comparativo com os Estados</h2>
        <p className="section-description">{metricLabel} ({year})</p>
      </div>

      {ranking.length === 0 ? (
        <div className="mt-6 rounded-[10px] border border-line bg-canvas px-4 py-8 text-center text-sm text-muted dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Não há estados disponíveis para a métrica e o ano selecionados.
        </div>
      ) : (
        <div className="state-comparison-scroll" role="region" aria-label="Ranking dos estados">
          <div className="state-comparison-canvas">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart accessibilityLayer data={data} margin={{ bottom: 0, left: 0, right: 0, top: 44 }}>
                <XAxis axisLine={false} dataKey="displayName" height={25} interval={0} tick={{ fill: '#54555a', fontSize: 12 }} tickMargin={10} tickLine={false} />
                <YAxis axisLine={false} domain={[0, chartMax]} hide />
                <Tooltip content={(props) => <StateTooltip {...props} scoreDecimals={scoreDecimals} />} cursor={{ fill: 'rgba(3, 78, 162, .05)' }} />
                <Bar dataKey="value" fill={accentColor} maxBarSize={30} name="Nota">
                  <LabelList content={(props) => <StateBarLabel {...props} labelColor={kind === 'clp-municipios' ? accentColor : '#012e66'} ranking={data} scoreDecimals={scoreDecimals} />} dataKey="value" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {ranking.length > 0 && (
        <div className="state-comparison-legend" aria-hidden="true">
          <span />
          {kind === 'clp-municipios' ? 'Nota' : 'Unidade Federativa (UF)'}
        </div>
      )}

      <div className="source-line state-comparison-source">
        Fonte: {source} · Descrição: {metricLabel}
      </div>
    </section>
  )
}
