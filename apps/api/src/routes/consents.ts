import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  admissionApplications,
  consentDocuments,
  consents,
  enrollments,
  formSubmissions,
  guardians,
  students,
} from '@ofir/db'
import {
  PERMISSIONS,
  consentAcceptanceSchema,
  consentDocumentCreateSchema,
  consentDocumentUpdateSchema,
  consentRevocationSchema,
} from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const consentRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

consentRoutes.use('*', authMiddleware, tenantMiddleware)

const fetchActiveDocument = async ({
  db,
  tenantId,
  code,
  version,
}: {
  db: AppContextVariables['db']
  tenantId: string
  code: string
  version?: string
}) => {
  const where = version
    ? and(
        eq(consentDocuments.tenantId, tenantId),
        eq(consentDocuments.code, code),
        eq(consentDocuments.version, version),
        eq(consentDocuments.isDeleted, false),
      )
    : and(
        eq(consentDocuments.tenantId, tenantId),
        eq(consentDocuments.code, code),
        eq(consentDocuments.isActive, true),
        eq(consentDocuments.isDeleted, false),
      )

  const [document] = await db
    .select()
    .from(consentDocuments)
    .where(where)
    .orderBy(desc(consentDocuments.effectiveFrom), desc(consentDocuments.createdAt))
    .limit(1)

  return document ?? null
}

const serializeDocument = (document: typeof consentDocuments.$inferSelect) => ({
  id: document.id,
  code: document.code,
  name: document.name,
  description: document.description ?? null,
  documentType: document.documentType,
  version: document.version,
  body: document.body,
  isActive: document.isActive,
  effectiveFrom: document.effectiveFrom ?? null,
  supersededBy: document.supersededBy ?? null,
  createdAt: document.createdAt.toISOString(),
  updatedAt: document.updatedAt.toISOString(),
})

consentRoutes.get('/documents', requirePermission(PERMISSIONS.CONSENTS_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const rows = await db
    .select()
    .from(consentDocuments)
    .where(and(eq(consentDocuments.tenantId, tenantId), eq(consentDocuments.isDeleted, false)))
    .orderBy(asc(consentDocuments.code), desc(consentDocuments.effectiveFrom), desc(consentDocuments.createdAt))

  return c.json(ok('Documentos de consentimiento cargados', { items: rows.map(serializeDocument) }))
})

consentRoutes.get('/documents/active', async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const rows = await db
    .select()
    .from(consentDocuments)
    .where(
      and(
        eq(consentDocuments.tenantId, tenantId),
        eq(consentDocuments.isActive, true),
        eq(consentDocuments.isDeleted, false),
      ),
    )
    .orderBy(asc(consentDocuments.code), desc(consentDocuments.effectiveFrom))

  const latestByCode = new Map<string, typeof rows[number]>()
  for (const row of rows) {
    if (!latestByCode.has(row.code)) latestByCode.set(row.code, row)
  }

  return c.json(ok('Documentos activos cargados', {
    items: [...latestByCode.values()].map(serializeDocument),
  }))
})

consentRoutes.get('/documents/:id', requirePermission(PERMISSIONS.CONSENTS_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [document] = await db
    .select()
    .from(consentDocuments)
    .where(and(eq(consentDocuments.id, id), eq(consentDocuments.tenantId, tenantId), eq(consentDocuments.isDeleted, false)))
    .limit(1)

  if (!document) throw new AppError('Documento de consentimiento no encontrado', 404)

  return c.json(ok('Documento cargado', serializeDocument(document)))
})

