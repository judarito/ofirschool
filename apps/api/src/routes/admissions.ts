import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  academicPeriods,
  academicYears,
  admissionApplications,
  admissionComments,
  admissionDecisionReasons,
  admissionDocumentReviews,
  admissionStatusHistory,
  enrollments,
  formFieldValues,
  formFields,
  formSections,
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
  users,
} from '@ofir/db'
import {
  PERMISSIONS,
  admissionAssignmentSchema,
  admissionCommentCreateSchema,
  admissionDecisionReasonSchema,
  admissionDocumentReviewSchema,
  admissionProcessSchema,
  manualAdmissionSchema,
  admissionUpdateSchema,
  admissionConversionSchema,
  admissionFiltersSchema,
  admissionStatusUpdateSchema,
} from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { validateEnrollmentPlacement } from '../lib/enrollment-placement'
import { ensureRequiredConsentsCaptured, listApplicationConsents } from './consents'
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
    draft: ['document_review', 'reviewing', 'rejected', 'waitlisted'],
    submitted: ['document_review', 'reviewing', 'interview_scheduled', 'committee_review', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted', 'needs_correction'],
    document_review: ['reviewing', 'needs_correction', 'interview_scheduled', 'committee_review', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted'],
    needs_correction: ['document_review', 'reviewing', 'rejected'],
    interview_scheduled: ['committee_review', 'reviewing', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted'],
    committee_review: ['accepted', 'accepted_conditional', 'rejected', 'waitlisted', 'reviewing'],
    waitlisted: ['reviewing', 'accepted', 'accepted_conditional', 'rejected'],
    reviewing: ['document_review', 'needs_correction', 'interview_scheduled', 'committee_review', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted'],
    accepted: ['reviewing', 'rejected', 'converted'],
    accepted_conditional: ['reviewing', 'accepted', 'rejected', 'converted'],
    rejected: ['reviewing'],
  }

  return transitions[currentStatus]?.includes(nextStatus) ?? false
}

const TERMINAL_STATUSES = new Set(['converted', 'rejected'])
const REQUIRES_OBSERVATION_STATUSES = new Set(['accepted_conditional', 'needs_correction'])
const REQUIRES_REJECTION_REASON = new Set(['rejected'])

const recordStatusHistory = async ({
  db,
  tenantId,
  application,
  toStatus,
  actorUserId,
  actorRole,
  decisionCode,
  decisionLabel,
  notes,
  isInternal,
  isVisibleToFamily,
  metadata,
}: {
  db: AppContextVariables['db']
  tenantId: string
  application: { id: string; status: string }
  toStatus: string
  actorUserId: string
  actorRole?: string
  decisionCode?: string | null
  decisionLabel?: string | null
  notes?: string | null
  isInternal: boolean
  isVisibleToFamily: boolean
  metadata?: Record<string, unknown>
}) => {
  const [entry] = await db
    .insert(admissionStatusHistory)
    .values({
      tenantId,
      admissionApplicationId: application.id,
      fromStatus: application.status,
      toStatus,
      actorUserId,
      actorRole: actorRole ?? null,
      decisionCode: decisionCode || null,
      decisionLabel: decisionLabel || null,
      isInternal,
      isVisibleToFamily,
      notes: notes || null,
      metadata: metadata ?? {},
      createdBy: actorUserId,
      updatedBy: actorUserId,
    })
    .returning({ id: admissionStatusHistory.id })

  return entry?.id ?? null
}

const upsertDecisionReason = async ({
  db,
  tenantId,
  actorUserId,
  payload,
}: {
  db: AppContextVariables['db']
  tenantId: string
  actorUserId: string
  payload: {
    code: string
    outcome: string
    label: string
    description?: string | null
    requiresObservation?: boolean
    sortOrder?: number
    isActive?: boolean
  }
}) => {
  const [existing] = await db
    .select({ id: admissionDecisionReasons.id })
    .from(admissionDecisionReasons)
    .where(
      and(
        eq(admissionDecisionReasons.tenantId, tenantId),
        eq(admissionDecisionReasons.code, payload.code),
        eq(admissionDecisionReasons.isDeleted, false),
      ),
    )
    .limit(1)

  if (existing) {
    await db
      .update(admissionDecisionReasons)
      .set({
        outcome: payload.outcome,
        label: payload.label,
        description: payload.description || null,
        requiresObservation: payload.requiresObservation ?? false,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
        updatedAt: new Date(),
        updatedBy: actorUserId,
      })
      .where(eq(admissionDecisionReasons.id, existing.id))
    return existing.id
  }

  const [created] = await db
    .insert(admissionDecisionReasons)
    .values({
      tenantId,
      code: payload.code,
      outcome: payload.outcome,
      label: payload.label,
      description: payload.description || null,
      requiresObservation: payload.requiresObservation ?? false,
      sortOrder: payload.sortOrder ?? 0,
      isActive: payload.isActive ?? true,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    })
    .returning({ id: admissionDecisionReasons.id })

  return created?.id ?? null
}

const loadDecisionReasons = async ({
  db,
  tenantId,
  outcome,
}: {
  db: AppContextVariables['db']
  tenantId: string
  outcome?: string
}) => {
  const where = outcome
    ? and(
        eq(admissionDecisionReasons.tenantId, tenantId),
        eq(admissionDecisionReasons.outcome, outcome),
        eq(admissionDecisionReasons.isActive, true),
        eq(admissionDecisionReasons.isDeleted, false),
      )
    : and(
        eq(admissionDecisionReasons.tenantId, tenantId),
        eq(admissionDecisionReasons.isActive, true),
        eq(admissionDecisionReasons.isDeleted, false),
      )

  const rows = await db
    .select()
    .from(admissionDecisionReasons)
    .where(where)
    .orderBy(asc(admissionDecisionReasons.sortOrder), asc(admissionDecisionReasons.label))

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    outcome: row.outcome,
    label: row.label,
    description: row.description ?? null,
    requiresObservation: row.requiresObservation,
    sortOrder: row.sortOrder,
  }))
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

