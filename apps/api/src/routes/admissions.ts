import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  academicPeriods,
  academicYears,
  admissionApplications,
  enrollments,
  formFieldValues,
  formSubmissions,
  formTemplates,
  formTemplateVersions,
  grades,
  groups,
  guardians,
  studentGuardians,
  students,
  tenants,
  uploadedDocuments,
} from '@ofir/db'
import {
  PERMISSIONS,
  admissionProcessSchema,
  manualAdmissionSchema,
  admissionConversionSchema,
  admissionFiltersSchema,
  admissionStatusUpdateSchema,
} from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { validateEnrollmentPlacement } from '../lib/enrollment-placement'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const admissionRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

admissionRoutes.use('*', tenantMiddleware, authMiddleware)

const todayIsoDate = () => new Date().toISOString().slice(0, 10)

const processStatus = (startsOn: string | null, endsOn: string | null, today: string) => {
  if (startsOn && startsOn > today) return 'programado'
  if (endsOn && endsOn < today) return 'cerrado'
  return 'activo'
}

const getAdmissionSetupStatus = async ({
  db,
  tenantId,
  academicYearId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
}) => {
  const [periodsCount] = await db
    .select({ total: count() })
    .from(academicPeriods)
    .where(
      and(
        eq(academicPeriods.tenantId, tenantId),
        eq(academicPeriods.academicYearId, academicYearId),
        eq(academicPeriods.isDeleted, false),
      ),
    )

  const periodRows = await db
    .select({ weight: academicPeriods.weight })
    .from(academicPeriods)
    .where(
      and(
        eq(academicPeriods.tenantId, tenantId),
        eq(academicPeriods.academicYearId, academicYearId),
        eq(academicPeriods.isDeleted, false),
      ),
    )

  const [gradesCount] = await db
    .select({ total: count() })
    .from(grades)
    .where(and(eq(grades.tenantId, tenantId), eq(grades.isDeleted, false)))

  const [coursesCount] = await db
    .select({ total: count() })
    .from(groups)
    .where(
      and(
        eq(groups.tenantId, tenantId),
        eq(groups.academicYearId, academicYearId),
        eq(groups.isDeleted, false),
      ),
    )

  const periodsWeightTotal = periodRows.reduce((sum, item) => sum + item.weight, 0)

  return {
    periodsCount: periodsCount?.total ?? 0,
    gradesCount: gradesCount?.total ?? 0,
    coursesCount: coursesCount?.total ?? 0,
    periodsWeightTotal,
    periodsReady: (periodsCount?.total ?? 0) > 0,
    gradesReady: (gradesCount?.total ?? 0) > 0,
    coursesReady: (coursesCount?.total ?? 0) > 0,
    periodWeightsReady: periodsWeightTotal === 100,
  }
}

const buildAdmissionProgress = (status: string) => {
  if (status === 'submitted') return 40
  if (status === 'reviewing') return 72
  if (status === 'accepted' || status === 'converted') return 100
  return 20
}

const canTransitionAdmissionStatus = (currentStatus: string, nextStatus: string) => {
  if (currentStatus === 'converted') return false
  if (currentStatus === nextStatus) return true

  const transitions: Record<string, string[]> = {
    draft: ['reviewing', 'rejected'],
    submitted: ['reviewing', 'accepted', 'rejected'],
    reviewing: ['accepted', 'rejected'],
    accepted: ['reviewing', 'rejected'],
    rejected: ['reviewing'],
  }

  return transitions[currentStatus]?.includes(nextStatus) ?? false
}

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