consentRoutes.post('/documents', requirePermission(PERMISSIONS.CONSENTS_WRITE), zValidator('json', consentDocumentCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [duplicate] = await db
    .select({ id: consentDocuments.id })
    .from(consentDocuments)
    .where(
      and(
        eq(consentDocuments.tenantId, tenantId),
        eq(consentDocuments.code, payload.code),
        eq(consentDocuments.version, payload.version),
        eq(consentDocuments.isDeleted, false),
      ),
    )
    .limit(1)

  if (duplicate) {
    throw new AppError('Ya existe un documento con ese código y versión', 409)
  }

  if (payload.isActive) {
    await db
      .update(consentDocuments)
      .set({ isActive: false, updatedAt: new Date(), updatedBy: user.id })
      .where(
        and(
          eq(consentDocuments.tenantId, tenantId),
          eq(consentDocuments.code, payload.code),
          eq(consentDocuments.isActive, true),
          eq(consentDocuments.isDeleted, false),
        ),
      )
  }

  const [saved] = await db
    .insert(consentDocuments)
    .values({
      tenantId,
      code: payload.code,
      name: payload.name,
      description: payload.description || null,
      documentType: payload.documentType,
      version: payload.version,
      body: payload.body,
      isActive: payload.isActive ?? true,
      effectiveFrom: payload.effectiveFrom || null,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning()

  if (!saved) throw new AppError('No fue posible crear el documento de consentimiento', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'consent_documents',
    entityId: saved.id,
    action: 'create',
    changes: payload as Record<string, unknown>,
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(created('Documento de consentimiento creado', serializeDocument(saved)), 201)
})

consentRoutes.put('/documents/:id', requirePermission(PERMISSIONS.CONSENTS_WRITE), zValidator('json', consentDocumentUpdateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  if (payload.id !== id) {
    throw new AppError('El identificador del documento no coincide con la ruta', 400)
  }

  const [existing] = await db
    .select()
    .from(consentDocuments)
    .where(and(eq(consentDocuments.id, id), eq(consentDocuments.tenantId, tenantId), eq(consentDocuments.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Documento no encontrado', 404)

  const [saved] = await db
    .update(consentDocuments)
    .set({
      name: payload.name,
      description: payload.description || null,
      documentType: payload.documentType,
      version: payload.version,
      body: payload.body,
      isActive: payload.isActive ?? true,
      effectiveFrom: payload.effectiveFrom || null,
      supersededBy: payload.supersededBy || null,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(eq(consentDocuments.id, id))
    .returning()

  if (!saved) throw new AppError('No fue posible actualizar el documento', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'consent_documents',
    entityId: saved.id,
    action: 'update',
    changes: { from: existing, to: saved },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(ok('Documento actualizado', serializeDocument(saved)))
})

consentRoutes.get('/records', requirePermission(PERMISSIONS.CONSENTS_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const studentId = c.req.query('studentId')
  const guardianId = c.req.query('guardianId')
  const admissionApplicationId = c.req.query('admissionApplicationId')
  const enrollmentId = c.req.query('enrollmentId')

  const filters = [eq(consents.tenantId, tenantId), eq(consents.isDeleted, false)]
  if (studentId) filters.push(eq(consents.studentId, studentId))
  if (guardianId) filters.push(eq(consents.guardianId, guardianId))
  if (admissionApplicationId) filters.push(eq(consents.admissionApplicationId, admissionApplicationId))
  if (enrollmentId) filters.push(eq(consents.enrollmentId, enrollmentId))

  const rows = await db
    .select({
      consent: consents,
      document: consentDocuments,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      guardianFirstName: guardians.firstName,
      guardianLastName: guardians.lastName,
    })
    .from(consents)
    .innerJoin(consentDocuments, eq(consentDocuments.id, consents.consentDocumentId))
    .leftJoin(students, eq(students.id, consents.studentId))
    .leftJoin(guardians, eq(guardians.id, consents.guardianId))
    .where(and(...filters))
    .orderBy(desc(consents.acceptedAt))

  return c.json(ok('Consentimientos cargados', {
    items: rows.map(({ consent, document, studentFirstName, studentLastName, guardianFirstName, guardianLastName }) => ({
      id: consent.id,
      documentId: document.id,
      documentCode: document.code,
      documentName: document.name,
      documentType: document.documentType,
      version: consent.version,
      status: consent.status,
      acceptedByName: consent.acceptedByName,
      acceptedByDocument: consent.acceptedByDocument,
      acceptedByRelationship: consent.acceptedByRelationship,
      acceptedAt: consent.acceptedAt.toISOString(),
      channel: consent.channel,
      ipAddress: consent.ipAddress,
      revokedAt: consent.revokedAt?.toISOString() ?? null,
      revocationReason: consent.revocationReason ?? null,
      studentId: consent.studentId,
      studentName: [studentFirstName, studentLastName].filter(Boolean).join(' ') || null,
      guardianId: consent.guardianId,
      guardianName: [guardianFirstName, guardianLastName].filter(Boolean).join(' ') || null,
      admissionApplicationId: consent.admissionApplicationId,
      enrollmentId: consent.enrollmentId,
      formSubmissionId: consent.formSubmissionId,
    })),
  }))
})

consentRoutes.get('/records/:id', requirePermission(PERMISSIONS.CONSENTS_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [row] = await db
    .select({
      consent: consents,
      document: consentDocuments,
    })
    .from(consents)
    .innerJoin(consentDocuments, eq(consentDocuments.id, consents.consentDocumentId))
    .where(and(eq(consents.id, id), eq(consents.tenantId, tenantId), eq(consents.isDeleted, false)))
    .limit(1)

  if (!row) throw new AppError('Consentimiento no encontrado', 404)

  return c.json(ok('Detalle de consentimiento cargado', {
    id: row.consent.id,
    document: serializeDocument(row.document),
    version: row.consent.version,
    status: row.consent.status,
    acceptedByName: row.consent.acceptedByName,
    acceptedByDocument: row.consent.acceptedByDocument,
    acceptedByRelationship: row.consent.acceptedByRelationship,
    acceptedAt: row.consent.acceptedAt.toISOString(),
    channel: row.consent.channel,
    ipAddress: row.consent.ipAddress,
    userAgent: row.consent.userAgent,
    textSnapshot: row.consent.textSnapshot,
    revokedAt: row.consent.revokedAt?.toISOString() ?? null,
    revocationReason: row.consent.revocationReason ?? null,
    studentId: row.consent.studentId,
    guardianId: row.consent.guardianId,
    admissionApplicationId: row.consent.admissionApplicationId,
    enrollmentId: row.consent.enrollmentId,
    formSubmissionId: row.consent.formSubmissionId,
  }))
})

consentRoutes.post('/accept', requirePermission(PERMISSIONS.CONSENTS_WRITE), zValidator('json', consentAcceptanceSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const document = await fetchActiveDocument({
    db,
    tenantId,
    code: payload.documentCode,
    version: payload.version,
  })

  if (!document) {
    throw new AppError('No existe un documento de consentimiento activo para ese código y versión', 404)
  }

  if (payload.admissionApplicationId) {
    const [application] = await db
      .select({ id: admissionApplications.id })
      .from(admissionApplications)
      .where(
        and(
          eq(admissionApplications.id, payload.admissionApplicationId),
          eq(admissionApplications.tenantId, tenantId),
          eq(admissionApplications.isDeleted, false),
        ),
      )
      .limit(1)
    if (!application) throw new AppError('La solicitud de admisión asociada no existe', 404)
  }

  if (payload.enrollmentId) {
    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.id, payload.enrollmentId),
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.isDeleted, false),
        ),
      )
      .limit(1)
    if (!enrollment) throw new AppError('La matrícula asociada no existe', 404)
  }

  if (payload.formSubmissionId) {
    const [submission] = await db
      .select({ id: formSubmissions.id })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.id, payload.formSubmissionId),
          eq(formSubmissions.tenantId, tenantId),
          eq(formSubmissions.isDeleted, false),
        ),
      )
      .limit(1)
    if (!submission) throw new AppError('La entrega de formulario asociada no existe', 404)
  }

  if (payload.studentId) {
    const [student] = await db
      .select({ id: students.id })
      .from(students)
      .where(
        and(
          eq(students.id, payload.studentId),
          eq(students.tenantId, tenantId),
          eq(students.isDeleted, false),
        ),
      )
      .limit(1)
    if (!student) throw new AppError('El estudiante asociado no existe', 404)
  }

  if (payload.guardianId) {
    const [guardian] = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(
        and(
          eq(guardians.id, payload.guardianId),
          eq(guardians.tenantId, tenantId),
          eq(guardians.isDeleted, false),
        ),
      )
      .limit(1)
    if (!guardian) throw new AppError('El acudiente asociado no existe', 404)
  }

  const [createdConsent] = await db
    .insert(consents)
    .values({
      tenantId,
      consentDocumentId: document.id,
      studentId: payload.studentId || null,
      guardianId: payload.guardianId || null,
      admissionApplicationId: payload.admissionApplicationId || null,
      enrollmentId: payload.enrollmentId || null,
      formSubmissionId: payload.formSubmissionId || null,
      acceptedByName: payload.acceptedByName,
      acceptedByRelationship: payload.acceptedByRelationship || null,
      acceptedAt: new Date(),
      channel: payload.channel,
      ipAddress: c.req.header('cf-connecting-ip') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
      textSnapshot: document.body,
      version: document.version,
      status: 'accepted',
      metadata: payload.notes ? { notes: payload.notes } : {},
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning()

  if (!createdConsent) throw new AppError('No fue posible registrar el consentimiento', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'consents',
    entityId: createdConsent.id,
    action: 'accept',
    changes: {
      documentCode: document.code,
      documentVersion: document.version,
      studentId: payload.studentId || null,
      guardianId: payload.guardianId || null,
      admissionApplicationId: payload.admissionApplicationId || null,
      enrollmentId: payload.enrollmentId || null,
      channel: payload.channel,
    },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(created('Consentimiento registrado', {
    id: createdConsent.id,
    documentId: document.id,
    documentCode: document.code,
    version: document.version,
    status: createdConsent.status,
    acceptedAt: createdConsent.acceptedAt.toISOString(),
  }), 201)
})

consentRoutes.post('/records/:id/revoke', requirePermission(PERMISSIONS.CONSENTS_WRITE), zValidator('json', consentRevocationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [existing] = await db
    .select()
    .from(consents)
    .where(and(eq(consents.id, id), eq(consents.tenantId, tenantId), eq(consents.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Consentimiento no encontrado', 404)
  if (existing.status === 'revoked') {
    return c.json(ok('El consentimiento ya estaba revocado', { id: existing.id, status: existing.status }))
  }

  const now = new Date()
  const [updated] = await db
    .update(consents)
    .set({
      status: 'revoked',
      revokedAt: now,
      revokedBy: user.id,
      revocationReason: payload.reason,
      updatedAt: now,
      updatedBy: user.id,
    })
    .where(eq(consents.id, id))
    .returning()

  if (!updated) throw new AppError('No fue posible revocar el consentimiento', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'consents',
    entityId: id,
    action: 'revoke',
    changes: { reason: payload.reason, from: existing.status, to: updated.status },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(ok('Consentimiento revocado', {
    id: updated.id,
    status: updated.status,
    revokedAt: updated.revokedAt?.toISOString() ?? null,
    revocationReason: updated.revocationReason ?? null,
  }))
})

consentRoutes.get('/student/:studentId/evidence', requirePermission(PERMISSIONS.CONSENTS_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const studentId = c.req.param('studentId')

  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.id, studentId),
        eq(students.tenantId, tenantId),
        eq(students.isDeleted, false),
      ),
    )
    .limit(1)
  if (!student) throw new AppError('Estudiante no encontrado', 404)

  const rows = await db
    .select({
      consent: consents,
      document: consentDocuments,
    })
    .from(consents)
    .innerJoin(consentDocuments, eq(consentDocuments.id, consents.consentDocumentId))
    .where(
      and(
        eq(consents.tenantId, tenantId),
        eq(consents.studentId, studentId),
        eq(consents.isDeleted, false),
      ),
    )
    .orderBy(desc(consents.acceptedAt))

  return c.json(ok('Evidencia de consentimientos del estudiante cargada', {
    studentId,
    items: rows.map(({ consent, document }) => ({
      id: consent.id,
      documentCode: document.code,
      documentName: document.name,
      documentType: document.documentType,
      version: consent.version,
      status: consent.status,
      acceptedByName: consent.acceptedByName,
      acceptedByRelationship: consent.acceptedByRelationship,
      acceptedAt: consent.acceptedAt.toISOString(),
      channel: consent.channel,
      ipAddress: consent.ipAddress,
      revokedAt: consent.revokedAt?.toISOString() ?? null,
      revocationReason: consent.revocationReason ?? null,
      textSnapshot: consent.textSnapshot,
    })),
  }))
})

export const upsertConsentDocument = async ({
  db,
  tenantId,
  user,
  payload,
  ipAddress,
}: {
  db: AppContextVariables['db']
  tenantId: string
  user: { id: string }
  payload: {
    code: string
    name: string
    description?: string | null
    documentType: 'privacy_notice' | 'data_treatment_authorization' | 'image_rights' | 'school_transport' | 'medical_authorization' | 'academic_publication' | 'enrollment_contract' | 'promissory_note' | 'other'
    version: string
    body: string
    isActive?: boolean
    effectiveFrom?: string | null
  }
  ipAddress?: string | null
}) => {
  const [existing] = await db
    .select({ id: consentDocuments.id, isActive: consentDocuments.isActive })
    .from(consentDocuments)
    .where(
      and(
        eq(consentDocuments.tenantId, tenantId),
        eq(consentDocuments.code, payload.code),
        eq(consentDocuments.version, payload.version),
        eq(consentDocuments.isDeleted, false),
      ),
    )
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(consentDocuments)
      .set({
        name: payload.name,
        description: payload.description || null,
        documentType: payload.documentType,
        body: payload.body,
        isActive: payload.isActive ?? existing.isActive,
        effectiveFrom: payload.effectiveFrom || null,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(consentDocuments.id, existing.id))
      .returning({ id: consentDocuments.id, version: consentDocuments.version, isActive: consentDocuments.isActive })
    return updated ?? null
  }

  if (payload.isActive) {
    await db
      .update(consentDocuments)
      .set({ isActive: false, updatedAt: new Date(), updatedBy: user.id })
      .where(
        and(
          eq(consentDocuments.tenantId, tenantId),
          eq(consentDocuments.code, payload.code),
          eq(consentDocuments.isActive, true),
          eq(consentDocuments.isDeleted, false),
        ),
      )
  }

  const [createdDoc] = await db
    .insert(consentDocuments)
    .values({
      tenantId,
      code: payload.code,
      name: payload.name,
      description: payload.description || null,
      documentType: payload.documentType,
      version: payload.version,
      body: payload.body,
      isActive: payload.isActive ?? true,
      effectiveFrom: payload.effectiveFrom || null,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: consentDocuments.id, version: consentDocuments.version, isActive: consentDocuments.isActive })

  return createdDoc ?? null
}

export const recordPublicConsents = async ({
  db,
  tenantId,
  consents: incomingConsents,
  context,
  ipAddress,
  userAgent,
  fallbackActorName,
}: {
  db: AppContextVariables['db']
  tenantId: string
  consents: Array<{ documentCode: string; accepted: true; acceptedByName: string; acceptedByRelationship?: string | null }>
  context: {
    studentId?: string | null
    guardianId?: string | null
    admissionApplicationId?: string | null
    formSubmissionId?: string | null
  }
  ipAddress?: string | null
  userAgent?: string | null
  fallbackActorName: string
}) => {
  if (!incomingConsents.length) return []

  const documentCodes = Array.from(new Set(incomingConsents.map((consent) => consent.documentCode)))
  const documents = await db
    .select()
    .from(consentDocuments)
    .where(
      and(
        eq(consentDocuments.tenantId, tenantId),
        inArray(consentDocuments.code, documentCodes),
        eq(consentDocuments.isActive, true),
        eq(consentDocuments.isDeleted, false),
      ),
    )

  if (documents.length === 0) return []

  const documentsByCode = new Map<string, typeof documents[number]>()
  for (const doc of documents) {
    if (!documentsByCode.has(doc.code)) documentsByCode.set(doc.code, doc)
  }

  const recorded: Array<{ id: string; documentCode: string; version: string }> = []

  for (const consent of incomingConsents) {
    const document = documentsByCode.get(consent.documentCode)
    if (!document) continue
    const [createdConsent] = await db
      .insert(consents)
      .values({
        tenantId,
        consentDocumentId: document.id,
        studentId: context.studentId ?? null,
        guardianId: context.guardianId ?? null,
        admissionApplicationId: context.admissionApplicationId ?? null,
        formSubmissionId: context.formSubmissionId ?? null,
        acceptedByName: consent.acceptedByName || fallbackActorName,
        acceptedByRelationship: consent.acceptedByRelationship || null,
        acceptedAt: new Date(),
        channel: 'public_form',
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        textSnapshot: document.body,
        version: document.version,
        status: 'accepted',
        metadata: { source: 'public_form' },
      })
      .returning({ id: consents.id, documentCode: consentDocuments.code, version: consentDocuments.version })

    if (!createdConsent) continue
    recorded.push({ id: createdConsent.id, documentCode: consent.documentCode, version: document.version })
  }

  return recorded
}

export const ensureRequiredConsentsCaptured = async ({
  db,
  tenantId,
  applicationId,
  requiredCodes,
}: {
  db: AppContextVariables['db']
  tenantId: string
  applicationId: string
  requiredCodes: string[]
}) => {
  if (!requiredCodes.length) return

  const captured = await db
    .select({
      code: consentDocuments.code,
      status: consents.status,
    })
    .from(consents)
    .innerJoin(consentDocuments, eq(consentDocuments.id, consents.consentDocumentId))
    .where(
      and(
        eq(consents.tenantId, tenantId),
        eq(consents.admissionApplicationId, applicationId),
        eq(consents.isDeleted, false),
        inArray(consentDocuments.code, requiredCodes),
      ),
    )

  const capturedCodes = new Set(
    captured.filter((row) => row.status === 'accepted').map((row) => row.code),
  )
  const missing = requiredCodes.filter((code) => !capturedCodes.has(code))

  if (missing.length) {
    throw new AppError(
      `Falta la aceptación de consentimientos obligatorios: ${missing.join(', ')}`,
      409,
    )
  }
}

export const listApplicationConsents = async ({
  db,
  tenantId,
  applicationId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  applicationId: string
}) => {
  const rows = await db
    .select({
      consent: consents,
      document: consentDocuments,
    })
    .from(consents)
    .innerJoin(consentDocuments, eq(consentDocuments.id, consents.consentDocumentId))
    .where(
      and(
        eq(consents.tenantId, tenantId),
        eq(consents.admissionApplicationId, applicationId),
        eq(consents.isDeleted, false),
      ),
    )
    .orderBy(desc(consents.acceptedAt))

  return rows.map(({ consent, document }) => ({
    id: consent.id,
    documentId: document.id,
    documentCode: document.code,
    documentName: document.name,
    documentType: document.documentType,
    version: consent.version,
    status: consent.status,
    acceptedByName: consent.acceptedByName,
    acceptedByRelationship: consent.acceptedByRelationship,
    acceptedAt: consent.acceptedAt.toISOString(),
    channel: consent.channel,
    ipAddress: consent.ipAddress,
    revokedAt: consent.revokedAt?.toISOString() ?? null,
    revocationReason: consent.revocationReason ?? null,
  }))
}
