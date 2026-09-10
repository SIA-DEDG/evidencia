import type { RankingHistoryItem } from '../types/dashboard'

interface HistoryCardProps {
  title: string
  metricLabel: string
  items: RankingHistoryItem[]
  regionalLabel: string
}

function HistoryCard({ title, metricLabel, items, regionalLabel }: HistoryCardProps) {
  return (
    <article className="history-card">
      <p className="eyebrow">Ranking</p>
      <h3 className="mt-1 truncate text-sm font-semibold text-brand-700 dark:text-blue-200">{title}</h3>
      <p className="mt-1 truncate text-[10px] text-muted dark:text-slate-400">{metricLabel}</p>
      <div className="history-list">
        {items.map((item) => (
          <div className="history-row" key={item.year}>
            <span className="history-rank"><strong>{item.national}º</strong><b> / {item.nationalTotal}</b> Brasil{item.regional ? <><b> / {item.regional}º</b> {regionalLabel}</> : null}</span>
            <span className="history-year">{item.year}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

interface RankingHistoryProps {
  primary: RankingHistoryItem[]
  comparison: RankingHistoryItem[]
  primaryLabel: string
  comparisonLabel: string
  hasComparison: boolean
  metricLabel: string
  regionalLabel: string
}

export function RankingHistory({ primary, comparison, primaryLabel, comparisonLabel, hasComparison, metricLabel, regionalLabel }: RankingHistoryProps) {
  return (
    <aside className="ranking-history-grid" aria-label="Histórico de ranking">
      <HistoryCard items={primary} metricLabel={metricLabel} regionalLabel={regionalLabel} title={primaryLabel} />
      {hasComparison ? <HistoryCard items={comparison} metricLabel={metricLabel} regionalLabel={regionalLabel} title={comparisonLabel} /> : (
        <article className="history-card history-card-empty">
          <p className="eyebrow">Ranking</p>
          <h3 className="mt-1 text-sm">{regionalLabel === 'Estado' ? 'Município' : 'Estado'} de comparação</h3>
          <p className="history-empty-message">Selecione um {regionalLabel === 'Estado' ? 'município' : 'estado'} para comparar o histórico de ranking.</p>
        </article>
      )}
    </aside>
  )
}