admissionRoutes.get('/process/:year', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const year = Number(c.req.param('year'))

  if (!Number.isInteger(year)) throw new AppError('Año lectivo invalido', 400)

  const [tenant] = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.isDeleted, false)))
    .limit(1)

  const [academicYear] = await db
    .select({ id: academicYears.id, name: academicYears.name, year: academicYears.year, isActive: academicYears.isActive })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, year), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!tenant || !academicYear) throw new AppError('Año lectivo no encontrado', 404)

  const [template] = await db
    .select({
      id: formTemplates.id,
      name: formTemplates.name,
      startsOn: formTemplates.startsOn,
      endsOn: formTemplates.endsOn,
    })
    .from(formTemplates)
    .where(
      and(
        eq(formTemplates.tenantId, tenantId),
        eq(formTemplates.academicYearId, academicYear.id),
        eq(formTemplates.module, 'enrollment'),
        eq(formTemplates.isDeleted, false),
      ),
    )
    .orderBy(desc(formTemplates.createdAt))
    .limit(1)

  const process = {
    year,
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    tenantSlug: tenant.slug,
    name: template?.name ?? `Inscripciones ${year}`,
    startsOn: template?.startsOn ?? '',
    endsOn: template?.endsOn ?? '',
    publicStatus: processStatus(template?.startsOn ?? null, template?.endsOn ?? null, todayIsoDate()),
    publicLink: `/inscripcion/${tenant.slug}/${year}`,
  }

  return c.json(ok('Proceso de inscripcion cargado', process))
})

