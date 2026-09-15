import { Building2, MapPinned } from 'lucide-react'
import type { DashboardDataset } from '../types/dashboard'
import { BrazilMap } from './BrazilMap'
import { DetailTable } from './DetailTable'
import { Filters } from './Filters'
import { Highlights } from './Highlights'
import { MunicipalityMap } from './MunicipalityMap'
import { PositionChart } from './PositionChart'
import { SeriesChart } from './SeriesChart'
import { StateComparisonChart, type ComparisonRankingItem } from './StateComparisonChart'
import { SummaryCards } from './SummaryCards'

interface DashboardPageProps {
  data: DashboardDataset
  onClpModeChange?: (mode: 'estados' | 'municipios') => void
  onFiltersChange?: (values: Record<string, string>) => void
}

export function DashboardPage({ data, onClpModeChange, onFiltersChange }: DashboardPageProps) {
  const isClp = data.kind.startsWith('clp')
  const municipal = data.kind === 'clp-municipios'
  const primaryLabel = data.summary[0]?.title ?? (municipal ? 'Município principal' : 'Estado principal')
  const comparisonLabel = data.summary[1]?.title ?? (municipal ? 'Município de comparação' : 'Estado de comparação')
  const metricLabel = data.summary[0]?.metric ?? 'Nota Geral'
  const selectedYear = data.filters.find((filter) => filter.id === 'year')?.value ?? ''
  const hasComparison = Boolean(data.filters.find((filter) => filter.id === 'comparison')?.value)
  // Em municípios, o estado em destaque é o do filtro "Estado".
  const primaryState = data.filters.find((filter) => filter.id === (municipal ? 'state' : 'primary'))?.value
  const comparisonState = municipal ? undefined : data.filters.find((filter) => filter.id === 'comparison')?.value
  const hasComparisonRegion = hasComparison && data.chart.comparisonRegional.some((value) => value !== null)
  const primaryRegionalLabel = data.summary[2]?.title ?? (municipal ? 'Estado' : 'Região')
  const comparisonRegionalLabel = data.chart.comparisonRegionalLabel.replace(/^Média (?:do|de) /, '')
  const stateFilter = data.filters.find((filter) => filter.id === 'state')
  const primaryValue = data.filters.find((filter) => filter.id === 'primary')?.value
  const comparisonValue = data.filters.find((filter) => filter.id === 'comparison')?.value
  const stateName = stateFilter?.options.find((option) => option.value === stateFilter.value)?.label.split(' · ')[0] ?? stateFilter?.value ?? ''
  // Municípios avaliados do estado, ordenados pela nota; a posição exibida é a do estado e a nacional vai no tooltip.
  const municipalityComparisonRanking: ComparisonRankingItem[] = (data.municipalityRanking ?? [])
    .filter((item) => !item.wasNull)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'pt-BR'))
    .map((item, index) => ({ ...item, position: index + 1, detail: item.position ? `${item.position}º no Brasil` : undefined }))

  // Clicar no mapa troca o território principal (estado ou município) e recarrega o painel com o novo filtro.
  function selectPrimary(code: string) {
    if (code === primaryValue) return
    const values = Object.fromEntries(data.filters.map((filter) => [filter.id, filter.value]))
    onFiltersChange?.({ ...values, primary: code, comparison: values.comparison === code ? '' : values.comparison })
  }

  return (
    <main className={`page-shell dashboard-${data.kind}`}>
      <div className="dashboard-intro">
        <div className="max-w-[900px]">
          {data.kind === 'ibid' ? (
            <>
              <h1 className="text-xl font-semibold text-brand-700 dark:text-blue-200">IBID - Índice Brasil de Inovação e Desenvolvimento</h1>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-brand-700 dark:text-blue-200">CLP - Ranking de Competitividade dos {municipal ? 'Municípios' : 'Estados'}</h1>
              <p className="mt-2 text-sm text-ink dark:text-slate-300">
                O CLP possui dados disponíveis em nível de município. Use o alternador ao lado para comparar estados ou municípios.
              </p>
            </>
          )}
        </div>
        {isClp && (
          <div className="segment-control" aria-label="Nível territorial">
            <button aria-pressed={!municipal} className={!municipal ? 'segment-active' : ''} onClick={() => onClpModeChange?.('estados')} type="button"><MapPinned size={15} /> Estados</button>
            <button aria-pressed={municipal} className={municipal ? 'segment-active' : ''} onClick={() => onClpModeChange?.('municipios')} type="button"><Building2 size={15} /> Municípios</button>
          </div>
        )}
      </div>

      <Highlights groups={data.highlights ?? []} kind={data.kind} primaryName={data.summary[0]?.title ?? ''} />

      <div className="dashboard-filter-intro">
        <h2>{isClp ? `Painel Ranking de Competitividade dos ${municipal ? 'Municípios' : 'Estados'}` : 'Painel Índice Brasil de Inovação e Desenvolvimento'}</h2>
        <p>{municipal
          ? 'Escolha um estado, um município principal, um município de comparação (opcional), o ano e a métrica desejada.'
          : 'Escolha um estado principal, um estado de comparação (opcional), o ano e a métrica desejada. A região é escolhida automaticamente com base no estado principal.'}</p>
      </div>

      <div className="mt-5"><Filters filters={data.filters} onChange={onFiltersChange} /></div>
      <div className="mt-[30px]"><SummaryCards kind={data.kind} labels={data.rankingLabels} national={data.nationalRanking} regional={data.regionalRanking} summary={data.summary} /></div>
      <div className="dashboard-results-panel">
        <div className="dashboard-visual-grid">
          <div className="dashboard-visual-charts">
            <PositionChart
              comparison={data.comparisonHistory}
              comparisonLabel={comparisonLabel}
              hasComparison={hasComparison}
              kind={data.kind}
              metricLabel={metricLabel}
              primary={data.history}
              primaryLabel={primaryLabel}
              source={data.meta.source}
            />
            <SeriesChart chart={data.chart} hasComparison={hasComparison} kind={data.kind} metricLabel={metricLabel} source={data.meta.source} />
          </div>
          {municipal ? (
            <MunicipalityMap
              comparisonCode={comparisonValue}
              decimals={2}
              metricLabel={metricLabel}
              onSelect={selectPrimary}
              ranking={data.municipalityRanking ?? []}
              selectedCode={primaryValue}
              stateName={stateName}
              uf={stateFilter?.value ?? ''}
              year={selectedYear}
            />
          ) : (
            <BrazilMap
              comparisonCode={comparisonState}
              decimals={data.kind === 'ibid' ? 3 : 2}
              kind={data.kind}
              metricLabel={metricLabel}
              onSelect={selectPrimary}
              ranking={data.stateRanking ?? []}
              selectedCode={primaryState}
              year={selectedYear}
            />
          )}
        </div>
      </div>
      <div className="dashboard-results-panel">
        <StateComparisonChart
          comparisonState={comparisonState}
          decimals={data.kind === 'ibid' ? 3 : 2}
          kind={data.kind}
          metricLabel={metricLabel}
          primaryState={primaryState}
          ranking={data.stateRanking ?? []}
          source={data.meta.source}
          year={selectedYear}
        />
        {municipal && (
          <StateComparisonChart
            comparisonState={comparisonValue}
            decimals={2}
            entityPlural="municípios"
            idPrefix="municipality-comparison"
            kind={data.kind}
            legendLabel="Nota"
            longLabels
            metricLabel={metricLabel}
            primaryState={primaryValue}
            ranking={municipalityComparisonRanking}
            source={data.meta.source}
            title={`Comparativo com os Municípios${stateName ? ` · ${stateName}` : ''}`}
            year={selectedYear}
          />
        )}
      </div>
      <div className="dashboard-results-panel">
        <DetailTable
          comparisonLabel={comparisonLabel}
          comparisonRegionalLabel={comparisonRegionalLabel}
          kind={data.kind}
          primaryLabel={primaryLabel}
          primaryRegionalLabel={primaryRegionalLabel}
          rows={data.details}
          showComparison={hasComparisonRegion}
        />
      </div>
    </main>
  )
}
