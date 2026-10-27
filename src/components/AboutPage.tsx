import { useEffect, useRef, useState } from 'react'

type StudyPage = 'ibid' | 'clp-estados' | 'clp-municipios'

interface AboutPageProps {
  chatOpen: boolean
  onAssistantVisibilityChange: (visible: boolean) => void
  onNavigate: (page: StudyPage) => void
  onOpenChat: (trigger: HTMLButtonElement) => void
}

interface HeroTile {
  side: 'left' | 'right'
  /** Distância até a borda do lado escolhido. */
  offset: number
  /** Posição vertical no hero de 400px; as duas fileiras de baixo ficam presas à base. */
  top: number
  color: string
}

const heroTiles: HeroTile[] = [
  { side: 'left', offset: 0, top: 0, color: '#eef4fc' },
  { side: 'left', offset: 80, top: 0, color: '#e3eefa' },
  { side: 'left', offset: 240, top: 0, color: '#eef4fc' },
  { side: 'left', offset: 560, top: 0, color: '#eef4fc' },
  { side: 'left', offset: 0, top: 80, color: '#e3eefa' },
  { side: 'left', offset: 0, top: 240, color: '#eef4fc' },
  { side: 'left', offset: 0, top: 320, color: 'rgba(3, 78, 162, .8)' },
  { side: 'left', offset: 80, top: 320, color: '#c9ddf4' },
  { side: 'left', offset: 160, top: 320, color: '#e3eefa' },
  { side: 'left', offset: 400, top: 320, color: '#eef4fc' },
  { side: 'left', offset: 640, top: 320, color: '#e3eefa' },
  { side: 'right', offset: 0, top: 0, color: '#034ea2' },
  { side: 'right', offset: 160, top: 0, color: '#e3eefa' },
  { side: 'right', offset: 320, top: 0, color: '#c9ddf4' },
  { side: 'right', offset: 0, top: 80, color: '#c9ddf4' },
  { side: 'right', offset: 400, top: 80, color: '#034ea2' },
  { side: 'right', offset: 480, top: 160, color: '#e3eefa' },
  { side: 'right', offset: 0, top: 240, color: '#0b5db8' },
  { side: 'right', offset: 320, top: 240, color: '#e3eefa' },
  { side: 'right', offset: 480, top: 240, color: '#c9ddf4' },
  { side: 'right', offset: 0, top: 320, color: '#034ea2' },
  { side: 'right', offset: 80, top: 320, color: '#c9ddf4' },
  { side: 'right', offset: 320, top: 320, color: '#c9ddf4' },
  { side: 'right', offset: 400, top: 320, color: '#08478d' },
]

const mapLegendColors = ['#b4cdec', '#7ba3db', '#3473c4', '#0b4a9c']

const historyLegend = [
  { label: 'Estado', color: '#031d3c' },
  { label: 'Região', color: '#9aa6b8' },
  { label: 'Brasil', color: '#7b5cf0' },
]

/** Mapa de calor do cartão "Evolução por pilar": seis anos por pilar. */
const pillarHeatmap = [
  { label: 'Instituições', cells: ['#b4c8e5', '#bdcfe9', '#bdcfe9', '#e2ecf8', '#698fc6', '#aac1e1'] },
  { label: 'Capital humano', cells: ['#bdcfe9', '#b4c8e5', '#bdcfe9', '#bdcfe9', '#b4c8e5', '#8eacd6'] },
  { label: 'Infraestrutura', cells: ['#85a5d2', '#85a5d2', '#7c9dce', '#7396ca', '#85a5d2', '#98b3da'] },
  { label: 'Economia', cells: ['#7396ca', '#698fc6', '#4473b7', '#1f56a8', '#4d7abb', '#7c9dce'] },
  { label: 'Negócios', cells: ['#4d7abb', '#4473b7', '#4473b7', '#4d7abb', '#98b3da', '#b4c8e5'] },
  { label: 'Conhec. e tecnologia', cells: ['#d9e5f4', '#98b3da', '#a1badd', '#bdcfe9', '#aac1e1', '#3b6bb3'] },
  { label: 'Economia criativa', cells: ['#aac1e1', '#aac1e1', '#a1badd', '#aac1e1', '#a1badd', '#98b3da'] },
]

