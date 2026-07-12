import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { academicYears, enrollments, feeItems, feeResolutions, financialClearances, paymentAgreements, studentFeeAssignments, students } from '@ofir/db'
import { PERMISSIONS, feeItemCreateSchema, feeResolutionCreateSchema, financialClearanceSchema, paymentAgreementCreateSchema, studentFeeAssignmentSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const financeRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

financeRoutes.use('*', authMiddleware, tenantMiddleware)

// ─── Régimen tarifario ────────────────────────────────
financeRoutes.get('/resolutions', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const items = await db.select({
    id: feeResolutions.id, resolutionNumber: feeResolutions.resolutionNumber,
    resolutionDate: feeResolutions.resolutionDate, annualFee: feeResolutions.annualFee,
    registrationFeePercentage: feeResolutions.registrationFeePercentage,
    maxInstallments: feeResolutions.maxInstallments, status: feeResolutions.status,
    academicYearName: academicYears.name, createdAt: feeResolutions.createdAt,
  }).from(feeResolutions).leftJoin(academicYears, eq(academicYears.id, feeResolutions.academicYearId))
    .where(and(eq(feeResolutions.tenantId, tenantId), eq(feeResolutions.isDeleted, false)))
    .orderBy(desc(feeResolutions.createdAt))

  return c.json(ok('Regímenes tarifarios cargados', { items }))
})

financeRoutes.post('/resolutions', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', feeResolutionCreateSchema), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const user = c.get('user')
  const payload = c.req.valid('json')
  const [r] = await db.insert(feeResolutions).values({
    tenantId, academicYearId: payload.academicYearId, resolutionNumber: payload.resolutionNumber,
    resolutionDate: payload.resolutionDate, issuingEntity: payload.issuingEntity,
    annualFee: String(payload.annualFee), registrationFeePercentage: String(payload.registrationFeePercentage),
    maxInstallments: payload.maxInstallments, notes: payload.notes || null,
    status: 'draft', createdBy: user.id, updatedBy: user.id,
  }).returning()
  if (!r) throw new AppError('No fue posible crear el régimen tarifario', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'fee_resolutions', entityId: r.id, action: 'create', changes: payload as Record<string, unknown> })
  return c.json(created('Régimen tarifario creado', { id: r.id }), 201)
})

// ─── Items de cobro ────────────────────────────────────
financeRoutes.get('/resolutions/:id/items', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const id = c.req.param('id')
  const items = await db.select().from(feeItems)
    .where(and(eq(feeItems.feeResolutionId, id), eq(feeItems.tenantId, tenantId), eq(feeItems.isDeleted, false)))
    .orderBy(asc(feeItems.sortOrder))
  return c.json(ok('Items de cobro cargados', { items }))
})

financeRoutes.post('/resolutions/:id/items', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', feeItemCreateSchema), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const user = c.get('user')
  const id = c.req.param('id'); const payload = c.req.valid('json')

  const [existing] = await db.select({ count: count() }).from(feeItems)
    .where(and(eq(feeItems.feeResolutionId, id), eq(feeItems.tenantId, tenantId), eq(feeItems.isDeleted, false)))

  const [item] = await db.insert(feeItems).values({
    tenantId, feeResolutionId: id, itemType: payload.itemType, name: payload.name,
    amount: String(payload.amount), dueDay: payload.dueDay, frequency: payload.frequency,
    isMandatory: payload.isMandatory, sortOrder: (existing?.count ?? 0) + 1,
    description: payload.description || null, createdBy: user.id, updatedBy: user.id,
  }).returning()
  if (!item) throw new AppError('No fue posible crear el item de cobro', 500)
  return c.json(created('Item de cobro creado', { id: item.id }), 201)
})

// ─── Paz y salvo ──────────────────────────────────────
financeRoutes.get('/clearances', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId')
  const items = await db.select({
    id: financialClearances.id, isCleared: financialClearances.isCleared,
    clearanceType: financialClearances.clearanceType, pendingAmount: financialClearances.pendingAmount,
    clearanceDate: financialClearances.clearanceDate, observations: financialClearances.observations,
    studentName: students.firstName, enrollmentId: financialClearances.enrollmentId,
  }).from(financialClearances).leftJoin(students, eq(students.id, financialClearances.enrollmentId))
    .where(and(eq(financialClearances.tenantId, tenantId), eq(financialClearances.isDeleted, false)))
    .orderBy(desc(financialClearances.createdAt))

  return c.json(ok('Paces y salvos cargados', { items }))
})

financeRoutes.post('/clearances', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', financialClearanceSchema), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const user = c.get('user')
  const payload = c.req.valid('json')

  const [existing] = await db.select({ id: financialClearances.id }).from(financialClearances)
    .where(and(eq(financialClearances.enrollmentId, payload.enrollmentId), eq(financialClearances.tenantId, tenantId), eq(financialClearances.isDeleted, false))).limit(1)

  const data = {
    isCleared: payload.isCleared, clearanceType: payload.clearanceType,
    observations: payload.observations || null, pendingAmount: String(payload.pendingAmount),
    authorizedBy: user.id, clearanceDate: payload.isCleared ? new Date() : null,
    updatedAt: new Date(), updatedBy: user.id,
  }

  if (existing) {
    await db.update(financialClearances).set(data).where(eq(financialClearances.id, existing.id))
    return c.json(ok('Paz y salvo actualizado', { id: existing.id, isCleared: payload.isCleared }))
  }

  const [cRecord] = await db.insert(financialClearances).values({
    tenantId, enrollmentId: payload.enrollmentId, ...data,
    createdBy: user.id,
  }).returning()

  if (!cRecord) throw new AppError('No fue posible crear el paz y salvo', 500)
  return c.json(created('Paz y salvo creado', { id: cRecord.id, isCleared: payload.isCleared }), 201)
})

// ─── Asignaciones de cobro por estudiante ──────────────
financeRoutes.post('/assignments', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', studentFeeAssignmentSchema), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const user = c.get('user')
  const payload = c.req.valid('json')

  const [a] = await db.insert(studentFeeAssignments).values({
    tenantId, enrollmentId: payload.enrollmentId, feeItemId: payload.feeItemId,
    customAmount: payload.customAmount ? String(payload.customAmount) : null,
    discountPercentage: payload.discountPercentage ? String(payload.discountPercentage) : null,
    discountReason: payload.discountReason || null, isExempt: payload.isExempt,
    createdBy: user.id, updatedBy: user.id,
  }).returning()

  if (!a) throw new AppError('No fue posible asignar el cobro', 500)
  return c.json(created('Cobro asignado', { id: a.id }), 201)
})
