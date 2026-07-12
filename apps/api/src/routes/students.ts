import { and, asc, count, desc, eq, ilike, ne, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  academicYears,
  admissionApplications,
  enrollments,
  formFieldValues,
  formSubmissions,
  grades,
  groups,
  guardians,
  students,
  uploadedDocuments,
} from '@ofir/db'
import { PERMISSIONS, studentAdmissionProfileSchema, studentFiltersSchema, studentSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const studentRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

studentRoutes.use('*', tenantMiddleware, authMiddleware)

const formatFieldDisplayValue = (row: {
  valueText: string | null
  valueNumber: string | null
  valueBoolean: boolean | null
  valueDate: string | null
  valueTimestamp: Date | null
  valueJson: unknown
}) => {
  if (row.valueText) return row.valueText
  if (row.valueNumber) return row.valueNumber
  if (typeof row.valueBoolean === 'boolean') return row.valueBoolean ? 'Sí' : 'No'
  if (row.valueDate) return row.valueDate
  if (row.valueTimestamp) return row.valueTimestamp.toISOString()

  if (Array.isArray(row.valueJson)) {
    return row.valueJson.map((item) => String(item)).join(', ')
  }

  if (row.valueJson && typeof row.valueJson === 'object') {
    return JSON.stringify(row.valueJson)
  }

  if (row.valueJson !== null && row.valueJson !== undefined) {
    return String(row.valueJson)
  }

  return 'Sin respuesta'
}

studentRoutes.get('/', requirePermission(PERMISSIONS.STUDENTS_READ), zValidator('query', studentFiltersSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')
  const offset = (filters.page - 1) * filters.pageSize
  let academicYearId: string | undefined

  if (filters.year) {
    const [row] = await db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, filters.year), eq(academicYears.isDeleted, false)))
      .limit(1)
    academicYearId = row?.id
  }

  const searchFilter = filters.query
    ? or(
        ilike(students.firstName, `%${filters.query}%`),
        ilike(students.middleName, `%${filters.query}%`),
        ilike(students.lastName, `%${filters.query}%`),
        ilike(students.documentNumber, `%${filters.query}%`),
        sql`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}) ILIKE ${`%${filters.query}%`}`,
      )
    : undefined

  const whereClause = and(
    eq(students.tenantId, tenantId),
    eq(students.isDeleted, false),
    searchFilter,
    academicYearId ? eq(enrollments.academicYearId, academicYearId) : undefined,
    filters.gradeId ? eq(enrollments.gradeId, filters.gradeId) : undefined,
    filters.groupId ? eq(enrollments.groupId, filters.groupId) : undefined,
  )

  const items = await db
    .select({
      student: students,
      academicYearName: academicYears.name,
      gradeName: grades.name,
      groupName: groups.name,
    })
    .from(students)
    .leftJoin(enrollments, and(eq(enrollments.studentId, students.id), eq(enrollments.tenantId, tenantId), eq(enrollments.isDeleted, false)))
    .leftJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .leftJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .where(whereClause)
    .orderBy(desc(students.createdAt), asc(students.firstName))
    .limit(filters.pageSize)
    .offset(offset)

  const [totalRow] = await db
    .select({ total: count(sql`distinct ${students.id}`) })
    .from(students)
    .leftJoin(enrollments, and(eq(enrollments.studentId, students.id), eq(enrollments.tenantId, tenantId), eq(enrollments.isDeleted, false)))
    .where(whereClause)

  return c.json(
    ok('Estudiantes cargados', {
      items: items.map(({ student, academicYearName, gradeName, groupName }) => ({
        id: student.id,
        tenantId: student.tenantId,
        firstName: student.firstName,
        middleName: student.middleName,
        lastName: student.lastName,
        documentType: student.documentType,
        documentNumber: student.documentNumber,
        birthDate: student.birthDate,
        gender: student.gender,
        bloodType: student.bloodType,
        status: student.status,
        academicYearName: academicYearName ?? null,
        gradeName: gradeName ?? null,
        groupName: groupName ?? null,
        createdAt: student.createdAt.toISOString(),
        updatedAt: student.updatedAt.toISOString(),
      })),
      total: totalRow?.total ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  )
})

