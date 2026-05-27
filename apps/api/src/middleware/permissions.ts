import { createMiddleware } from 'hono/factory'
import { AppError } from '../lib/errors'
import type { AppContextVariables, Bindings } from '../types'

export const requirePermission = (permission: string) =>
  createMiddleware<{
    Bindings: Bindings
    Variables: AppContextVariables
  }>(async (c, next) => {
    const user = c.get('user')
    const isSuperAdmin = user.roleCodes.includes('super_admin')

    if (!isSuperAdmin && !user.permissions.includes(permission)) {
      throw new AppError('No tiene permisos para esta accion', 403)
    }

    await next()
  })
