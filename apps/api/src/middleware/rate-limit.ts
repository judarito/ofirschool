import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import { AppError } from '../lib/errors'
import type { AppContextVariables, Bindings } from '../types'

type AppContext = Context<{ Bindings: Bindings; Variables: AppContextVariables }>

type RateLimitOptions = {
  windowMs: number
  max: number
  keyPrefix: string
  key?: (c: AppContext) => string
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitEntry>()

const cleanupExpiredBuckets = (now: number) => {
  if (buckets.size < 1000) return

  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) buckets.delete(key)
  }
}

const getIpAddress = (c: AppContext) =>
  c.req.header('cf-connecting-ip') ??
  c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
  'unknown'

export const rateLimit = ({ windowMs, max, keyPrefix, key }: RateLimitOptions) =>
  createMiddleware<{
    Bindings: Bindings
    Variables: AppContextVariables
  }>(async (c, next) => {
    const now = Date.now()
    cleanupExpiredBuckets(now)

    const bucketKey = `${keyPrefix}:${key ? key(c) : getIpAddress(c)}`
    const current = buckets.get(bucketKey)
    const entry = current && current.resetAt > now
      ? current
      : {
          count: 0,
          resetAt: now + windowMs,
        }

    entry.count += 1
    buckets.set(bucketKey, entry)

    const retryAfterSeconds = Math.max(Math.ceil((entry.resetAt - now) / 1000), 1)
    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(Math.max(max - entry.count, 0)))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > max) {
      c.header('Retry-After', String(retryAfterSeconds))
      throw new AppError('Demasiados intentos. Intenta nuevamente en unos minutos.', 429)
    }

    await next()
  })

export const rateLimitKeyParts = {
  ip: getIpAddress,
}