studentRoutes.post('/', requirePermission(PERMISSIONS.STUDENTS_WRITE), zValidator('json', studentSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const payload = c.req.valid('json')
  const user = c.get('user')

  const [duplicate] = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.tenantId, tenantId),
        eq(students.documentType, payload.documentType),
        eq(students.documentNumber, payload.documentNumber),
        eq(students.isDeleted, false),
      ),
    )
    .limit(1)

  if (duplicate) {
    throw new AppError('Ya existe un estudiante con este tipo y número de documento', 409)
  }

  let student: { id: string } | undefined
  try {
    ;[student] = await db
      .insert(students)
      .values({
        tenantId,
        firstName: payload.firstName,
        middleName: payload.middleName || null,
        lastName: payload.lastName,
        documentType: payload.documentType,
        documentNumber: payload.documentNumber,
        birthDate: payload.birthDate || null,
        gender: payload.gender,
        bloodType: payload.bloodType || null,
        status: payload.status,
        emergencyContacts: [],
        pickupAuthorized: [],
        sensitiveDataAccess: {},
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: students.id })
  } catch (error) {
    console.error('Error creating student', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new AppError(`No fue posible crear el estudiante: ${errorMessage}`, 500)
  }

  if (!student) {
    throw new AppError('No fue posible crear el estudiante', 500)
  }

  try {
    await writeAuditLog(db, {
      tenantId,
      actorUserId: user.id,
      entity: 'students',
      entityId: student.id,
      action: 'create',
      changes: payload,
      ipAddress: c.req.header('cf-connecting-ip'),
    })
  } catch (error) {
    console.error('Error writing student create audit log', error)
  }

  return c.json(
    created('Estudiante creado', {
      id: student.id,
    }),
    201,
  )
})

