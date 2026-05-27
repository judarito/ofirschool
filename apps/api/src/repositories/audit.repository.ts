import { auditLogs } from '@ofir/db'
import type { Database } from '@ofir/db'

type AuditEntry = {
  tenantId: string
  actorUserId?: string
  entity: string
  entityId: string
  action: string
  changes?: Record<string, unknown>
  ipAddress?: string | null
}

export const writeAuditLog = async (db: Database, entry: AuditEntry) => {
  await db.insert(auditLogs).values({
    tenantId: entry.tenantId,
    actorUserId: entry.actorUserId,
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    changes: entry.changes ?? {},
    ipAddress: entry.ipAddress ?? null,
  })
}
