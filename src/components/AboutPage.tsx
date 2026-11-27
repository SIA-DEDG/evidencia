import { useRef, useState } from 'react'
import { HomeAssistantV3 } from './HomeAssistantV3'
import { HomeNewsV3 } from './HomeNewsV3'
import { HomeV3Intro } from './HomeV3Intro'

type StudyPage = 'ibid' | 'clp-estados' | 'clp-municipios'

interface AboutPageProps {
  onNavigate: (page: StudyPage) => void
}

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
  period: string
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
    source: 'INPI, Coordenação-Geral de Economia e Inovação',
    period: '2015 - 2025',
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
    period: '2015 - 2025',
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
    period: '2015 - 2025',
    dashboardLabel: 'Ir para o painel CLP',
    moreLabel: 'Saiba mais sobre o CLP',
    moreHref: 'https://rankingdecompetitividade.org.br/',
  },
]

// Classes escritas por extenso: o Tailwind descarta da camada de componentes as que só aparecem montadas.
const chipClassNames = { blue: 'study-tag study-tag-blue', green: 'study-tag study-tag-green' }

function Badge({ children, icon, iconWidth }: { children: React.ReactNode; icon: string; iconWidth: number }) {
  return (
    <p className="home-badge">
      <img alt="" aria-hidden="true" height="18" src={icon} width={iconWidth} />
      {children}
    </p>
  )
}

export function AboutPage({ onNavigate }: AboutPageProps) {
  const studiesRef = useRef<HTMLDivElement>(null)
  const studiesTitleRef = useRef<HTMLHeadingElement>(null)
  const [activeStudy, setActiveStudy] = useState(0)

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
      <HomeV3Intro onExplore={scrollToStudies} />

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
                      <p>Grupos</p>
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
                  <ul className="home-study-chips">
                    {card.chips.map(({ label, tone }) => (
                      <li className={tone ? chipClassNames[tone] : 'study-tag'} key={label}>{label}</li>
                    ))}
                  </ul>
                  <div className="home-study-meta">
                    <p><strong>Fonte: </strong>{card.source}</p>
                    <p><strong>Período: </strong>{card.period}</p>
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

      <HomeAssistantV3 />
      <HomeNewsV3 />
    </main>
  )
}
