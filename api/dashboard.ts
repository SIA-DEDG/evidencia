import type { IncomingMessage, ServerResponse } from 'node:http'
import pg from 'pg'
import type { DashboardDataset, DashboardKind } from '../src/types/dashboard'
import { DashboardService } from '../server/dashboardService'

const dashboardKinds = new Set<DashboardKind>(['ibid', 'clp-estados', 'clp-municipios'])
const cacheTtlMs = 60_000
const maxCacheEntries = 100

interface CacheEntry {
  expiresAt: number
  value: DashboardDataset
}

const cache = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<DashboardDataset>>()
let pool: pg.Pool | undefined

function json(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      json(response, 405, { error: 'Método não permitido.' })
      return
    }

    const connectionString = process.env.SUPABASE_URL
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
      max: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    })

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
      dashboardRequest = new DashboardService(pool).getDashboard(kind, values).then((dashboard) => {
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

    json(response, 200, await dashboardRequest)
  } catch (error: unknown) {
    console.error('Falha ao executar a Function do dashboard:', error)
    if (!response.headersSent) {
      json(response, 500, { error: 'Falha ao executar a API do dashboard. Consulte os logs da Function na Vercel.' })
      return
    }
    response.end()
  }
}
