import './HomeV3Intro.css'

interface HomeV3IntroProps {
  onExplore(): void
}

const benefits = [
  { icon: '/assets/purpose-v3-icon-star.svg', title: 'Identificar forças e gargalos', description: 'Nos pilares em que o Piauí se destaca ou precisa avançar.' },
  { icon: '/assets/purpose-v3-icon-trend.svg', title: 'Comparar resultados', description: 'Entre anos, regiões, estados e municípios.' },
  { icon: '/assets/purpose-v3-icon-search.svg', title: 'Detalhar até o indicador', description: 'Do resultado geral a cada indicador da nota.' },
  { icon: '/assets/purpose-v3-icon-landmark.svg', title: 'Indicar órgãos e esferas responsáveis', description: 'Por cada resultado avaliado.' },
]

export function HomeV3Intro({ onExplore }: HomeV3IntroProps) {
  return (
    <>
      <section aria-labelledby="home-title" className="home-hero-v3" data-node-id="3911:8447">
        <div aria-hidden="true" className="home-hero-v3-tiles home-hero-v3-tiles-left">
          <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
        </div>
        <div aria-hidden="true" className="home-hero-v3-art">
          <div className="home-hero-v3-tiles home-hero-v3-tiles-right">
            <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <img alt="" className="home-hero-v3-watermark" height="601.5" src="/assets/hero-v3-piaui-watermark.svg" width="403.839" />
          <img alt="" className="home-hero-v3-ribbon" height="550" src="/assets/hero-v3-ribbon.svg" width="816" />
          <img alt="" className="home-hero-v3-map-front" height="4326.1" src="/assets/hero-v3-piaui-over-ribbon.svg" width="4141.1" />
        </div>

        <div className="home-hero-v3-content">
          <p className="home-hero-v3-eyebrow">Painel do EvidencIA Inovação · SIA Piauí</p>
          <h1 id="home-title">
            <span>Onde o <mark>Piauí</mark> está nos</span>{' '}
            <span>rankings de <em>inovação</em> e</span>{' '}
            <span><em>competitividade</em> do país</span>
          </h1>
          <p className="home-hero-v3-description">Compare o Piauí com outros estados, regiões e municípios no IBID e no Ranking de Competitividade do CLP.</p>
          <p className="home-hero-v3-assistant">
            <span className="home-hero-v3-avatar"><img alt="" height="20" src="/assets/edson-logo-white.svg" width="20" /></span>
            <span>Precisa de um dado específico ou de uma explicação? Pergunte ao <strong>Edson</strong>, assistente do painel.</span>
          </p>
          <button className="home-hero-v3-action" onClick={onExplore} type="button">
            Explorar os índices
            <img alt="" aria-hidden="true" height="20" src="/assets/hero-v3-arrow-right.svg" width="20" />
          </button>
          <dl className="home-hero-v3-stats">
            <div><dt>2</dt><dd>estudos: IBID e Ranking de Competitividade (CLP)</dd></div>
            <div><dt>27</dt><dd>estados</dd></div>
            <div><dt>5</dt><dd>regiões</dd></div>
            <div><dt>2015 a 2026</dt><dd>série histórica</dd></div>
          </dl>
        </div>
        <div aria-hidden="true" className="home-hero-v3-stripe"><i /><i /><i /><i /></div>
      </section>

      <section aria-labelledby="purpose-title" className="home-purpose-v3" data-node-id="3911:10657">
        <div className="home-purpose-v3-inner">
          <div aria-label="Composição visual do Piauí com paisagens, mapa do Brasil e gráficos" className="home-purpose-v3-mosaic" role="img">
            <div className="home-purpose-v3-photo home-purpose-v3-photo-pedra"><img alt="" loading="lazy" src="/assets/purpose-v3-pedra-furada.png" /></div>
            <div className="home-purpose-v3-photo home-purpose-v3-photo-ponte"><img alt="" loading="lazy" src="/assets/purpose-v3-ponte-estaiada.png" /></div>
            <div className="home-purpose-v3-block home-purpose-v3-trend"><img alt="" height="40" src="/assets/purpose-v3-trend-up.svg" width="40" /></div>
            <div className="home-purpose-v3-block home-purpose-v3-green" />
            <div className="home-purpose-v3-block home-purpose-v3-blue" />
            <div className="home-purpose-v3-block home-purpose-v3-red" />
            <div className="home-purpose-v3-block home-purpose-v3-isotipo"><img alt="" height="63.2436" src="/assets/purpose-v3-isotipo.svg" width="47.2792" /></div>
            <div className="home-purpose-v3-block home-purpose-v3-ranking"><img alt="" height="53.551" src="/assets/purpose-v3-ranking-line.svg" width="164" /></div>
            <div className="home-purpose-v3-block home-purpose-v3-map"><img alt="" height="156" src="/assets/purpose-v3-brazil-map.svg" width="151.948" /></div>
            <div className="home-purpose-v3-block home-purpose-v3-bars"><i /><i /><i /></div>
          </div>
          <div className="home-purpose-v3-copy">
            <p className="home-purpose-v3-badge"><img alt="" aria-hidden="true" height="18" src="/assets/purpose-v3-badge.svg" width="13" /> Propósito do painel</p>
            <h2 id="purpose-title">Evidências para orientar <span>decisões públicas</span> no Piauí.</h2>
            <p className="home-purpose-v3-lead">Oferecer dados públicos claros a gestores, pesquisadores e à população.</p>
            <ul>
              {benefits.map(({ icon, title, description }) => (
                <li key={title}>
                  <span className="home-purpose-v3-icon"><img alt="" aria-hidden="true" height="22" src={icon} width="22" /></span>
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