studentRoutes.get('/:id/admission-profile', requirePermission(PERMISSIONS.STUDENTS_READ), zValidator('query', studentAdmissionProfileSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')
  const filters = c.req.valid('query')

  const [student] = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      documentType: students.documentType,
      documentNumber: students.documentNumber,
      birthDate: students.birthDate,
      gender: students.gender,
      bloodType: students.bloodType,
      status: students.status,
    })
    .from(students)
    .where(and(eq(students.id, id), eq(students.tenantId, tenantId), eq(students.isDeleted, false)))
    .limit(1)

  if (!student) {
    throw new AppError('Estudiante no encontrado', 404)
  }

  let academicYearId: string | undefined
  if (filters.year) {
    const [yearRow] = await db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, filters.year), eq(academicYears.isDeleted, false)))
      .limit(1)
    academicYearId = yearRow?.id
  }

  const [row] = await db
    .select({
      application: admissionApplications,
      guardian: guardians,
      academicYearName: academicYears.name,
      gradeName: grades.name,
      groupName: groups.name,
      submissionId: formSubmissions.id,
      submissionStatus: formSubmissions.status,
      submissionProgressPercent: formSubmissions.progressPercent,
      submissionSubmittedAt: formSubmissions.submittedAt,
      submissionMetadata: formSubmissions.metadata,
    })
    .from(admissionApplications)
    .leftJoin(guardians, eq(guardians.id, admissionApplications.primaryGuardianId))
    .leftJoin(academicYears, eq(academicYears.id, admissionApplications.academicYearId))
    .leftJoin(grades, eq(grades.id, admissionApplications.requestedGradeId))
    .leftJoin(groups, eq(groups.id, admissionApplications.requestedGroupId))
    .leftJoin(formSubmissions, eq(formSubmissions.admissionApplicationId, admissionApplications.id))
    .where(
      and(
        eq(admissionApplications.studentId, id),
        eq(admissionApplications.tenantId, tenantId),
        eq(admissionApplications.isDeleted, false),
        academicYearId ? eq(admissionApplications.academicYearId, academicYearId) : undefined,
      ),
    )
    .orderBy(desc(admissionApplications.submittedAt), desc(admissionApplications.createdAt))
    .limit(1)

  if (!row) {
    return c.json(ok('Perfil de inscripción cargado', { admission: null }))
  }

  const values = row.submissionId
    ? await db
        .select({
          fieldCode: formFieldValues.fieldCode,
          fieldLabel: formFieldValues.fieldLabelSnapshot,
          fieldType: formFieldValues.fieldType,
          sectionTitle: formFieldValues.sectionTitleSnapshot,
          valueText: formFieldValues.valueText,
          valueNumber: formFieldValues.valueNumber,
          valueBoolean: formFieldValues.valueBoolean,
          valueDate: formFieldValues.valueDate,
          valueTimestamp: formFieldValues.valueTimestamp,
          valueJson: formFieldValues.valueJson,
          createdAt: formFieldValues.createdAt,
        })
        .from(formFieldValues)
        .where(
          and(
            eq(formFieldValues.tenantId, tenantId),
            eq(formFieldValues.formSubmissionId, row.submissionId),
            eq(formFieldValues.isDeleted, false),
          ),
        )
        .orderBy(asc(formFieldValues.createdAt))
    : []

  const uploaded = row.submissionId
    ? await db
        .select({
          id: uploadedDocuments.id,
          requiredDocumentId: uploadedDocuments.requiredDocumentId,
          fileName: uploadedDocuments.fileName,
          mimeType: uploadedDocuments.mimeType,
          fileSizeBytes: uploadedDocuments.fileSizeBytes,
          status: uploadedDocuments.status,
          metadata: uploadedDocuments.metadata,
        })
        .from(uploadedDocuments)
        .where(
          and(
            eq(uploadedDocuments.tenantId, tenantId),
            eq(uploadedDocuments.formSubmissionId, row.submissionId),
            eq(uploadedDocuments.isDeleted, false),
          ),
        )
        .orderBy(desc(uploadedDocuments.uploadedAt))
    : []

  const sectionsMap = new Map<string, { title: string; fields: Array<{ fieldCode: string; fieldLabel: string; fieldType: string; displayValue: string; rawValue: unknown }> }>()

  values.forEach((value) => {
    const bucket = sectionsMap.get(value.sectionTitle) ?? { title: value.sectionTitle, fields: [] }
    bucket.fields.push({
      fieldCode: value.fieldCode,
      fieldLabel: value.fieldLabel,
      fieldType: value.fieldType,
      displayValue: formatFieldDisplayValue(value),
      rawValue:
        value.valueJson ??
        value.valueText ??
        value.valueNumber ??
        value.valueBoolean ??
        value.valueDate ??
        value.valueTimestamp,
    })
    sectionsMap.set(value.sectionTitle, bucket)
  })

  const metadataDocuments = Array.isArray((row.submissionMetadata as { selectedDocuments?: unknown } | null)?.selectedDocuments)
    ? ((row.submissionMetadata as { selectedDocuments?: Array<Record<string, unknown>> }).selectedDocuments ?? [])
    : []

  const normalizedUploaded = uploaded.map((document) => ({
    id: document.id,
    documentCode: String((document.metadata as { documentCode?: unknown } | null)?.documentCode ?? document.requiredDocumentId),
    name: String((document.metadata as { documentName?: unknown } | null)?.documentName ?? document.fileName),
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileSizeBytes: document.fileSizeBytes,
    status: document.status,
    source: 'uploaded' as const,
  }))

  const uploadedCodes = new Set(normalizedUploaded.map((document) => document.documentCode))
  const normalizedMetadata = metadataDocuments
    .filter((document) => !uploadedCodes.has(String(document.documentCode ?? '')))
    .map((document, index) => ({
      id: `metadata-${index}-${String(document.documentCode ?? 'doc')}`,
      documentCode: String(document.documentCode ?? `doc-${index + 1}`),
      name: String(document.documentName ?? document.documentCode ?? `Documento ${index + 1}`),
      fileName: String(document.fileName ?? 'Archivo sin nombre'),
      mimeType: typeof document.mimeType === 'string' ? document.mimeType : null,
      fileSizeBytes: typeof document.fileSizeBytes === 'number' ? document.fileSizeBytes : null,
      status: 'pendiente_carga',
      source: 'metadata' as const,
    }))

  return c.json(
    ok('Perfil de inscripción cargado', {
      admission: {
        application: {
          id: row.application.id,
          studentId: row.application.studentId,
          studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
          studentDocument: `${student.documentType} ${student.documentNumber}`.trim(),
          guardianName: row.guardian ? [row.guardian.firstName, row.guardian.lastName].filter(Boolean).join(' ') : '',
          guardianEmail: row.guardian?.email ?? null,
          requestedGradeId: row.application.requestedGradeId,
          requestedGradeName: row.gradeName ?? '',
          requestedGroupId: row.application.requestedGroupId,
          requestedGroupName: row.groupName ?? null,
          academicYearId: row.application.academicYearId,
          academicYearName: row.academicYearName ?? '',
          status: row.application.status,
          source: row.application.source,
          progress:
            row.application.status === 'submitted'
              ? 40
              : row.application.status === 'reviewing'
                ? 72
                : row.application.status === 'accepted' || row.application.status === 'converted'
                  ? 100
                  : 20,
          applicationDate: row.application.applicationDate.toISOString(),
          submittedAt: row.application.submittedAt?.toISOString() ?? null,
          convertedEnrollmentId: row.application.convertedEnrollmentId,
          notes: row.application.notes ?? null,
          fixedData: row.application.fixedData ?? {},
        },
        student: {
          id: student.id,
          firstName: student.firstName,
          middleName: student.middleName,
          lastName: student.lastName,
          documentType: student.documentType,
          documentNumber: student.documentNumber,
          birthDate: student.birthDate,
          gender: student.gender,
          bloodType: student.bloodType,
          status: student.status,
        },
        guardian: row.guardian
          ? {
              id: row.guardian.id,
              firstName: row.guardian.firstName,
              lastName: row.guardian.lastName,
              documentType: row.guardian.documentType,
              documentNumber: row.guardian.documentNumber,
              phone: row.guardian.phone,
              email: row.guardian.email,
              relationship: row.guardian.relationship,
            }
          : null,
        submission: row.submissionId
          ? {
              id: row.submissionId,
              status: row.submissionStatus ?? 'draft',
              progressPercent: row.submissionProgressPercent ?? 0,
              submittedAt: row.submissionSubmittedAt?.toISOString() ?? null,
            }
          : null,
        sections: Array.from(sectionsMap.values()),
        documents: [...normalizedUploaded, ...normalizedMetadata],
      },
    }),
  )
})

