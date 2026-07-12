import { and, asc, desc, eq, inArray, isNull, not } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { academicYears, daneCodes, documentTypeCatalog, officialReports, students } from '@ofir/db'
import { PERMISSIONS, daneCodeSchema, documentTypeCatalogSchema, officialReportSchema, studentSensitiveDataSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const catalogRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

catalogRoutes.use('*', authMiddleware, tenantMiddleware)

catalogRoutes.get('/dane', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const codeType = c.req.query('codeType')
  const parentCode = c.req.query('parentCode')

  const where = and(
    eq(daneCodes.tenantId, tenantId),
    eq(daneCodes.isDeleted, false),
    codeType ? eq(daneCodes.codeType, codeType) : undefined,
    parentCode ? eq(daneCodes.parentCode, parentCode) : undefined,
  )
  const rows = await db.select().from(daneCodes).where(where).orderBy(asc(daneCodes.codeType), asc(daneCodes.code))
  return c.json(ok('Códigos DANE cargados', { items: rows }))
})

catalogRoutes.post('/dane', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', daneCodeSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  const [saved] = await db.insert(daneCodes).values({ tenantId, ...payload, createdBy: user.id, updatedBy: user.id }).returning()
  if (!saved) throw new AppError('No fue posible guardar el código DANE', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'dane_codes', entityId: saved.id, action: 'create', changes: payload as Record<string, unknown>, ipAddress: c.req.header('cf-connecting-ip') })
  return c.json(created('Código DANE guardado', saved), 201)
})

catalogRoutes.delete('/dane/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const [existing] = await db.select().from(daneCodes).where(and(eq(daneCodes.id, id), eq(daneCodes.tenantId, tenantId), eq(daneCodes.isDeleted, false))).limit(1)
  if (!existing) throw new AppError('Código DANE no encontrado', 404)
  await db.update(daneCodes).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(eq(daneCodes.id, id))
  return c.json(ok('Código DANE eliminado', { id }))
})

catalogRoutes.get('/document-types', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const rows = await db.select().from(documentTypeCatalog).where(and(eq(documentTypeCatalog.tenantId, tenantId), eq(documentTypeCatalog.isDeleted, false))).orderBy(asc(documentTypeCatalog.sortOrder), asc(documentTypeCatalog.name))
  return c.json(ok('Tipos de documento cargados', { items: rows }))
})

catalogRoutes.post('/document-types/seed', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')

  const defaults = [
    { code: 'CC', name: 'Cédula de Ciudadanía', country: 'CO', isNational: true, sortOrder: 1 },
    { code: 'CE', name: 'Cédula de Extranjería', country: 'CO', isNational: true, sortOrder: 2 },
    { code: 'TI', name: 'Tarjeta de Identidad', country: 'CO', isNational: true, sortOrder: 3 },
    { code: 'RC', name: 'Registro Civil', country: 'CO', isNational: true, sortOrder: 4 },
    { code: 'PA', name: 'Pasaporte', country: 'CO', isNational: false, sortOrder: 5 },
    { code: 'NIT', name: 'NIT', country: 'CO', isNational: true, sortOrder: 6 },
    { code: 'PPT', name: 'Permiso por Protección Temporal', country: 'CO', isNational: false, sortOrder: 7 },
    { code: 'OTRO', name: 'Otro', country: 'CO', isNational: false, sortOrder: 8 },
  ]

  let created = 0
  const existing = await db.select({ code: documentTypeCatalog.code }).from(documentTypeCatalog).where(and(eq(documentTypeCatalog.tenantId, tenantId), eq(documentTypeCatalog.isDeleted, false)))
  const existingCodes = new Set(existing.map((r) => r.code))

  for (const doc of defaults) {
    if (!existingCodes.has(doc.code)) {
      await db.insert(documentTypeCatalog).values({ tenantId, ...doc, createdBy: user.id, updatedBy: user.id })
      created++
    }
  }
  return c.json(ok(`Tipos de documento sembrados`, { created, total: defaults.length, skipped: defaults.length - created }))
})

catalogRoutes.post('/document-types', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', documentTypeCatalogSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  const [saved] = await db.insert(documentTypeCatalog).values({ tenantId, ...payload, createdBy: user.id, updatedBy: user.id }).returning()
  if (!saved) throw new AppError('No fue posible guardar el tipo de documento', 500)
  return c.json(created('Tipo de documento guardado', saved), 201)
})

catalogRoutes.get('/reports', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const yearId = c.req.query('academicYearId')
  const reportType = c.req.query('reportType')
  const where = and(
    eq(officialReports.tenantId, tenantId),
    eq(officialReports.isDeleted, false),
    yearId ? eq(officialReports.academicYearId, yearId) : undefined,
    reportType ? eq(officialReports.reportType, reportType) : undefined,
  )
  const rows = await db.select().from(officialReports).where(where).orderBy(desc(officialReports.reportDate))
  return c.json(ok('Reportes oficiales cargados', { items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), submittedAt: r.submittedAt?.toISOString() ?? null })) }))
})

