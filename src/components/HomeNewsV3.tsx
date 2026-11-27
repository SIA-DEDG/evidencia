import { Play } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import './HomeNewsV3.css'

type NewsImage =
  | { kind: 'logo'; src: string; alt: string }
  | { kind: 'photo'; src: string; stripe: 'yellow' | 'green' }

interface NewsItem {
  id: string
  source: string
  date: { label: string; iso: string }
  title: string
  summary: string
  href: string
  image: NewsImage
}

const clpHref = 'https://rankingdecompetitividade.org.br/'
const ibidHref = 'https://www.gov.br/inpi/pt-br/inpi-data/indice-brasil-de-inovacao-e-desenvolvimento-ibid'
const clpLogo: NewsImage = { kind: 'logo', src: '/assets/clp.png', alt: 'Marca CLP' }

const news: NewsItem[] = [
  {
    id: 'clp-estados-2026',
    source: 'CLP · Estados',
    date: { label: '27 ago 2026', iso: '2026-08-27' },
    title: 'Ranking de Competitividade dos Estados 2026: Santa Catarina assume a liderança pela primeira vez',
    summary: 'Edição avalia as 27 UFs em 100 indicadores e 10 pilares. Veja onde o Piauí aparece.',
    href: clpHref,
    image: clpLogo,
  },
  {
    id: 'clp-municipios-teresina',
    source: 'CLP · Municípios',
    date: { label: '27 ago 2026', iso: '2026-08-27' },
    title: 'Teresina está entre os 100 municípios mais competitivos do país',
    summary: 'A capital ocupa a 90ª posição entre os 423 municípios avaliados no ranking de 2026.',
    href: clpHref,
    image: { kind: 'photo', src: '/assets/news-teresina.png', stripe: 'yellow' },
  },
  {
    id: 'ibid-2025',
    source: 'IBID · INPI',
    date: { label: '29 ago 2025', iso: '2025-08-29' },
    title: 'IBID 2025: Piauí avança no ranking nacional de inovação',
    summary: 'Segunda edição do índice do INPI traz dados inéditos de 2025 para os 27 estados.',
    href: ibidHref,
    image: { kind: 'photo', src: '/assets/news-pedra-furada.png', stripe: 'green' },
  },
  {
    id: 'clp-potencial-mercado',
    source: 'CLP · Estados',
    date: { label: '2025', iso: '2025' },
    title: 'Piauí é o 4º estado com maior Potencial de Mercado',
    summary: 'Resultado do pilar no Ranking de Competitividade dos Estados 2025, à frente de estados do Sul e do Sudeste.',
    href: clpHref,
    image: { kind: 'photo', src: '/assets/news-piaui-market.png', stripe: 'yellow' },
  },
  {
    id: 'clp-esg-ods',
    source: 'CLP · ESG e ODS',
    date: { label: 'ago 2026', iso: '2026-08' },
    title: 'CLP divulga o Ranking de Sustentabilidade dos Estados: ESG e ODS 2026',
    summary: 'Um outro olhar sobre os indicadores de competitividade, com foco em desenvolvimento sustentável.',
    href: clpHref,
    image: clpLogo,
  },
  {
    id: 'ibid-serie-historica',
    source: 'IBID · INPI',
    date: { label: 'mai 2025', iso: '2025-05' },
    title: 'INPI publica a série histórica do IBID com dados de 2014 a 2024',
    summary: 'Estudo relaciona inovação, PIB e IDH dos estados ao longo de uma década.',
    href: ibidHref,
    image: { kind: 'logo', src: '/assets/ibid.png', alt: 'Marca IBID' },
  },
]

/** Tempo de cada página antes da troca automática, em milissegundos. */
const pageDuration = 8000

function cardsPerPage(width: number) {
  if (width >= 1100) return 3
  if (width >= 680) return 2
  return 1
}

const pad = (value: number) => String(value).padStart(2, '0')

function NewsCardImage({ image }: { image: NewsImage }) {
  if (image.kind === 'logo') {
    return (
      <div className="home-news-image home-news-image-logo">
        <i /><i /><i /><i /><i /><i />
        <span><img alt={image.alt} src={image.src} /></span>
      </div>
    )
  }

  return (
    <div aria-hidden="true" className="home-news-image home-news-image-photo">
      <img alt="" loading="lazy" src={image.src} />
      <b className={`home-news-stripe home-news-stripe-${image.stripe}`} />
    </div>
  )
}

