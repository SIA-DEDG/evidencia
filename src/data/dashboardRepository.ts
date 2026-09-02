import type { DashboardDataset, DashboardKind } from '../types/dashboard'

/** Contrato da API agregada que mantém as credenciais PostgreSQL no servidor. */
export interface DashboardRepository {
  getDashboard(kind: DashboardKind, filters?: Record<string, string>): Promise<DashboardDataset>
}

class ApiDashboardRepository implements DashboardRepository {
  async getDashboard(kind: DashboardKind, filters: Record<string, string> = {}) {
    const query = new URLSearchParams({ kind, ...filters })
    const response = await fetch(`/api/dashboard?${query}`)
    const body = await response.json() as DashboardDataset | { error?: string }
    if (!response.ok) {
      throw new Error('error' in body && body.error ? body.error : 'Não foi possível carregar os dados do painel.')
    }
    return body as DashboardDataset
  }
}

export const dashboardRepository: DashboardRepository = new ApiDashboardRepository()
