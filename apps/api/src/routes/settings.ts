import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { tenants } from '@ofir/db'
import { PERMISSIONS } from '@ofir/shared'
import { z } from 'zod'
import { AppError } from '../lib/errors'
import { ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const settingsRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

settingsRoutes.use('*', authMiddleware, tenantMiddleware)

const tenantRulesSchema = z.object({
  academic: z.object({
    passingGrade: z.coerce.number().min(0).max(10).default(3),
    maxDecimalPlaces: z.coerce.number().int().min(0).max(4).default(2),
    qualitativePreschool: z.boolean().default(true),
    enableRecovery: z.boolean().default(true),
    enablePromotionBoard: z.boolean().default(true),
    maxFailedSubjectsForPromotion: z.coerce.number().int().min(0).max(10).default(3),
  }).default({}),
  enrollment: z.object({
    maxStudentsPerGroup: z.coerce.number().int().min(1).max(100).default(35),
    requireConsentForEnrollment: z.boolean().default(true),
    allowReEntry: z.boolean().default(true),
    registrationFeePercentage: z.coerce.number().min(0).max(100).default(10),
    maxInstallments: z.coerce.number().int().min(1).max(12).default(10),
  }).default({}),
  coexistence: z.object({
    requireCommitteeForType3: z.boolean().default(true),
    notifyFamilyOnOpen: z.boolean().default(true),
    maxOpenCasesPerStudent: z.coerce.number().int().min(0).max(10).default(3),
    confidentialityForMinors: z.boolean().default(true),
  }).default({}),
  notifications: z.object({
    admissionReceived: z.boolean().default(true),
    enrollmentConfirmed: z.boolean().default(true),
    reportCardPublished: z.boolean().default(true),
    coexistenceCaseOpened: z.boolean().default(true),
    paymentOverdue: z.boolean().default(true),
    documentExpiring: z.boolean().default(true),
    committeeScheduled: z.boolean().default(true),
  }).default({}),
})

settingsRoutes.get('/', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const [tenant] = await db.select({ settings: tenants.settings }).from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.isDeleted, false))).limit(1)

  if (!tenant) throw new AppError('Tenant no encontrado', 404)

  const rules = tenant.settings?.rules || {}
  return c.json(ok('Reglas cargadas', { rules }))
})

settingsRoutes.put('/', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', tenantRulesSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [existing] = await db.select({ settings: tenants.settings }).from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.isDeleted, false))).limit(1)

  if (!existing) throw new AppError('Tenant no encontrado', 404)

  const updatedSettings = {
    ...(existing.settings || {}),
    rules: payload,
  }

  await db.update(tenants).set({
    settings: updatedSettings,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(eq(tenants.id, tenantId))

  await writeAuditLog(db, {
    tenantId, actorUserId: user.id, entity: 'tenants', entityId: tenantId,
    action: 'update_rules',
    changes: { from: existing.settings?.rules, to: payload },
  })

  return c.json(ok('Reglas actualizadas', { rules: payload }))
})
