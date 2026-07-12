import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { auditLogs, users } from '@ofir/db'
import { PERMISSIONS } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import type { AppContextVariables, Bindings } from '../types'

export const auditRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

auditRoutes.use('*', authMiddleware, tenantMiddleware)

auditRoutes.get('/logs', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const entity = c.req.query('entity')
  const entityId = c.req.query('entityId')

  const whereConditions = [eq(auditLogs.tenantId, tenantId), eq(auditLogs.isDeleted, false)]
  if (entity) whereConditions.push(eq(auditLogs.entity, entity))
  if (entityId) whereConditions.push(eq(auditLogs.entityId, entityId))

  const rows = await db.select({
    id: auditLogs.id,
    entity: auditLogs.entity,
    entityId: auditLogs.entityId,
    action: auditLogs.action,
    changes: auditLogs.changes,
    ipAddress: auditLogs.ipAddress,
    createdAt: auditLogs.createdAt,
    actorName: users.fullName,
  }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(and(...whereConditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200)

  const items = rows.map((r) => ({
    id: r.id, entity: r.entity, entityId: r.entityId,
    action: r.action, changes: r.changes, ipAddress: r.ipAddress,
    actorName: r.actorName ?? 'Sistema',
    createdAt: r.createdAt.toISOString(),
    diff: extractDiff(r.changes as Record<string, unknown> | undefined),
  }))

  return c.json(ok('Bitácora cargada', { items, total: items.length }))
})

function extractDiff(changes: Record<string, unknown> | undefined): Array<{ field: string; from: string; to: string }> | null {
  if (!changes) return null
  const from = changes.from as Record<string, unknown> | undefined
  const to = changes.to as Record<string, unknown> | undefined
  if (!from || !to) return null

  const diffs: Array<{ field: string; from: string; to: string }> = []
  for (const key of Object.keys(to)) {
    const fromVal = JSON.stringify(from[key] ?? '')
    const toVal = JSON.stringify(to[key] ?? '')
    if (fromVal !== toVal) {
      diffs.push({ field: key, from: from[key] as string ?? '', to: to[key] as string ?? '' })
    }
  }
  return diffs.length ? diffs : null
}