const hasAnswerValue = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

const buildFieldValueRecord = ({
  tenantId,
  submissionId,
  field,
  sectionTitle,
  value,
}: {
  tenantId: string
  submissionId: string
  field: {
    id: string
    formSectionId: string
    code: string
    label: string
    fieldType: string
  }
  sectionTitle: string
  value: unknown
}) => {
  const base = {
    tenantId,
    formSubmissionId: submissionId,
    formFieldId: field.id,
    formSectionId: field.formSectionId,
    fieldCode: field.code,
    fieldType: field.fieldType,
    fieldLabelSnapshot: field.label,
    sectionTitleSnapshot: sectionTitle,
    searchableValue: null as string | null,
  }

  if (field.fieldType === 'checkbox') {
    return {
      ...base,
      valueBoolean: Boolean(value),
      searchableValue: Boolean(value) ? 'si' : 'no',
    }
  }

  if (field.fieldType === 'number' || field.fieldType === 'decimal') {
    const numeric = Number(value)

    return {
      ...base,
      valueNumber: Number.isFinite(numeric) ? String(numeric) : null,
      searchableValue: Number.isFinite(numeric) ? String(numeric) : null,
    }
  }

  if (field.fieldType === 'date') {
    return {
      ...base,
      valueDate: typeof value === 'string' ? value : null,
      searchableValue: typeof value === 'string' ? value : null,
    }
  }

  if (field.fieldType === 'datetime') {
    return {
      ...base,
      valueTimestamp: typeof value === 'string' ? new Date(value) : null,
      searchableValue: typeof value === 'string' ? value : null,
    }
  }

  if (field.fieldType === 'select' || field.fieldType === 'radio') {
    return {
      ...base,
      valueText: typeof value === 'string' ? value : null,
      valueJson: value,
      searchableValue: typeof value === 'string' ? value : null,
    }
  }

  if (field.fieldType === 'multiselect') {
    const arrayValue = Array.isArray(value) ? value.map((item) => String(item)) : []

    return {
      ...base,
      valueJson: arrayValue,
      searchableValue: arrayValue.join(', '),
    }
  }

  return {
    ...base,
    valueText: typeof value === 'string' ? value : String(value),
    valueJson: typeof value === 'string' ? null : value,
    searchableValue: typeof value === 'string' ? value : String(value),
  }
}

const summarizeDatabaseError = (error: unknown) => {
  if (!(error instanceof Error)) return { message: String(error) }
  const record = error as Error & {
    cause?: unknown
    code?: string
    constraint?: string
    detail?: string
  }

  const causeMessage = record.cause instanceof Error ? record.cause.message : undefined
  const message = error.message.startsWith('Failed query:') && causeMessage ? causeMessage : error.message

  return {
    name: error.name,
    message,
    code: record.code,
    constraint: record.constraint,
    detail: record.detail,
    cause: causeMessage,
  }
}

