import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type TooltipContentProps } from 'recharts'
import type { SphereBreakdownItem } from '../data/responsibilitySpheres'

interface SphereDonutFilterProps {
  data: SphereBreakdownItem[]
  onChange: (sphere?: string) => void
  selected?: string
}

interface SphereDatum extends SphereBreakdownItem {
  color: string
}

const SPHERE_COLORS: Record<string, string> = {
  'Exclusivo do Poder Executivo Estadual': '#034ea2',
  'Poder Executivo Estadual e Municipal': '#2f8fd1',
  'Poder Executivo Estadual, Municipal e Federal': '#7c3aed',
  'Poder Executivo Estadual e Federal': '#16a34a',
  'Poder Executivo Municipal': '#d97706',
  'Outras esferas': '#64748b',
  'Múltipla': '#475569',
  'Mercado': '#0f766e',
  'Compartilhada': '#be123c',
  'Estadual': '#4f46e5',
  'Federal/Mercado': '#a16207',
  'Federal': '#0e7490',
  'Estadual/Mercado': '#6d28d9',
  'Outro Poder (TJ-PI)': '#c2410c',
  'Outro Poder (ALEPI)': '#b45309',
  'Municipal': '#15803d',
  'Demografia': '#9333ea',
}

const FALLBACK_COLORS = ['#0369a1', '#9f1239', '#166534', '#854d0e', '#5b21b6', '#115e59', '#9a3412', '#3730a3']

function colorFor(name: string, index: number) {
  return SPHERE_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

function percentage(count: number, total: number) {
  return total ? `${((count / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '0%'
}

const LEVEL_LABELS = {
  Grupo: 'pelos grupos',
  Pilar: 'pelos pilares',
  Dimensão: 'pelas dimensões',
  Indicador: 'pelos indicadores',
} as const

function titleFor(data: SphereBreakdownItem[]) {
  const levels = [...new Set(data.flatMap((item) => item.levels))]
  const labels = (['Grupo', 'Pilar', 'Dimensão', 'Indicador'] as const)
    .filter((level) => levels.includes(level))
    .map((level) => LEVEL_LABELS[level])

  if (labels.length === 0) return 'Esferas responsáveis pelos componentes'
  if (labels.length === 1) return `Esferas responsáveis ${labels[0]}`
  return `Esferas responsáveis ${labels.slice(0, -1).join(', ')} e ${labels.at(-1)}`
}

function SphereTooltip({ active, payload, total }: TooltipContentProps & { total: number }) {
  if (!active || !payload.length) return null
  const datum = payload[0]?.payload as SphereDatum | undefined
  if (!datum) return null

  return (
    <div className="chart-tooltip sphere-donut-tooltip">
      <strong>{datum.name}</strong>
      <p><span style={{ backgroundColor: datum.color }} />{datum.count} componentes · {percentage(datum.count, total)}</p>
    </div>
  )
}

export function SphereDonutFilter({ data, onChange, selected }: SphereDonutFilterProps) {
  if (data.length === 0) return null

  const total = data.reduce((sum, item) => sum + item.count, 0)
  const chartData: SphereDatum[] = data.map((item, index) => ({ ...item, color: colorFor(item.name, index) }))
  const selectedItem = chartData.find((item) => item.name === selected)
  const centerCount = selectedItem?.count ?? total
  const title = titleFor(data)

  function toggle(name: string) {
    onChange(selected === name ? undefined : name)
  }

  return (
    <section aria-labelledby="sphere-filter-title" className="sphere-filter">
      <div className="sphere-filter-heading">
        <div>
          <h2 className="section-title" id="sphere-filter-title">
            {title}
          </h2>
          <p className="section-description">Clique em uma categoria para filtrar a tabela detalhada.</p>
        </div>
        {selected && (
          <button className="sphere-filter-clear" onClick={() => onChange(undefined)} type="button">
            Limpar filtro
          </button>
        )}
      </div>

      <div className="sphere-filter-content">
        <div aria-label={`Gráfico de rosca com ${total} componentes distribuídos por esfera`} className="sphere-donut-canvas" role="img">
          <ResponsiveContainer height="100%" width="100%">
            <PieChart accessibilityLayer>
              <Pie
                data={chartData}
                dataKey="count"
                innerRadius="62%"
                nameKey="name"
                outerRadius="88%"
                paddingAngle={2}
                stroke="#ffffff"
                strokeWidth={2}
              >
                {chartData.map((item) => (
                  <Cell
                    cursor="pointer"
                    fill={item.color}
                    key={item.name}
                    onClick={() => toggle(item.name)}
                    opacity={!selected || selected === item.name ? 1 : 0.28}
                  />
                ))}
              </Pie>
              <Tooltip content={(props) => <SphereTooltip {...props} total={total} />} />
              <text className="sphere-donut-total" dominantBaseline="central" textAnchor="middle" x="50%" y="47%">{centerCount}</text>
              <text className="sphere-donut-caption" dominantBaseline="central" textAnchor="middle" x="50%" y="58%">componentes</text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul aria-label="Filtro por esfera" className="sphere-filter-legend">
          {chartData.map((item) => (
            <li key={item.name}>
              <button
                aria-pressed={selected === item.name}
                className={selected === item.name ? 'sphere-filter-option sphere-filter-option-active' : 'sphere-filter-option'}
                onClick={() => toggle(item.name)}
                type="button"
              >
                <span aria-hidden="true" className="sphere-filter-swatch" style={{ backgroundColor: item.color }} />
                <span className="sphere-filter-name">{item.name}</span>
                <strong>{item.count}</strong>
                <small>{percentage(item.count, total)}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p aria-live="polite" className="sr-only">
        {selectedItem ? `Filtro ativo: ${selectedItem.name}, ${selectedItem.count} componentes.` : `Todos os ${total} componentes estão visíveis.`}
      </p>
    </section>
  )
}
