import type { DetailRow, IndicatorResponsibility, ResponsibleAgency } from '../types/dashboard'

export const responsibilityHeader = 'Órgãos responsáveis (PI)'

export function hasResponsibility(rows: DetailRow[]): boolean {
  return rows.some((row) => Boolean(row.responsibility) || hasResponsibility(row.children ?? []))
}

function agencyNames(agencies: ResponsibleAgency[]) {
  return agencies.map((agency) => agency.name).join('; ')
}

function agenciesWithBasis(agencies: ResponsibleAgency[]) {
  return agencies.map((agency) => agency.legalBasis ? `${agency.name} (${agency.legalBasis})` : agency.name).join('; ')
}

function relationText(responsibility: IndicatorResponsibility) {
  return `Relação: ${responsibility.relation} · Esfera: ${responsibility.sphere}`
}

/** A célula mostra os órgãos; a base legal de cada um fica no texto ao passar o mouse. */
function responsibilityTitle(responsibility: IndicatorResponsibility) {
  return [
    responsibility.principal.length ? `Principal: ${agenciesWithBasis(responsibility.principal)}` : '',
    responsibility.coResponsible.length ? `Corresponsáveis: ${agenciesWithBasis(responsibility.coResponsible)}` : '',
    relationText(responsibility),
  ].filter(Boolean).join('\n')
}

export function ResponsibilityCell({ responsibility }: { responsibility?: IndicatorResponsibility }) {
  if (!responsibility) return <td className="detail-text-cell">—</td>
  return (
    <td className="detail-text-cell" title={responsibilityTitle(responsibility)}>
      <span className="detail-responsibility">
        {responsibility.principal.length > 0 && <strong>{agencyNames(responsibility.principal)}</strong>}
        {responsibility.coResponsible.length > 0 && <span>Corresponsáveis: {agencyNames(responsibility.coResponsible)}</span>}
        <small>{relationText(responsibility)}</small>
        {responsibility.justification.trim() && <em>{responsibility.justification}</em>}
      </span>
    </td>
  )
}

/** Itens da lista de detalhes da tabela no celular. */
export function ResponsibilityDetails({ responsibility }: { responsibility?: IndicatorResponsibility }) {
  if (!responsibility) return null
  return (
    <>
      {responsibility.principal.length > 0 && <div><dt>Órgão responsável (PI)</dt><dd>{agenciesWithBasis(responsibility.principal)}</dd></div>}
      {responsibility.coResponsible.length > 0 && <div><dt>Corresponsáveis</dt><dd>{agenciesWithBasis(responsibility.coResponsible)}</dd></div>}
      <div><dt>Relação com o governo</dt><dd>{relationText(responsibility)}</dd></div>
      <div><dt>Justificativa</dt><dd>{responsibility.justification}</dd></div>
    </>
  )
}
