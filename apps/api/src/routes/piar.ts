import { and, asc, count, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { academicPeriods, academicYears, grades, groups, piarAdjustments, piarAnnualReports, piarBarriers, piarFollowUps, piarRecords, students, subjects } from '@ofir/db'
import { PERMISSIONS, piarAdjustmentCreateSchema, piarAnnualReportSchema, piarFollowUpCreateSchema, piarRecordCreateSchema, piarRecordUpdateSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const piarRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

piarRoutes.use('*', authMiddleware, tenantMiddleware)

piarRoutes.get('/', requirePermission(PERMISSIONS.SIEE_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const items = await db
    .select({
      id: piarRecords.id,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      disabilityType: piarRecords.disabilityType,
      hasPIAR: piarRecords.hasPIAR,
      status: piarRecords.status,
      academicYearName: academicYears.name,
      createdAt: piarRecords.createdAt,
    })
    .from(piarRecords)
    .innerJoin(students, eq(students.id, piarRecords.studentId))
    .leftJoin(academicYears, eq(academicYears.id, piarRecords.academicYearId))
    .where(and(eq(piarRecords.tenantId, tenantId), eq(piarRecords.isDeleted, false)))
    .orderBy(desc(piarRecords.createdAt))

  return c.json(ok('Registros PIAR cargados', { items }))
})

piarRoutes.get('/:id', requirePermission(PERMISSIONS.SIEE_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [record] = await db
    .select()
    .from(piarRecords)
    .where(and(eq(piarRecords.id, id), eq(piarRecords.tenantId, tenantId), eq(piarRecords.isDeleted, false)))
    .limit(1)

  if (!record) throw new AppError('Registro PIAR no encontrado', 404)

  const barriers = await db.select().from(piarBarriers).where(and(eq(piarBarriers.piarRecordId, id), eq(piarBarriers.isDeleted, false)))
  const adjustments = await db.select({
    id: piarAdjustments.id,
    adjustmentType: piarAdjustments.adjustmentType,
    description: piarAdjustments.description,
    responsibleName: piarAdjustments.responsibleName,
    startDate: piarAdjustments.startDate,
    endDate: piarAdjustments.endDate,
    evaluationCriteria: piarAdjustments.evaluationCriteria,
    status: piarAdjustments.status,
    effectiveness: piarAdjustments.effectiveness,
    subjectName: subjects.name,
  }).from(piarAdjustments).leftJoin(subjects, eq(subjects.id, piarAdjustments.subjectId)).where(and(eq(piarAdjustments.piarRecordId, id), eq(piarAdjustments.isDeleted, false)))

  const followUps = await db.select().from(piarFollowUps).where(and(eq(piarFollowUps.piarRecordId, id), eq(piarFollowUps.isDeleted, false))).orderBy(desc(piarFollowUps.followUpDate))

  const reports = await db.select().from(piarAnnualReports).where(and(eq(piarAnnualReports.piarRecordId, id), eq(piarAnnualReports.isDeleted, false))).orderBy(desc(piarAnnualReports.reportYear))

  return c.json(ok('Registro PIAR cargado', { record, barriers, adjustments, followUps, reports }))
})

piarRoutes.post('/', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', piarRecordCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [existing] = await db
    .select({ id: piarRecords.id })
    .from(piarRecords)
    .where(and(eq(piarRecords.tenantId, tenantId), eq(piarRecords.studentId, payload.studentId), eq(piarRecords.academicYearId, payload.academicYearId), eq(piarRecords.isDeleted, false)))
    .limit(1)

  if (existing) throw new AppError('El estudiante ya tiene un registro PIAR para este año lectivo', 409)

  const [record] = await db.insert(piarRecords).values({
    tenantId,
    academicYearId: payload.academicYearId,
    studentId: payload.studentId,
    enrollmentId: payload.enrollmentId || null,
    diagnosticInfo: payload.diagnosticInfo || null,
    healthConditions: payload.healthConditions || null,
    disabilityType: payload.disabilityType || null,
    disabilityCategory: payload.disabilityCategory || null,
    hasPIAR: payload.hasPIAR,
    approvalDate: payload.approvalDate || null,
    status: 'active',
    isConfidential: true,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()

  if (!record) throw new AppError('No fue posible crear el registro PIAR', 500)

  await writeAuditLog(db, {
    tenantId, actorUserId: user.id, entity: 'piar_records', entityId: record.id,
    action: 'create', changes: { studentId: payload.studentId, academicYearId: payload.academicYearId },
  })

  return c.json(created('Registro PIAR creado', { id: record.id }), 201)
})

piarRoutes.post('/:id/adjustments', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', piarAdjustmentCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [adj] = await db.insert(piarAdjustments).values({
    tenantId, piarRecordId: id,
    subjectId: payload.subjectId || null,
    adjustmentType: payload.adjustmentType,
    description: payload.description,
    responsibleName: payload.responsibleName || null,
    startDate: payload.startDate || null,
    endDate: payload.endDate || null,
    evaluationCriteria: payload.evaluationCriteria || null,
    status: 'active',
    createdBy: user.id, updatedBy: user.id,
  }).returning()

  if (!adj) throw new AppError('No fue posible crear el ajuste', 500)
  return c.json(created('Ajuste creado', { id: adj.id }), 201)
})

piarRoutes.post('/:id/follow-ups', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', piarFollowUpCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [fu] = await db.insert(piarFollowUps).values({
    tenantId, piarRecordId: id, followUpDate: payload.followUpDate,
    periodId: payload.periodId || null, progress: payload.progress,
    difficulties: payload.difficulties || null,
    adjustmentsStatus: payload.adjustmentsStatus,
    recommendations: payload.recommendations || null,
    performedBy: user.id, performedByName: payload.performedByName || null,
    agreementsWithFamily: payload.agreementsWithFamily || null,
    createdBy: user.id, updatedBy: user.id,
  }).returning()

  if (!fu) throw new AppError('No fue posible crear el seguimiento', 500)
  return c.json(created('Seguimiento registrado', { id: fu.id }), 201)
})