const purposeHighlights = [
  {
    title: 'Dois estudos',
    icon: '/assets/purpose-studies.svg',
    text: ['IBID (INPI) e CLP avaliam os estados sob óticas complementares: instituições, capital humano, infraestrutura, economia, negócios e conhecimento.'],
  },
  {
    title: 'Comparação livre',
    icon: '/assets/purpose-comparison.svg',
    text: ['Escolha qualquer estado e compare com outro estado e com a média da sua região — em ranking, pontuação, série histórica, pilar, dimensão e indicador.'],
  },
  {
    title: 'Cobertura',
    icon: '/assets/purpose-coverage.svg',
    text: ['27 unidades federativas + 5 regiões. Recorte municipal na base CLP.', 'Série histórica: IBID 2015 e 2025 · CLP 2015–2025.'],
  },
]

/** Quadradinhos da composição de imagem do propósito, antes e depois do recorte das pessoas. */
const purposePixelsBehind = [
  { left: 110, top: 90, color: '#034ea2' },
  { left: 150, top: 50, color: '#b7d6f3' },
  { left: 70, top: 130, color: '#61a5d7' },
  { left: 190, top: 10, color: '#dceaf9' },
  { left: 30, top: 90, color: 'rgba(183, 214, 243, .8)' },
]

const purposePixelsFront = [
  { left: 390, top: 390, color: '#034ea2' },
  { left: 270, top: 470, color: 'rgba(183, 214, 243, .7)' },
  { left: 430, top: 390, color: '#dceaf9' },
  { left: 390, top: 350, color: '#61a5d7' },
  { left: 310, top: 430, color: '#b7d6f3' },
  { left: 350, top: 390, color: '#031d3c' },
]

interface StudyCard {
  id: string
  page: StudyPage
  logo: { src: string; alt: string; width: number; height: number }
  scope: string
  title: string
  subtitle: string
  description: string
  numbers: Array<{ value: string; label: string }>
  chipsLabel: string
  chips: Array<{ label: string; tone?: 'blue' | 'green' }>
  source: string
  dashboardLabel: string
  moreLabel: string
  moreHref: string
}

const studyCards: StudyCard[] = [
  {
    id: 'ibid',
    page: 'ibid',
    logo: { src: '/assets/ibid.png', alt: 'Marca IBID', width: 44, height: 29.135 },
    scope: 'Estados',
    title: 'IBID',
    subtitle: 'Índice Brasil de Inovação e Desenvolvimento',
    description: 'Publicado pelo INPI, com metodologia inspirada no Índice Global de Inovação (OMPI). Nota geral única do estado.',
    numbers: [{ value: '7', label: 'pilares' }, { value: '21', label: 'dimensões' }, { value: '80', label: 'indicadores' }],
    chipsLabel: 'Pilares',
    chips: [
      { label: 'Economia', tone: 'blue' },
      { label: 'Instituições', tone: 'blue' },
      { label: 'Capital Humano', tone: 'blue' },
      { label: 'Infraestrutura', tone: 'blue' },
      { label: 'Negócios', tone: 'blue' },
      { label: 'Economia Criativa', tone: 'green' },
      { label: 'Conhecimento e Tecnologia', tone: 'green' },
    ],
    source: 'INPI – Coordenação-Geral de Economia e Inovação',
    dashboardLabel: 'Ir para o painel IBID',
    moreLabel: 'Saiba mais sobre o IBID',
    moreHref: 'https://www.gov.br/inpi/pt-br/inpi-data/indice-brasil-de-inovacao-e-desenvolvimento-ibid',
  },
  {
    id: 'clp-estados',
    page: 'clp-estados',
    logo: { src: '/assets/clp.png', alt: 'Marca CLP', width: 44, height: 15.613 },
    scope: 'Estados',
    title: 'CLP · Estados',
    subtitle: 'Ranking de Competitividade dos Estados',
    description: 'Centro de Liderança Pública. Avalia a competitividade das 27 unidades federativas a partir de uma nota geral.',
    numbers: [{ value: '10', label: 'pilares' }, { value: '90', label: 'indicadores' }],
    chipsLabel: 'Pilares',
    chips: [
      'Sustentabilidade Ambiental',
      'Capital Humano',
      'Educação',
      'Eficiência da Máquina Pública',
      'Infraestrutura',
      'Inovação',
      'Potencial de Mercado',
      'Solidez Fiscal',
      'Segurança Pública',
      'Sustentabilidade Social',
    ].map((label) => ({ label })),
    source: 'Centro de Liderança Pública (CLP)',
    dashboardLabel: 'Ir para o painel CLP',
    moreLabel: 'Saiba mais sobre o CLP',
    moreHref: 'https://rankingdecompetitividade.org.br/',
  },
  {
    id: 'clp-municipios',
    page: 'clp-municipios',
    logo: { src: '/assets/clp.png', alt: 'Marca CLP', width: 44, height: 15.613 },
    scope: 'Municípios',
    title: 'CLP · Municípios',
    subtitle: 'Ranking de Competitividade dos Municípios',
    description: 'Pesquisa independente do CLP com recorte municipal: avalia os municípios brasileiros em 3 dimensões, 13 pilares e 65 indicadores.',
    numbers: [{ value: '3', label: 'dimensões' }, { value: '13', label: 'pilares' }, { value: '65', label: 'indicadores' }],
    chipsLabel: 'Dimensões',
    chips: ['Instituições', 'Sociedade', 'Economia'].map((label) => ({ label })),
    source: 'Centro de Liderança Pública (CLP)',
    dashboardLabel: 'Ir para o painel CLP',
    moreLabel: 'Saiba mais sobre o CLP',
    moreHref: 'https://rankingdecompetitividade.org.br/',
  },
]

