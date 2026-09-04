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

function json(status: number, body: unknown, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

async function handleDashboard(request: Request) {
  if (request.method !== 'GET') {
    return json(405, { error: 'Método não permitido.' }, { Allow: 'GET' })
  }

  const connectionString = process.env.SUPABASE_URL
  if (!connectionString) {
    return json(503, { error: 'SUPABASE_URL não foi configurada no servidor.' })
  }

  const url = new URL(request.url)
  const kind = url.searchParams.get('kind') as DashboardKind | null
  if (!kind || !dashboardKinds.has(kind)) {
    return json(400, { error: 'Painel inválido.' })
  }

  pool ??= new pg.Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 30_000,
    ssl: { rejectUnauthorized: false },
  })

  const values = Object.fromEntries(url.searchParams.entries())
  url.searchParams.sort()
  const cacheKey = url.searchParams.toString()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return json(200, cached.value)
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

  try {
    return json(200, await dashboardRequest)
  } catch (error: unknown) {
    console.error('Falha ao montar o dashboard:', error)
    return json(500, { error: 'Falha ao consultar o banco.' })
  }
}

export default {
  fetch: handleDashboard,
}