admissionRoutes.put('/process/:year', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', admissionProcessSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const year = Number(c.req.param('year'))
  const payload = c.req.valid('json')

  if (!Number.isInteger(year) || year !== payload.year) throw new AppError('El año lectivo no coincide con la ruta', 400)

  const [tenant] = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.isDeleted, false)))
    .limit(1)

  const [academicYear] = await db
    .select({ id: academicYears.id, name: academicYears.name, year: academicYears.year, isActive: academicYears.isActive })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, year), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!tenant || !academicYear) throw new AppError('Año lectivo no encontrado', 404)

  if (!academicYear.isActive) {
    throw new AppError(`Solo puedes configurar el proceso público del año lectivo activo (${academicYear.name}).`, 409)
  }

  const setupStatus = await getAdmissionSetupStatus({
    db,
    tenantId,
    academicYearId: academicYear.id,
  })

  if (!setupStatus.periodsReady) {
    throw new AppError('Configura primero los periodos académicos del año activo antes de abrir inscripciones.', 409)
  }
  if (!setupStatus.periodWeightsReady) {
    throw new AppError(`Los periodos del año activo deben sumar 100. Hoy suman ${setupStatus.periodsWeightTotal}.`, 409)
  }
  if (!setupStatus.gradesReady) {
    throw new AppError('Configura primero el catálogo de grados antes de abrir inscripciones.', 409)
  }
  if (!setupStatus.coursesReady) {
    throw new AppError('Configura primero los cursos del año activo antes de abrir inscripciones.', 409)
  }

  const [existingTemplate] = await db
    .select({ id: formTemplates.id })
    .from(formTemplates)
    .where(
      and(
        eq(formTemplates.tenantId, tenantId),
        eq(formTemplates.academicYearId, academicYear.id),
        eq(formTemplates.module, 'enrollment'),
        eq(formTemplates.isDeleted, false),
      ),
    )
    .orderBy(desc(formTemplates.createdAt))
    .limit(1)

  const [saved] = existingTemplate
    ? await db
        .update(formTemplates)
        .set({
          name: payload.name,
          startsOn: payload.startsOn,
          endsOn: payload.endsOn,
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(formTemplates.id, existingTemplate.id))
        .returning({ id: formTemplates.id, name: formTemplates.name, startsOn: formTemplates.startsOn, endsOn: formTemplates.endsOn })
    : await db
        .insert(formTemplates)
        .values({
          tenantId,
          academicYearId: academicYear.id,
          code: `enrollment-${year}`,
          name: payload.name,
          description: `Proceso público de inscripción ${year}`,
          module: 'enrollment',
          entityType: 'enrollment',
          startsOn: payload.startsOn,
          endsOn: payload.endsOn,
          status: 'active',
          settings: {
            autosave: true,
            progressBar: true,
          },
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning({ id: formTemplates.id, name: formTemplates.name, startsOn: formTemplates.startsOn, endsOn: formTemplates.endsOn })

  if (!saved) throw new AppError('No fue posible guardar el proceso de inscripción', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'form_templates',
    entityId: saved.id,
    action: existingTemplate ? 'update_process' : 'create_process',
    changes: payload,
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(
    ok('Proceso de inscripcion guardado', {
      year,
      academicYearId: academicYear.id,
      academicYearName: academicYear.name,
      tenantSlug: tenant.slug,
      name: saved.name,
      startsOn: saved.startsOn,
      endsOn: saved.endsOn,
      publicStatus: processStatus(saved.startsOn, saved.endsOn, todayIsoDate()),
      publicLink: `/inscripcion/${tenant.slug}/${year}`,
    }),
  )
})

admissionRoutes.get('/overview/:year', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const year = Number(c.req.param('year'))

  if (!Number.isInteger(year)) throw new AppError('Año lectivo invalido', 400)

  const [academicYear] = await db
    .select({ id: academicYears.id, name: academicYears.name, isActive: academicYears.isActive })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, year), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!academicYear) throw new AppError('Año lectivo no encontrado', 404)

  const [template] = await db
    .select({
      id: formTemplates.id,
      startsOn: formTemplates.startsOn,
      endsOn: formTemplates.endsOn,
    })
    .from(formTemplates)
    .where(
      and(
        eq(formTemplates.tenantId, tenantId),
        eq(formTemplates.academicYearId, academicYear.id),
        eq(formTemplates.module, 'enrollment'),
        eq(formTemplates.isDeleted, false),
      ),
    )
    .orderBy(desc(formTemplates.createdAt))
    .limit(1)

  const setupStatus = await getAdmissionSetupStatus({
    db,
    tenantId,
    academicYearId: academicYear.id,
  })

  const [publishedFormCount] = template
    ? await db
        .select({ total: count() })
        .from(formTemplateVersions)
        .where(
          and(
            eq(formTemplateVersions.tenantId, tenantId),
            eq(formTemplateVersions.formTemplateId, template.id),
            eq(formTemplateVersions.status, 'published'),
            eq(formTemplateVersions.isDeleted, false),
          ),
        )
    : [{ total: 0 }]

  const applicationCounts = await db
    .select({
      status: admissionApplications.status,
      total: count(),
    })
    .from(admissionApplications)
    .where(
      and(
        eq(admissionApplications.tenantId, tenantId),
        eq(admissionApplications.academicYearId, academicYear.id),
        eq(admissionApplications.isDeleted, false),
      ),
    )
    .groupBy(admissionApplications.status)

  const funnel = {
    total: 0,
    draft: 0,
    submitted: 0,
    reviewing: 0,
    accepted: 0,
    converted: 0,
    rejected: 0,
  }

  applicationCounts.forEach((row) => {
    funnel.total += row.total
    if (row.status === 'draft') funnel.draft = row.total
    if (row.status === 'submitted') funnel.submitted = row.total
    if (row.status === 'reviewing') funnel.reviewing = row.total
    if (row.status === 'accepted') funnel.accepted = row.total
    if (row.status === 'converted') funnel.converted = row.total
    if (row.status === 'rejected') funnel.rejected = row.total
  })

  const checklist = [
    {
      code: 'active-year',
      label: 'Año activo para apertura',
      ready: academicYear.isActive,
      detail: academicYear.isActive ? 'Es el año lectivo activo' : 'Debes activar este año antes de abrir inscripciones',
    },
    {
      code: 'academic-year',
      label: 'Año lectivo creado',
      ready: true,
      detail: academicYear.name,
    },
    {
      code: 'periods',
      label: 'Periodos académicos',
      ready: setupStatus.periodsReady,
      detail: `${setupStatus.periodsCount} configurados`,
    },
    {
      code: 'period-weights',
      label: 'Peso total de periodos',
      ready: setupStatus.periodWeightsReady,
      detail: `${setupStatus.periodsWeightTotal}% acumulado`,
    },
    {
      code: 'grades',
      label: 'Catálogo de grados',
      ready: setupStatus.gradesReady,
      detail: `${setupStatus.gradesCount} disponibles`,
    },
    {
      code: 'courses',
      label: 'Cursos del año',
      ready: setupStatus.coursesReady,
      detail: `${setupStatus.coursesCount} creados`,
    },
    {
      code: 'process',
      label: 'Proceso público configurado',
      ready: Boolean(template),
      detail: template ? `${template.startsOn || '--'} a ${template.endsOn || '--'}` : 'Sin ventana configurada',
    },
    {
      code: 'form-published',
      label: 'Formulario publicado',
      ready: (publishedFormCount?.total ?? 0) > 0,
      detail: (publishedFormCount?.total ?? 0) > 0 ? `${publishedFormCount?.total ?? 0} versión publicada` : 'Sin versión publicada',
    },
  ]

  return c.json(ok('Resumen anual de admisiones cargado', {
    year,
    academicYearId: academicYear.id,
    checklist,
    readyToOpen: checklist.every((item) => item.ready),
    funnel,
  }))
})