export function HomeNewsV3() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [perPage, setPerPage] = useState(3)
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const [interacting, setInteracting] = useState(false)

  const pageCount = Math.ceil(news.length / perPage)
  const currentPage = Math.min(page, pageCount - 1)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(([entry]) => setPerPage(cardsPerPage(entry.contentRect.width)))
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const goTo = (target: number) => setPage((target + pageCount) % pageCount)

  // Troca automática: o tempo restante é guardado ao pausar, para a barra de progresso e o timer seguirem juntos.
  const remainingRef = useRef(pageDuration)
  const timerKeyRef = useRef('')
  const timerKey = `${currentPage}-${perPage}`
  const running = pageCount > 1 && !paused && !interacting

  useEffect(() => {
    if (timerKeyRef.current !== timerKey) {
      timerKeyRef.current = timerKey
      remainingRef.current = pageDuration
    }
    if (!running) return

    const startedAt = performance.now()
    const timer = window.setTimeout(() => setPage((value) => (value + 1) % pageCount), remainingRef.current)
    return () => {
      window.clearTimeout(timer)
      remainingRef.current = Math.max(0, remainingRef.current - (performance.now() - startedAt))
    }
  }, [pageCount, running, timerKey])

  return (
    <section aria-labelledby="news-title" className="home-news-v3" data-node-id="3911:9817">
      <header className="home-news-header">
        <div>
          <p className="home-news-badge">
            <img alt="" aria-hidden="true" height="18" src="/assets/badge-isotipo-indices.svg" width="12" />
            Notícias
          </p>
          <h2 id="news-title">Notícias</h2>
          <p>Novas edições, resultados e destaques do IBID, do CLP e de outros estudos sobre o Piauí.</p>
        </div>
        <div className="home-news-nav">
          <button aria-controls="home-news-track" aria-label="Notícias anteriores" className="home-news-prev" onClick={() => goTo(currentPage - 1)} type="button">
            <img alt="" aria-hidden="true" height="20" src="/assets/news-chevron-left.svg" width="20" />
          </button>
          <button aria-controls="home-news-track" aria-label="Próximas notícias" className="home-news-next" onClick={() => goTo(currentPage + 1)} type="button">
            <img alt="" aria-hidden="true" height="20" src="/assets/news-chevron-right.svg" width="20" />
          </button>
        </div>
      </header>

      <div
        aria-label="Notícias"
        aria-roledescription="carrossel"
        className="home-news-viewport"
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false) }}
        onFocus={() => setInteracting(true)}
        onMouseEnter={() => setInteracting(true)}
        onMouseLeave={() => setInteracting(false)}
        ref={viewportRef}
        role="region"
      >
        <ul
          className="home-news-track"
          id="home-news-track"
          style={{ '--news-per-page': perPage, '--news-page': currentPage } as CSSProperties}
        >
          {news.map((item, index) => {
            const visible = Math.floor(index / perPage) === currentPage
            return (
              <li aria-hidden={!visible} className="home-news-card" key={item.id}>
                <NewsCardImage image={item.image} />
                <div className="home-news-card-body">
                  <p className="home-news-meta">
                    <span>{item.source}</span>
                    <time dateTime={item.date.iso}>{item.date.label}</time>
                  </p>
                  <h3>{item.title}</h3>
                  <p className="home-news-summary">{item.summary}</p>
                  <a className="home-news-read" href={item.href} rel="noreferrer" tabIndex={visible ? undefined : -1} target="_blank">
                    Ler notícia <span className="sr-only">: {item.title}</span>
                    <img alt="" aria-hidden="true" height="16" src="/assets/news-arrow-right.svg" width="16" />
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="home-news-pagination">
        <div className="home-news-indicators">
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              aria-current={index === currentPage ? 'true' : undefined}
              aria-label={`Ir para a página ${index + 1} de notícias`}
              className={index === currentPage ? 'is-active' : undefined}
              key={index}
              onClick={() => goTo(index)}
              type="button"
            >
              {index === currentPage && pageCount > 1 && (
                <span
                  className="home-news-progress"
                  key={timerKey}
                  style={{ animationDuration: `${pageDuration}ms`, animationPlayState: running ? 'running' : 'paused' }}
                />
              )}
            </button>
          ))}
        </div>
        <p aria-hidden="true">{pad(currentPage + 1)} / {pad(pageCount)}</p>
        <span className="sr-only" aria-live="polite">Página {currentPage + 1} de {pageCount}</span>
        <button className="home-news-pause" onClick={() => setPaused((value) => !value)} type="button">
          {paused
            ? <Play aria-hidden="true" size={14} strokeWidth={1.5} />
            : <img alt="" aria-hidden="true" height="14" src="/assets/news-pause.svg" width="14" />}
          {paused ? 'Retomar' : 'Pausar'}
        </button>
      </div>
    </section>
  )
}