catalogRoutes.post('/reports', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', officialReportSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [year] = await db.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.id, payload.academicYearId), eq(academicYears.tenantId, tenantId), eq(academicYears.isDeleted, false))).limit(1)
  if (!year) throw new AppError('Año lectivo no encontrado', 404)

  const [saved] = await db.insert(officialReports).values({
    tenantId,
    reportType: payload.reportType,
    academicYearId: payload.academicYearId,
    reportDate: payload.reportDate ? payload.reportDate : new Date().toISOString().slice(0, 10),
    responsibleName: payload.responsibleName,
    fileName: payload.fileName || null,
    fileKey: payload.fileKey || null,
    notes: payload.notes || null,
    status: payload.status,
    submittedAt: payload.status === 'submitted' ? new Date() : null,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()
  if (!saved) throw new AppError('No fue posible guardar el reporte oficial', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'official_reports', entityId: saved.id, action: 'create', changes: payload as Record<string, unknown>, ipAddress: c.req.header('cf-connecting-ip') })
  return c.json(created('Reporte oficial registrado', saved), 201)
})

catalogRoutes.patch('/reports/:id/status', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json() as { status?: string; notes?: string }
  const status = body.status

  const [existing] = await db.select().from(officialReports).where(and(eq(officialReports.id, id), eq(officialReports.tenantId, tenantId), eq(officialReports.isDeleted, false))).limit(1)
  if (!existing) throw new AppError('Reporte oficial no encontrado', 404)

  const now = new Date()
  const [saved] = await db.update(officialReports).set({
    status: status ?? existing.status,
    notes: body.notes !== undefined ? body.notes : existing.notes,
    submittedAt: status === 'submitted' ? now : existing.submittedAt,
    updatedAt: now,
    updatedBy: user.id,
  }).where(eq(officialReports.id, id)).returning()
  if (!saved) throw new AppError('No fue posible actualizar el reporte', 500)
  return c.json(ok('Reporte actualizado', saved))
})

catalogRoutes.patch('/students/:studentId/sensitive-data', requirePermission(PERMISSIONS.STUDENTS_WRITE), zValidator('json', studentSensitiveDataSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const studentId = c.req.param('studentId')
  const payload = c.req.valid('json')

  const [existing] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId), eq(students.isDeleted, false))).limit(1)
  if (!existing) throw new AppError('Estudiante no encontrado', 404)

  const userRole = user.roleCodes[0] ?? ''
  const isAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'coordinator'
  if (!isAdmin && (payload.medicalConditions || payload.disabilityInfo || payload.reasonableAdjustments)) {
    throw new AppError('No tiene permisos para modificar datos sensibles del estudiante', 403)
  }

  const [saved] = await db.update(students).set({
    medicalConditions: payload.medicalConditions ?? existing.medicalConditions,
    disabilityInfo: payload.disabilityInfo ?? existing.disabilityInfo,
    reasonableAdjustments: payload.reasonableAdjustments ?? existing.reasonableAdjustments,
    daneInstitutionCode: payload.daneInstitutionCode ?? existing.daneInstitutionCode,
    daneBranchCode: payload.daneBranchCode ?? existing.daneBranchCode,
    calendar: payload.calendar ?? existing.calendar,
    zone: payload.zone ?? existing.zone,
    sector: payload.sector ?? existing.sector,
    originInstitution: payload.originInstitution ?? existing.originInstitution,
    originGrade: payload.originGrade ?? existing.originGrade,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(eq(students.id, studentId)).returning()
  if (!saved) throw new AppError('No fue posible actualizar los datos del estudiante', 500)

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'students', entityId: studentId, action: 'update_sensitive', changes: { updated: Object.keys(payload).filter((k) => payload[k as keyof typeof payload] !== undefined && payload[k as keyof typeof payload] !== null) }, ipAddress: c.req.header('cf-connecting-ip') })
  return c.json(ok('Datos del estudiante actualizados', { id: saved.id }))
})

catalogRoutes.get('/students/:studentId/emergency-contacts', requirePermission(PERMISSIONS.STUDENTS_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const studentId = c.req.param('studentId')

  const [student] = await db.select({ id: students.id, emergencyContacts: students.emergencyContacts, pickupAuthorized: students.pickupAuthorized }).from(students).where(and(eq(students.id, studentId), eq(students.tenantId, tenantId), eq(students.isDeleted, false))).limit(1)
  if (!student) throw new AppError('Estudiante no encontrado', 404)

  return c.json(ok('Contactos de emergencia cargados', {
    emergencyContacts: (student.emergencyContacts as Array<{ name: string; phone: string; relationship: string }>) ?? [],
    pickupAuthorized: (student.pickupAuthorized as Array<{ name: string; phone: string; relationship: string; isAuthorizedToPickup: boolean }>) ?? [],
  }))
})