admissionRoutes.get('/applications', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', admissionFiltersSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')

  let academicYearId: string | undefined
  if (filters.year) {
    const [row] = await db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, filters.year), eq(academicYears.isDeleted, false)))
      .limit(1)
    academicYearId = row?.id
  }

  const whereClause = and(
    eq(admissionApplications.tenantId, tenantId),
    eq(admissionApplications.isDeleted, false),
    academicYearId ? eq(admissionApplications.academicYearId, academicYearId) : undefined,
    filters.status ? eq(admissionApplications.status, filters.status) : undefined,
    filters.gradeId ? eq(admissionApplications.requestedGradeId, filters.gradeId) : undefined,
    filters.groupId ? eq(admissionApplications.requestedGroupId, filters.groupId) : undefined,
    filters.query
      ? or(
          ilike(students.firstName, `%${filters.query}%`),
          ilike(students.middleName, `%${filters.query}%`),
          ilike(students.lastName, `%${filters.query}%`),
          ilike(students.documentNumber, `%${filters.query}%`),
          ilike(guardians.firstName, `%${filters.query}%`),
          ilike(guardians.lastName, `%${filters.query}%`),
          sql`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}) ILIKE ${`%${filters.query}%`}`,
        )
      : undefined,
  )

  const [totalRow] = await db
    .select({ total: count() })
    .from(admissionApplications)
    .leftJoin(students, eq(students.id, admissionApplications.studentId))
    .leftJoin(guardians, eq(guardians.id, admissionApplications.primaryGuardianId))
    .where(whereClause)

  const offset = (filters.page - 1) * filters.pageSize

  const rows = await db
    .select({
      application: admissionApplications,
      studentFirstName: students.firstName,
      studentMiddleName: students.middleName,
      studentLastName: students.lastName,
      studentDocumentType: students.documentType,
      studentDocumentNumber: students.documentNumber,
      guardianFirstName: guardians.firstName,
      guardianLastName: guardians.lastName,
      guardianEmail: guardians.email,
      gradeName: grades.name,
      groupName: groups.name,
      academicYearName: academicYears.name,
      submissionStatus: formSubmissions.status,
    })
    .from(admissionApplications)
    .leftJoin(students, eq(students.id, admissionApplications.studentId))
    .leftJoin(guardians, eq(guardians.id, admissionApplications.primaryGuardianId))
    .leftJoin(grades, eq(grades.id, admissionApplications.requestedGradeId))
    .leftJoin(groups, eq(groups.id, admissionApplications.requestedGroupId))
    .leftJoin(academicYears, eq(academicYears.id, admissionApplications.academicYearId))
    .leftJoin(formSubmissions, eq(formSubmissions.admissionApplicationId, admissionApplications.id))
    .where(whereClause)
    .orderBy(desc(admissionApplications.submittedAt), desc(admissionApplications.createdAt))
    .limit(filters.pageSize)
    .offset(offset)

  return c.json(
    ok('Solicitudes cargadas', {
      items: rows.map(({ application, studentFirstName, studentMiddleName, studentLastName, studentDocumentType, studentDocumentNumber, guardianFirstName, guardianLastName, guardianEmail, gradeName, groupName, academicYearName }) => ({
        id: application.id,
        studentId: application.studentId,
        studentName: [studentFirstName, studentMiddleName, studentLastName].filter(Boolean).join(' '),
        studentDocument: `${studentDocumentType ?? ''} ${studentDocumentNumber ?? ''}`.trim(),
        guardianName: [guardianFirstName, guardianLastName].filter(Boolean).join(' '),
        guardianEmail: guardianEmail ?? null,
        requestedGradeId: application.requestedGradeId,
        requestedGradeName: gradeName ?? '',
        requestedGroupId: application.requestedGroupId,
        requestedGroupName: groupName ?? null,
        academicYearId: application.academicYearId,
        academicYearName: academicYearName ?? '',
        status: application.status,
        source: application.source,
        progress: buildAdmissionProgress(application.status),
        applicationDate: application.applicationDate.toISOString(),
        submittedAt: application.submittedAt?.toISOString() ?? null,
        convertedEnrollmentId: application.convertedEnrollmentId,
      })),
      total: totalRow?.total ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  )
})

