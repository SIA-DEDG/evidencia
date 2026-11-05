import type { IncomingMessage, ServerResponse } from 'node:http'
import pg from 'pg'

let pool: pg.Pool | undefined

function json(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    json(response, 405, { error: 'Método não permitido.' })
    return
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    json(response, 503, { error: 'CRON_SECRET não foi configurado no servidor.' })
    return
  }

  if (request.headers.authorization !== `Bearer ${cronSecret}`) {
    json(response, 401, { error: 'Não autorizado.' })
    return
  }

  const connectionString = process.env.SUPABASE_URL
  if (!connectionString) {
    json(response, 503, { error: 'SUPABASE_URL não foi configurada no servidor.' })
    return
  }

  try {
    pool ??= new pg.Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    })

    await pool.query('SELECT 1')
    json(response, 200, { ok: true, checkedAt: new Date().toISOString() })
  } catch (error: unknown) {
    console.error('Falha ao executar o keep-alive do banco:', error)
    json(response, 500, { error: 'Falha ao consultar o banco.' })
  }
}
