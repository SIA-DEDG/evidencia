import type { DashboardKind } from '../types/dashboard'

export function getDashboardChartColors(kind: DashboardKind) {
  const municipal = kind === 'clp-municipios'

  return {
    bar: municipal ? '#4d2f8a' : '#034ea2',
    primary: municipal ? '#4d2f8a' : '#08325e',
    comparison: municipal ? '#a78bdb' : '#8db2ff',
    regional: '#6e7781',
    national: municipal ? '#7450bd' : '#7c3aed',
  }
}
