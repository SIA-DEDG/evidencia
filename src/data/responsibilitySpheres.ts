import type { DetailRow } from '../types/dashboard'

export interface SphereBreakdownItem {
  count: number
  levels: DetailRow['level'][]
  name: string
}

/** Conta os mesmos componentes com responsabilidade que aparecem na tabela detalhada. */
export function buildSphereBreakdown(rows: DetailRow[]) {
  const counts = new Map<string, number>()
  const levels = new Map<string, Set<DetailRow['level']>>()
  const seenComponents = new Set<string>()

  function visit(items: DetailRow[]) {
    items.forEach((row) => {
      const sphere = row.responsibility?.sphere.trim()
      if (sphere && !seenComponents.has(row.id)) {
        seenComponents.add(row.id)
        counts.set(sphere, (counts.get(sphere) ?? 0) + 1)
        const sphereLevels = levels.get(sphere) ?? new Set<DetailRow['level']>()
        sphereLevels.add(row.level)
        levels.set(sphere, sphereLevels)
      }
      if (row.children?.length) visit(row.children)
    })
  }

  visit(rows)
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, levels: [...(levels.get(name) ?? [])] }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
}

/**
 * Mantém os ancestrais dos componentes encontrados para não quebrar a hierarquia da tabela.
 * Ancestrais de outra esfera aparecem apenas como contexto, sem exibir uma responsabilidade
 * diferente daquela selecionada no gráfico.
 */
export function filterDetailsBySphere(rows: DetailRow[], sphere?: string): DetailRow[] {
  if (!sphere) return rows

  return rows.flatMap((row) => {
    const children = filterDetailsBySphere(row.children ?? [], sphere)
    const matches = row.responsibility?.sphere.trim() === sphere
    if (!matches && children.length === 0) return []
    return [{
      ...row,
      responsibility: matches ? row.responsibility : undefined,
      children: children.length ? children : undefined,
    }]
  })
}