studentRoutes.put('/:id', requirePermission(PERMISSIONS.STUDENTS_WRITE), zValidator('json', studentSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const payload = c.req.valid('json')
  const user = c.get('user')
  const id = c.req.param('id')

  const [duplicate] = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.tenantId, tenantId),
        eq(students.documentType, payload.documentType),
        eq(students.documentNumber, payload.documentNumber),
        eq(students.isDeleted, false),
        ne(students.id, id),
      ),
    )
    .limit(1)

  if (duplicate) {
    throw new AppError('Ya existe otro estudiante con este tipo y número de documento', 409)
  }

  let student:
    | {
        id: string
        tenantId: string
        firstName: string
        middleName: string | null
        lastName: string
        documentType: string
        documentNumber: string
        birthDate: string | null
        gender: string | null
        bloodType: string | null
        status: string
        createdAt: Date
        updatedAt: Date
      }
    | undefined
  try {
    ;[student] = await db
      .update(students)
      .set({
        firstName: payload.firstName,
        middleName: payload.middleName || null,
        lastName: payload.lastName,
        documentType: payload.documentType,
        documentNumber: payload.documentNumber,
        birthDate: payload.birthDate || null,
        gender: payload.gender,
        bloodType: payload.bloodType || null,
        status: payload.status,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(students.id, id), eq(students.tenantId, tenantId), eq(students.isDeleted, false)))
      .returning({
        id: students.id,
        tenantId: students.tenantId,
        firstName: students.firstName,
        middleName: students.middleName,
        lastName: students.lastName,
        documentType: students.documentType,
        documentNumber: students.documentNumber,
        birthDate: students.birthDate,
        gender: students.gender,
        bloodType: students.bloodType,
        status: students.status,
        createdAt: students.createdAt,
        updatedAt: students.updatedAt,
      })
  } catch (error) {
    console.error('Error updating student', error)
    throw new AppError('No fue posible actualizar el estudiante. Revisa los datos obligatorios e intenta nuevamente.', 500)
  }

  if (!student) {
    throw new AppError('Estudiante no encontrado', 404)
  }

  try {
    await writeAuditLog(db, {
      tenantId,
      actorUserId: user.id,
      entity: 'students',
      entityId: id,
      action: 'update',
      changes: payload,
      ipAddress: c.req.header('cf-connecting-ip'),
    })
  } catch (error) {
    console.error('Error writing student update audit log', error)
  }

  return c.json(ok('Estudiante actualizado', student))
})

studentRoutes.delete('/:id', requirePermission(PERMISSIONS.STUDENTS_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  await db
    .update(students)
    .set({
      isDeleted: true,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(and(eq(students.id, id), eq(students.tenantId, tenantId)))

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'students',
    entityId: id,
    action: 'delete',
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(ok('Estudiante eliminado', { id }))
})
