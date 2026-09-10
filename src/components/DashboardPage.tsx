import { Building2, MapPinned } from 'lucide-react'
import type { DashboardDataset } from '../types/dashboard'
import { DetailTable } from './DetailTable'
import { Filters } from './Filters'
import { Highlights } from './Highlights'
import { RankingHistory } from './RankingHistory'
import { SeriesChart } from './SeriesChart'
import { StateComparisonChart } from './StateComparisonChart'
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
  const hasComparisonRegion = hasComparison && data.chart.comparisonRegional.some((value) => value !== null)
  const primaryRegionalLabel = data.summary[2]?.title ?? (municipal ? 'Estado' : 'Região')
  const comparisonRegionalLabel = data.chart.comparisonRegionalLabel.replace(/^Média (?:do|de) /, '')

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
          <SeriesChart chart={data.chart} hasComparison={hasComparison} kind={data.kind} metricLabel={metricLabel} source={data.meta.source} />
          <RankingHistory
            comparison={data.comparisonHistory}
            comparisonLabel={comparisonLabel}
            hasComparison={hasComparison}
            metricLabel={metricLabel}
            primary={data.history}
            primaryLabel={primaryLabel}
            regionalLabel={municipal ? 'Estado' : 'Região'}
          />
        </div>
        <StateComparisonChart
          decimals={data.kind === 'ibid' ? 3 : 2}
          kind={data.kind}
          metricLabel={metricLabel}
          ranking={data.stateRanking ?? []}
          source={data.meta.source}
          year={selectedYear}
        />
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
