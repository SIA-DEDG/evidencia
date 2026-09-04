import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import type { DashboardDataset, DashboardKind } from '../types/dashboard'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export function SeriesChart({ chart, hasComparison, kind, source }: { chart: DashboardDataset['chart']; hasComparison: boolean; kind: DashboardKind; source: string }) {
  const isIbid = kind === 'ibid'
  const period = chart.years.length === 1 ? String(chart.years[0]) : `${chart.years[0]}–${chart.years.at(-1)}`
  const pointRadius = chart.years.length === 1 ? 4 : 0

  return (
    <section className={isIbid ? 'series-chart series-chart-ibid min-w-0' : 'series-chart series-chart-clp min-w-0'}>
      <h2 className="section-title">Série Histórica ({period})</h2>
      {isIbid ? (
        <p className="section-description">Nota Geral (IBID) é um indicador sintético que varia de 0 a 1 e agrega indicadores de naturezas e escalas distintas.</p>
      ) : (
        <p className="section-description">A Nota Geral - CLP é obtida por normalização e ponderação de indicadores que variam de 0 a 100.</p>
      )}
      <div className="chart-canvas min-w-0">
        <Line
          data={{
            labels: chart.years,
            datasets: [
              { label: chart.primaryLabel, data: chart.primary, borderColor: '#08325e', backgroundColor: 'rgba(8,50,94,.1)', borderWidth: 3, pointRadius, tension: 0.42 },
              ...(hasComparison ? [{ label: chart.comparisonLabel, data: chart.comparison, borderColor: '#8db2ff', backgroundColor: 'rgba(141,178,255,.12)', borderWidth: 3, pointRadius, tension: 0.42 }] : []),
              { label: chart.regionalLabel, data: chart.regional, borderColor: '#6e7781', borderDash: [4, 4], borderWidth: 2, pointRadius, tension: 0.42 },
              ...(hasComparison && chart.comparisonRegional.some((value) => value !== null)
                ? [{ label: chart.comparisonRegionalLabel, data: chart.comparisonRegional, borderColor: '#d97706', backgroundColor: 'rgba(217,119,6,.1)', borderDash: [4, 4], borderWidth: 2, pointRadius, tension: 0.42 }]
                : []),
              { label: 'Média do Brasil', data: chart.nationalAverage, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.1)', borderDash: [7, 4], borderWidth: 2, pointRadius, tension: 0.42 },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 24, boxHeight: 2, color: '#4c6379', usePointStyle: true, pointStyle: 'line' } },
              tooltip: { backgroundColor: '#08325e', padding: 12, cornerRadius: 8 },
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#6d8295' }, border: { color: '#bfd0e0' } },
              y: { min: 0, max: chart.yMax, grid: { color: 'rgba(191,208,224,.62)' }, ticks: { color: '#6d8295' }, border: { display: false } },
            },
          }}
        />
      </div>
      <p className="source-line">Fonte: {source}</p>
    </section>
  )
}
