import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  academicPeriods,
  academicYears,
  admissionApplications,
  formFields,
  formSections,
  formSubmissions,
  formTemplates,
  formTemplateVersions,
  formFieldValues,
  grades,
  groups,
  guardians,
  requiredDocuments,
  studentGuardians,
  students,
  tenants,
  uploadedDocuments,
} from '@ofir/db'
import { publicAdmissionSubmissionSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { ok } from '../lib/http'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const publicAdmissionRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

const todayIsoDate = () => new Date().toISOString().slice(0, 10)

const isInsideWindow = (startsOn: string | null, endsOn: string | null, today: string) =>
  (!startsOn || startsOn <= today) && (!endsOn || endsOn >= today)

const processStatus = (startsOn: string | null, endsOn: string | null, today: string) => {
  if (startsOn && startsOn > today) return 'scheduled'
  if (endsOn && endsOn < today) return 'closed'
  return 'open'
}

const hasAnswerValue = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

const parseJsonField = (formData: FormData, key: string) => {
  const raw = formData.get(key)

  if (typeof raw !== 'string') {
    throw new AppError(`Falta el campo ${key} en la solicitud`, 400)
  }

  try {
    return JSON.parse(raw)
  } catch {
    throw new AppError(`El campo ${key} tiene un formato invalido`, 400)
  }
}

const parsePublicSubmissionRequest = async (c: {
  req: {
    header: (name: string) => string | undefined
    raw: {
      formData: () => Promise<FormData>
      json: () => Promise<unknown>
    }
  }
}) => {
  const contentType = c.req.header('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.raw.formData()
    const files = new Map<string, File>()

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('document:') && value instanceof File && value.size > 0) {
        files.set(key.slice('document:'.length), value)
      }
    }

    return {
      payload: publicAdmissionSubmissionSchema.parse({
        submissionToken: formData.get('submissionToken'),
        formTemplateId: formData.get('formTemplateId'),
        formTemplateVersionId: formData.get('formTemplateVersionId'),
        student: parseJsonField(formData, 'student'),
        guardian: parseJsonField(formData, 'guardian'),
        admission: parseJsonField(formData, 'admission'),
        answers: parseJsonField(formData, 'answers'),
        documents: parseJsonField(formData, 'documents'),
      }),
      files,
    }
  }

  return {
    payload: publicAdmissionSubmissionSchema.parse(await c.req.raw.json()),
    files: new Map<string, File>(),
  }
}

const sanitizeFileName = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

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

