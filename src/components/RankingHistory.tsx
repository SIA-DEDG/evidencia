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
      <div className="history-list divide-y divide-line/70 dark:divide-slate-700">
        {items.map((item) => (
          <div className="history-row" key={item.year}>
            <span className="whitespace-nowrap"><strong className="text-brand-700 dark:text-blue-200">{item.national}º</strong> / {item.nationalTotal} Brasil</span>
            <span className="ml-auto whitespace-nowrap text-muted dark:text-slate-400">{item.regional ? `${item.regional}º/${item.regionalTotal} ${regionalLabel}` : ''}</span>
            <span className="w-[30px] shrink-0 text-right text-[9px] text-[#8098ac]">{item.year}</span>
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
    <aside className={hasComparison ? 'ranking-history-grid' : 'ranking-history-grid ranking-history-grid-single'} aria-label="Histórico de ranking">
      <HistoryCard items={primary} metricLabel={metricLabel} regionalLabel={regionalLabel} title={primaryLabel} />
      {hasComparison && <HistoryCard items={comparison} metricLabel={metricLabel} regionalLabel={regionalLabel} title={comparisonLabel} />}
    </aside>
  )
}
