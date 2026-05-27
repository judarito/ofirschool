import { createMiddleware } from 'hono/factory'
import { AppError } from '../lib/errors'
import { verifyAccessToken } from '../lib/jwt'
import type { AppContextVariables, Bindings } from '../types'

export const authMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: AppContextVariables
}>(async (c, next) => {
  const authorization = c.req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null

  if (!token) {
    throw new AppError('No autorizado', 401)
  }

  let user
  try {
    user = await verifyAccessToken(token, c.env.JWT_SECRET)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token inválido'
    const isExpired = message.includes('"exp" claim timestamp check failed') || message.includes('JWTExpired')
    throw new AppError(isExpired ? 'Sesion expirada, inicia sesion nuevamente' : 'No autorizado', 401)
  }

  c.set('user', user)
  await next()
})
