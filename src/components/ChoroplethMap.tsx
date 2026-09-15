import { useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { DashboardKind, RankingItem } from '../types/dashboard'

export interface MapLocation {
  id: string
  name: string
  path: string
}

interface ColorStep {
  color: string
  label: string
  min: number
}

function colorScale(kind: DashboardKind, decimals: number): ColorStep[] {
  const ramp = kind === 'clp-municipios'
    ? ['#4d2f8a', '#7450bd', '#a78bdb', '#cbb9ec', '#ece6f7']
    : ['#0b4a9a', '#3574c4', '#79a5dc', '#b3cdee', '#dde8f5']
  // IBID varia de 0 a 1; CLP de 0 a 100.
  const limits = kind === 'ibid' ? [0.5, 0.3, 0.2, 0.1] : [70, 60, 50, 40]
  const format = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

  return [
    { color: ramp[0], label: `≥ ${format(limits[0])}`, min: limits[0] },
    { color: ramp[1], label: `${format(limits[1])} – ${format(limits[0])}`, min: limits[1] },
    { color: ramp[2], label: `${format(limits[2])} – ${format(limits[1])}`, min: limits[2] },
    { color: ramp[3], label: `${format(limits[3])} – ${format(limits[2])}`, min: limits[3] },
    { color: ramp[4], label: `< ${format(limits[3])}`, min: Number.NEGATIVE_INFINITY },
  ]
}

const NO_DATA_COLOR = '#e5e7eb'

interface TooltipState {
  locationId: string
  x: number
  y: number
}

interface ChoroplethMapProps {
  ariaLabel: string
  comparisonCode?: string
  decimals: number
  description: ReactNode
  /** Mensagem exibida no lugar do mapa (carregando, erro etc.). */
  emptyMessage?: string
  itemFor: (location: MapLocation) => RankingItem | undefined
  kind: DashboardKind
  locations: MapLocation[]
  noDataLabel: string
  onSelect?: (code: string) => void
  positionText: (item: RankingItem) => string[]
  selectedCode?: string
  title: string
  titleId: string
  viewBox: string
}

export function ChoroplethMap({
  ariaLabel,
  comparisonCode,
  decimals,
  description,
  emptyMessage,
  itemFor,
  kind,
  locations,
  noDataLabel,
  onSelect,
  positionText,
  selectedCode,
  title,
  titleId,
  viewBox,
}: ChoroplethMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const municipal = kind === 'clp-municipios'
  const steps = colorScale(kind, decimals)
  const selectedColor = municipal ? '#2a1854' : '#041d3b'
  const comparisonStroke = municipal ? '#a78bdb' : '#8db2ff'
  const formatValue = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

  const entries = locations.map((location) => ({ location, item: itemFor(location) }))
  const hasNoData = entries.some(({ item }) => !item || item.wasNull)
  const tooltipEntry = tooltip ? entries.find(({ location }) => location.id === tooltip.locationId) : undefined

  // O selecionado e o de comparação são desenhados por último para que o contorno fique por cima dos vizinhos.
  const weight = (code: string | undefined) => (code && code === selectedCode ? 2 : code && code === comparisonCode ? 1 : 0)
  const orderedEntries = [...entries].sort((a, b) => weight(a.item?.code) - weight(b.item?.code))

  function fillFor(item: RankingItem | undefined) {
    if (!item || item.wasNull) return NO_DATA_COLOR
    if (item.code === selectedCode) return selectedColor
    return steps.find((step) => item.value >= step.min)?.color ?? steps.at(-1)!.color
  }

  function showTooltip(locationId: string, clientX: number, clientY: number) {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return
    setTooltip({ locationId, x: clientX - bounds.left, y: clientY - bounds.top })
  }

  function handlePointer(event: MouseEvent<SVGPathElement>, locationId: string) {
    showTooltip(locationId, event.clientX, event.clientY)
  }

  function handleFocus(event: FocusEvent<SVGPathElement>, locationId: string) {
    const rect = event.currentTarget.getBoundingClientRect()
    showTooltip(locationId, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  function handleKeyDown(event: KeyboardEvent<SVGPathElement>, code: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect?.(code)
  }

  return (
    <section className="brazil-map min-w-0" aria-labelledby={titleId}>
      <h2 className="section-title" id={titleId}>{title}</h2>
      <p className="section-description">{description}</p>
      {emptyMessage ? (
        <div className="chart-empty brazil-map-empty">{emptyMessage}</div>
      ) : (
        <div className="brazil-map-canvas" onMouseLeave={() => setTooltip(null)} ref={containerRef}>
          <svg aria-label={ariaLabel} className="brazil-map-svg" role="group" viewBox={viewBox}>
            {orderedEntries.map(({ location, item }) => {
              const code = item?.code
              const selected = Boolean(code) && code === selectedCode
              const compared = Boolean(code) && code === comparisonCode
              const hasValue = item && !item.wasNull
              return (
                <path
                  aria-label={code ? `${item.label ?? location.name}: nota ${hasValue ? formatValue(item.value) : noDataLabel.toLowerCase()}${hasValue ? `, ${positionText(item).join(', ')}` : ''}` : undefined}
                  aria-pressed={code ? selected : undefined}
                  className={`brazil-map-state${code ? ' brazil-map-state-interactive' : ''}${selected ? ' brazil-map-state-selected' : ''}`}
                  d={location.path}
                  fill={fillFor(item)}
                  key={location.id}
                  onBlur={() => setTooltip(null)}
                  onClick={code ? () => onSelect?.(code) : undefined}
                  onFocus={code ? (event) => handleFocus(event, location.id) : undefined}
                  onKeyDown={code ? (event) => handleKeyDown(event, code) : undefined}
                  onMouseEnter={(event) => handlePointer(event, location.id)}
                  onMouseMove={(event) => handlePointer(event, location.id)}
                  role={code ? 'button' : undefined}
                  stroke={compared && !selected ? comparisonStroke : '#ffffff'}
                  strokeWidth={selected ? 2 : compared ? 3 : municipal ? 0.6 : 1}
                  tabIndex={code ? 0 : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </svg>
          {tooltip && tooltipEntry && (
            <div className="chart-tooltip brazil-map-tooltip" role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
              <span className="brazil-map-tooltip-name">
                {tooltipEntry.item?.label ?? tooltipEntry.location.name}
                {tooltipEntry.item && tooltipEntry.item.name !== tooltipEntry.item.label ? ` (${tooltipEntry.item.name})` : ''}
              </span>
              {tooltipEntry.item && !tooltipEntry.item.wasNull ? (
                <>
                  <strong>{formatValue(tooltipEntry.item.value)}</strong>
                  {positionText(tooltipEntry.item).map((line) => <strong key={line}>{line}</strong>)}
                </>
              ) : (
                <strong>{noDataLabel}</strong>
              )}
            </div>
          )}
          <ul className="brazil-map-legend" aria-label="Legenda de notas">
            {steps.map((step) => (
              <li key={step.label}><span style={{ backgroundColor: step.color }} />{step.label}</li>
            ))}
            {hasNoData && <li><span style={{ backgroundColor: NO_DATA_COLOR }} />{noDataLabel}</li>}
            <li><span style={{ backgroundColor: selectedColor }} />Selecionado</li>
            {comparisonCode && <li><span className="brazil-map-legend-outline" style={{ borderColor: comparisonStroke }} />Comparação</li>}
          </ul>
        </div>
      )}
    </section>
  )
}