const manualAdmissionDbError = (stage: string, error: unknown) => {
  const details = {
    stage,
    database: summarizeDatabaseError(error),
  }
  console.error('Manual admission failed', details)
  return new AppError(
    `No fue posible guardar la inscripción manual en la etapa "${stage}".`,
    500,
    details,
    `MANUAL_ADMISSION_${stage.toUpperCase()}_FAILED`,
  )
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

admissionRoutes.get('/forms/:year/active', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const year = Number(c.req.param('year'))

  if (!Number.isInteger(year)) throw new AppError('Año lectivo invalido', 400)

  const [academicYear] = await db
    .select({ id: academicYears.id, name: academicYears.name, year: academicYears.year })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, year), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!academicYear) throw new AppError('Año lectivo no encontrado', 404)

  const [template] = await db
    .select({
      id: formTemplates.id,
      name: formTemplates.name,
      settings: formTemplates.settings,
      activeVersionId: formTemplates.activeVersionId,
    })
    .from(formTemplates)
    .where(
      and(
        eq(formTemplates.tenantId, tenantId),
        eq(formTemplates.academicYearId, academicYear.id),
        eq(formTemplates.module, 'enrollment'),
        eq(formTemplates.status, 'active'),
        eq(formTemplates.isDeleted, false),
      ),
    )
    .orderBy(desc(formTemplates.createdAt))
    .limit(1)

  if (!template) {
    return c.json(ok('No hay formulario activo para este año lectivo', { form: null }))
  }

  const versionFilter = template.activeVersionId
    ? and(
        eq(formTemplateVersions.tenantId, tenantId),
        eq(formTemplateVersions.id, template.activeVersionId),
        eq(formTemplateVersions.status, 'published'),
        eq(formTemplateVersions.isDeleted, false),
      )
    : and(
        eq(formTemplateVersions.tenantId, tenantId),
        eq(formTemplateVersions.formTemplateId, template.id),
        eq(formTemplateVersions.status, 'published'),
        eq(formTemplateVersions.isDeleted, false),
      )

  const [version] = await db
    .select({
      id: formTemplateVersions.id,
      versionNumber: formTemplateVersions.versionNumber,
      schemaSnapshot: formTemplateVersions.schemaSnapshot,
    })
    .from(formTemplateVersions)
    .where(versionFilter)
    .orderBy(desc(formTemplateVersions.versionNumber))
    .limit(1)

  if (!version) {
    return c.json(ok('No hay version publicada para este formulario', { form: null }))
  }

  const sections = await db
    .select({
      id: formSections.id,
      code: formSections.code,
      title: formSections.title,
      description: formSections.description,
      sortOrder: formSections.sortOrder,
    })
    .from(formSections)
    .where(and(eq(formSections.tenantId, tenantId), eq(formSections.formTemplateVersionId, version.id), eq(formSections.isDeleted, false)))
    .orderBy(asc(formSections.sortOrder), asc(formSections.title))

  const fields = await db
    .select({
      id: formFields.id,
      sectionId: formFields.formSectionId,
      code: formFields.code,
      label: formFields.label,
      helpText: formFields.helpText,
      fieldType: formFields.fieldType,
      placeholder: formFields.placeholder,
      options: formFields.options,
      validationRules: formFields.validationRules,
      visibilityRules: formFields.visibilityRules,
      isRequired: formFields.isRequired,
      sortOrder: formFields.sortOrder,
    })
    .from(formFields)
    .where(and(eq(formFields.tenantId, tenantId), eq(formFields.formTemplateVersionId, version.id), eq(formFields.isDeleted, false)))
    .orderBy(asc(formFields.sortOrder), asc(formFields.label))

  return c.json(
    ok('Formulario activo de inscripcion cargado', {
      form: {
        templateId: template.id,
        versionId: version.id,
        versionNumber: version.versionNumber,
        name: template.name,
        settings: template.settings,
        schemaSnapshot: version.schemaSnapshot,
        academicYear,
        sections: sections.map((section) => ({
          ...section,
          fields: fields.filter((field) => field.sectionId === section.id).map(({ sectionId: _sectionId, ...field }) => field),
        })),
      },
    }),
  )
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
    filters.assignedTo ? eq(admissionApplications.assignedTo, filters.assignedTo) : undefined,
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
      assignedToName: users.fullName,
      submissionStatus: formSubmissions.status,
    })
    .from(admissionApplications)
    .leftJoin(students, eq(students.id, admissionApplications.studentId))
    .leftJoin(guardians, eq(guardians.id, admissionApplications.primaryGuardianId))
    .leftJoin(grades, eq(grades.id, admissionApplications.requestedGradeId))
    .leftJoin(groups, eq(groups.id, admissionApplications.requestedGroupId))
    .leftJoin(academicYears, eq(academicYears.id, admissionApplications.academicYearId))
    .leftJoin(users, eq(users.id, admissionApplications.assignedTo))
    .leftJoin(formSubmissions, eq(formSubmissions.admissionApplicationId, admissionApplications.id))
    .where(whereClause)
    .orderBy(desc(admissionApplications.submittedAt), desc(admissionApplications.createdAt))
    .limit(filters.pageSize)
    .offset(offset)

  return c.json(
    ok('Solicitudes cargadas', {
      items: rows.map(({ application, studentFirstName, studentMiddleName, studentLastName, studentDocumentType, studentDocumentNumber, guardianFirstName, guardianLastName, guardianEmail, gradeName, groupName, academicYearName, assignedToName, ...rest }) => ({
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
        assignedTo: application.assignedTo,
        assignedToName: assignedToName ?? null,
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
      assignedToName: users.fullName,
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
    .leftJoin(users, eq(users.id, admissionApplications.assignedTo))
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
        assignedTo: row.application.assignedTo,
        assignedToName: row.assignedToName ?? null,
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
      consents: await listApplicationConsents({ db, tenantId, applicationId: row.application.id }),
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
  if (TERMINAL_STATUSES.has(application.status)) {
    throw new AppError(`La solicitud ya está en un estado terminal (${application.status})`, 409)
  }
  if (!canTransitionAdmissionStatus(application.status, payload.status)) {
    throw new AppError(`No se puede cambiar la solicitud de ${application.status} a ${payload.status}`, 409)
  }

  if (REQUIRES_REJECTION_REASON.has(payload.status) && !payload.decisionCode) {
    throw new AppError('Para rechazar una solicitud debes seleccionar un motivo estructurado', 400)
  }
  if (REQUIRES_OBSERVATION_STATUSES.has(payload.status) && !(payload.observation && payload.observation.trim().length)) {
    throw new AppError('Para aceptar de forma condicionada o devolver para corrección debes registrar una observación', 400)
  }

  let decisionLabel: string | null = null
  if (payload.decisionCode) {
    const [reason] = await db
      .select()
      .from(admissionDecisionReasons)
      .where(
        and(
          eq(admissionDecisionReasons.tenantId, tenantId),
          eq(admissionDecisionReasons.code, payload.decisionCode),
          eq(admissionDecisionReasons.isDeleted, false),
        ),
      )
      .limit(1)
    if (!reason) {
      throw new AppError('El motivo de decisión seleccionado no existe o está inactivo', 400)
    }
    if (reason.requiresObservation && !(payload.observation && payload.observation.trim().length)) {
      throw new AppError(`El motivo "${reason.label}" requiere una observación`, 400)
    }
    decisionLabel = reason.label
  }

  const now = new Date()
  const [updated] = await db
    .update(admissionApplications)
    .set({
      status: payload.status,
      notes: payload.notes === undefined ? application.notes : payload.notes || null,
      reviewedAt: now,
      reviewedBy: user.id,
      acceptedAt: payload.status === 'accepted' || payload.status === 'accepted_conditional' ? now : payload.status === 'rejected' ? null : application.acceptedAt,
      rejectedAt: payload.status === 'rejected' ? now : payload.status === 'accepted' || payload.status === 'accepted_conditional' ? null : application.rejectedAt,
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

  const historyId = await recordStatusHistory({
    db,
    tenantId,
    application,
    toStatus: payload.status,
    actorUserId: user.id,
    actorRole: user.roleCodes[0] ?? undefined,
    decisionCode: payload.decisionCode || null,
    decisionLabel,
    notes: payload.observation || payload.notes || null,
    isInternal: payload.isInternal ?? true,
    isVisibleToFamily: payload.isVisibleToFamily ?? true,
    metadata: {
      source: 'status_update',
    },
  })

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'admission_applications',
    entityId: id,
    action: 'status_update',
    changes: {
      from: application.status,
      to: payload.status,
      decisionCode: payload.decisionCode || null,
      decisionLabel,
      notes: payload.notes || null,
      observation: payload.observation || null,
      historyId,
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
    decisionCode: payload.decisionCode || null,
    decisionLabel,
    historyId,
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

  let student: { id: string } | undefined

  try {
    ;[student] = existingStudent
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
  } catch (error) {
    throw manualAdmissionDbError('student', error)
  }

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

  let guardian: { id: string } | undefined

  try {
    ;[guardian] = existingGuardian
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
  } catch (error) {
    throw manualAdmissionDbError('guardian', error)
  }

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
    try {
      await db.execute(sql`
        insert into student_guardians (
          tenant_id,
          student_id,
          guardian_id,
          is_primary,
          created_by,
          updated_by
        )
        values (
          ${tenantId},
          ${student.id},
          ${guardian.id},
          ${true},
          ${user.id},
          ${user.id}
        )
      `)
    } catch (error) {
      throw manualAdmissionDbError('relation', error)
    }
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

  const [template] = await db
    .select({
      id: formTemplates.id,
      activeVersionId: formTemplates.activeVersionId,
      settings: formTemplates.settings,
    })
    .from(formTemplates)
    .where(
      and(
        eq(formTemplates.tenantId, tenantId),
        eq(formTemplates.academicYearId, payload.academicYearId),
        eq(formTemplates.module, 'enrollment'),
        eq(formTemplates.status, 'active'),
        eq(formTemplates.isDeleted, false),
      ),
    )
    .orderBy(desc(formTemplates.createdAt))
    .limit(1)

  const versionFilter = template?.activeVersionId
    ? and(
        eq(formTemplateVersions.tenantId, tenantId),
        eq(formTemplateVersions.id, template.activeVersionId),
        eq(formTemplateVersions.status, 'published'),
        eq(formTemplateVersions.isDeleted, false),
      )
    : template
      ? and(
          eq(formTemplateVersions.tenantId, tenantId),
          eq(formTemplateVersions.formTemplateId, template.id),
          eq(formTemplateVersions.status, 'published'),
          eq(formTemplateVersions.isDeleted, false),
        )
      : undefined

  const [version] = versionFilter
    ? await db
        .select({
          id: formTemplateVersions.id,
          versionNumber: formTemplateVersions.versionNumber,
          schemaSnapshot: formTemplateVersions.schemaSnapshot,
        })
        .from(formTemplateVersions)
        .where(versionFilter)
        .orderBy(desc(formTemplateVersions.versionNumber))
        .limit(1)
    : []

  const versionSections = version
    ? await db
        .select({
          id: formSections.id,
          title: formSections.title,
        })
        .from(formSections)
        .where(and(eq(formSections.tenantId, tenantId), eq(formSections.formTemplateVersionId, version.id), eq(formSections.isDeleted, false)))
    : []

  const versionFields = version
    ? await db
        .select({
          id: formFields.id,
          formSectionId: formFields.formSectionId,
          code: formFields.code,
          label: formFields.label,
          fieldType: formFields.fieldType,
          isRequired: formFields.isRequired,
        })
        .from(formFields)
        .where(and(eq(formFields.tenantId, tenantId), eq(formFields.formTemplateVersionId, version.id), eq(formFields.isDeleted, false)))
    : []

  const requiredFieldErrors = versionFields
    .filter((field) => field.isRequired)
    .filter((field) => !hasAnswerValue(payload.answers[field.code]))
    .map((field) => field.label)

  if (requiredFieldErrors.length) {
    throw new AppError(`Faltan campos obligatorios del formulario: ${requiredFieldErrors.join(', ')}`, 400)
  }

  let application: { id: string } | undefined

  try {
    ;[application] = await db
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
  } catch (error) {
    throw manualAdmissionDbError('application', error)
  }

  if (!application) throw new AppError('No fue posible crear la solicitud', 500)

  let submissionId: string | null = null

  if (template && version) {
    try {
      const [submission] = await db
        .insert(formSubmissions)
        .values({
          tenantId,
          formTemplateId: template.id,
          formTemplateVersionId: version.id,
          academicYearId: payload.academicYearId,
          admissionApplicationId: application.id,
          studentId: student.id,
          submittedByGuardianId: guardian.id,
          status: 'submitted',
          progressPercent: 100,
          submittedAt: new Date(),
          schemaSnapshot: version.schemaSnapshot ?? {},
          metadata: {
            source: 'student_module',
            createdInternally: true,
            processSettings: template.settings ?? {},
          },
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning({ id: formSubmissions.id })

      submissionId = submission?.id ?? null

      if (!submissionId) throw new AppError('No fue posible crear la entrega del formulario', 500)
    } catch (error) {
      if (error instanceof AppError) throw error
      throw manualAdmissionDbError('submission', error)
    }

    const sectionById = new Map(versionSections.map((section) => [section.id, section.title]))
    const valueRows = versionFields
      .filter((field) => hasAnswerValue(payload.answers[field.code]))
      .map((field) =>
        buildFieldValueRecord({
          tenantId,
          submissionId: submissionId as string,
          field,
          sectionTitle: sectionById.get(field.formSectionId) ?? 'Formulario',
          value: payload.answers[field.code],
        }),
      )

    try {
      if (valueRows.length) {
        await db.insert(formFieldValues).values(valueRows)
      }
    } catch (error) {
      throw manualAdmissionDbError('field_values', error)
    }
  }

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'admission_applications',
    entityId: application.id,
    action: 'create_manual',
    changes: { ...(payload as Record<string, unknown>), formSubmissionId: submissionId },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(created('Solicitud creada', { id: application.id }), 201)
})

admissionRoutes.put('/applications/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', admissionUpdateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [application] = await db
    .select({
      id: admissionApplications.id,
      primaryGuardianId: admissionApplications.primaryGuardianId,
      studentId: admissionApplications.studentId,
    })
    .from(admissionApplications)
    .where(and(eq(admissionApplications.id, id), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false)))
    .limit(1)

  if (!application) throw new AppError('Inscripción no encontrada', 404)
  if (!application.primaryGuardianId) throw new AppError('La inscripción no tiene acudiente principal asociado', 409)

  const [guardian] = await db
    .update(guardians)
    .set({
      firstName: payload.guardian.firstName,
      lastName: payload.guardian.lastName,
      fullName: `${payload.guardian.firstName} ${payload.guardian.lastName}`,
      documentType: payload.guardian.documentType,
      documentNumber: payload.guardian.documentNumber,
      phone: payload.guardian.phone,
      email: payload.guardian.email,
      relationship: payload.guardian.relationship,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(and(eq(guardians.id, application.primaryGuardianId), eq(guardians.tenantId, tenantId)))
    .returning({ id: guardians.id })

  if (!guardian) throw new AppError('Acudiente no encontrado', 404)

  await db
    .update(admissionApplications)
    .set({
      requestedGradeId: payload.requestedGradeId,
      requestedGroupId: payload.requestedGroupId || null,
      source: payload.source,
      notes: payload.notes || null,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(eq(admissionApplications.id, id))

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'admission_applications',
    entityId: id,
    action: 'update',
    changes: payload as Record<string, unknown>,
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(ok('Inscripción actualizada', { id }))
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

  await ensureRequiredConsentsCaptured({
    db,
    tenantId,
    applicationId: application.id,
    requiredCodes: ['privacy_notice', 'data_treatment_authorization'],
  })

  const blockingDocuments = await db
    .select({ id: admissionDocumentReviews.id, status: admissionDocumentReviews.status })
    .from(admissionDocumentReviews)
    .where(
      and(
        eq(admissionDocumentReviews.tenantId, tenantId),
        eq(admissionDocumentReviews.admissionApplicationId, application.id),
        eq(admissionDocumentReviews.isDeleted, false),
        inArray(admissionDocumentReviews.status, ['rejected', 'needs_correction']),
      ),
    )
  if (blockingDocuments.length) {
    throw new AppError('La solicitud tiene documentos rechazados o pendientes de corrección. Resuélvelos antes de matricular.', 409)
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
      branchId: payload.branchId || null,
      journey: payload.journey || null,
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

  await recordStatusHistory({
    db,
    tenantId,
    application: { id: application.id, status: 'accepted' },
    toStatus: 'converted',
    actorUserId: user.id,
    actorRole: user.roleCodes[0] ?? undefined,
    decisionLabel: 'Conversión a matrícula',
    notes: 'Conversión automática al crear la matrícula',
    isInternal: true,
    isVisibleToFamily: false,
    metadata: { enrollmentId: enrollment.id },
  })

  return c.json(ok('Solicitud convertida a matrícula', { id: enrollment.id }))
})

admissionRoutes.get('/decision-reasons', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const outcome = c.req.query('outcome')
  const items = await loadDecisionReasons({ db, tenantId, outcome })

  return c.json(ok('Motivos de decisión cargados', { items }))
})

admissionRoutes.post('/decision-reasons', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', admissionDecisionReasonSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const id = await upsertDecisionReason({
    db,
    tenantId,
    actorUserId: user.id,
    payload,
  })

  if (!id) throw new AppError('No fue posible guardar el motivo de decisión', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'admission_decision_reasons',
    entityId: id,
    action: 'upsert',
    changes: payload as Record<string, unknown>,
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(created('Motivo de decisión guardado', { id }), 201)
})

admissionRoutes.get('/applications/:id/history', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [application] = await db
    .select({ id: admissionApplications.id })
    .from(admissionApplications)
    .where(and(eq(admissionApplications.id, id), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false)))
    .limit(1)
  if (!application) throw new AppError('Solicitud no encontrada', 404)

  const items = await db
    .select()
    .from(admissionStatusHistory)
    .where(
      and(
        eq(admissionStatusHistory.tenantId, tenantId),
        eq(admissionStatusHistory.admissionApplicationId, id),
        eq(admissionStatusHistory.isDeleted, false),
      ),
    )
    .orderBy(desc(admissionStatusHistory.createdAt))

  return c.json(ok('Historial de la solicitud cargado', {
    items: items.map((item) => ({
      id: item.id,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      actorUserId: item.actorUserId,
      actorRole: item.actorRole,
      decisionCode: item.decisionCode,
      decisionLabel: item.decisionLabel,
      notes: item.notes,
      isInternal: item.isInternal,
      isVisibleToFamily: item.isVisibleToFamily,
      metadata: item.metadata,
      createdAt: item.createdAt.toISOString(),
    })),
  }))
})

admissionRoutes.get('/applications/:id/document-reviews', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [application] = await db
    .select({ id: admissionApplications.id })
    .from(admissionApplications)
    .where(and(eq(admissionApplications.id, id), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false)))
    .limit(1)
  if (!application) throw new AppError('Solicitud no encontrada', 404)

  const rows = await db
    .select({
      review: admissionDocumentReviews,
      document: uploadedDocuments,
    })
    .from(admissionDocumentReviews)
    .innerJoin(uploadedDocuments, eq(uploadedDocuments.id, admissionDocumentReviews.uploadedDocumentId))
    .where(
      and(
        eq(admissionDocumentReviews.tenantId, tenantId),
        eq(admissionDocumentReviews.admissionApplicationId, id),
        eq(admissionDocumentReviews.isDeleted, false),
      ),
    )
    .orderBy(desc(admissionDocumentReviews.reviewedAt), desc(admissionDocumentReviews.createdAt))

  return c.json(ok('Revisión documental cargada', {
    items: rows.map(({ review, document }) => ({
      id: review.id,
      uploadedDocumentId: document.id,
      documentCode: String((document.metadata as { documentCode?: unknown } | null)?.documentCode ?? document.requiredDocumentId),
      fileName: document.fileName,
      status: review.status,
      reasonCode: review.reasonCode,
      reasonLabel: review.reasonLabel,
      notes: review.notes,
      requestedCorrection: review.requestedCorrection,
      reviewedBy: review.reviewedBy,
      reviewedAt: review.reviewedAt?.toISOString() ?? null,
      createdAt: review.createdAt.toISOString(),
    })),
  }))
})

admissionRoutes.post(
  '/applications/:id/documents/:documentId/review',
  requirePermission(PERMISSIONS.ACADEMIC_WRITE),
  zValidator('json', admissionDocumentReviewSchema),
  async (c) => {
    const db = c.get('db')
    const tenantId = c.get('tenantId')
    const user = c.get('user')
    const id = c.req.param('id')
    const documentId = c.req.param('documentId')
    const payload = c.req.valid('json')

    const [application] = await db
      .select({ id: admissionApplications.id })
      .from(admissionApplications)
      .where(and(eq(admissionApplications.id, id), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false)))
      .limit(1)
    if (!application) throw new AppError('Solicitud no encontrada', 404)

    const [document] = await db
      .select()
      .from(uploadedDocuments)
      .where(
        and(
          eq(uploadedDocuments.id, documentId),
          eq(uploadedDocuments.tenantId, tenantId),
          eq(uploadedDocuments.formSubmissionId, sql`(SELECT submission_id FROM admission_applications WHERE id = ${id})`),
          eq(uploadedDocuments.isDeleted, false),
        ),
      )
      .limit(1)

    if (!document) throw new AppError('Documento no encontrado para esta solicitud', 404)

    const now = new Date()
    const [existing] = await db
      .select({ id: admissionDocumentReviews.id })
      .from(admissionDocumentReviews)
      .where(
        and(
          eq(admissionDocumentReviews.tenantId, tenantId),
          eq(admissionDocumentReviews.uploadedDocumentId, documentId),
          eq(admissionDocumentReviews.isDeleted, false),
        ),
      )
      .limit(1)

    let reasonLabel: string | null = null
    if (payload.reasonCode) {
      const [reason] = await db
        .select()
        .from(admissionDecisionReasons)
        .where(
          and(
            eq(admissionDecisionReasons.tenantId, tenantId),
            eq(admissionDecisionReasons.code, payload.reasonCode),
            eq(admissionDecisionReasons.isDeleted, false),
          ),
        )
        .limit(1)
      if (reason) reasonLabel = reason.label
    }

    const review = existing
      ? (
          await db
            .update(admissionDocumentReviews)
            .set({
              status: payload.status,
              reasonCode: payload.reasonCode || null,
              reasonLabel: payload.reasonLabel || reasonLabel,
              notes: payload.notes || null,
              requestedCorrection: payload.requestedCorrection || null,
              reviewedBy: user.id,
              reviewedAt: now,
              updatedAt: now,
              updatedBy: user.id,
            })
            .where(eq(admissionDocumentReviews.id, existing.id))
            .returning()
        )[0]
      : (
          await db
            .insert(admissionDocumentReviews)
            .values({
              tenantId,
              admissionApplicationId: id,
              uploadedDocumentId: documentId,
              status: payload.status,
              reasonCode: payload.reasonCode || null,
              reasonLabel: payload.reasonLabel || reasonLabel,
              notes: payload.notes || null,
              requestedCorrection: payload.requestedCorrection || null,
              reviewedBy: user.id,
              reviewedAt: now,
              createdBy: user.id,
              updatedBy: user.id,
            })
            .returning()
        )[0]

    if (!review) throw new AppError('No fue posible guardar la revisión documental', 500)

    await writeAuditLog(db, {
      tenantId,
      actorUserId: user.id,
      entity: 'admission_document_reviews',
      entityId: review.id,
      action: 'review',
      changes: {
        applicationId: id,
        uploadedDocumentId: documentId,
        status: payload.status,
        reasonCode: payload.reasonCode || null,
        reasonLabel: payload.reasonLabel || reasonLabel,
        notes: payload.notes || null,
        requestedCorrection: payload.requestedCorrection || null,
      },
      ipAddress: c.req.header('cf-connecting-ip'),
    })

    return c.json(ok('Revisión documental registrada', {
      id: review.id,
      status: review.status,
      reviewedAt: review.reviewedAt?.toISOString() ?? null,
    }))
  },
)

admissionRoutes.get('/users/staff', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const staff = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
    })
    .from(users)
    .where(and(
      eq(users.tenantId, tenantId),
      eq(users.isDeleted, false),
      eq(users.status, 'active'),
    ))
    .orderBy(asc(users.fullName))

  return c.json(ok('Personal cargado', { items: staff }))
})

admissionRoutes.patch('/applications/:id/assign', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', admissionAssignmentSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [application] = await db
    .select({ id: admissionApplications.id, assignedTo: admissionApplications.assignedTo })
    .from(admissionApplications)
    .where(and(eq(admissionApplications.id, id), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false)))
    .limit(1)

  if (!application) throw new AppError('Solicitud no encontrada', 404)

  const [updated] = await db
    .update(admissionApplications)
    .set({ assignedTo: payload.assignedTo, updatedAt: new Date(), updatedBy: user.id })
    .where(eq(admissionApplications.id, id))
    .returning({ id: admissionApplications.id, assignedTo: admissionApplications.assignedTo })

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'admission_applications',
    entityId: id,
    action: 'assign',
    changes: { from: application.assignedTo, to: payload.assignedTo },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(ok('Responsable asignado', { id: updated!.id, assignedTo: updated!.assignedTo }))
})