type AssistantTileTone = 'base' | 'dark' | 'faint'

const assistantTileColors: Record<AssistantTileTone, string> = {
  base: 'rgba(3, 78, 162, .8)',
  dark: 'rgba(6, 63, 125, .7)',
  faint: 'rgba(2, 62, 130, .2)',
}

/** Fileiras dos quadrados do assistente: duas no topo e uma encostada na base de 360px. */
const assistantTileRows = [0, 80, 280]

const assistantExtensionTiles = [
  ...Array.from({ length: 80 }, (_, index) => index - 80),
  ...Array.from({ length: 80 }, (_, index) => index + 18),
].flatMap((columnIndex) => assistantTileRows.flatMap((top, rowIndex) => {
  const variation = Math.abs((columnIndex * 5) + (rowIndex * 7) + (columnIndex * rowIndex * 3)) % 11
  if (variation > 2) return []

  const tone: AssistantTileTone = variation === 0 ? 'base' : variation === 1 ? 'dark' : 'faint'
  return [{ columnIndex, top, tone }]
}))

// Classes escritas por extenso: o Tailwind descarta da camada de componentes as que só aparecem montadas.
const chipClassNames = { blue: 'study-tag study-tag-blue', green: 'study-tag study-tag-green' }
const heroTileClassNames = { left: 'home-hero-tile home-hero-tile-left', right: 'home-hero-tile home-hero-tile-right' }

function Badge({ children, icon, iconWidth, tone = 'light' }: { children: React.ReactNode; icon: string; iconWidth: number; tone?: 'light' | 'dark' }) {
  return (
    <p className={tone === 'dark' ? 'home-badge home-badge-dark' : 'home-badge'}>
      <img alt="" aria-hidden="true" height="18" src={icon} width={iconWidth} />
      {children}
    </p>
  )
}

