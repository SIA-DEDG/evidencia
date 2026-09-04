import { useRef, useState } from 'react'
import { ArrowRight, Construction, ExternalLink } from 'lucide-react'

interface AboutPageProps {
  onNavigate: (page: 'ibid' | 'clp-estados') => void
}

export function AboutPage({ onNavigate }: AboutPageProps) {
  const studiesRef = useRef<HTMLDivElement>(null)
  const [activeStudy, setActiveStudy] = useState(0)
  const studyCount = 2

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
    <main className="page-shell">
      <section className="purpose-card">
        <p className="text-[11px] font-medium uppercase tracking-wide text-blue-100">Propósito do painel</p>
        <h1 className="mt-[14px] max-w-[651px] text-[24px] font-semibold leading-[29px] text-white">
          Acompanhar, de forma contínua e comparável, a posição do Piauí nos principais índices de inovação e competitividade do país.
        </h1>
        <p className="mt-[14px] max-w-[947px] text-[13px] leading-[17px] text-blue-100">
          Este painel reúne dois estudos independentes — IBID e CLP — que avaliam estados e municípios brasileiros sob óticas complementares: instituições, capital humano, infraestrutura, economia, negócios, conhecimento e competitividade. Em cada aba é possível escolher um território, compará-lo com outro e acompanhar sua posição no Brasil e em seu recorte regional.
        </p>
        <div className="mt-[14px] flex flex-wrap gap-x-[10px] gap-y-2 text-[11px] leading-[15px] text-blue-100">
          <span className="before:mr-2 before:text-blue-300 before:content-['•']">27 unidades federativas + 5 regiões</span>
          <span className="before:mr-2 before:text-blue-300 before:content-['•']">Recorte municipal: disponível na base CLP</span>
          <span className="before:mr-2 before:text-blue-300 before:content-['•']">Séries históricas conforme a disponibilidade de cada pesquisa</span>
        </div>
      </section>

      <aside aria-labelledby="development-notice-title" className="development-notice">
        <Construction aria-hidden="true" className="shrink-0" size={20} />
        <div>
          <h2 id="development-notice-title">Painel em desenvolvimento</h2>
          <p>Esta é uma versão em evolução. Novos dados e funcionalidades serão adicionados, e elementos visuais e fluxos de navegação poderão mudar.</p>
        </div>
      </aside>

      <section className="mt-5">
        <h2 className="text-[24px] font-semibold leading-6 text-brand-700 dark:text-blue-200">Os dois índices</h2>
        <p className="mt-[10px] text-[13px] leading-[17px] text-ink dark:text-slate-300">
          Estrutura hierárquica de cada estudo, conforme metodologia divulgada por cada instituição responsável.
        </p>

        <div
          aria-label="Estudos disponíveis"
          className="about-study-grid about-study-grid-two mx-auto mt-5"
          onScroll={updateActiveStudy}
          ref={studiesRef}
          role="region"
          tabIndex={0}
        >
          <article className="study-card">
            <header className="flex min-h-[66px] items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-brand-700 dark:text-blue-200">IBID</h3>
                <p className="mt-1 text-xs text-brand-700 dark:text-blue-200">Índice Brasil de Inovação e Desenvolvimento</p>
              </div>
              <img alt="Marca IBID" className="h-[50px] w-[105px] object-contain object-right" src="/assets/ibid.png" />
            </header>
            <p className="mt-4 text-sm leading-relaxed text-muted dark:text-slate-300">
              Publicado pelo INPI com metodologia inspirada no Global Innovation Index (OMPI). Nota geral única, dividida em 2 grupos, 7 pilares e 21 dimensões, a partir de 80 indicadores estatísticos.
            </p>
            <dl className="mt-4 space-y-3 text-xs text-muted dark:text-slate-300">
              <div><dt className="inline font-semibold">Geral: </dt><dd className="inline">Nota IBID</dd></div>
              <div><dt className="inline font-semibold">Grupo: </dt><dd className="inline">2 grupos</dd></div>
              <div><dt className="inline font-semibold">Pilar: </dt><dd className="inline">7 pilares</dd></div>
              <div><dt className="inline font-semibold">Dimensão: </dt><dd className="inline">21 dimensões</dd></div>
              <div><dt className="inline font-semibold">Indicador: </dt><dd className="inline">80 indicadores</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="tag tag-blue">Contexto</span><span className="tag tag-blue">Resultado</span>
              <span className="tag tag-blue">Economia</span><span className="tag tag-blue">Instituições</span>
              <span className="tag tag-blue">Capital Humano</span><span className="tag tag-blue">Infraestrutura</span>
              <span className="tag tag-blue">Negócios</span><span className="tag tag-blue">Economia Criativa</span>
              <span className="tag tag-blue">Conhecimento e Tecnologia</span>
            </div>
            <dl className="mt-5 space-y-3 border-t border-dashed border-[#bfd0e0] pt-4 text-xs text-muted dark:border-slate-600 dark:text-slate-300">
              <div><dt className="inline font-semibold">Fonte: </dt><dd className="inline">INPI – Coordenação-Geral de Economia e Inovação</dd></div>
              <div><dt className="inline font-semibold">Período: </dt><dd className="inline">2014 - 2025</dd></div>
              <div><dt className="inline font-semibold">Atualização: </dt><dd className="inline">Anual</dd></div>
            </dl>
            <div className="study-card-actions">
              <button className="study-card-primary-action" onClick={() => onNavigate('ibid')} type="button">
                Ir para o painel IBID <ArrowRight aria-hidden="true" size={16} />
              </button>
              <a
                className="study-card-secondary-action"
                href="https://www.gov.br/inpi/pt-br/inpi-data/indice-brasil-de-inovacao-e-desenvolvimento-ibid"
                rel="noreferrer"
                target="_blank"
              >
                Saiba mais no site do IBID <ExternalLink aria-hidden="true" size={13} />
              </a>
            </div>
          </article>

          <article className="study-card">
            <header className="flex min-h-[66px] items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-brand-700 dark:text-blue-200">CLP</h3>
                <p className="mt-1 text-xs text-brand-700 dark:text-blue-200">Ranking de Competitividade – Centro de Liderança Pública</p>
              </div>
              <img alt="Marca CLP" className="h-[50px] w-[105px] object-contain object-right" src="/assets/clp.png" />
            </header>
            <p className="mt-4 text-sm leading-relaxed text-muted dark:text-slate-300">
              O ranking compara a competitividade dos estados e municípios brasileiros com indicadores normalizados e organizados em pilares temáticos.
            </p>
            <dl className="mt-4 space-y-3 text-xs text-muted dark:text-slate-300">
              <div><dt className="inline font-semibold">Geral: </dt><dd className="inline">Nota Geral</dd></div>
              <div><dt className="inline font-semibold">Pilar: </dt><dd className="inline">10 pilares</dd></div>
              <div><dt className="inline font-semibold">Indicador: </dt><dd className="inline">100 estaduais e 65 municipais</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="tag tag-gray">Sustentabilidade Ambiental</span><span className="tag tag-gray">Capital Humano</span>
              <span className="tag tag-gray">Educação</span><span className="tag tag-gray">Eficiência da Máquina Pública</span>
              <span className="tag tag-gray">Infraestrutura</span><span className="tag tag-gray">Inovação</span>
              <span className="tag tag-gray">Potencial de Mercado</span><span className="tag tag-gray">Solidez Fiscal</span>
              <span className="tag tag-gray">Segurança Pública</span><span className="tag tag-gray">Sustentabilidade Social</span>
            </div>
            <dl className="mt-5 space-y-3 border-t border-dashed border-[#bfd0e0] pt-4 text-xs text-muted dark:border-slate-600 dark:text-slate-300">
              <div><dt className="inline font-semibold">Fonte: </dt><dd className="inline">Centro de Liderança Pública (CLP)</dd></div>
              <div><dt className="inline font-semibold">Período: </dt><dd className="inline">2015 - 2026 (estados)</dd></div>
              <div><dt className="inline font-semibold">Recorte: </dt><dd className="inline">Estados e Municípios</dd></div>
              <div><dt className="inline font-semibold">Atualização: </dt><dd className="inline">Anual</dd></div>
            </dl>
            <div className="study-card-actions">
              <button className="study-card-primary-action" onClick={() => onNavigate('clp-estados')} type="button">
                Ir para o painel CLP <ArrowRight aria-hidden="true" size={16} />
              </button>
              <a
                className="study-card-secondary-action"
                href="https://rankingdecompetitividade.org.br/eleicoes/"
                rel="noreferrer"
                target="_blank"
              >
                Saiba mais no site do CLP <ExternalLink aria-hidden="true" size={13} />
              </a>
            </div>
          </article>

        </div>
        <div aria-label="Navegação dos estudos" className="about-carousel-controls sm:hidden">
          <button
            aria-label="Ver estudo anterior"
            className="about-carousel-arrow"
            disabled={activeStudy === 0}
            onClick={() => scrollToStudy(activeStudy - 1)}
            type="button"
          >
            <span aria-hidden="true">←</span>
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: studyCount }, (_, index) => (
              <button
                aria-label={`Ir para o estudo ${index + 1}`}
                aria-current={activeStudy === index ? 'true' : undefined}
                className={activeStudy === index ? 'about-carousel-dot about-carousel-dot-active' : 'about-carousel-dot'}
                key={index}
                onClick={() => scrollToStudy(index)}
                type="button"
              />
            ))}
          </div>
          <span aria-live="polite" className="sr-only">Estudo {activeStudy + 1} de {studyCount}</span>
          <button
            aria-label="Ver próximo estudo"
            className="about-carousel-arrow"
            disabled={activeStudy === studyCount - 1}
            onClick={() => scrollToStudy(activeStudy + 1)}
            type="button"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  )
}
