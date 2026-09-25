import { useCallback, useEffect, useRef, useState } from 'react'
import { AboutPage } from './components/AboutPage'
import { ComparisonPage } from './components/ComparisonPage'
import { DashboardPage } from './components/DashboardPage'
import { EdsonChat } from './components/EdsonChat'
import { HeaderIntegration, type PageId } from './components/HeaderIntegration'
import { LoadingState } from './components/LoadingState'
import { dashboardRepository } from './data/dashboardRepository'
import { pillarRelation } from './data/studyRelations'
import { detectDashboardKind, interpretDashboardSearch, normalizeSearchText } from './data/dashboardSearch'
import type { ComparisonDataset, DashboardDataset, DataMeta } from './types/dashboard'

const allowedPages: PageId[] = ['sobre', 'ibid', 'clp-estados', 'clp-municipios', 'comparativo']
const fontScales = [0.9, 1, 1.1, 1.2]
const fontScaleStorageKey = 'observatorio:escala-fonte'

function initialFontScale() {
  try {
    const saved = Number(localStorage.getItem(fontScaleStorageKey))
    return fontScales.includes(saved) ? saved : 1
  } catch {
    return 1
  }
}

function pageFromHash(): PageId {
  const value = window.location.hash.replace('#/', '') as PageId
  return allowedPages.includes(value) ? value : 'sobre'
}