admissionRoutes.get('/applications/:id/comments', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const rows = await db
    .select({
      id: admissionComments.id,
      content: admissionComments.content,
      isInternalOnly: admissionComments.isInternalOnly,
      createdAt: admissionComments.createdAt,
      authorId: admissionComments.authorId,
      authorName: users.fullName,
    })
    .from(admissionComments)
    .leftJoin(users, eq(users.id, admissionComments.authorId))
    .where(and(
      eq(admissionComments.tenantId, tenantId),
      eq(admissionComments.admissionApplicationId, id),
      eq(admissionComments.isDeleted, false),
    ))
    .orderBy(asc(admissionComments.createdAt))

  return c.json(ok('Comentarios cargados', {
    items: rows.map((row) => ({
      id: row.id,
      content: row.content,
      isInternalOnly: row.isInternalOnly,
      authorName: row.authorName ?? 'Sistema',
      createdAt: row.createdAt.toISOString(),
    })),
  }))
})

admissionRoutes.post('/applications/:id/comments', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', admissionCommentCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [application] = await db
    .select({ id: admissionApplications.id })
    .from(admissionApplications)
    .where(and(eq(admissionApplications.id, id), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false)))
    .limit(1)

  if (!application) throw new AppError('Solicitud no encontrada', 404)

  const [comment] = await db
    .insert(admissionComments)
    .values({
      tenantId,
      admissionApplicationId: id,
      authorId: user.id,
      content: payload.content,
      isInternalOnly: payload.isInternalOnly,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: admissionComments.id, content: admissionComments.content, createdAt: admissionComments.createdAt })

  if (!comment) throw new AppError('No fue posible crear el comentario', 500)

  return c.json(created('Comentario agregado', {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
  }), 201)
})

