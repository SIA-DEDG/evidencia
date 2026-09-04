import type { DashboardDataset, DashboardKind } from '../types/dashboard'

/** Contrato da API agregada que mantém as credenciais PostgreSQL no servidor. */
export interface DashboardRepository {
  getDashboard(kind: DashboardKind, filters?: Record<string, string>): Promise<DashboardDataset>
}

class ApiDashboardRepository implements DashboardRepository {
  async getDashboard(kind: DashboardKind, filters: Record<string, string> = {}) {
    const query = new URLSearchParams({ kind, ...filters })
    const response = await fetch(`/api/dashboard?${query}`)
    const responseText = await response.text()
    let body: DashboardDataset | { error?: string }

    try {
      body = JSON.parse(responseText) as DashboardDataset | { error?: string }
    } catch {
      const statusHint = response.status === 404
        ? 'A Function /api/dashboard não foi encontrada no deploy.'
        : response.status === 504
          ? 'A consulta excedeu o tempo limite da Function.'
          : 'A API retornou uma resposta inválida em vez de JSON.'
      throw new Error(`${statusHint} Código HTTP: ${response.status}.`)
    }

    if (!response.ok) {
      throw new Error('error' in body && body.error ? body.error : 'Não foi possível carregar os dados do painel.')
    }
    return body as DashboardDataset
  }
}

export const dashboardRepository: DashboardRepository = new ApiDashboardRepository()