export default function App() {
  const [page, setPage] = useState<PageId>(pageFromHash)
  const [dashboard, setDashboard] = useState<DashboardDataset | null>(null)
  const [comparison, setComparison] = useState<ComparisonDataset | null>(null)
  const [siteMeta, setSiteMeta] = useState<DataMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fontScale, setFontScale] = useState(initialFontScale)
  const requestSequence = useRef(0)
  const skipNextPageLoad = useRef(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [homeAssistantVisible, setHomeAssistantVisible] = useState(false)
  const chatTriggerRef = useRef<HTMLButtonElement | null>(null)

  const openChat = useCallback((trigger: HTMLButtonElement) => {
    chatTriggerRef.current = trigger
    setChatOpen(true)
  }, [])

  const closeChat = useCallback(() => {
    setChatOpen(false)
    requestAnimationFrame(() => {
      const triggers = [chatTriggerRef.current, ...document.querySelectorAll<HTMLButtonElement>('[aria-controls="edson-chat"]')]
      const visibleTrigger = triggers.find((trigger) => {
        if (!trigger?.isConnected || trigger.hidden) return false
        const rect = trigger.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
      })
      visibleTrigger?.focus({ preventScroll: true })
    })
  }, [])

  useEffect(() => {
    dashboardRepository.getMeta().then(setSiteMeta, (reason: unknown) => {
      console.error('Não foi possível consultar a última atualização dos dados.', reason)
    })
  }, [])

  useEffect(() => {
    const syncHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  const loadDashboard = useCallback(async (kind: Exclude<PageId, 'sobre' | 'comparativo'>, filters: Record<string, string> = {}) => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError(null)
    try {
      const value = await dashboardRepository.getDashboard(kind, filters)
      if (requestId === requestSequence.current) setDashboard(value)
    } catch (reason) {
      if (requestId === requestSequence.current) {
        setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o painel.')
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }, [])

  const loadComparison = useCallback(async (filters: Record<string, string> = {}) => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError(null)
    try {
      const primary = filters.primary || undefined
      const relation = pillarRelation(filters.metric)
      const ibidMetric: Record<string, string> = relation ? { metric: relation.ibidMetric } : {}
      const clpMetric: Record<string, string> = relation ? { metric: relation.clpMetric } : {}
      const seedFilters: Record<string, string> = primary ? { primary } : {}
      const [ibidSeed, clpSeed] = await Promise.all([
        dashboardRepository.getDashboard('ibid', { ...seedFilters, ...ibidMetric }),
        dashboardRepository.getDashboard('clp-estados', { ...seedFilters, ...clpMetric }),
      ])
      const ibidYears = new Set(ibidSeed.filters.find((item) => item.id === 'year')?.options.map((item) => item.value) ?? [])
      const commonYears = clpSeed.filters
        .find((item) => item.id === 'year')
        ?.options.map((item) => item.value)
        .filter((year) => ibidYears.has(year)) ?? []
      const year = filters.year && commonYears.includes(filters.year) ? filters.year : commonYears[0]
      const selectedPrimary = ibidSeed.filters.find((item) => item.id === 'primary')?.value ?? primary
      const synchronizedFilters = { ...(selectedPrimary ? { primary: selectedPrimary } : {}), ...(year ? { year } : {}) }
      const ibidSelectedYear = ibidSeed.filters.find((item) => item.id === 'year')?.value
      const clpSelectedYear = clpSeed.filters.find((item) => item.id === 'year')?.value
      const [ibid, clp] = await Promise.all([
        year && ibidSelectedYear !== year ? dashboardRepository.getDashboard('ibid', { ...synchronizedFilters, ...ibidMetric }) : Promise.resolve(ibidSeed),
        year && clpSelectedYear !== year ? dashboardRepository.getDashboard('clp-estados', { ...synchronizedFilters, ...clpMetric }) : Promise.resolve(clpSeed),
      ])
      if (requestId !== requestSequence.current) return
      const updatedAt = new Date(Math.max(new Date(ibid.meta.updatedAt).getTime(), new Date(clp.meta.updatedAt).getTime())).toISOString()
      const years = [...new Set([...ibid.chart.years, ...clp.chart.years])].sort((a, b) => a - b)
      setComparison({
        ibid,
        clp,
        relation: relation?.id,
        meta: {
          updatedAt,
          dataPeriod: years.length === 1 ? String(years[0]) : `${years[0]}–${years.at(-1)}`,
          source: `${ibid.meta.source} · ${clp.meta.source}`,
        },
      })
    } catch (reason) {
      if (requestId === requestSequence.current) {
        setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o comparativo.')
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (skipNextPageLoad.current) {
      skipNextPageLoad.current = false
      return
    }
    if (page === 'sobre') {
      requestSequence.current += 1
      setDashboard(null)
      setComparison(null)
      setLoading(false)
      setError(null)
      return
    }
    if (page === 'comparativo') {
      setDashboard(null)
      setComparison(null)
      void loadComparison()
      return
    }
    setComparison(null)
    setDashboard(null)
    void loadDashboard(page)
  }, [loadComparison, loadDashboard, page])

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.dataset.theme = 'light'
    try {
      localStorage.removeItem('observatorio:tema')
    } catch {
      // O modo claro continua aplicado durante a sessão.
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale * 16}px`
    try {
      localStorage.setItem(fontScaleStorageKey, String(fontScale))
    } catch {
      // A preferência continua aplicada durante a sessão.
    }
  }, [fontScale])

  function navigate(next: PageId) {
    if (window.location.hash === `#/${next}`) setPage(next)
    else window.location.hash = `/${next}`
  }

  const applySmartSearch = useCallback(async (command: string) => {
    const target = detectDashboardKind(command, page)
    if (target === 'sobre') {
      navigate('sobre')
      return
    }

    const requestId = ++requestSequence.current
    setLoading(true)
    setError(null)
    try {
      let base = dashboard?.kind === target ? dashboard : await dashboardRepository.getDashboard(target)
      let interpretation = interpretDashboardSearch(command, base)

      if (target === 'clp-municipios') {
        const currentState = base.filters.find((filter) => filter.id === 'state')?.value
        const requestedState = interpretation.filters.state
        if (requestedState && requestedState !== currentState) {
          base = await dashboardRepository.getDashboard(target, { state: requestedState })
          interpretation = interpretDashboardSearch(command, base)
        }
      }

      const explicitlyNamesPanel = /\b(ibid|clp|municipio|municipios|municipal)\b/.test(normalizeSearchText(command))
      if (!interpretation.matchedFilters.length && !explicitlyNamesPanel) {
        throw new Error('Não reconheci território, região, ano ou métrica nessa busca.')
      }

      const value = await dashboardRepository.getDashboard(target, interpretation.filters)
      if (requestId !== requestSequence.current) return

      if (page !== target) {
        skipNextPageLoad.current = true
        window.history.pushState(null, '', `#/${target}`)
        setPage(target)
      }
      setDashboard(value)
    } catch (reason) {
      if (requestId === requestSequence.current) {
        const message = reason instanceof Error ? reason.message : 'Não foi possível aplicar os filtros da busca.'
        setError(message)
        throw new Error(message)
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false)
    }
  }, [dashboard, page])

  return (
    <div className="min-h-screen bg-canvas text-ink transition-colors dark:bg-slate-950 dark:text-slate-100">
      <HeaderIntegration
        dataMeta={dashboard?.meta ?? comparison?.meta ?? (page === 'sobre' ? siteMeta ?? undefined : undefined)}
        fontScale={fontScale}
        onFontScaleChange={setFontScale}
        onNavigate={navigate}
        onSmartSearch={applySmartSearch}
        page={page}
      />
      {loading && page === 'sobre' && <LoadingState label="Interpretando busca e carregando dados" overlay />}
      {page !== 'sobre' && loading && !dashboard && !comparison && <div className="page-shell"><LoadingState label={page === 'comparativo' ? 'Carregando comparação entre os estudos' : 'Carregando dados do painel'} /></div>}
      {page !== 'sobre' && error && !dashboard && !comparison && (
        <div className="page-shell">
          <div className="data-error" role="alert">
            <strong>Não foi possível carregar os dados.</strong>
            <span>{error}</span>
            <button onClick={() => page === 'comparativo' ? void loadComparison() : void loadDashboard(page)} type="button">Tentar novamente</button>
          </div>
        </div>
      )}
      {page === 'sobre' && (
        <AboutPage
          chatOpen={chatOpen}
          onAssistantVisibilityChange={setHomeAssistantVisible}
          onNavigate={navigate}
          onOpenChat={openChat}
        />
      )}
      {comparison && page === 'comparativo' && (
        <div className="relative">
          {loading && <LoadingState label="Atualizando comparação" overlay />}
          <ComparisonPage data={comparison} onFiltersChange={(filters) => void loadComparison(filters)} />
          {error && <div className="page-shell pt-0 text-sm text-red-700" role="alert">{error}</div>}
        </div>
      )}
      {dashboard && (
        <div className="relative">
          {loading && <LoadingState label="Atualizando indicadores" overlay />}
          <DashboardPage
            data={dashboard}
            onClpModeChange={(mode) => navigate(mode === 'estados' ? 'clp-estados' : 'clp-municipios')}
            onFiltersChange={(filters) => void loadDashboard(dashboard.kind, filters)}
          />
          {error && <div className="page-shell pt-0 text-sm text-red-700" role="alert">{error}</div>}
        </div>
      )}
      {page !== 'sobre' && (
        <footer className="mt-14 border-t border-line px-5 py-6 text-center text-xs text-muted dark:border-slate-800 dark:text-slate-400">
          © 2026 Secretaria de Inteligência Artificial, Economia Digital, Ciência, Tecnologia e Inovação — SIA
        </footer>
      )}
      <button
        aria-controls="edson-chat"
        aria-expanded={chatOpen}
        aria-haspopup="dialog"
        aria-label="Abrir chat do Edson"
        className="edson-chat-launcher"
        hidden={chatOpen || (page === 'sobre' && homeAssistantVisible)}
        onClick={(event) => openChat(event.currentTarget)}
        type="button"
      >
        <img alt="" aria-hidden="true" height={48} src="/assets/edson-empty-state.svg" width={48} />
      </button>
      <EdsonChat onClose={closeChat} open={chatOpen} />
    </div>
  )
}
