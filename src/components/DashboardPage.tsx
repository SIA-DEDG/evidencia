import { Building2, MapPinned } from 'lucide-react'
import type { DashboardDataset } from '../types/dashboard'
import { DetailTable } from './DetailTable'
import { Filters } from './Filters'
import { RankingHistory } from './RankingHistory'
import { SeriesChart } from './SeriesChart'
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
  const hasComparison = Boolean(data.filters.find((filter) => filter.id === 'comparison')?.value)

  return (
    <main className="page-shell">
      <div className={isClp ? 'dashboard-intro dashboard-intro-clp' : 'dashboard-intro dashboard-intro-ibid'}>
        <div className="max-w-[900px]">
          {data.kind === 'ibid' ? (
            <>
              <h1 className="text-xl font-semibold text-brand-700 dark:text-blue-200">IBID - Índice Brasil de Inovação e Desenvolvimento</h1>
              <p className="mt-2 text-sm text-ink dark:text-slate-300">
                Escolha um estado principal, um estado de comparação (opcional), o ano e a métrica desejada. A região é escolhida automaticamente com base no estado principal.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-brand-700 dark:text-blue-200">CLP - Ranking de Competitividade dos Estados e Municípios</h1>
              <p className="mt-2 text-sm text-ink dark:text-slate-300">
                O CLP possui dados disponíveis em nível de município. Use o alternador ao lado para comparar estados ou municípios.
              </p>
              {municipal ? (
                <p className="mt-2 text-sm text-ink dark:text-slate-300">Escolha um estado, um município principal, um município de comparação (opcional), o ano e a métrica desejada.</p>
              ) : (
                <p className="mt-2 text-sm text-ink dark:text-slate-300">Escolha um estado principal, um estado de comparação (opcional), o ano e a métrica desejada.</p>
              )}
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

      <div className="mt-5"><Filters filters={data.filters} onChange={onFiltersChange} /></div>
      <div className="mt-[30px]"><SummaryCards kind={data.kind} labels={data.rankingLabels} national={data.nationalRanking} regional={data.regionalRanking} summary={data.summary} /></div>
      <div className="dashboard-visual-grid mt-[30px]">
        <SeriesChart chart={data.chart} hasComparison={hasComparison} kind={data.kind} source={data.meta.source} />
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
      <DetailTable kind={data.kind} primaryLabel={primaryLabel} rows={data.details} />
    </main>
  )
}
