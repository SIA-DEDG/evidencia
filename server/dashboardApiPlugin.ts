import type { IncomingMessage, ServerResponse } from 'node:http'
import pg from 'pg'
import type { Plugin } from 'vite'
import type { DashboardKind } from '../src/types/dashboard'
import { DashboardService } from './dashboardService'

const dashboardKinds = new Set<DashboardKind>(['ibid', 'clp-estados', 'clp-municipios'])

function json(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

export function dashboardApiPlugin(connectionString: string | undefined): Plugin {
  let pool: pg.Pool | undefined

  function handler(request: IncomingMessage, response: ServerResponse) {
    if (request.method !== 'GET') {
      json(response, 405, { error: 'Método não permitido.' })
      return
    }
    if (!connectionString) {
      json(response, 503, { error: 'SUPABASE_URL não foi configurada no servidor.' })
      return
    }

    const url = new URL(request.url ?? '/', 'http://localhost')
    const kind = url.searchParams.get('kind') as DashboardKind | null
    if (!kind || !dashboardKinds.has(kind)) {
      json(response, 400, { error: 'Painel inválido.' })
      return
    }

    pool ??= new pg.Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      ssl: { rejectUnauthorized: false },
    })
    const service = new DashboardService(pool)
    const values = Object.fromEntries(url.searchParams.entries())
    service.getDashboard(kind, values)
      .then((dashboard) => json(response, 200, dashboard))
      .catch((error: unknown) => {
        console.error('Falha ao montar o dashboard:', error)
        json(response, 500, { error: error instanceof Error ? error.message : 'Falha ao consultar o banco.' })
      })
  }

  return {
    name: 'dashboard-postgres-api',
    configureServer(server) {
      server.middlewares.use('/api/dashboard', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/dashboard', handler)
    },
  }
}