admissionRoutes.get('/applications/:id', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [row] = await db
    .select({
      application: admissionApplications,
      student: students,
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
    .leftJoin(students, eq(students.id, admissionApplications.studentId))
    .leftJoin(guardians, eq(guardians.id, admissionApplications.primaryGuardianId))
    .leftJoin(academicYears, eq(academicYears.id, admissionApplications.academicYearId))
    .leftJoin(grades, eq(grades.id, admissionApplications.requestedGradeId))
    .leftJoin(groups, eq(groups.id, admissionApplications.requestedGroupId))
    .leftJoin(formSubmissions, eq(formSubmissions.admissionApplicationId, admissionApplications.id))
    .where(and(eq(admissionApplications.id, id), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false)))
    .limit(1)

  if (!row || !row.student) throw new AppError('Solicitud no encontrada', 404)

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
    ok('Detalle de inscripción cargado', {
      application: {
        id: row.application.id,
        studentId: row.application.studentId,
        studentName: [row.student.firstName, row.student.middleName, row.student.lastName].filter(Boolean).join(' '),
        studentDocument: `${row.student.documentType} ${row.student.documentNumber}`.trim(),
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
        progress: buildAdmissionProgress(row.application.status),
        applicationDate: row.application.applicationDate.toISOString(),
        submittedAt: row.application.submittedAt?.toISOString() ?? null,
        convertedEnrollmentId: row.application.convertedEnrollmentId,
        notes: row.application.notes ?? null,
        fixedData: row.application.fixedData ?? {},
      },
      student: {
        id: row.student.id,
        firstName: row.student.firstName,
        middleName: row.student.middleName,
        lastName: row.student.lastName,
        documentType: row.student.documentType,
        documentNumber: row.student.documentNumber,
        birthDate: row.student.birthDate,
        gender: row.student.gender,
        bloodType: row.student.bloodType,
        status: row.student.status,
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
    }),
  )
})

admissionRoutes.patch('/applications/:id/status', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', admissionStatusUpdateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [application] = await db
    .select()
    .from(admissionApplications)
    .where(and(eq(admissionApplications.id, id), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false)))
    .limit(1)

  if (!application) throw new AppError('Solicitud no encontrada', 404)
  if (!canTransitionAdmissionStatus(application.status, payload.status)) {
    throw new AppError(`No se puede cambiar la solicitud de ${application.status} a ${payload.status}`, 409)
  }

  const now = new Date()
  const [updated] = await db
    .update(admissionApplications)
    .set({
      status: payload.status,
      notes: payload.notes === undefined ? application.notes : payload.notes || null,
      reviewedAt: payload.status === 'reviewing' || payload.status === 'accepted' || payload.status === 'rejected' ? now : application.reviewedAt,
      reviewedBy: payload.status === 'reviewing' || payload.status === 'accepted' || payload.status === 'rejected' ? user.id : application.reviewedBy,
      acceptedAt: payload.status === 'accepted' ? now : payload.status === 'rejected' ? null : application.acceptedAt,
      rejectedAt: payload.status === 'rejected' ? now : payload.status === 'accepted' ? null : application.rejectedAt,
      updatedAt: now,
      updatedBy: user.id,
    })
    .where(eq(admissionApplications.id, id))
    .returning({
      id: admissionApplications.id,
      status: admissionApplications.status,
      reviewedAt: admissionApplications.reviewedAt,
      acceptedAt: admissionApplications.acceptedAt,
      rejectedAt: admissionApplications.rejectedAt,
      notes: admissionApplications.notes,
    })

  if (!updated) throw new AppError('No fue posible actualizar la solicitud', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'admission_applications',
    entityId: id,
    action: 'status_update',
    changes: {
      from: application.status,
      to: payload.status,
      notes: payload.notes || null,
    },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(ok('Estado de inscripción actualizado', {
    id: updated.id,
    status: updated.status,
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    acceptedAt: updated.acceptedAt?.toISOString() ?? null,
    rejectedAt: updated.rejectedAt?.toISOString() ?? null,
    notes: updated.notes ?? null,
  }))
})

