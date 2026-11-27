import './HomeAssistantV3.css'

const features = [
  { icon: '/assets/edson-feature-search.svg', title: 'Busca rápida', description: 'Encontre posição, nota, pilar ou indicador sem navegar pelos painéis.' },
  { icon: '/assets/edson-feature-book.svg', title: 'Explica os índices', description: 'Entenda metodologias, pilares e dimensões do IBID e do CLP.' },
  { icon: '/assets/edson-feature-chart.svg', title: 'Compara por você', description: 'Peça comparações entre estados, regiões e anos da série histórica.' },
  { icon: '/assets/edson-feature-landmark.svg', title: 'Mostra os responsáveis', description: 'Saiba quais esferas de governo respondem por cada indicador.' },
]

export function HomeAssistantV3() {
  return (
    <section aria-labelledby="assistant-title" className="home-assistant-v3" data-node-id="3911:60407">
      <div aria-hidden="true" className="home-assistant-v3-decoration">
        <img alt="" className="home-assistant-v3-map" height="600" src="/assets/edson-piaui-connected.svg" width="415" />
        <span className="home-assistant-v3-fade" />
        <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
      </div>

      <div className="home-assistant-v3-inner">
        <div className="home-assistant-v3-copy">
          <p className="home-assistant-v3-badge">
            <img alt="" aria-hidden="true" height="18" src="/assets/edson-mono.svg" width="18" />
            Assistente do painel
          </p>
          <h2 id="assistant-title">Converse com o <span>Edson</span></h2>
          <p className="home-assistant-v3-lead">
            O Edson é o assistente virtual do EvidencIA Inovação. Ele conhece os dados do IBID e do Ranking de
            Competitividade do CLP e explica cada resultado sem termos técnicos, enquanto você explora os painéis.
          </p>
          <ul className="home-assistant-v3-features">
            {features.map(({ icon, title, description }) => (
              <li key={title}>
                <span><img alt="" aria-hidden="true" height="18" src={icon} width="18" /></span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ul>
          <div className="home-assistant-v3-actions">
            <button aria-describedby="assistant-edson-unavailable" className="home-assistant-v3-action" disabled type="button">
              <img alt="" aria-hidden="true" height="20" src="/assets/edson-chat-icon.svg" width="20" />
              Converse com o assistente Edson
            </button>
            <p className="home-assistant-v3-unavailable" id="assistant-edson-unavailable" role="status">
              Edson está desativado no momento.
            </p>
          </div>
        </div>

        <div aria-hidden="true" className="home-assistant-v3-radar">
          <img alt="" height="331.391" src="/assets/edson-radar.svg" width="344.503" />
        </div>
      </div>
    </section>
  )
}