admissionRoutes.get('/applications/:id/file', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [application] = await db
    .select()
    .from(admissionApplications)
    .where(and(eq(admissionApplications.id, id), eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.isDeleted, false)))
    .limit(1)
  if (!application) throw new AppError('Solicitud no encontrada', 404)

  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, application.studentId), eq(students.tenantId, tenantId), eq(students.isDeleted, false)))
    .limit(1)

  const guardianRows = await db
    .select({ link: studentGuardians, guardian: guardians })
    .from(studentGuardians)
    .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
    .where(and(eq(studentGuardians.tenantId, tenantId), eq(studentGuardians.studentId, application.studentId), eq(studentGuardians.isDeleted, false)))
    .orderBy(desc(studentGuardians.isPrimary), desc(studentGuardians.isLegalRepresentative))

  const documents = await db
    .select()
    .from(uploadedDocuments)
    .where(and(eq(uploadedDocuments.tenantId, tenantId), eq(uploadedDocuments.studentId, application.studentId), eq(uploadedDocuments.isDeleted, false)))
    .orderBy(desc(uploadedDocuments.uploadedAt))

  return c.json(ok('Expediente de aspirante cargado', {
    application: { id: application.id, status: application.status, source: application.source, createdAt: application.createdAt.toISOString(), submittedAt: application.submittedAt?.toISOString() ?? null, notes: application.notes ?? null },
    student: student ? { id: student.id, firstName: student.firstName, lastName: student.lastName, documentType: student.documentType, documentNumber: student.documentNumber, birthDate: student.birthDate, gender: student.gender } : null,
    guardians: guardianRows.map(({ link, guardian }) => ({ id: guardian.id, firstName: guardian.firstName, lastName: guardian.lastName, documentType: guardian.documentType, documentNumber: guardian.documentNumber, email: guardian.email, phone: guardian.phone, relationship: guardian.relationship, relationshipType: link.relationshipType, isPrimary: link.isPrimary, isLegalRepresentative: link.isLegalRepresentative, isFinancialResponsible: link.isFinancialResponsible })),
    documents: documents.map((d) => ({ id: d.id, fileName: d.fileName, mimeType: d.mimeType, status: d.status, fileSizeBytes: d.fileSizeBytes, uploadedAt: d.uploadedAt.toISOString() })),
  }))
})

