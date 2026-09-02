import { useCallback, useEffect, useRef, useState } from 'react'
import { AboutPage } from './components/AboutPage'
import { DashboardPage } from './components/DashboardPage'
import { Header, type PageId } from './components/Header'
import { LoadingState } from './components/LoadingState'
import { dashboardRepository } from './data/dashboardRepository'
import type { DashboardDataset } from './types/dashboard'

const allowedPages: PageId[] = ['sobre', 'ibid', 'clp-estados', 'clp-municipios']
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fontScale, setFontScale] = useState(initialFontScale)
  const requestSequence = useRef(0)

  useEffect(() => {
    const syncHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [])

  const loadDashboard = useCallback(async (kind: Exclude<PageId, 'sobre'>, filters: Record<string, string> = {}) => {
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

  useEffect(() => {
    if (page === 'sobre') {
      requestSequence.current += 1
      setDashboard(null)
      setLoading(false)
      setError(null)
      return
    }
    setDashboard(null)
    void loadDashboard(page)
  }, [loadDashboard, page])

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

  return (
    <div className="min-h-screen bg-canvas text-ink transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header dataMeta={dashboard?.meta} fontScale={fontScale} onFontScaleChange={setFontScale} onNavigate={navigate} page={page} />
      {page !== 'sobre' && loading && !dashboard && <div className="page-shell"><LoadingState label="Carregando dados do painel" /></div>}
      {page !== 'sobre' && error && !dashboard && (
        <div className="page-shell">
          <div className="data-error" role="alert">
            <strong>Não foi possível carregar os dados.</strong>
            <span>{error}</span>
            <button onClick={() => void loadDashboard(page)} type="button">Tentar novamente</button>
          </div>
        </div>
      )}
      {page === 'sobre' && <AboutPage />}
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
      <footer className="mt-14 border-t border-line px-5 py-6 text-center text-xs text-muted dark:border-slate-800 dark:text-slate-400">EvidêncIA Inovação · Dados oficiais consolidados</footer>
    </div>
  )
}
