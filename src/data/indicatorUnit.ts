/** Abbreviates the source unit without rescaling the normalized ranking scores. */
export function formatIndicatorUnit(unit?: string | null): string {
  if (!unit?.trim()) return 'Não informada'

  return unit.trim()
    .replace(/\btrilh(?:ão|ões)\b/giu, 'tri')
    .replace(/\bbilh(?:ão|ões)\b/giu, 'bi')
    .replace(/\bmilh(?:ão|ões)\b/giu, 'mi')
    .replace(/\bmilhar(?:es)?\b/giu, 'mil')
    .replace(/\breais\s*\(R?\$\)/giu, 'R$')
    .replace(/\breais\b/giu, 'R$')
    .replace(/\b(?:porcentagem|percentual|proporção)\s*(?:[-–]\s*)?(?:\(%\))?$/iu, '%')
    .replace(/\bporcentagem\b/giu, '%')
    .replace(/\bm3\b/giu, 'm³')
}
