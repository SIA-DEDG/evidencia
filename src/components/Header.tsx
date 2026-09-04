import { ArrowUp, Check, ChevronDown, MapPin, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

export type PageId = 'sobre' | 'ibid' | 'clp-estados' | 'clp-municipios'

interface HeaderProps {
  page: PageId
  fontScale: number
  dataMeta?: {
    updatedAt: string
    dataPeriod: string
  }
  onNavigate: (page: PageId) => void
  onFontScaleChange: (scale: number) => void
  onSmartSearch: (command: string) => Promise<void>
}

interface SearchResult {
  id: PageId
  title: string
  subtitle: string
  keywords: string
}

const tabs: Array<{ id?: PageId; label: string; disabled?: boolean }> = [
  { id: 'sobre', label: 'Sobre o Painel' },
  { id: 'ibid', label: 'IBID' },
  { id: 'clp-estados', label: 'CLP' },
  { label: 'Comparativo', disabled: true },
]

const searchIndex: SearchResult[] = [
  { id: 'sobre', title: 'Sobre o Painel', subtitle: 'Apresentação dos índices e fontes', keywords: 'sobre painel início estudos fontes' },
  { id: 'ibid', title: 'IBID', subtitle: 'Índice Brasil de Inovação e Desenvolvimento', keywords: 'ibid inovação desenvolvimento estados regiões' },
  { id: 'clp-estados', title: 'CLP — Estados', subtitle: 'Ranking de Competitividade dos Estados', keywords: 'clp ranking competitividade estados regiões' },
  { id: 'clp-municipios', title: 'CLP — Municípios', subtitle: 'Ranking de Competitividade dos Municípios', keywords: 'clp ranking competitividade municípios cidades' },
]

const fontScales = [0.9, 1, 1.1, 1.2]

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function Header({ page, fontScale, dataMeta, onNavigate, onFontScaleChange, onSmartSearch }: HeaderProps) {
  const [projectsMenuOpen, setProjectsMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeResult, setActiveResult] = useState(0)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const projectsMenuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const isClp = page.startsWith('clp')
  const scaleIndex = fontScales.indexOf(fontScale)

  const searchResults = useMemo(() => {
    const normalizedQuery = normalizeText(query)
    if (normalizedQuery.length < 2) return []
    const tokens = normalizedQuery.split(' ')
    return searchIndex.filter((result) => {
      const content = normalizeText(`${result.title} ${result.subtitle} ${result.keywords}`)
      return tokens.every((token) => content.includes(token))
    })
  }, [query])

  function adjustFont(offset: number) {
    const currentIndex = scaleIndex < 0 ? 1 : scaleIndex
    const nextIndex = Math.min(fontScales.length - 1, Math.max(0, currentIndex + offset))
    onFontScaleChange(fontScales[nextIndex])
  }

  function selectSearchResult(result: SearchResult) {
    setQuery('')
    setSearchOpen(false)
    onNavigate(result.id)
  }

  async function applySmartSearch() {
    if (normalizeText(query).length < 2 || searching) return
    setSearching(true)
    setSearchError('')
    try {
      await onSmartSearch(query)
      setQuery('')
      setSearchOpen(false)
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : 'Não foi possível interpretar a busca.')
    } finally {
      setSearching(false)
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setSearchOpen(false)
      return
    }
    const hasSmartAction = normalizeText(query).length >= 2
    const resultCount = searchResults.length + (hasSmartAction ? 1 : 0)
    if (!searchOpen || resultCount === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveResult((index) => (index + 1) % resultCount)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveResult((index) => (index - 1 + resultCount) % resultCount)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (hasSmartAction && activeResult === 0) void applySmartSearch()
      else {
        const result = searchResults[activeResult - (hasSmartAction ? 1 : 0)]
        if (result) selectSearchResult(result)
      }
    }
  }

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!projectsMenuRef.current?.contains(target)) setProjectsMenuOpen(false)
      if (!searchRef.current?.contains(target)) setSearchOpen(false)
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProjectsMenuOpen(false)
        setSearchOpen(false)
      }
      if (!event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        adjustFont(1)
      } else if (event.key === '-') {
        event.preventDefault()
        adjustFont(-1)
      } else if (event.key === '0') {
        event.preventDefault()
        onFontScaleChange(1)
      }
    }
    const handleScroll = () => setShowBackToTop(window.scrollY > 320)

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll)
    }
  })

  return (
    <>
      <header className="site-header">
        <div className="header-top-row">
          <div className="header-utility-menu">
            <span aria-hidden="true" className="header-divider" />
            <span className="header-site-label">Site SIA</span>
            <span aria-hidden="true" className="header-divider" />
            <div className="header-projects" ref={projectsMenuRef}>
              <button
                aria-expanded={projectsMenuOpen}
                aria-haspopup="menu"
                className="header-projects-trigger"
                onClick={() => setProjectsMenuOpen((open) => !open)}
                type="button"
              >
                <span>Projetos</span>
                <ChevronDown aria-hidden="true" className={projectsMenuOpen ? 'rotate-180' : ''} size={16} />
              </button>
              {projectsMenuOpen && (
                <div className="header-projects-popover" role="menu">
                  <button aria-checked="true" onClick={() => setProjectsMenuOpen(false)} role="menuitemradio" type="button">
                    <span>EvidencIA Inovação</span>
                    <Check aria-hidden="true" size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div aria-label="Controles de tamanho da fonte" className="accessibility-controls" role="group">
            <button
              aria-label={`Diminuir fonte e conteúdo. Tamanho atual: ${Math.round(fontScale * 100)}%`}
              className="square-control"
              disabled={scaleIndex === 0}
              onClick={() => adjustFont(-1)}
              title="Diminuir fonte (Alt -)"
              type="button"
            >A-</button>
            <button
              aria-label={`Aumentar fonte e conteúdo. Tamanho atual: ${Math.round(fontScale * 100)}%`}
              className="square-control"
              disabled={scaleIndex === fontScales.length - 1}
              onClick={() => adjustFont(1)}
              title="Aumentar fonte (Alt +)"
              type="button"
            >A+</button>
            <span aria-live="polite" className="sr-only">Tamanho da interface: {Math.round(fontScale * 100)}%</span>
          </div>
        </div>

        <div className="header-middle-row">
          <img
            alt="Secretaria de Inteligência Artificial, Economia Digital, Ciência, Tecnologia e Inovação — Governo do Piauí"
            className="header-logo"
            height="63"
            src="/assets/logo.svg"
            width="317"
          />

          <div className="header-search">
            <div className="header-search-root" ref={searchRef}>
              <div className={searchOpen ? 'header-search-field header-search-field-open' : 'header-search-field'}>
                <Search aria-hidden="true" size={20} />
                <input
                  aria-autocomplete="list"
                  aria-controls="site-search-results"
                  aria-expanded={searchOpen}
                  aria-label="Buscar seções do painel"
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActiveResult(0)
                    setSearchError('')
                    setSearchOpen(Boolean(event.target.value))
                  }}
                  onFocus={() => setSearchOpen(Boolean(query))}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar no EvidencIA"
                  role="combobox"
                  type="search"
                  value={query}
                />
              </div>

              {searchOpen && (
                <div className="header-search-results" id="site-search-results" role="listbox">
                  {normalizeText(query).length >= 2 && (
                    <button
                      aria-selected={activeResult === 0}
                      className={activeResult === 0 ? 'header-search-result header-search-result-smart header-search-result-active' : 'header-search-result header-search-result-smart'}
                      disabled={searching}
                      onClick={() => void applySmartSearch()}
                      onMouseEnter={() => setActiveResult(0)}
                      role="option"
                      type="button"
                    >
                      <span className="header-search-result-icon"><Search aria-hidden="true" size={16} /></span>
                      <span className="min-w-0">
                        <strong>{searching ? 'Aplicando filtros…' : 'Aplicar filtros desta busca'}</strong>
                        <small>Reconhece painel, localidade, comparação, região, ano e métrica</small>
                      </span>
                    </button>
                  )}
                  {searchResults.map((result, index) => (
                    <button
                      aria-selected={index + 1 === activeResult}
                      className={index + 1 === activeResult ? 'header-search-result header-search-result-active' : 'header-search-result'}
                      key={result.id}
                      onClick={() => selectSearchResult(result)}
                      onMouseEnter={() => setActiveResult(index + 1)}
                      role="option"
                      type="button"
                    >
                      <span className="header-search-result-icon"><MapPin aria-hidden="true" size={16} /></span>
                      <span className="min-w-0">
                        <strong>{result.title}</strong>
                        <small>{result.subtitle}</small>
                      </span>
                    </button>
                  ))}
                  {normalizeText(query).length < 2 && (
                    <p>Nenhum resultado encontrado.</p>
                  )}
                  {searchError && <p className="header-search-error">{searchError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="main-nav" aria-label="Páginas">
        <ul className="main-nav-content">
          {tabs.map((tab) => {
            const active = tab.id === page || (tab.id === 'clp-estados' && isClp)
            return (
              <li className="flex" key={tab.label}>
                <button
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'nav-tab nav-tab-active' : 'nav-tab'}
                  disabled={tab.disabled}
                  onClick={() => tab.id && onNavigate(tab.id)}
                  title={tab.disabled ? 'Seção ainda não disponível' : undefined}
                  type="button"
                >
                  {tab.label}
                  {tab.disabled && <span className="sr-only"> (indisponível)</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="update-strip">
        <span>Última atualização desta página: {dataMeta ? new Date(dataMeta.updatedAt).toLocaleString('pt-BR') : 'consulte um dos painéis'}</span>
        <span>Período dos dados: {dataMeta?.dataPeriod ?? 'conforme a pesquisa selecionada'}</span>
      </div>

      {showBackToTop && (
        <button aria-label="Voltar ao topo" className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Voltar ao topo" type="button">
          <ArrowUp aria-hidden="true" size={20} />
        </button>
      )}
    </>
  )
}