publicAdmissionRoutes.get('/tenants/:tenantSlug/inscriptions/:year', async (c) => {
  const db = c.get('db')
  const tenantSlug = c.req.param('tenantSlug')
  const year = Number(c.req.param('year'))

  if (!Number.isInteger(year)) {
    throw new AppError('Año lectivo invalido', 400)
  }

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      settings: tenants.settings,
    })
    .from(tenants)
    .where(and(eq(tenants.slug, tenantSlug), eq(tenants.status, 'active'), eq(tenants.isDeleted, false)))
    .limit(1)

  if (!tenant) {
    throw new AppError('Colegio no encontrado', 404)
  }

  const [academicYear] = await db
    .select({
      id: academicYears.id,
      name: academicYears.name,
      year: academicYears.year,
      startsOn: academicYears.startsOn,
      endsOn: academicYears.endsOn,
      isActive: academicYears.isActive,
    })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenant.id), eq(academicYears.year, year), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!academicYear) {
    throw new AppError('Año lectivo no encontrado para este colegio', 404)
  }

  if (!academicYear.isActive) {
    throw new AppError('El formulario público solo está disponible para el año lectivo activo.', 409)
  }

  const periodRows = await db
    .select({ weight: academicPeriods.weight })
    .from(academicPeriods)
    .where(
      and(
        eq(academicPeriods.tenantId, tenant.id),
        eq(academicPeriods.academicYearId, academicYear.id),
        eq(academicPeriods.isDeleted, false),
      ),
    )

  const periodsWeightTotal = periodRows.reduce((sum, item) => sum + item.weight, 0)
  if (!periodRows.length) {
    throw new AppError('El proceso público aún no está listo: faltan periodos académicos para el año activo.', 409)
  }
  if (periodsWeightTotal !== 100) {
    throw new AppError(`El proceso público aún no está listo: los periodos del año activo deben sumar 100 y hoy suman ${periodsWeightTotal}.`, 409)
  }

  const [template] = await db
    .select({
      id: formTemplates.id,
      code: formTemplates.code,
      name: formTemplates.name,
      description: formTemplates.description,
      startsOn: formTemplates.startsOn,
      endsOn: formTemplates.endsOn,
      status: formTemplates.status,
      settings: formTemplates.settings,
      activeVersionId: formTemplates.activeVersionId,
    })
    .from(formTemplates)
    .where(
      and(
        eq(formTemplates.tenantId, tenant.id),
        eq(formTemplates.academicYearId, academicYear.id),
        eq(formTemplates.module, 'enrollment'),
        eq(formTemplates.status, 'active'),
        eq(formTemplates.isDeleted, false),
      ),
    )
    .orderBy(desc(formTemplates.createdAt))
    .limit(1)

  if (!template) {
    throw new AppError('No hay proceso de inscripcion configurado para este año lectivo', 404)
  }

  const today = todayIsoDate()
  const publicStatus = processStatus(template.startsOn, template.endsOn, today)
  const isOpen = isInsideWindow(template.startsOn, template.endsOn, today)

  const availableGrades = await db
    .select({
      id: grades.id,
      name: grades.name,
      level: grades.level,
    })
    .from(grades)
    .where(and(eq(grades.tenantId, tenant.id), eq(grades.isDeleted, false)))
    .orderBy(asc(grades.level), asc(grades.name))

  if (!availableGrades.length) {
    throw new AppError('El proceso público aún no está listo: faltan grados configurados.', 409)
  }

  const availableGroups = await db
    .select({
      id: groups.id,
      gradeId: groups.gradeId,
      name: groups.name,
    })
    .from(groups)
    .where(
      and(
        eq(groups.tenantId, tenant.id),
        eq(groups.academicYearId, academicYear.id),
        eq(groups.isDeleted, false),
      ),
    )
    .orderBy(asc(groups.name))

  if (!availableGroups.length) {
    throw new AppError('El proceso público aún no está listo: faltan cursos configurados para el año activo.', 409)
  }

  if (!isOpen) {
    return c.json(
      ok('Proceso de inscripcion no disponible', {
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          settings: tenant.settings,
        },
        academicYear,
        process: {
          code: template.code,
          name: template.name,
          description: template.description,
          startsOn: template.startsOn,
          endsOn: template.endsOn,
          status: publicStatus,
          isOpen,
        },
        form: null,
        catalogs: {
          grades: availableGrades,
          groups: availableGroups,
        },
      }),
    )
  }

  const versionFilter = template.activeVersionId
    ? and(
        eq(formTemplateVersions.tenantId, tenant.id),
        eq(formTemplateVersions.id, template.activeVersionId),
        eq(formTemplateVersions.status, 'published'),
        eq(formTemplateVersions.isDeleted, false),
      )
    : and(
        eq(formTemplateVersions.tenantId, tenant.id),
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
    throw new AppError('El proceso no tiene una version publicada del formulario', 404)
  }

  const sections = await db
    .select({
      id: formSections.id,
      code: formSections.code,
      title: formSections.title,
      description: formSections.description,
      sortOrder: formSections.sortOrder,
      isCollapsible: formSections.isCollapsible,
    })
    .from(formSections)
    .where(
      and(
        eq(formSections.tenantId, tenant.id),
        eq(formSections.formTemplateVersionId, version.id),
        eq(formSections.isDeleted, false),
      ),
    )
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
    .where(
      and(
        eq(formFields.tenantId, tenant.id),
        eq(formFields.formTemplateVersionId, version.id),
        eq(formFields.isDeleted, false),
      ),
    )
    .orderBy(asc(formFields.sortOrder), asc(formFields.label))

  const documents = await db
    .select({
      id: requiredDocuments.id,
      code: requiredDocuments.code,
      name: requiredDocuments.name,
      description: requiredDocuments.description,
      isRequired: requiredDocuments.isRequired,
      acceptedMimeTypes: requiredDocuments.acceptedMimeTypes,
      maxFileSizeMb: requiredDocuments.maxFileSizeMb,
      sortOrder: requiredDocuments.sortOrder,
    })
    .from(requiredDocuments)
    .where(
      and(
        eq(requiredDocuments.tenantId, tenant.id),
        eq(requiredDocuments.formTemplateVersionId, version.id),
        eq(requiredDocuments.isDeleted, false),
      ),
    )
    .orderBy(asc(requiredDocuments.sortOrder), asc(requiredDocuments.name))

  const sectionsWithFields = sections.map((section) => ({
    ...section,
    fields: fields.filter((field) => field.sectionId === section.id).map(({ sectionId: _sectionId, ...field }) => field),
  }))

  return c.json(
    ok('Formulario publico de inscripcion cargado', {
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        settings: tenant.settings,
      },
      academicYear,
      process: {
        code: template.code,
        name: template.name,
        description: template.description,
        startsOn: template.startsOn,
        endsOn: template.endsOn,
        status: publicStatus,
        isOpen,
      },
      form: {
        templateId: template.id,
        versionId: version.id,
        versionNumber: version.versionNumber,
        settings: template.settings,
        schemaSnapshot: version.schemaSnapshot,
        sections: sectionsWithFields,
        requiredDocuments: documents,
      },
      catalogs: {
        grades: availableGrades,
        groups: availableGroups,
      },
    }),
  )
})

