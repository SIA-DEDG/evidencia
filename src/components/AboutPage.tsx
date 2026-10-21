import { useEffect, useRef, useState } from 'react'

interface AboutPageProps {
  chatOpen: boolean
  onAssistantVisibilityChange: (visible: boolean) => void
  onNavigate: (page: 'ibid' | 'clp-estados') => void
  onOpenChat: (trigger: HTMLButtonElement) => void
}

const ibidPillars = [
  { label: 'Economia', tone: 'blue' },
  { label: 'Instituições', tone: 'blue' },
  { label: 'Capital Humano', tone: 'blue' },
  { label: 'Infraestrutura', tone: 'blue' },
  { label: 'Negócios', tone: 'blue' },
  { label: 'Economia Criativa', tone: 'green' },
  { label: 'Conhecimento e Tecnologia', tone: 'green' },
] as const

const statePillars = [
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
  'Ranking Geral',
]

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

/** Vértices da linha do cartão "Série histórica", relativos ao cartão. */
const historyPoints = [
  [17.3, 81.1],
  [30.1, 57.9],
  [42.9, 71.1],
  [55.8, 103.2],
  [68.4, 76.6],
  [81.2, 82.3],
  [94.1, 90.1],
  [106.9, 74.5],
  [119.5, 90.1],
  [132.4, 58.8],
] as const

const purposeHighlights = [
  {
    title: 'Dois estudos',
    icon: '/assets/purpose-studies.svg',
    text: 'IBID (INPI) e CLP avaliam os estados sob óticas complementares: instituições, capital humano, infraestrutura, economia, negócios e conhecimento.',
  },
  {
    title: 'Comparação livre',
    icon: '/assets/purpose-comparison.svg',
    text: 'Escolha qualquer estado e compare com outro estado e com a média da sua região — em ranking, pontuação, série histórica, pilar, dimensão e indicador.',
  },
  {
    title: 'Cobertura',
    icon: '/assets/purpose-coverage.svg',
    text: '27 unidades federativas + 5 regiões. Recorte municipal na base CLP. Série histórica: IBID 2015 e 2025 · CLP 2015–2025.',
  },
]

type AssistantTileTone = 'base' | 'dark' | 'faint'

const assistantTileColors: Record<AssistantTileTone, string> = {
  base: 'rgba(3, 78, 162, .8)',
  dark: 'rgba(6, 63, 125, .7)',
  faint: 'rgba(2, 62, 130, .2)',
}

const assistantExtensionTiles = [
  ...Array.from({ length: 80 }, (_, index) => index - 80),
  ...Array.from({ length: 80 }, (_, index) => index + 18),
].flatMap((columnIndex) => Array.from({ length: 3 }).flatMap((_, rowIndex) => {
  const variation = Math.abs((columnIndex * 5) + (rowIndex * 7) + (columnIndex * rowIndex * 3)) % 11
  if (variation > 2) return []

  const tone: AssistantTileTone = variation === 0 ? 'base' : variation === 1 ? 'dark' : 'faint'
  return [{ columnIndex, rowIndex, tone }]
}))