admissionRoutes.get('/export/csv', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const year = Number(c.req.query('year') ?? '0')
  const status = c.req.query('status') || undefined

  if (!Number.isInteger(year)) throw new AppError('Año lectivo requerido para exportación', 400)

  let academicYearId: string | undefined
  if (year) {
    const [row] = await db.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, year), eq(academicYears.isDeleted, false))).limit(1)
    if (!row) throw new AppError('Año lectivo no encontrado', 404)
    academicYearId = row.id
  }

  const where = and(
    eq(admissionApplications.tenantId, tenantId),
    eq(admissionApplications.isDeleted, false),
    academicYearId ? eq(admissionApplications.academicYearId, academicYearId) : undefined,
    status ? eq(admissionApplications.status, status) : undefined,
  )

  const rows = await db
    .select({
      id: admissionApplications.id,
      status: admissionApplications.status,
      source: admissionApplications.source,
      createdAt: admissionApplications.createdAt,
      submittedAt: admissionApplications.submittedAt,
      studentFirstName: students.firstName,
      studentMiddleName: students.middleName,
      studentLastName: students.lastName,
      studentDocumentType: students.documentType,
      studentDocumentNumber: students.documentNumber,
      guardianFirstName: guardians.firstName,
      guardianLastName: guardians.lastName,
      guardianEmail: guardians.email,
      gradeName: grades.name,
    })
    .from(admissionApplications)
    .leftJoin(students, eq(students.id, admissionApplications.studentId))
    .leftJoin(guardians, eq(guardians.id, admissionApplications.primaryGuardianId))
    .leftJoin(grades, eq(grades.id, admissionApplications.requestedGradeId))
    .where(where)
    .orderBy(desc(admissionApplications.createdAt))

  const header = 'id,estudiante,tipo_documento,numero_documento,acudiente,email_acudiente,grado_solicitado,fuente,estado,fecha_creacion\n'
  const bodyLines = rows.map((r) => [
    r.id,
    [r.studentFirstName, r.studentMiddleName, r.studentLastName].filter(Boolean).join(' '),
    r.studentDocumentType ?? '', r.studentDocumentNumber ?? '',
    [r.guardianFirstName, r.guardianLastName].filter(Boolean).join(' '),
    r.guardianEmail ?? '', r.gradeName ?? '', r.source ?? '', r.status ?? '', r.createdAt.toISOString(),
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')

  c.res.headers.set('Content-Type', 'text/csv; charset=utf-8')
  c.res.headers.set('Content-Disposition', `attachment; filename="inscripciones-${year}.csv"`)
  return c.body(header + bodyLines)
})
