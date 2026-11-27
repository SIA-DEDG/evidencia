import { ArrowRight, Landmark, Search, Star, Target, TrendingUp } from 'lucide-react'
import './HomeV3Intro.css'

interface HomeV3IntroProps {
  onExplore(): void
}

const benefits = [
  { icon: Star, title: 'Identificar forças e gargalos', description: 'Nos pilares em que o Piauí se destaca ou precisa avançar.' },
  { icon: TrendingUp, title: 'Comparar resultados', description: 'Entre anos, regiões, estados e municípios.' },
  { icon: Search, title: 'Detalhar até o indicador', description: 'Do resultado geral a cada indicador da nota.' },
  { icon: Landmark, title: 'Indicar órgãos e esferas responsáveis', description: 'Por cada resultado avaliado.' },
]

export function HomeV3Intro({ onExplore }: HomeV3IntroProps) {
  return (
    <>
      <section aria-labelledby="home-title" className="home-hero-v3">
        <div className="home-hero-v3-art" aria-hidden="true">
          <img alt="" height="624" src="/assets/home-hero-art-v3.png" width="740" />
        </div>
        <div className="home-hero-v3-content">
          <p className="home-hero-v3-eyebrow">Painel do EvidencIA Inovação · SIA Piauí</p>
          <h1 id="home-title">Onde o <mark>Piauí</mark> está nos rankings de <em>inovação</em> e <em>competitividade</em> do país</h1>
          <p className="home-hero-v3-description">Compare o Piauí com outros estados, regiões e municípios no IBID e no Ranking de Competitividade do CLP.</p>
          <p className="home-hero-v3-assistant"><span><Target aria-hidden="true" size={20} /></span>Precisa de um dado específico ou de uma explicação? Pergunte ao <strong>Edson</strong>, assistente do painel.</p>
          <button className="home-hero-v3-action" onClick={onExplore} type="button">Explorar os índices <ArrowRight aria-hidden="true" size={20} /></button>
          <dl className="home-hero-v3-stats">
            <div><dt>2</dt><dd>estudos: IBID e Ranking de Competitividade (CLP)</dd></div>
            <div><dt>27</dt><dd>estados</dd></div>
            <div><dt>5</dt><dd>regiões</dd></div>
            <div><dt>2015 a 2026</dt><dd>série histórica</dd></div>
          </dl>
        </div>
        <div className="home-hero-v3-stripe" aria-hidden="true"><i /><i /><i /><i /></div>
      </section>

      <section aria-labelledby="purpose-title" className="home-purpose-v3">
        <div className="home-purpose-v3-inner">
          <img alt="Composição visual do Piauí com paisagem, dados e mapa do Brasil" className="home-purpose-v3-art" height="520" loading="lazy" src="/assets/home-purpose-art-v3.png" width="500" />
          <div className="home-purpose-v3-copy">
            <p className="home-purpose-v3-badge"><img alt="" aria-hidden="true" height="16" src="/assets/badge-isotipo-purpose.svg" width="16" /> Propósito do painel</p>
            <h2 id="purpose-title">Evidências para orientar <span>decisões públicas</span> no Piauí.</h2>
            <p className="home-purpose-v3-lead">Oferecer dados públicos claros a gestores, pesquisadores e à população.</p>
            <ul>
              {benefits.map(({ icon: Icon, title, description }) => (
                <li key={title}>
                  <span className="home-purpose-v3-icon"><Icon aria-hidden="true" size={22} /></span>
                  <div><h3>{title}</h3><p>{description}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