function Definition({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="study-definition">
      <strong>{label}: </strong>
      <span>{children}</span>
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
    carousel.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
  }

  const updateActiveStudy = () => {
    const carousel = studiesRef.current
    if (!carousel) return

    const carouselCenter = carousel.scrollLeft + carousel.clientWidth / 2
    const slides = Array.from(carousel.children) as HTMLElement[]
    const closestStudy = slides.reduce((closest, slide, index) => {
      const slideCenter = slide.offsetLeft + slide.clientWidth / 2
      const distance = Math.abs(carouselCenter - slideCenter)
      return distance < closest.distance ? { index, distance } : closest
    }, { index: 0, distance: Number.POSITIVE_INFINITY })

    setActiveStudy(closestStudy.index)
  }

  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title" data-node-id="2568:2236">
        <div aria-hidden="true" className="home-hero-tiles">
          {heroTiles.map(({ side, offset, top, color }) => (
            <span
              className={`home-hero-tile home-hero-tile-${side}`}
              key={`${side}-${offset}-${top}`}
              style={{
                backgroundColor: color,
                [side]: offset,
                ...(top >= 240 ? { bottom: 320 - top } : { top }),
              }}
            />
          ))}
        </div>

        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <h1 id="home-title">Evidenc<span>IA</span> Inovação</h1>
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

          <div aria-hidden="true" className="home-hero-visuals">
            <img
              className="home-hero-illustration"
              height="288"
              src="/assets/home-hero-illustration.svg"
              width="211"
            />
            <div className="home-history-card">
              <strong>Série histórica</strong>
              <span className="home-history-badge">
                <img alt="" height="9" src="/assets/home-history-calendar.svg" width="9" />
                Atualização anual
              </span>
              <img alt="" className="home-history-line" height="47" src="/assets/home-history-chart.svg" width="117" />
              {historyPoints.map(([left, top]) => (
                <img
                  alt=""
                  className="home-history-point"
                  height="4.3"
                  key={left}
                  src="/assets/home-history-point.svg"
                  style={{ left, top }}
                  width="4.3"
                />
              ))}
              <span className="home-history-year home-history-year-start">2015</span>
              <span className="home-history-year home-history-year-end">2026</span>
            </div>
            <div className="home-ranking-card">
              <strong>Ranking nacional<br />e regional</strong>
              <div className="home-ranking-chart">
                <img alt="" height="45" src="/assets/home-ranking-chart.svg" width="68" />
                <span className="rank-first">1º</span>
                <span className="rank-second">2º</span>
                <span className="rank-third">3º</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-purpose" aria-labelledby="purpose-title" data-node-id="2568:2395">
        <header className="home-purpose-heading">
          <p>Propósito do painel</p>
          <h2 id="purpose-title">
            Acompanhar, de forma contínua e comparável, a posição do Piauí nos principais índices de{' '}
            <span>inovação</span> e <span>competitividade</span> do país.
          </h2>
          <p>
            Dois estudos independentes, lidos lado a lado, para mostrar onde o estado avança, onde perde posição e como
            se compara ao Brasil e à sua região.
          </p>
        </header>

        <ul className="home-purpose-highlights">
          {purposeHighlights.map(({ title, icon, text }) => (
            <li key={title}>
              <span aria-hidden="true" className="home-purpose-tiles">
                <span /><span /><span /><span /><span /><span /><span /><span />
              </span>
              <span className="home-purpose-icon">
                <img alt="" aria-hidden="true" height="22" src={icon} width="22" />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-studies" aria-labelledby="studies-title" data-node-id="2568:2463">
        <div aria-hidden="true" className="home-studies-decoration">
          <span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
        </div>
        <div className="home-studies-inner">
          <header className="home-studies-heading">
            <h2 id="studies-title" ref={studiesTitleRef} tabIndex={-1}>Índices</h2>
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
            <article className="home-study-card home-study-card-ibid" data-node-id="2568:2469">
              <header className="home-study-card-header">
                <button className="home-study-title" onClick={() => onNavigate('ibid')} type="button">
                  <strong>IBID</strong>
                  <span>Índice Brasil de Inovação e Desenvolvimento</span>
                </button>
                <img alt="Marca IBID" height="49" src="/assets/ibid.png" width="74" />
              </header>

              <div className="home-study-card-body">
                <p className="study-description">
                  Publicado pelo INPI com metodologia inspirada do Índice Global de Inovação (IGI), da Organização Mundial
                  da Propriedade Intelectual (OMPI). Nota geral única, dividida em 2 grupos, 7 pilares e 21 dimensões, a partir
                  de 80 indicadores estatísticos.
                </p>
                <Definition label="Geral">Nota IBID</Definition>
                <div className="study-inline-row">
                  <Definition label="Grupo">2 grupos</Definition>
                  <span className="study-legend-item study-legend-blue">
                    <img alt="" aria-hidden="true" height="6" src="/assets/study-dot-context.svg" width="6" />
                    Contexto
                  </span>
                  <span className="study-legend-item study-legend-green">
                    <img alt="" aria-hidden="true" height="6" src="/assets/study-dot-result.svg" width="6" />
                    Resultado
                  </span>
                </div>
                <div className="study-detail-group">
                  <Definition label="Pilar">7 pilares</Definition>
                  <div className="study-tags">
                    {ibidPillars.map((pillar) => (
                      <span className={`study-tag study-tag-${pillar.tone}`} key={pillar.label}>{pillar.label}</span>
                    ))}
                  </div>
                </div>
                <Definition label="Dimensão">21 dimensões, 3 dimensões para cada pilar</Definition>
                <Definition label="Indicador">80 indicadores</Definition>
                <img alt="" aria-hidden="true" className="study-divider" height="1" src="/assets/study-divider.svg" width="294" />
                <Definition label="Fonte">INPI – Coordenação-Geral de Economia e Inovação</Definition>
                <Definition label="Período">2015 - 2025</Definition>
                <Definition label="Recorte">Estados</Definition>
                <Definition label="Atualização">Anual</Definition>
                <button className="home-study-dashboard-link" onClick={() => onNavigate('ibid')} type="button">
                  Ir para o painel IBID
                  <img alt="" aria-hidden="true" height="18" src="/assets/study-button-arrow.svg" width="18" />
                </button>
                <a
                  className="study-external-link"
                  href="https://www.gov.br/inpi/pt-br/inpi-data/indice-brasil-de-inovacao-e-desenvolvimento-ibid"
                  rel="noreferrer"
                  target="_blank"
                >
                  Saiba mais sobre o IBID
                  <img alt="" aria-hidden="true" height="12" src="/assets/external-link.svg" width="12" />
                </a>
              </div>
            </article>

            <article className="home-study-card home-study-card-clp" data-node-id="2568:2516">
              <header className="home-study-card-header">
                <button className="home-study-title" onClick={() => onNavigate('clp-estados')} type="button">
                  <strong>CLP</strong>
                  <span>Centro de Liderança Pública - Ranking de Competitividade e os recortes de ESG e ODS</span>
                </button>
                <img alt="Marca CLP" height="33" src="/assets/clp.png" width="93" />
              </header>

              <div className="home-study-card-body">
                <p className="study-description">
                  O Ranking de Competitividade é formado por duas pesquisas independentes: uma avalia os estados brasileiros,
                  a outra avalia os municípios.
                </p>
                <h3>Ranking de Competitividade dos Estados</h3>
                <div className="study-subsection">
                  <Definition label="Geral">Nota Geral</Definition>
                  <div className="study-detail-group">
                    <Definition label="Pilar">10 pilares</Definition>
                    <div className="study-tags study-tags-gray">
                      {statePillars.map((pillar) => <span className="study-tag" key={pillar}>{pillar}</span>)}
                    </div>
                  </div>
                  <Definition label="Indicador">90 indicadores</Definition>
                </div>
                <h3>Ranking de Competitividade dos Municípios</h3>
                <div className="study-subsection">
                  <Definition label="Geral">Nota Geral</Definition>
                  <div className="study-detail-group">
                    <Definition label="Dimensão">3 Dimensões</Definition>
                    <div className="study-tags study-tags-gray">
                      {['Instituições', 'Sociedade', 'Economia'].map((dimension) => (
                        <span className="study-tag" key={dimension}>{dimension}</span>
                      ))}
                    </div>
                  </div>
                  <Definition label="Pilar">13 pilares</Definition>
                  <Definition label="Indicador">65 indicadores</Definition>
                </div>
                <img alt="" aria-hidden="true" className="study-divider" height="1" src="/assets/study-divider.svg" width="294" />
                <Definition label="Fonte">Centro de Liderança Pública (CLP)</Definition>
                <Definition label="Período">2015 - 2025</Definition>
                <Definition label="Recorte">Estados e Municípios</Definition>
                <Definition label="Atualização">Anual</Definition>
                <button className="home-study-dashboard-link" onClick={() => onNavigate('clp-estados')} type="button">
                  Ir para o painel CLP
                  <img alt="" aria-hidden="true" height="18" src="/assets/study-button-arrow.svg" width="18" />
                </button>
                <a
                  className="study-external-link"
                  href="https://rankingdecompetitividade.org.br/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Saiba mais sobre o CLP
                  <img alt="" aria-hidden="true" height="12" src="/assets/external-link.svg" width="12" />
                </a>
              </div>
            </article>
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
              {[0, 1].map((index) => (
                <button
                  aria-label={`Ir para o estudo ${index + 1}`}
                  aria-current={activeStudy === index ? 'true' : undefined}
                  className={activeStudy === index ? 'home-carousel-dot home-carousel-dot-active' : 'home-carousel-dot'}
                  key={index}
                  onClick={() => scrollToStudy(index)}
                  type="button"
                />
              ))}
            </div>
            <span aria-live="polite" className="sr-only">Estudo {activeStudy + 1} de 2</span>
            <button
              aria-label="Ver próximo estudo"
              disabled={activeStudy === 1}
              onClick={() => scrollToStudy(activeStudy + 1)}
              type="button"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      <section className="home-assistant" aria-labelledby="assistant-title" data-node-id="2568:2593" ref={assistantRef}>
        <div aria-hidden="true" className="home-assistant-grid">
          <span /><span /><span /><span /><span /><span /><span /><span />
          {assistantExtensionTiles.map(({ columnIndex, rowIndex, tone }) => (
            <span
              className="home-assistant-extension-tile"
              key={`${columnIndex}-${rowIndex}`}
              style={{
                backgroundColor: assistantTileColors[tone],
                borderColor: tone === 'dark' ? 'rgba(222, 240, 255, .35)' : 'rgba(222, 230, 255, .35)',
                height: rowIndex === 2 ? 65 : 80,
                left: `calc(50% - 720px + ${columnIndex * 80}px)`,
                top: rowIndex * 80,
              }}
            />
          ))}
        </div>
        <div className="home-assistant-inner">
          <div className="home-assistant-copy">
            <div>
              <p className="home-assistant-eyebrow">
                <img alt="" aria-hidden="true" height="16" src="/assets/assistant-insights.svg" width="16" />
                Assistente do painel
              </p>
              <h2 id="assistant-title">Converse com o <span>Edson</span></h2>
              <p>
                Nosso assistente conhece os dois estudos e responde suas perguntas sobre índices, metodologias, comparações
                entre estados e regiões, pilares, dimensões e indicadores do IBID e CLP em linguagem simples
              </p>
            </div>
            <button aria-controls="edson-chat" aria-expanded={chatOpen} aria-haspopup="dialog" onClick={(event) => onOpenChat(event.currentTarget)} type="button">
              Converse com o assistente Edson
              <img alt="" aria-hidden="true" height="16" src="/assets/assistant-arrow.svg" width="16" />
            </button>
          </div>
          <img
            alt="Visualização abstrata do assistente Edson"
            className="home-assistant-art"
            height="185"
            src="/assets/assistant-edson.png"
            width="192"
          />
        </div>
      </section>
    </main>
  )
}