publicAdmissionRoutes.post(
  '/tenants/:tenantSlug/inscriptions/:year/submissions',
  async (c) => {
    const db = c.get('db')
    const { payload, files } = await parsePublicSubmissionRequest(c)
    const tenantSlug = c.req.param('tenantSlug')
    const year = Number(c.req.param('year'))

    if (!Number.isInteger(year)) {
      throw new AppError('Año lectivo invalido', 400)
    }

    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
      })
      .from(tenants)
      .where(and(eq(tenants.slug, tenantSlug), eq(tenants.status, 'active'), eq(tenants.isDeleted, false)))
      .limit(1)

    if (!tenant) {
      throw new AppError('Colegio no encontrado', 404)
    }

    const [academicYear] = await db
      .select({
        id: academicYears.id,
        year: academicYears.year,
      })
      .from(academicYears)
      .where(and(eq(academicYears.tenantId, tenant.id), eq(academicYears.year, year), eq(academicYears.isDeleted, false)))
      .limit(1)

    if (!academicYear) {
      throw new AppError('Año lectivo no encontrado para este colegio', 404)
    }

    const [template] = await db
      .select({
        id: formTemplates.id,
        startsOn: formTemplates.startsOn,
        endsOn: formTemplates.endsOn,
        activeVersionId: formTemplates.activeVersionId,
        settings: formTemplates.settings,
      })
      .from(formTemplates)
      .where(
        and(
          eq(formTemplates.tenantId, tenant.id),
          eq(formTemplates.id, payload.formTemplateId),
          eq(formTemplates.academicYearId, academicYear.id),
          eq(formTemplates.module, 'enrollment'),
          eq(formTemplates.status, 'active'),
          eq(formTemplates.isDeleted, false),
        ),
      )
      .limit(1)

    if (!template) {
      throw new AppError('Proceso de inscripcion no disponible', 404)
    }

    const today = todayIsoDate()
    if (!isInsideWindow(template.startsOn, template.endsOn, today)) {
      throw new AppError('El proceso de inscripcion esta fuera de la ventana permitida', 400)
    }

    const [version] = await db
      .select({
        id: formTemplateVersions.id,
        versionNumber: formTemplateVersions.versionNumber,
        schemaSnapshot: formTemplateVersions.schemaSnapshot,
      })
      .from(formTemplateVersions)
      .where(
        and(
          eq(formTemplateVersions.tenantId, tenant.id),
          eq(formTemplateVersions.id, payload.formTemplateVersionId),
          eq(formTemplateVersions.formTemplateId, template.id),
          eq(formTemplateVersions.status, 'published'),
          eq(formTemplateVersions.isDeleted, false),
        ),
      )
      .limit(1)

    if (!version) {
      throw new AppError('La version del formulario no esta publicada', 400)
    }

    const [requestedGrade] = await db
      .select({
        id: grades.id,
        name: grades.name,
      })
      .from(grades)
      .where(and(eq(grades.tenantId, tenant.id), eq(grades.id, payload.admission.requestedGradeId), eq(grades.isDeleted, false)))
      .limit(1)

    if (!requestedGrade) {
      throw new AppError('El grado solicitado no existe en este colegio', 400)
    }

    if (payload.admission.requestedGroupId) {
      const [requestedGroup] = await db
        .select({
          id: groups.id,
        })
        .from(groups)
        .where(
          and(
            eq(groups.tenantId, tenant.id),
            eq(groups.id, payload.admission.requestedGroupId),
            eq(groups.academicYearId, academicYear.id),
            eq(groups.gradeId, requestedGrade.id),
            eq(groups.isDeleted, false),
          ),
        )
        .limit(1)

      if (!requestedGroup) {
        throw new AppError('El curso solicitado no pertenece al grado o año lectivo elegido', 400)
      }
    }

    const versionSections = await db
      .select({
        id: formSections.id,
        title: formSections.title,
      })
      .from(formSections)
      .where(
        and(
          eq(formSections.tenantId, tenant.id),
          eq(formSections.formTemplateVersionId, version.id),
          eq(formSections.isDeleted, false),
        ),
      )

    const versionFields = await db
      .select({
        id: formFields.id,
        formSectionId: formFields.formSectionId,
        code: formFields.code,
        label: formFields.label,
        fieldType: formFields.fieldType,
        isRequired: formFields.isRequired,
      })
      .from(formFields)
      .where(
        and(
          eq(formFields.tenantId, tenant.id),
          eq(formFields.formTemplateVersionId, version.id),
          eq(formFields.isDeleted, false),
        ),
      )

    const sectionById = new Map(versionSections.map((section) => [section.id, section.title]))
    const requiredFieldErrors = versionFields
      .filter((field) => field.isRequired)
      .filter((field) => !hasAnswerValue(payload.answers[field.code]))
      .map((field) => field.label)

    if (requiredFieldErrors.length) {
      throw new AppError(`Faltan campos obligatorios del formulario: ${requiredFieldErrors.join(', ')}`, 400)
    }

    const configuredDocuments = await db
      .select({
        id: requiredDocuments.id,
        code: requiredDocuments.code,
        name: requiredDocuments.name,
        isRequired: requiredDocuments.isRequired,
        acceptedMimeTypes: requiredDocuments.acceptedMimeTypes,
        maxFileSizeMb: requiredDocuments.maxFileSizeMb,
      })
      .from(requiredDocuments)
      .where(
        and(
          eq(requiredDocuments.tenantId, tenant.id),
          eq(requiredDocuments.formTemplateVersionId, version.id),
          eq(requiredDocuments.isDeleted, false),
        ),
      )

    const submittedDocuments = new Map(payload.documents.map((document) => [document.documentCode, document]))
    files.forEach((file, documentCode) => {
      if (!submittedDocuments.has(documentCode)) {
        submittedDocuments.set(documentCode, {
          documentCode,
          fileName: file.name,
          mimeType: file.type || null,
          fileSizeBytes: file.size,
        })
      }
    })

    const missingDocuments = configuredDocuments
      .filter((document) => document.isRequired)
      .filter((document) => !submittedDocuments.has(document.code))
      .map((document) => document.name)

    if (missingDocuments.length) {
      throw new AppError(`Faltan documentos obligatorios: ${missingDocuments.join(', ')}`, 400)
    }

    configuredDocuments.forEach((document) => {
      const file = files.get(document.code)

      if (!file) return

      if (document.acceptedMimeTypes.length && !document.acceptedMimeTypes.includes(file.type)) {
        throw new AppError(`El archivo ${file.name} no cumple con los formatos permitidos para ${document.name}`, 400)
      }

      const maxSizeBytes = document.maxFileSizeMb * 1024 * 1024
      if (file.size > maxSizeBytes) {
        throw new AppError(`El archivo ${file.name} supera el tamaño máximo permitido para ${document.name}`, 400)
      }
    })

    const [existingSubmission] = await db
      .select({
        id: formSubmissions.id,
        studentId: formSubmissions.studentId,
        guardianId: formSubmissions.submittedByGuardianId,
        applicationId: formSubmissions.admissionApplicationId,
      })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.tenantId, tenant.id),
          eq(formSubmissions.formTemplateId, template.id),
          eq(formSubmissions.academicYearId, academicYear.id),
          eq(formSubmissions.isDeleted, false),
          sql`${formSubmissions.metadata} ->> 'submissionToken' = ${payload.submissionToken}`,
        ),
      )
      .limit(1)

    if (existingSubmission) {
      return c.json(
        ok('Inscripcion ya registrada previamente', {
          studentId: existingSubmission.studentId,
          guardianId: existingSubmission.guardianId,
          applicationId: existingSubmission.applicationId,
          formSubmissionId: existingSubmission.id,
          idempotentReplay: true,
          documentsStoredAsMetadata: true,
        }),
      )
    }

    const cleanupState = {
      createdStudentId: null as string | null,
      createdGuardianId: null as string | null,
      createdRelationId: null as string | null,
      createdApplicationId: null as string | null,
      createdSubmissionId: null as string | null,
      uploadedDocumentIds: [] as string[],
      uploadedObjectKeys: [] as string[],
    }

    let result: {
      student: { id: string }
      guardian: { id: string }
      application: { id: string }
      submission: { id: string }
    }

    try {

    const [existingStudent] = await db
      .select({
        id: students.id,
      })
      .from(students)
      .where(
        and(
          eq(students.tenantId, tenant.id),
          eq(students.documentType, payload.student.documentType),
          eq(students.documentNumber, payload.student.documentNumber),
          eq(students.isDeleted, false),
        ),
      )
      .limit(1)

    const studentResult = existingStudent
      ? await db
          .update(students)
          .set({
            firstName: payload.student.firstName,
            middleName: payload.student.middleName || null,
            lastName: payload.student.lastName,
            birthDate: payload.student.birthDate,
            gender: payload.student.gender,
            bloodType: payload.student.bloodType || null,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(students.id, existingStudent.id))
          .returning()
      : await db
          .insert(students)
          .values({
            tenantId: tenant.id,
            firstName: payload.student.firstName,
            middleName: payload.student.middleName || null,
            lastName: payload.student.lastName,
            documentType: payload.student.documentType,
            documentNumber: payload.student.documentNumber,
            birthDate: payload.student.birthDate,
            gender: payload.student.gender,
            bloodType: payload.student.bloodType || null,
            status: 'active',
          })
          .returning()
    const student = studentResult[0]

    if (!existingStudent) {
      cleanupState.createdStudentId = student?.id ?? null
    }

    if (!student) {
      throw new AppError('No fue posible registrar el estudiante', 500)
    }

    const [existingGuardian] = await db
      .select({
        id: guardians.id,
      })
      .from(guardians)
      .where(
        and(
          eq(guardians.tenantId, tenant.id),
          eq(guardians.documentType, payload.guardian.documentType),
          eq(guardians.documentNumber, payload.guardian.documentNumber),
          eq(guardians.isDeleted, false),
        ),
      )
      .limit(1)

    const guardianResult = existingGuardian
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
          })
          .where(eq(guardians.id, existingGuardian.id))
          .returning()
      : await db
          .insert(guardians)
          .values({
            tenantId: tenant.id,
            fullName: `${payload.guardian.firstName} ${payload.guardian.lastName}`,
            firstName: payload.guardian.firstName,
            lastName: payload.guardian.lastName,
            documentType: payload.guardian.documentType,
            documentNumber: payload.guardian.documentNumber,
            email: payload.guardian.email,
            phone: payload.guardian.phone,
            relationship: payload.guardian.relationship,
          })
          .returning()
    const guardian = guardianResult[0]

    if (!existingGuardian) {
      cleanupState.createdGuardianId = guardian?.id ?? null
    }

    if (!guardian) {
      throw new AppError('No fue posible registrar el acudiente', 500)
    }

    const [existingRelation] = await db
      .select({
        id: studentGuardians.id,
      })
      .from(studentGuardians)
      .where(
        and(
          eq(studentGuardians.tenantId, tenant.id),
          eq(studentGuardians.studentId, student.id),
          eq(studentGuardians.guardianId, guardian.id),
          eq(studentGuardians.isDeleted, false),
        ),
      )
      .limit(1)

    if (!existingRelation) {
      const relationResult = await db.insert(studentGuardians).values({
        tenantId: tenant.id,
        studentId: student.id,
        guardianId: guardian.id,
        isPrimary: true,
      }).returning({ id: studentGuardians.id })
      cleanupState.createdRelationId = relationResult[0]?.id ?? null
    }

    const [existingApplication] = await db
      .select({
        id: admissionApplications.id,
      })
      .from(admissionApplications)
      .where(
        and(
          eq(admissionApplications.tenantId, tenant.id),
          eq(admissionApplications.studentId, student.id),
          eq(admissionApplications.academicYearId, academicYear.id),
          eq(admissionApplications.isDeleted, false),
        ),
      )
      .limit(1)

    if (existingApplication) {
      throw new AppError('Ya existe una inscripcion para este estudiante en el año lectivo seleccionado', 409)
    }

    const applicationResult = await db
      .insert(admissionApplications)
      .values({
        tenantId: tenant.id,
        studentId: student.id,
        academicYearId: academicYear.id,
        requestedGradeId: payload.admission.requestedGradeId,
        requestedGroupId: payload.admission.requestedGroupId || null,
        primaryGuardianId: guardian.id,
        status: 'submitted',
        source: payload.admission.source,
        applicationDate: new Date(),
        submittedAt: new Date(),
        fixedData: {},
        notes: payload.admission.notes || null,
      })
      .returning()
    const application = applicationResult[0]
    cleanupState.createdApplicationId = application?.id ?? null

    if (!application) {
      throw new AppError('No fue posible crear la solicitud de inscripcion', 500)
    }

    const submissionResult = await db
      .insert(formSubmissions)
      .values({
        tenantId: tenant.id,
        formTemplateId: template.id,
        formTemplateVersionId: version.id,
        academicYearId: academicYear.id,
        admissionApplicationId: application.id,
        studentId: student.id,
        submittedByGuardianId: guardian.id,
        status: 'submitted',
        progressPercent: 100,
        submittedAt: new Date(),
        schemaSnapshot: version.schemaSnapshot,
        metadata: {
          source: 'public_link',
          tenantSlug,
          submissionToken: payload.submissionToken,
          academicYear: year,
          selectedDocuments: payload.documents,
          processSettings: template.settings,
        },
      })
      .returning()
    const submission = submissionResult[0]
    cleanupState.createdSubmissionId = submission?.id ?? null

    if (!submission) {
      throw new AppError('No fue posible crear la entrega del formulario', 500)
    }

    const valueRows = versionFields
      .filter((field) => hasAnswerValue(payload.answers[field.code]))
      .map((field) =>
        buildFieldValueRecord({
          tenantId: tenant.id,
          submissionId: submission.id,
          field,
          sectionTitle: sectionById.get(field.formSectionId) ?? 'Formulario',
          value: payload.answers[field.code],
        }),
      )

    if (valueRows.length) {
      await db.insert(formFieldValues).values(valueRows)
    }

    for (const document of configuredDocuments) {
      const file = files.get(document.code)

      if (!file) continue

      const safeName = sanitizeFileName(file.name) || `${document.code}.bin`
      const fileKey = `${tenant.slug}/${year}/${submission.id}/${document.code}-${crypto.randomUUID()}-${safeName}`

      await c.env.ADMISSIONS_BUCKET.put(fileKey, file.stream(), {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
        customMetadata: {
          tenantId: tenant.id,
          submissionId: submission.id,
          documentCode: document.code,
        },
      })

      cleanupState.uploadedObjectKeys.push(fileKey)

      const [uploadedDocument] = await db
        .insert(uploadedDocuments)
        .values({
          tenantId: tenant.id,
          requiredDocumentId: document.id,
          formSubmissionId: submission.id,
          studentId: student.id,
          fileName: file.name,
          fileKey,
          mimeType: file.type || 'application/octet-stream',
          fileSizeBytes: file.size,
          status: 'uploaded',
          metadata: {
            documentCode: document.code,
            documentName: document.name,
          },
        })
        .returning({ id: uploadedDocuments.id, fileKey: uploadedDocuments.fileKey })

      if (uploadedDocument) {
        cleanupState.uploadedDocumentIds.push(uploadedDocument.id)
      }
    }

    result = {
      student,
      guardian,
      application,
      submission,
    }
    } catch (error) {
      try {
        if (cleanupState.uploadedDocumentIds.length) {
          await db
            .update(uploadedDocuments)
            .set({
              isDeleted: true,
              updatedAt: new Date(),
            })
            .where(inArray(uploadedDocuments.id, cleanupState.uploadedDocumentIds))
        }

        if (cleanupState.uploadedObjectKeys.length) {
          await Promise.all(cleanupState.uploadedObjectKeys.map((key) => c.env.ADMISSIONS_BUCKET.delete(key)))
        }

        if (cleanupState.createdSubmissionId) {
          await db
            .update(formFieldValues)
            .set({
              isDeleted: true,
              updatedAt: new Date(),
            })
            .where(eq(formFieldValues.formSubmissionId, cleanupState.createdSubmissionId))

          await db
            .update(formSubmissions)
            .set({
              isDeleted: true,
              updatedAt: new Date(),
            })
            .where(eq(formSubmissions.id, cleanupState.createdSubmissionId))
        }

        if (cleanupState.createdApplicationId) {
          await db
            .update(admissionApplications)
            .set({
              isDeleted: true,
              updatedAt: new Date(),
            })
            .where(eq(admissionApplications.id, cleanupState.createdApplicationId))
        }

        if (cleanupState.createdRelationId) {
          await db
            .update(studentGuardians)
            .set({
              isDeleted: true,
              updatedAt: new Date(),
            })
            .where(eq(studentGuardians.id, cleanupState.createdRelationId))
        }

        if (cleanupState.createdGuardianId) {
          await db
            .update(guardians)
            .set({
              isDeleted: true,
              updatedAt: new Date(),
            })
            .where(eq(guardians.id, cleanupState.createdGuardianId))
        }

        if (cleanupState.createdStudentId) {
          await db
            .update(students)
            .set({
              isDeleted: true,
              updatedAt: new Date(),
            })
            .where(eq(students.id, cleanupState.createdStudentId))
        }
      } catch (cleanupError) {
        console.error('Cleanup error after public admission failure', cleanupError)
      }

      throw error
    }

    await writeAuditLog(db, {
      tenantId: tenant.id,
      entity: 'admission_applications',
      entityId: result.application.id,
      action: 'public_submit',
      changes: {
        studentDocument: payload.student.documentNumber,
        guardianDocument: payload.guardian.documentNumber,
        requestedGradeId: payload.admission.requestedGradeId,
        requestedGroupId: payload.admission.requestedGroupId || null,
      },
      ipAddress: c.req.header('cf-connecting-ip'),
    })

    return c.json(
        ok('Inscripcion enviada correctamente', {
          studentId: result.student.id,
          guardianId: result.guardian.id,
          applicationId: result.application.id,
          formSubmissionId: result.submission.id,
          documentsStoredAsMetadata: files.size === 0,
          uploadedDocumentsCount: files.size,
        }),
      201,
    )
  },
)
