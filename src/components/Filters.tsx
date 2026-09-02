import { useEffect, useState } from 'react'
import type { FilterDefinition } from '../types/dashboard'

interface FiltersProps {
  filters: FilterDefinition[]
  onChange?: (values: Record<string, string>) => void
}

export function Filters({ filters, onChange }: FiltersProps) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(filters.map((filter) => [filter.id, filter.value])))

  useEffect(() => {
    const next = Object.fromEntries(filters.map((filter) => [filter.id, filter.value]))
    setValues(next)
  }, [filters])

  function update(id: string, value: string) {
    setValues((current) => {
      const next = { ...current, [id]: value }
      onChange?.(next)
      return next
    })
  }

  function renderFilter(filter: FilterDefinition) {
    return (
      <div className="min-w-0" key={filter.id}>
        <label className="field-label" htmlFor={`filter-${filter.id}`}>{filter.label}</label>
        <select
          className="field-select"
          disabled={filter.disabled}
          id={`filter-${filter.id}`}
          onChange={(event) => update(filter.id, event.target.value)}
          value={values[filter.id] ?? ''}
        >
          {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    )
  }

  const municipal = filters[0]?.id === 'state'
  const comparisonStart = municipal ? 1 : 0
  const beforeComparison = filters.slice(0, comparisonStart)
  const comparisonFilters = filters.slice(comparisonStart, comparisonStart + 2)
  const remainingFilters = filters.slice(comparisonStart + 2)

  return (
    <section className="filter-panel" aria-label="Filtros do painel">
      <div className={municipal ? 'filter-layout filter-layout-municipal' : 'filter-layout filter-layout-state'}>
        {beforeComparison.map(renderFilter)}
        <div className="filter-comparison-group">
          {renderFilter(comparisonFilters[0])}
          <span className="filter-vs" aria-hidden="true">VS</span>
          {renderFilter(comparisonFilters[1])}
        </div>
        {remainingFilters.map(renderFilter)}
      </div>
    </section>
  )
}
