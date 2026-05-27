import { createMiddleware } from 'hono/factory'
import { getDb } from '../lib/db'
import { AppError } from '../lib/errors'
import type { AppContextVariables, Bindings } from '../types'

export const contextMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: AppContextVariables
}>(async (c, next) => {
  if (!c.env.DATABASE_URL) {
    throw new AppError('DATABASE_URL no configurado en apps/api/.dev.vars', 500)
  }

  c.set('db', getDb(c.env))
  c.set('requestId', crypto.randomUUID())
  await next()
})
