import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { admissionApplications, communicationTemplates, enrollmentDocumentAcceptance, enrollments, notificationLogs, students } from '@ofir/db'
import { PERMISSIONS, communicationTemplateSchema, enrollmentDocumentAcceptanceSchema, sendCommunicationSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const communicationRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

communicationRoutes.use('*', authMiddleware, tenantMiddleware)

communicationRoutes.get('/templates', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const rows = await db
    .select()
    .from(communicationTemplates)
    .where(and(eq(communicationTemplates.tenantId, tenantId), eq(communicationTemplates.isDeleted, false)))
    .orderBy(asc(communicationTemplates.code))
  return c.json(ok('Plantillas cargadas', { items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })) }))
})

communicationRoutes.get('/templates/:id', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const [row] = await db.select().from(communicationTemplates).where(and(eq(communicationTemplates.id, id), eq(communicationTemplates.tenantId, tenantId), eq(communicationTemplates.isDeleted, false))).limit(1)
  if (!row) throw new AppError('Plantilla no encontrada', 404)
  return c.json(ok('Plantilla cargada', row))
})

communicationRoutes.post('/templates', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', communicationTemplateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  const [saved] = await db.insert(communicationTemplates).values({ tenantId, ...payload, createdBy: user.id, updatedBy: user.id }).returning()
  if (!saved) throw new AppError('No fue posible crear la plantilla', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'communication_templates', entityId: saved.id, action: 'create', changes: payload as Record<string, unknown>, ipAddress: c.req.header('cf-connecting-ip') })
  return c.json(created('Plantilla creada', saved), 201)
})

communicationRoutes.put('/templates/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', communicationTemplateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')
  const [existing] = await db.select().from(communicationTemplates).where(and(eq(communicationTemplates.id, id), eq(communicationTemplates.tenantId, tenantId), eq(communicationTemplates.isDeleted, false))).limit(1)
  if (!existing) throw new AppError('Plantilla no encontrada', 404)
  const [saved] = await db.update(communicationTemplates).set({ ...payload, updatedAt: new Date(), updatedBy: user.id }).where(eq(communicationTemplates.id, id)).returning()
  if (!saved) throw new AppError('No fue posible actualizar la plantilla', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'communication_templates', entityId: id, action: 'update', changes: { from: existing, to: saved }, ipAddress: c.req.header('cf-connecting-ip') })
  return c.json(ok('Plantilla actualizada', saved))
})

communicationRoutes.post('/send', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', sendCommunicationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [template] = await db.select().from(communicationTemplates).where(and(eq(communicationTemplates.tenantId, tenantId), eq(communicationTemplates.code, payload.templateCode), eq(communicationTemplates.isActive, true), eq(communicationTemplates.isDeleted, false))).limit(1)
  if (!template) throw new AppError('Plantilla no encontrada o inactiva', 404)

  if (payload.admissionApplicationId) {
    const [app] = await db.select({ id: admissionApplications.id }).from(admissionApplications).where(and(eq(admissionApplications.id, payload.admissionApplicationId), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false))).limit(1)
    if (!app) throw new AppError('Solicitud de admisión no encontrada', 404)
  }
  if (payload.enrollmentId) {
    const [enr] = await db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.id, payload.enrollmentId), eq(enrollments.tenantId, tenantId), eq(enrollments.isDeleted, false))).limit(1)
    if (!enr) throw new AppError('Matrícula no encontrada', 404)
  }

  let interpolatedBody = template.body
  for (const [key, value] of Object.entries(payload.variables)) {
    interpolatedBody = interpolatedBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  const [log] = await db.insert(notificationLogs).values({
    tenantId,
    channel: payload.channel,
    recipient: payload.recipient,
    template: template.code,
    templateId: template.id,
    entity: payload.entity || template.code,
    entityId: payload.entityId || null,
    admissionApplicationId: payload.admissionApplicationId || null,
    enrollmentId: payload.enrollmentId || null,
    payload: { subject: payload.subject || template.subject, body: interpolatedBody, variables: payload.variables, recipientName: payload.recipientName || null },
    status: 'sent',
    sentAt: new Date(),
    isInternal: payload.isInternal ?? false,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()

  if (!log) throw new AppError('No fue posible registrar la comunicación', 500)

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'notification_logs', entityId: log.id, action: 'send', changes: { templateCode: template.code, channel: payload.channel, admissionApplicationId: payload.admissionApplicationId, enrollmentId: payload.enrollmentId }, ipAddress: c.req.header('cf-connecting-ip') })
  return c.json(created('Comunicación enviada', { id: log.id }), 201)
})