export function AboutPage({ chatOpen, onAssistantVisibilityChange, onNavigate, onOpenChat }: AboutPageProps) {
  const studiesRef = useRef<HTMLDivElement>(null)
  const studiesTitleRef = useRef<HTMLHeadingElement>(null)
  const [activeStudy, setActiveStudy] = useState(0)
  const assistantRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = assistantRef.current
    if (!section) return
    const observer = new IntersectionObserver(([entry]) => onAssistantVisibilityChange(entry.isIntersecting))
    observer.observe(section)
    return () => {
      observer.disconnect()
      onAssistantVisibilityChange(false)
    }
  }, [onAssistantVisibilityChange])

  const scrollToStudies = () => {
    const title = studiesTitleRef.current
    if (!title) return
    title.scrollIntoView({ behavior: 'smooth', block: 'start' })
    title.focus({ preventScroll: true })
  }

  const scrollToStudy = (index: number) => {
    const carousel = studiesRef.current
    const slide = carousel?.children.item(index) as HTMLElement | null
    if (!carousel || !slide) return
    carousel.scrollTo({ left: slide.offsetLeft - carousel.offsetLeft, behavior: 'smooth' })
  }

  const updateActiveStudy = () => {
    const carousel = studiesRef.current
    if (!carousel) return

    const carouselCenter = carousel.scrollLeft + carousel.clientWidth / 2
    const slides = Array.from(carousel.children) as HTMLElement[]
    const closestStudy = slides.reduce((closest, slide, index) => {
      const slideCenter = slide.offsetLeft - carousel.offsetLeft + slide.clientWidth / 2
      const distance = Math.abs(carouselCenter - slideCenter)
      return distance < closest.distance ? { index, distance } : closest
    }, { index: 0, distance: Number.POSITIVE_INFINITY })

    setActiveStudy(closestStudy.index)
  }

  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title" data-node-id="3019:1100">
        <div aria-hidden="true" className="home-hero-tiles">
          {heroTiles.map(({ side, offset, top, color }) => (
            <span
              className={heroTileClassNames[side]}
              key={`${side}-${offset}-${top}`}
              style={{
                backgroundColor: color,
                [side]: offset,
                ...(top >= 240 ? { bottom: 320 - top } : { top }),
              }}
            />
          ))}
        </div>

        <div className="home-hero-copy">
          <h1 id="home-title">
            <img alt="EvidencIA Inovação" height="84" src="/assets/hero-logo-evidencia.svg" width="317" />
          </h1>
          <p>
            Painel de evidências que acompanha o desempenho do Piauí nos índices de inovação e competitividade,
            reunindo dados do IBID e do CLP para comparar estados, regiões e municípios. Ficou com dúvida?
            O <strong>Edson</strong>, nosso assistente, explica os índices em linguagem simples.
          </p>
          <div className="home-hero-actions">
            <button className="home-hero-action-primary" onClick={scrollToStudies} type="button">
              Explorar os índices
            </button>
            <button
              aria-controls="edson-chat"
              aria-expanded={chatOpen}
              aria-haspopup="dialog"
              className="home-hero-action-secondary"
              onClick={(event) => onOpenChat(event.currentTarget)}
              type="button"
            >
              Converse com o Edson
            </button>
          </div>
        </div>

        <div aria-hidden="true" className="home-hero-graphics" data-node-id="3019:1139">
          <img alt="" className="home-hero-accent-circle" height="64" src="/assets/hero-accent-circle.svg" width="64" />
          <img alt="" className="home-hero-accent-light" height="14" src="/assets/hero-accent-dot-light.svg" width="14" />
          <img alt="" className="home-hero-accent-dark" height="10" src="/assets/hero-accent-dot-dark.svg" width="10" />

          <div className="hero-card hero-card-map">
            <strong>Mapa do Brasil por nota</strong>
            <span className="hero-card-caption">Nota geral por estado</span>
            <img alt="" className="hero-map" height="205" src="/assets/hero-brazil-map.svg" width="200" />
            <div className="hero-map-legend">
              {mapLegendColors.map((color) => <span key={color} style={{ backgroundColor: color }} />)}
              menor → maior nota
            </div>
            <span className="hero-map-tag">
              <img alt="" height="6" src="/assets/hero-selected-dot.svg" width="6" />
              Estado selecionado
            </span>
          </div>

          <div className="hero-card hero-card-glass hero-card-ranking">
            <strong>Posição no ranking</strong>
            <span className="hero-card-caption">Nacional e regional, ano a ano</span>
            <span className="hero-ranking-badge">
              <img alt="" height="10" src="/assets/hero-ranking-icon.svg" width="10" />
              Ranking
            </span>
            <img alt="" className="hero-ranking-line" height="64" src="/assets/hero-ranking-line.svg" width="196" />
          </div>

          <div className="hero-card hero-card-glass hero-card-history">
            <strong>Série histórica</strong>
            <div className="hero-history-legend">
              {historyLegend.map(({ label, color }) => (
                <span key={label}><i style={{ backgroundColor: color }} />{label}</span>
              ))}
            </div>
            <img alt="" className="hero-history-lines" height="48" src="/assets/hero-history-lines.svg" width="150" />
          </div>

          <div className="hero-card hero-card-pillars">
            <strong>Evolução por pilar</strong>
            <span className="hero-card-caption">Posição de cada pilar ao longo dos anos</span>
            <div className="hero-pillar-grid">
              {pillarHeatmap.map(({ label, cells }) => (
                <div className="hero-pillar-row" key={label}>
                  <span>{label}</span>
                  {cells.map((color, index) => <i key={index} style={{ backgroundColor: color }} />)}
                </div>
              ))}
            </div>
          </div>

          <div className="hero-ranking-pill">
            <img alt="" height="28" src="/assets/hero-trend-icon.svg" width="28" />
            <span>
              <strong>Posições no ranking</strong>
              Nacional e regional, por pilar
            </span>
          </div>
        </div>
      </section>

      <section className="home-purpose" aria-labelledby="purpose-title" data-node-id="3019:1346">
        <div className="home-purpose-content">
          <div aria-hidden="true" className="home-purpose-art">
            <img alt="" className="purpose-photo" height="484" loading="lazy" src="/assets/purpose-photo.png" width="424" />
            <div className="purpose-photo-blur">
              <img alt="" height="428" loading="lazy" src="/assets/purpose-photo-blur.png" width="368" />
            </div>
            <img alt="" className="purpose-photo-border" height="420" src="/assets/purpose-photo-border.svg" width="360" />
            {purposePixelsBehind.map(({ left, top, color }) => (
              <span className="purpose-pixel" key={`${left}-${top}`} style={{ left, top, backgroundColor: color }} />
            ))}
            <div className="purpose-people">
              <img alt="" height="347" loading="lazy" src="/assets/purpose-people.png" width="520" />
            </div>
            {purposePixelsFront.map(({ left, top, color }) => (
              <span className="purpose-pixel" key={`${left}-${top}`} style={{ left, top, backgroundColor: color }} />
            ))}
            <div className="purpose-ranking-card">
              <strong>Evolução no ranking</strong>
              <span>Ano a ano, por estado</span>
              <img alt="" height="46" src="/assets/purpose-ranking-line.svg" width="172" />
            </div>
            <div className="purpose-seal">
              <img alt="" height="67.76" src="/assets/purpose-isotipo.svg" width="51" />
            </div>
          </div>

          <div className="home-purpose-text">
            <Badge icon="/assets/badge-isotipo-purpose.svg" iconWidth={13}>Propósito do painel</Badge>
            <h2 id="purpose-title">
              Acompanhar, de forma contínua e comparável, a posição do Piauí nos principais índices de{' '}
              <span>inovação</span> e <span>competitividade</span> do país.
            </h2>
            <p className="home-purpose-description">
              Dois estudos independentes, lidos lado a lado, para mostrar onde o estado avança, onde perde posição e
              como se compara ao Brasil e à sua região.
            </p>
            <ul className="home-purpose-highlights">
              {purposeHighlights.map(({ title, icon, text }) => (
                <li key={title}>
                  <span className="home-purpose-icon">
                    <img alt="" aria-hidden="true" height="22" src={icon} width="22" />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text.map((line, index) => <span key={index}>{line}</span>)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="home-studies" aria-labelledby="studies-title" data-node-id="3019:1598">
        <div aria-hidden="true" className="home-studies-decoration">
          <span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
        </div>
        <div className="home-studies-inner">
          <header className="home-studies-heading">
            <Badge icon="/assets/badge-isotipo-indices.svg" iconWidth={12}>Índices</Badge>
            <h2 id="studies-title" ref={studiesTitleRef} tabIndex={-1}>Dois estudos, três rankings para acompanhar o Piauí</h2>
            <p>Estrutura hierárquica de cada estudo, conforme metodologia divulgada por cada instituição responsável.</p>
          </header>

          <div
            aria-label="Estudos disponíveis"
            className="home-study-grid"
            onScroll={updateActiveStudy}
            ref={studiesRef}
            role="region"
            tabIndex={0}
          >
            {studyCards.map((card) => (
              <article className="home-study-card" key={card.id}>
                <div className="home-study-card-content">
                  <div className="home-study-card-top">
                    <span className="home-study-logo">
                      <img alt={card.logo.alt} height={card.logo.height} src={card.logo.src} width={card.logo.width} />
                    </span>
                    <span className="home-study-scope">{card.scope}</span>
                  </div>
                  <header className="home-study-card-title">
                    <h3>{card.title}</h3>
                    <p>{card.subtitle}</p>
                  </header>
                  <p className="home-study-description">{card.description}</p>
                  <dl className="home-study-numbers">
                    {card.numbers.map(({ value, label }) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {card.id === 'ibid' && (
                    <div className="home-study-groups">
                      <p>2 grupos</p>
                      <div>
                        <span className="study-legend-item study-legend-blue">
                          <img alt="" aria-hidden="true" height="6" src="/assets/study-dot-context.svg" width="6" />
                          Contexto
                        </span>
                        <span className="study-legend-item study-legend-green">
                          <img alt="" aria-hidden="true" height="6" src="/assets/study-dot-result.svg" width="6" />
                          Resultado
                        </span>
                      </div>
                      <small>As cores dos pilares indicam o grupo.</small>
                    </div>
                  )}
                  <p className="home-study-chips-label">{card.chipsLabel}</p>
                  <ul className={card.id === 'ibid' ? 'home-study-chips home-study-chips-wide' : 'home-study-chips'}>
                    {card.chips.map(({ label, tone }) => (
                      <li className={tone ? chipClassNames[tone] : 'study-tag'} key={label}>{label}</li>
                    ))}
                  </ul>
                  <div className="home-study-meta">
                    <p><strong>Fonte: </strong>{card.source}</p>
                    <p><strong>Período: </strong>2015 - 2025</p>
                    <p><strong>Atualização: </strong>Anual</p>
                  </div>
                </div>
                <div className="home-study-actions">
                  <button className="home-study-dashboard-link" onClick={() => onNavigate(card.page)} type="button">
                    {card.dashboardLabel}
                    <img alt="" aria-hidden="true" height="18" src="/assets/study-button-arrow.svg" width="18" />
                  </button>
                  <a className="study-external-link" href={card.moreHref} rel="noreferrer" target="_blank">
                    {card.moreLabel}
                    <img alt="" aria-hidden="true" height="12" src="/assets/external-link.svg" width="12" />
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div aria-label="Navegação dos estudos" className="home-carousel-controls">
            <button
              aria-label="Ver estudo anterior"
              disabled={activeStudy === 0}
              onClick={() => scrollToStudy(activeStudy - 1)}
              type="button"
            >
              <span aria-hidden="true">←</span>
            </button>
            <div>
              {studyCards.map((card, index) => (
                <button
                  aria-label={`Ir para o estudo ${card.title}`}
                  aria-current={activeStudy === index ? 'true' : undefined}
                  className={activeStudy === index ? 'home-carousel-dot home-carousel-dot-active' : 'home-carousel-dot'}
                  key={card.id}
                  onClick={() => scrollToStudy(index)}
                  type="button"
                />
              ))}
            </div>
            <span aria-live="polite" className="sr-only">Estudo {activeStudy + 1} de {studyCards.length}</span>
            <button
              aria-label="Ver próximo estudo"
              disabled={activeStudy === studyCards.length - 1}
              onClick={() => scrollToStudy(activeStudy + 1)}
              type="button"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      <section className="home-assistant" aria-labelledby="assistant-title" data-node-id="3019:1960" ref={assistantRef}>
        <div aria-hidden="true" className="home-assistant-grid">
          <span /><span /><span /><span /><span /><span /><span /><span />
          {assistantExtensionTiles.map(({ columnIndex, top, tone }) => (
            <span
              className="home-assistant-extension-tile"
              key={`${columnIndex}-${top}`}
              style={{
                backgroundColor: assistantTileColors[tone],
                borderColor: tone === 'dark' ? 'rgba(222, 240, 255, .35)' : 'rgba(222, 230, 255, .35)',
                left: `calc(50% - 720px + ${columnIndex * 80}px)`,
                top,
              }}
            />
          ))}
        </div>
        <div className="home-assistant-inner">
          <div className="home-assistant-copy">
            <div>
              <Badge icon="/assets/badge-isotipo-assistant.svg" iconWidth={13} tone="dark">Assistente do painel</Badge>
              <h2 id="assistant-title">Converse com o <span>Edson</span></h2>
              <p>
                Nosso assistente conhece os dois estudos e responde suas perguntas sobre índices, metodologias, comparações
                entre estados e regiões, pilares, dimensões e indicadores do IBID e CLP em linguagem simples
              </p>
            </div>
            <button aria-controls="edson-chat" aria-expanded={chatOpen} aria-haspopup="dialog" onClick={(event) => onOpenChat(event.currentTarget)} type="button">
              Converse com o assistente Edson
            </button>
          </div>
          <img
            alt="Visualização abstrata do assistente Edson"
            className="home-assistant-art"
            height="224"
            src="/assets/assistant-edson.png"
            width="232"
          />
        </div>
      </section>
    </main>
  )
}
