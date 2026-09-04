import type { IncomingMessage, ServerResponse } from 'node:http'
import pg from 'pg'
import type { Plugin } from 'vite'
import type { DashboardDataset, DashboardKind } from '../src/types/dashboard.js'
import { DashboardService } from './dashboardService.js'

const dashboardKinds = new Set<DashboardKind>(['ibid', 'clp-estados', 'clp-municipios'])
const cacheTtlMs = 60_000
const maxCacheEntries = 100

interface CacheEntry {
  expiresAt: number
  value: DashboardDataset
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

export function dashboardApiPlugin(connectionString: string | undefined): Plugin {
  let pool: pg.Pool | undefined
  const cache = new Map<string, CacheEntry>()
  const pending = new Map<string, Promise<DashboardDataset>>()

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
    url.searchParams.sort()
    const cacheKey = url.searchParams.toString()
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      json(response, 200, cached.value)
      return
    }
    if (cached) cache.delete(cacheKey)

    let dashboardRequest = pending.get(cacheKey)
    if (!dashboardRequest) {
      dashboardRequest = service.getDashboard(kind, values).then((dashboard) => {
        if (cache.size >= maxCacheEntries) {
          const oldestKey = cache.keys().next().value
          if (oldestKey) cache.delete(oldestKey)
        }
        cache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, value: dashboard })
        return dashboard
      })
      pending.set(cacheKey, dashboardRequest)
      void dashboardRequest.then(
        () => pending.delete(cacheKey),
        () => pending.delete(cacheKey),
      )
    }

    dashboardRequest
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