communicationRoutes.get('/logs', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const admissionId = c.req.query('admissionApplicationId')
  const enrollmentId = c.req.query('enrollmentId')
  const entity = c.req.query('entity')

  const filters = [eq(notificationLogs.tenantId, tenantId), eq(notificationLogs.isDeleted, false)]
  if (admissionId) filters.push(eq(notificationLogs.admissionApplicationId, admissionId))
  if (enrollmentId) filters.push(eq(notificationLogs.enrollmentId, enrollmentId))
  if (entity) filters.push(eq(notificationLogs.entity, entity))

  const rows = await db.select().from(notificationLogs).where(and(...filters)).orderBy(desc(notificationLogs.sentAt), desc(notificationLogs.createdAt)).limit(200)

  return c.json(ok('Comunicaciones cargadas', { items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), sentAt: r.sentAt?.toISOString() ?? null })) }))
})

communicationRoutes.post('/document-acceptance', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', enrollmentDocumentAcceptanceSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [enrollment] = await db.select().from(enrollments).where(and(eq(enrollments.id, payload.enrollmentId), eq(enrollments.tenantId, tenantId), eq(enrollments.isDeleted, false))).limit(1)
  if (!enrollment) throw new AppError('Matrícula no encontrada', 404)

  const [student] = await db.select({ id: students.id }).from(students).where(and(eq(students.id, enrollment.studentId), eq(students.tenantId, tenantId), eq(students.isDeleted, false))).limit(1)
  if (!student) throw new AppError('Estudiante no encontrado', 404)

  const [saved] = await db.insert(enrollmentDocumentAcceptance).values({
    tenantId,
    enrollmentId: enrollment.id,
    studentId: student.id,
    documentCode: payload.documentCode,
    documentName: payload.documentName,
    documentVersion: payload.documentVersion,
    textSnapshot: payload.textSnapshot,
    acceptedByName: payload.acceptedByName,
    acceptedByRelationship: payload.acceptedByRelationship || null,
    channel: payload.channel,
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    metadata: payload.notes ? { notes: payload.notes } : {},
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()

  if (!saved) throw new AppError('No fue posible registrar la aceptación del documento', 500)

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'enrollment_document_acceptance', entityId: saved.id, action: 'accept', changes: { documentCode: payload.documentCode, enrollmentId: enrollment.id }, ipAddress: c.req.header('cf-connecting-ip') })
  return c.json(created('Aceptación de documento registrada', { id: saved.id }), 201)
})

communicationRoutes.get('/document-acceptance/:enrollmentId', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const enrollmentId = c.req.param('enrollmentId')

  const [enrollment] = await db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.id, enrollmentId), eq(enrollments.tenantId, tenantId), eq(enrollments.isDeleted, false))).limit(1)
  if (!enrollment) throw new AppError('Matrícula no encontrada', 404)

  const rows = await db.select().from(enrollmentDocumentAcceptance).where(and(eq(enrollmentDocumentAcceptance.tenantId, tenantId), eq(enrollmentDocumentAcceptance.enrollmentId, enrollmentId), eq(enrollmentDocumentAcceptance.isDeleted, false))).orderBy(desc(enrollmentDocumentAcceptance.acceptedAt))

  return c.json(ok('Documentos aceptados cargados', { items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), acceptedAt: r.acceptedAt.toISOString() })) }))
})
