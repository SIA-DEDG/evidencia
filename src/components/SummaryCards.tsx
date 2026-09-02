import type { DashboardKind, RankingItem, SummaryMetric } from '../types/dashboard'

interface SummaryCardsProps {
  summary: SummaryMetric[]
  national: RankingItem[]
  regional: RankingItem[]
  kind: DashboardKind
  labels: { national: string; regional: string }
}

function RankingCard({ title, metric, ranking, decimals }: { title: string; metric: string; ranking: RankingItem[]; decimals: number }) {
  const [first, ...remaining] = ranking

  return (
    <article className="summary-card ranking-summary">
      <p className="eyebrow truncate">{title} · {metric}</p>
      {first && (
        <div className="mt-[10px] flex items-baseline gap-1">
          <strong className="text-base leading-none text-brand-700 dark:text-blue-200">{first.position}º {first.name}</strong>
          <span className="text-[10px] text-muted dark:text-slate-400">nota {first.value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>
        </div>
      )}
      <div className="mt-[10px] grid grid-cols-2 gap-x-4 gap-y-[6px]">
        {remaining.map((item) => (
          <div className="flex items-baseline gap-1" key={item.name}>
            <strong className="text-xs leading-none text-brand-700 dark:text-blue-200">{item.position}º {item.name}</strong>
            <span className="text-[9px] text-muted dark:text-slate-400">{item.value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

export function SummaryCards({ summary, national, regional, kind, labels }: SummaryCardsProps) {
  const decimals = kind === 'ibid' ? 3 : 2
  return (
    <section className="summary-grid" aria-label="Resumo dos indicadores">
      {summary.map((item) => (
        <article className={item.emphasis === 'primary' ? 'summary-card summary-card-primary' : 'summary-card'} key={item.eyebrow}>
          <p className="eyebrow">{item.eyebrow}</p>
          <h3 className="mt-1 truncate text-base font-semibold text-brand-700 dark:text-blue-200">{item.title}</h3>
          <p className="mt-1 truncate text-xs text-muted dark:text-slate-400">{item.metric}</p>
          <div className="mt-[10px] flex items-end gap-[10px]">
            <strong className="text-[20px] leading-6 text-brand-700 dark:text-blue-200">{item.rank}</strong>
            <span className="text-[10px] text-muted dark:text-slate-400">{item.note}</span>
          </div>
        </article>
      ))}
      <RankingCard decimals={decimals} metric={summary[0]?.metric ?? 'Nota Geral'} ranking={national} title={labels.national} />
      <RankingCard decimals={decimals} metric={summary[0]?.metric ?? 'Nota Geral'} ranking={regional} title={labels.regional} />
    </section>
  )
}
