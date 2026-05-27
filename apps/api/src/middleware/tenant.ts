import { createMiddleware } from 'hono/factory'
import { AppError } from '../lib/errors'
import type { AppContextVariables, Bindings } from '../types'

export const tenantMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: AppContextVariables
}>(async (c, next) => {
  const tenantId = c.req.header('x-tenant-id') ?? c.env.DEFAULT_TENANT_ID

  if (!tenantId) {
    throw new AppError('Tenant no proporcionado', 400)
  }

  c.set('tenantId', tenantId)
  await next()
})
