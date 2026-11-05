import { ChevronDown } from 'lucide-react'
import type { DetailRow, IndicatorResponsibility, ResponsibleAgency } from '../types/dashboard'

export const responsibilityHeader = 'Órgãos responsáveis (PI)'

export function hasResponsibility(rows: DetailRow[]): boolean {
  return rows.some((row) => Boolean(row.responsibility) || hasResponsibility(row.children ?? []))
}

function relationText(responsibility: IndicatorResponsibility) {
  return `Relação: ${responsibility.relation} · Esfera: ${responsibility.sphere}`
}

const noAgencyText = 'Nenhum órgão responsável'

function hasAgencies(responsibility: IndicatorResponsibility) {
  return responsibility.principal.length > 0 || responsibility.coResponsible.length > 0
}

function AgencyList({ agencies }: { agencies: ResponsibleAgency[] }) {
  return (
    <ul className="detail-agency-list">
      {agencies.map((agency, index) => (
        <li key={`${agency.name}-${index}`}>
          <span>{agency.name}</span>
          {agency.legalBasis && <small>{agency.legalBasis}</small>}
        </li>
      ))}
    </ul>
  )
}

function ResponsibilityContent({ label, responsibility }: { label?: string; responsibility: IndicatorResponsibility }) {
  const agencyCount = responsibility.principal.length + responsibility.coResponsible.length
  const agencyLabel = agencyCount === 1 ? '1 órgão' : `${agencyCount} órgãos`

  return (
    <details className="detail-responsibility">
      <summary>
        <span className="detail-responsibility-summary">
          {label && <b>{label}</b>}
          <strong>{hasAgencies(responsibility) ? agencyLabel : noAgencyText}</strong>
          <small>Esfera: {responsibility.sphere}</small>
        </span>
        <ChevronDown aria-hidden="true" className="detail-responsibility-chevron" size={16} />
      </summary>
      <div className="detail-responsibility-content">
        {responsibility.principal.length > 0 && (
          <section>
            <h4>{responsibility.principal.length === 1 ? 'Responsável principal' : 'Responsáveis principais'}</h4>
            <AgencyList agencies={responsibility.principal} />
          </section>
        )}
        {responsibility.coResponsible.length > 0 && (
          <section>
            <h4>Corresponsáveis</h4>
            <AgencyList agencies={responsibility.coResponsible} />
          </section>
        )}
        <small>{relationText(responsibility)}</small>
        {responsibility.justification.trim() && <em>{responsibility.justification}</em>}
      </div>
    </details>
  )
}

export function ResponsibilityCell({ responsibility }: { responsibility?: IndicatorResponsibility }) {
  if (!responsibility) return <td className="detail-text-cell">—</td>
  return (
    <td className="detail-text-cell">
      <ResponsibilityContent responsibility={responsibility} />
    </td>
  )
}

/** Na comparação, os responsáveis do indicador de cada estudo, identificados pelo nome do estudo. */
export function ResponsibilityPairCell({ clp, ibid }: { clp?: IndicatorResponsibility; ibid?: IndicatorResponsibility }) {
  const studies = [{ label: 'IBID', responsibility: ibid }, { label: 'CLP', responsibility: clp }]
    .flatMap(({ label, responsibility }) => responsibility ? [{ label, responsibility }] : [])
  if (!studies.length) return <td className="detail-text-cell">—</td>
  return (
    <td className="detail-text-cell">
      <div className="detail-responsibility-pair">
        {studies.map(({ label, responsibility }) => <ResponsibilityContent key={label} label={label} responsibility={responsibility} />)}
      </div>
    </td>
  )
}

/** Itens da lista de detalhes da tabela no celular. */
export function ResponsibilityDetails({ responsibility }: { responsibility?: IndicatorResponsibility }) {
  if (!responsibility) return null
  return (
    <>
      {responsibility.principal.length > 0 && <div><dt>Órgão responsável (PI)</dt><dd><AgencyList agencies={responsibility.principal} /></dd></div>}
      {responsibility.coResponsible.length > 0 && <div><dt>Corresponsáveis</dt><dd><AgencyList agencies={responsibility.coResponsible} /></dd></div>}
      {!hasAgencies(responsibility) && <div><dt>Órgão responsável (PI)</dt><dd>{noAgencyText}</dd></div>}
      <div><dt>Relação com o governo</dt><dd>{relationText(responsibility)}</dd></div>
      <div><dt>Justificativa</dt><dd>{responsibility.justification}</dd></div>
    </>
  )
}
