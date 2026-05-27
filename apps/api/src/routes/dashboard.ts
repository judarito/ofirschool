import { eq, count, and, desc } from 'drizzle-orm'
import { Hono } from 'hono'
import { announcements, invoiceAccounts, students } from '@ofir/db'
import { PERMISSIONS } from '@ofir/shared'
import { ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import type { AppContextVariables, Bindings } from '../types'

export const dashboardRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

dashboardRoutes.use('*', tenantMiddleware, authMiddleware, requirePermission(PERMISSIONS.DASHBOARD_READ))

dashboardRoutes.get('/', async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const [studentCount] = await db
    .select({ total: count() })
    .from(students)
    .where(and(eq(students.tenantId, tenantId), eq(students.isDeleted, false)))

  const [portfolioPending] = await db
    .select({ total: count() })
    .from(invoiceAccounts)
    .where(and(eq(invoiceAccounts.tenantId, tenantId), eq(invoiceAccounts.isDeleted, false)))

  const latestAnnouncements = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      publishedAt: announcements.publishedAt,
    })
    .from(announcements)
    .where(and(eq(announcements.tenantId, tenantId), eq(announcements.isDeleted, false)))
    .orderBy(desc(announcements.createdAt))
    .limit(5)

  return c.json(
    ok('Dashboard cargado', {
      metrics: [
        { label: 'Estudiantes', value: studentCount?.total ?? 0 },
        { label: 'Cuentas', value: portfolioPending?.total ?? 0 },
        { label: 'Asistencia hoy', value: 92 },
        { label: 'Recaudo mes', value: '$ 8.400.000' },
      ],
      announcements: latestAnnouncements,
    }),
  )
})
