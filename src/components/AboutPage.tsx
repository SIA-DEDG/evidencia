import { ExternalLink } from 'lucide-react'

export function AboutPage() {
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

      <section className="mt-5">
        <h2 className="text-[24px] font-semibold leading-6 text-brand-700 dark:text-blue-200">Os dois índices</h2>
        <p className="mt-[10px] text-[13px] leading-[17px] text-ink dark:text-slate-300">
          Estrutura hierárquica de cada estudo, conforme metodologia divulgada por cada instituição responsável.
        </p>

        <div className="about-study-grid about-study-grid-two mx-auto mt-5">
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
            <button className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-300" type="button" onClick={() => window.open('https://www.gov.br/inpi/pt-br/inpi-data/indice-brasil-de-inovacao-e-desenvolvimento-ibid')}>
              Saiba mais sobre o IBID <ExternalLink size={13} />
            </button>
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
            <button className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-300" type="button" onClick={() => window.open('https://rankingdecompetitividade.org.br/eleicoes/')}>
              Saiba mais sobre o CLP <ExternalLink size={13} />
            </button>
          </article>

        </div>
      </section>
    </main>
  )
}