admissionRoutes.get('/documents/:id/download', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [document] = await db
    .select({
      id: uploadedDocuments.id,
      fileName: uploadedDocuments.fileName,
      fileKey: uploadedDocuments.fileKey,
      mimeType: uploadedDocuments.mimeType,
      fileSizeBytes: uploadedDocuments.fileSizeBytes,
    })
    .from(uploadedDocuments)
    .where(and(eq(uploadedDocuments.id, id), eq(uploadedDocuments.tenantId, tenantId), eq(uploadedDocuments.isDeleted, false)))
    .limit(1)

  if (!document) throw new AppError('Documento no encontrado', 404)

  const object = await c.env.ADMISSIONS_BUCKET.get(document.fileKey)
  if (!object?.body) throw new AppError('El archivo no está disponible en almacenamiento', 404)

  const headers = new Headers()
  headers.set('Content-Type', document.mimeType || 'application/octet-stream')
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(document.fileName)}"`)

  if (document.fileSizeBytes) {
    headers.set('Content-Length', String(document.fileSizeBytes))
  }

  return new Response(object.body, {
    status: 200,
    headers,
  })
})

admissionRoutes.post('/applications/manual', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', manualAdmissionSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [existingStudent] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.tenantId, tenantId), eq(students.documentType, payload.student.documentType), eq(students.documentNumber, payload.student.documentNumber), eq(students.isDeleted, false)))
    .limit(1)

  const [student] = existingStudent
    ? await db
        .update(students)
        .set({
          firstName: payload.student.firstName,
          middleName: payload.student.middleName || null,
          lastName: payload.student.lastName,
          birthDate: payload.student.birthDate,
          gender: payload.student.gender,
          bloodType: payload.student.bloodType || null,
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(students.id, existingStudent.id))
        .returning({ id: students.id })
    : await db
        .insert(students)
        .values({
          tenantId,
          firstName: payload.student.firstName,
          middleName: payload.student.middleName || null,
          lastName: payload.student.lastName,
          documentType: payload.student.documentType,
          documentNumber: payload.student.documentNumber,
          birthDate: payload.student.birthDate,
          gender: payload.student.gender,
          bloodType: payload.student.bloodType || null,
          status: 'active',
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning({ id: students.id })

  const [existingGuardian] = await db
    .select({ id: guardians.id })
    .from(guardians)
    .where(
      and(
        eq(guardians.tenantId, tenantId),
        eq(guardians.documentType, payload.guardian.documentType),
        eq(guardians.documentNumber, payload.guardian.documentNumber),
        eq(guardians.isDeleted, false),
      ),
    )
    .limit(1)

  const [guardian] = existingGuardian
    ? await db
        .update(guardians)
        .set({
          fullName: `${payload.guardian.firstName} ${payload.guardian.lastName}`,
          firstName: payload.guardian.firstName,
          lastName: payload.guardian.lastName,
          email: payload.guardian.email,
          phone: payload.guardian.phone,
          relationship: payload.guardian.relationship,
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(eq(guardians.id, existingGuardian.id))
        .returning({ id: guardians.id })
    : await db
        .insert(guardians)
        .values({
          tenantId,
          fullName: `${payload.guardian.firstName} ${payload.guardian.lastName}`,
          firstName: payload.guardian.firstName,
          lastName: payload.guardian.lastName,
          documentType: payload.guardian.documentType,
          documentNumber: payload.guardian.documentNumber,
          email: payload.guardian.email,
          phone: payload.guardian.phone,
          relationship: payload.guardian.relationship,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning({ id: guardians.id })

  if (!student || !guardian) throw new AppError('No fue posible crear la solicitud manual', 500)

  const [existingRelation] = await db
    .select({ id: studentGuardians.id })
    .from(studentGuardians)
    .where(
      and(
        eq(studentGuardians.tenantId, tenantId),
        eq(studentGuardians.studentId, student.id),
        eq(studentGuardians.guardianId, guardian.id),
        eq(studentGuardians.isDeleted, false),
      ),
    )
    .limit(1)

  if (!existingRelation) {
    await db.insert(studentGuardians).values({
      tenantId,
      studentId: student.id,
      guardianId: guardian.id,
      isPrimary: true,
      createdBy: user.id,
      updatedBy: user.id,
    })
  }

  const [existingApplication] = await db
    .select({ id: admissionApplications.id })
    .from(admissionApplications)
    .where(
      and(
        eq(admissionApplications.tenantId, tenantId),
        eq(admissionApplications.studentId, student.id),
        eq(admissionApplications.academicYearId, payload.academicYearId),
        eq(admissionApplications.isDeleted, false),
      ),
    )
    .limit(1)

  if (existingApplication) throw new AppError('Ya existe una inscripción para este estudiante en ese año lectivo', 409)

  const [application] = await db
    .insert(admissionApplications)
    .values({
      tenantId,
      studentId: student.id,
      academicYearId: payload.academicYearId,
      requestedGradeId: payload.requestedGradeId,
      requestedGroupId: payload.requestedGroupId || null,
      primaryGuardianId: guardian.id,
      status: 'reviewing',
      source: payload.source,
      applicationDate: new Date(),
      submittedAt: new Date(),
      notes: payload.notes || null,
      fixedData: { createdInternally: true },
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: admissionApplications.id })

  if (!application) throw new AppError('No fue posible crear la solicitud', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'admission_applications',
    entityId: application.id,
    action: 'create_manual',
    changes: payload as Record<string, unknown>,
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(created('Solicitud creada', { id: application.id }), 201)
})

admissionRoutes.post('/applications/:id/convert-to-enrollment', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', admissionConversionSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [application] = await db
    .select()
    .from(admissionApplications)
    .where(and(eq(admissionApplications.id, id), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false)))
    .limit(1)

  if (!application) throw new AppError('Solicitud no encontrada', 404)
  if (application.convertedEnrollmentId) throw new AppError('La solicitud ya fue convertida a matrícula', 409)
  if (application.status !== 'accepted') {
    throw new AppError('Solo las solicitudes aprobadas pueden convertirse a matrícula', 409)
  }
  if (application.academicYearId !== payload.academicYearId) {
    throw new AppError('La matrícula debe crearse en el mismo año lectivo de la solicitud aprobada', 409)
  }

  const [existingEnrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, application.studentId),
        eq(enrollments.academicYearId, payload.academicYearId),
        eq(enrollments.isDeleted, false),
      ),
    )
    .limit(1)

  if (existingEnrollment) {
    throw new AppError('El estudiante ya tiene matrícula para ese año lectivo', 409)
  }

  await validateEnrollmentPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    gradeId: payload.gradeId,
    groupId: payload.groupId || null,
  })

  const [enrollment] = await db
    .insert(enrollments)
    .values({
      tenantId,
      studentId: application.studentId,
      academicYearId: payload.academicYearId,
      gradeId: payload.gradeId,
      groupId: payload.groupId || null,
      admissionApplicationId: application.id,
      enrollmentType: application.source === 'new_student' ? 'new' : application.source === 'transfer' ? 'transfer' : 'renewal',
      enrollmentStatus: payload.enrollmentStatus,
      enrollmentDate: new Date(`${payload.enrollmentDate}T00:00:00.000Z`),
      status: payload.enrollmentStatus === 'active' ? 'active' : 'pending',
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: enrollments.id })

  if (!enrollment) throw new AppError('No fue posible crear la matrícula', 500)

  await db
    .update(admissionApplications)
    .set({
      status: 'converted',
      acceptedAt: application.acceptedAt ?? new Date(),
      reviewedAt: new Date(),
      reviewedBy: user.id,
      convertedEnrollmentId: enrollment.id,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(eq(admissionApplications.id, application.id))

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'admission_applications',
    entityId: application.id,
    action: 'convert_to_enrollment',
    changes: { enrollmentId: enrollment.id, ...payload },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(ok('Solicitud convertida a matrícula', { id: enrollment.id }))
})
