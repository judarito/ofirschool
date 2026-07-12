import { and, asc, desc, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  academicYears,
  formFields,
  formSections,
  formTemplates,
  formTemplateVersions,
  requiredDocuments,
  tenants,
} from '@ofir/db'
import { PERMISSIONS, enrollmentFormEditorSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const enrollmentFormRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

enrollmentFormRoutes.use('*', tenantMiddleware, authMiddleware)

const sanitizeCode = (value: string, fallback: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || fallback

const getAcademicYearByNumber = async (db: AppContextVariables['db'], tenantId: string, year: number) => {
  const [academicYear] = await db
    .select({
      id: academicYears.id,
      name: academicYears.name,
      year: academicYears.year,
      isActive: academicYears.isActive,
    })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, year), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!academicYear) {
    throw new AppError('Debes crear primero el año lectivo antes de configurar el formulario', 404)
  }

  return academicYear
}

const getActiveAcademicYear = async (db: AppContextVariables['db'], tenantId: string) => {
  const [academicYear] = await db
    .select({
      id: academicYears.id,
      name: academicYears.name,
      year: academicYears.year,
    })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.isActive, true), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!academicYear) {
    throw new AppError('No hay un año lectivo activo configurado para publicar el formulario.', 409)
  }

  return academicYear
}

const mapEditorPayload = async (
  db: AppContextVariables['db'],
  tenantId: string,
  tenantSlug: string,
  year: number,
  gradeId?: string | null,
  branchId?: string | null,
) => {
  const academicYear = await getAcademicYearByNumber(db, tenantId, year)

  const whereConditions = [
    eq(formTemplates.tenantId, tenantId),
    eq(formTemplates.academicYearId, academicYear.id),
    eq(formTemplates.module, 'enrollment'),
    eq(formTemplates.isDeleted, false),
  ]

  if (gradeId) {
    whereConditions.push(eq(formTemplates.gradeId, gradeId))
  } else {
    whereConditions.push(eq(formTemplates.gradeId, null as any))
  }

  if (branchId) {
    whereConditions.push(eq(formTemplates.branchId, branchId))
  } else {
    whereConditions.push(eq(formTemplates.branchId, null as any))
  }

  const [template] = await db
    .select({
      id: formTemplates.id,
      code: formTemplates.code,
      name: formTemplates.name,
      startsOn: formTemplates.startsOn,
      endsOn: formTemplates.endsOn,
      activeVersionId: formTemplates.activeVersionId,
      settings: formTemplates.settings,
      gradeId: formTemplates.gradeId,
      branchId: formTemplates.branchId,
    })
    .from(formTemplates)
    .where(and(...whereConditions))
    .orderBy(desc(formTemplates.createdAt))
    .limit(1)

  if (!template) {
    return {
      academicYear,
      tenantSlug,
      template: null,
      version: null,
      sections: [],
      documents: [],
    }
  }

  const versions = await db
    .select({
      id: formTemplateVersions.id,
      versionNumber: formTemplateVersions.versionNumber,
      status: formTemplateVersions.status,
      publishedAt: formTemplateVersions.publishedAt,
    })
    .from(formTemplateVersions)
    .where(
      and(
        eq(formTemplateVersions.tenantId, tenantId),
        eq(formTemplateVersions.formTemplateId, template.id),
        eq(formTemplateVersions.isDeleted, false),
      ),
    )
    .orderBy(desc(formTemplateVersions.versionNumber), desc(formTemplateVersions.createdAt))

  const version =
    versions.find((item) => item.status === 'draft') ??
    versions.find((item) => item.id === template.activeVersionId) ??
    versions.find((item) => item.status === 'published') ??
    versions[0]

  if (!version) {
    return {
      academicYear,
      tenantSlug,
      template,
      version: null,
      sections: [],
      documents: [],
    }
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
    .where(
      and(
        eq(formSections.tenantId, tenantId),
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
      fieldType: formFields.fieldType,
      isRequired: formFields.isRequired,
      options: formFields.options,
      sortOrder: formFields.sortOrder,
    })
    .from(formFields)
    .where(
      and(
        eq(formFields.tenantId, tenantId),
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
      isRequired: requiredDocuments.isRequired,
      applicantTypes: requiredDocuments.applicantTypes,
      maxFileSizeMb: requiredDocuments.maxFileSizeMb,
      sortOrder: requiredDocuments.sortOrder,
    })
    .from(requiredDocuments)
    .where(
      and(
        eq(requiredDocuments.tenantId, tenantId),
        eq(requiredDocuments.formTemplateVersionId, version.id),
        eq(requiredDocuments.isDeleted, false),
      ),
    )
    .orderBy(asc(requiredDocuments.sortOrder), asc(requiredDocuments.name))

  return {
    academicYear,
    tenantSlug,
    template,
    version,
    sections: sections.map((section) => ({
      id: section.code,
      title: section.title,
      description: section.description ?? '',
      fields: fields
        .filter((field) => field.sectionId === section.id)
        .map((field) => ({
          id: field.code,
          label: field.label,
          type: field.fieldType,
          required: field.isRequired,
          options: Array.isArray(field.options)
            ? field.options.map((option) => {
                if (typeof option === 'string') return { label: option, value: option }
                const item = option as Record<string, unknown>
                return {
                  label: String(item.label ?? item.value ?? ''),
                  value: String(item.value ?? item.label ?? ''),
                }
              })
            : [],
        })),
    })),
    documents: documents.map((document) => ({
      code: document.code,
      name: document.name,
      isRequired: document.isRequired,
      applicantTypes: document.applicantTypes || [],
      maxFileSizeMb: document.maxFileSizeMb,
      sortOrder: document.sortOrder,
    })),
  }
}

const saveVersionGraph = async ({
  db,
  tenantId,
  year,
  gradeId,
  branchId,
  payload,
}: {
  db: AppContextVariables['db']
  tenantId: string
  year: number
  gradeId?: string | null
  branchId?: string | null
  payload: {
    name: string
    startsOn: string
    endsOn: string
    autosave: boolean
    progressBar: boolean
    sections: Array<{
      id: string
      title: string
      description: string
      fields: Array<{
        id: string
        label: string
        type: string
        required: boolean
        options: Array<{ label: string; value: string }>
      }>
    }>
    documents: Array<{
      id: string
      name: string
      required: boolean
      maxSizeMb: number
    }>
  }
}) => {
  const academicYear = await getAcademicYearByNumber(db, tenantId, year)

  const whereConditions = [
    eq(formTemplates.tenantId, tenantId),
    eq(formTemplates.academicYearId, academicYear.id),
    eq(formTemplates.module, 'enrollment'),
    eq(formTemplates.isDeleted, false),
  ]

  if (gradeId) {
    whereConditions.push(eq(formTemplates.gradeId, gradeId))
  } else {
    whereConditions.push(eq(formTemplates.gradeId, null as any))
  }

  if (branchId) {
    whereConditions.push(eq(formTemplates.branchId, branchId))
  } else {
    whereConditions.push(eq(formTemplates.branchId, null as any))
  }

  const [existingTemplate] = await db
    .select({
      id: formTemplates.id,
      activeVersionId: formTemplates.activeVersionId,
    })
    .from(formTemplates)
    .where(and(...whereConditions))
    .limit(1)

  const templateCode = `enrollment-${year}${gradeId ? `-g${gradeId.slice(0, 8)}` : ''}${branchId ? `-b${branchId.slice(0, 8)}` : ''}`

  const template = existingTemplate
    ? (
        await db
          .update(formTemplates)
          .set({
            name: payload.name,
            description: `Formulario de inscripción ${year}`,
            startsOn: payload.startsOn,
            endsOn: payload.endsOn,
            settings: {
              autosave: payload.autosave,
              progressBar: payload.progressBar,
              allowGuardianDraft: payload.autosave,
            },
            updatedAt: new Date(),
          })
          .where(eq(formTemplates.id, existingTemplate.id))
          .returning({
            id: formTemplates.id,
            activeVersionId: formTemplates.activeVersionId,
          })
      )[0]
    : (
        await db
          .insert(formTemplates)
          .values({
            tenantId,
            academicYearId: academicYear.id,
            gradeId: gradeId || null,
            branchId: branchId || null,
            code: templateCode,
            name: payload.name,
            description: `Formulario de inscripción ${year}`,
            module: 'enrollment',
            entityType: 'enrollment',
            startsOn: payload.startsOn,
            endsOn: payload.endsOn,
            status: 'active',
            settings: {
              autosave: payload.autosave,
              progressBar: payload.progressBar,
              allowGuardianDraft: payload.autosave,
            },
          })
          .returning({
            id: formTemplates.id,
            activeVersionId: formTemplates.activeVersionId,
          })
      )[0]

  if (!template) {
    throw new AppError('No fue posible guardar la cabecera del formulario', 500)
  }

  const versions = await db
    .select({
      id: formTemplateVersions.id,
      versionNumber: formTemplateVersions.versionNumber,
      status: formTemplateVersions.status,
    })
    .from(formTemplateVersions)
    .where(
      and(
        eq(formTemplateVersions.tenantId, tenantId),
        eq(formTemplateVersions.formTemplateId, template.id),
        eq(formTemplateVersions.isDeleted, false),
      ),
    )
    .orderBy(desc(formTemplateVersions.versionNumber))

  let draftVersion = versions.find((version) => version.status === 'draft')

  if (!draftVersion) {
    const [createdDraft] = await db
      .insert(formTemplateVersions)
      .values({
        tenantId,
        formTemplateId: template.id,
        versionNumber: (versions[0]?.versionNumber ?? 0) + 1,
        status: 'draft',
        schemaSnapshot: {},
        notes: 'Borrador editable desde el constructor.',
      })
      .returning({
        id: formTemplateVersions.id,
        versionNumber: formTemplateVersions.versionNumber,
        status: formTemplateVersions.status,
      })

    draftVersion = createdDraft
  }

  if (!draftVersion) {
    throw new AppError('No fue posible preparar una versión borrador', 500)
  }

  await db.delete(formFields).where(eq(formFields.formTemplateVersionId, draftVersion.id))
  await db.delete(formSections).where(eq(formSections.formTemplateVersionId, draftVersion.id))
  await db.delete(requiredDocuments).where(eq(requiredDocuments.formTemplateVersionId, draftVersion.id))

  const insertedSections = payload.sections.length
    ? await db
        .insert(formSections)
        .values(
          payload.sections.map((section, index) => ({
            tenantId,
            formTemplateVersionId: draftVersion.id,
            code: sanitizeCode(section.id || section.title, `section-${index + 1}`),
            title: section.title,
            description: section.description || '',
            sortOrder: index + 1,
            isCollapsible: true,
          })),
        )
        .returning({
          id: formSections.id,
          code: formSections.code,
          title: formSections.title,
        })
    : []

  const sectionIdByCode = new Map(insertedSections.map((section) => [section.code, section.id]))

  const fieldRows = payload.sections.flatMap((section, sectionIndex) =>
    section.fields.map((field, fieldIndex) => ({
      tenantId,
      formTemplateVersionId: draftVersion!.id,
      formSectionId: sectionIdByCode.get(sanitizeCode(section.id || section.title, `section-${sectionIndex + 1}`)) ?? '',
      code: sanitizeCode(field.id || field.label, `field-${sectionIndex + 1}-${fieldIndex + 1}`),
      label: field.label,
      fieldType: field.type,
      sortOrder: fieldIndex + 1,
      isRequired: field.required,
      isSearchable: true,
      isReportable: true,
      options: field.options,
      validationRules: {},
    }))
  ).filter((field) => field.formSectionId)

  if (fieldRows.length) {
    await db.insert(formFields).values(fieldRows)
  }

  if (payload.documents.length) {
    await db.insert(requiredDocuments).values(
      payload.documents.map((document, index) => ({
        tenantId,
        formTemplateVersionId: draftVersion.id,
        code: sanitizeCode(document.id || document.name, `document-${index + 1}`),
        name: document.name,
        isRequired: document.required,
        applicantTypes: 'applicantTypes' in document ? (document as Record<string, unknown>).applicantTypes as string[] || [] : [],
        maxFileSizeMb: document.maxSizeMb,
        acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        sortOrder: index + 1,
      })),
    )
  }

  const schemaSnapshot = {
    version: draftVersion.versionNumber,
    sections: payload.sections.map((section) => ({
      id: sanitizeCode(section.id || section.title, 'section'),
      title: section.title,
      fieldCount: section.fields.length,
    })),
    documents: payload.documents.map((document) => ({
      id: sanitizeCode(document.id || document.name, 'document'),
      name: document.name,
      required: document.required,
    })),
    settings: {
      autosave: payload.autosave,
      progressBar: payload.progressBar,
    },
  }

  await db
    .update(formTemplateVersions)
    .set({
      schemaSnapshot,
      updatedAt: new Date(),
    })
    .where(eq(formTemplateVersions.id, draftVersion.id))

  return {
    templateId: template.id,
    versionId: draftVersion.id,
    versionNumber: draftVersion.versionNumber,
    activeVersionId: template.activeVersionId,
  }
}

enrollmentFormRoutes.get('/:year', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const year = Number(c.req.param('year'))
  const gradeId = c.req.query('gradeId') || null
  const branchId = c.req.query('branchId') || null


  if (!Number.isInteger(year)) {
    throw new AppError('Año lectivo invalido', 400)
  }

  const [tenant] = await db
    .select({
      slug: tenants.slug,
    })
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.isDeleted, false)))
    .limit(1)

  if (!tenant) {
    throw new AppError('Tenant no encontrado', 404)
  }

  const data = await mapEditorPayload(db, tenantId, tenant.slug, year, gradeId, branchId)

  return c.json(
    ok('Configuración del formulario cargada', {
      year,
      gradeId,
      branchId,
      tenantSlug: tenant.slug,
      templateId: data.template?.id ?? null,
      versionId: data.version?.id ?? null,
      versionNumber: data.version?.versionNumber ?? 0,
      versionStatus: data.version?.status ?? 'draft',
      formConfig: {
        name: data.template?.name ?? `Formulario de inscripción ${year}`,
        year: String(year),
        tenantSlug: tenant.slug,
        startsOn: data.template?.startsOn ?? '',
        endsOn: data.template?.endsOn ?? '',
        autosave: Boolean((data.template?.settings as Record<string, unknown> | undefined)?.autosave ?? true),
        progressBar: Boolean((data.template?.settings as Record<string, unknown> | undefined)?.progressBar ?? true),
      },
      sections: data.sections,
      documents: data.documents,
    }),
  )
})

enrollmentFormRoutes.put('/:year', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', enrollmentFormEditorSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const year = Number(c.req.param('year'))
  const payload = c.req.valid('json')

  if (!Number.isInteger(year) || year !== payload.year) {
    throw new AppError('El año lectivo del formulario no coincide con la ruta', 400)
  }

  const [tenant] = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.isDeleted, false)))
    .limit(1)

  if (!tenant) {
    throw new AppError('Tenant no encontrado', 404)
  }

  const saved = await saveVersionGraph({
    db,
    tenantId,
    year,
    gradeId: payload.gradeId,
    branchId: payload.branchId,
    payload,
  })

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'form_templates',
    entityId: saved.templateId,
    action: 'save_draft',
    changes: {
      year,
      gradeId: payload.gradeId,
      branchId: payload.branchId,
      versionId: saved.versionId,
      sections: payload.sections.length,
      documents: payload.documents.length,
    },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  const data = await mapEditorPayload(db, tenantId, tenant.slug, year, payload.gradeId, payload.branchId)

  return c.json(
    ok('Borrador guardado', {
      year,
      tenantSlug: tenant.slug,
      templateId: data.template?.id ?? null,
      versionId: data.version?.id ?? null,
      versionNumber: data.version?.versionNumber ?? 0,
      versionStatus: data.version?.status ?? 'draft',
      formConfig: {
        name: data.template?.name ?? payload.name,
        year: String(year),
        tenantSlug: tenant.slug,
        startsOn: data.template?.startsOn ?? payload.startsOn,
        endsOn: data.template?.endsOn ?? payload.endsOn,
        autosave: Boolean((data.template?.settings as Record<string, unknown> | undefined)?.autosave ?? payload.autosave),
        progressBar: Boolean((data.template?.settings as Record<string, unknown> | undefined)?.progressBar ?? payload.progressBar),
      },
      sections: data.sections,
      documents: data.documents,
    }),
  )
})

enrollmentFormRoutes.post('/:year/publish', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', enrollmentFormEditorSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const year = Number(c.req.param('year'))
  const payload = c.req.valid('json')

  if (!Number.isInteger(year) || year !== payload.year) {
    throw new AppError('El año lectivo del formulario no coincide con la ruta', 400)
  }

  const [tenant] = await db
    .select({ slug: tenants.slug })
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), eq(tenants.isDeleted, false)))
    .limit(1)

  if (!tenant) {
    throw new AppError('Tenant no encontrado', 404)
  }

  const requestedAcademicYear = await getAcademicYearByNumber(db, tenantId, year)
  const activeAcademicYear = await getActiveAcademicYear(db, tenantId)

  if (requestedAcademicYear.id !== activeAcademicYear.id) {
    throw new AppError(`Solo puedes publicar el formulario del año lectivo activo (${activeAcademicYear.name}).`, 409)
  }

  const saved = await saveVersionGraph({
    db,
    tenantId,
    year,
    gradeId: payload.gradeId,
    branchId: payload.branchId,
    payload,
  })

  await db
    .update(formTemplateVersions)
    .set({
      status: 'archived',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(formTemplateVersions.tenantId, tenantId),
        eq(formTemplateVersions.formTemplateId, saved.templateId),
        eq(formTemplateVersions.status, 'published'),
      ),
    )

  await db
    .update(formTemplateVersions)
    .set({
      status: 'published',
      publishedAt: new Date(),
      publishedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(formTemplateVersions.id, saved.versionId))

  await db
    .update(formTemplates)
    .set({
      status: 'inactive',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(formTemplates.tenantId, tenantId),
        eq(formTemplates.module, 'enrollment'),
        eq(formTemplates.isDeleted, false),
        ne(formTemplates.id, saved.templateId),
      ),
    )

  await db
    .update(formTemplates)
    .set({
      status: 'active',
      activeVersionId: saved.versionId,
      updatedAt: new Date(),
    })
    .where(eq(formTemplates.id, saved.templateId))

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'form_templates',
    entityId: saved.templateId,
    action: 'publish',
    changes: {
      year,
      gradeId: payload.gradeId,
      branchId: payload.branchId,
      versionId: saved.versionId,
      versionNumber: saved.versionNumber,
    },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  const data = await mapEditorPayload(db, tenantId, tenant.slug, year, payload.gradeId, payload.branchId)

  return c.json(
    ok('Formulario publicado', {
      year,
      gradeId: payload.gradeId,
      branchId: payload.branchId,
      tenantSlug: tenant.slug,
      templateId: data.template?.id ?? null,
      versionId: data.version?.id ?? null,
      versionNumber: data.version?.versionNumber ?? 0,
      versionStatus: data.version?.status ?? 'published',
      formConfig: {
        name: data.template?.name ?? payload.name,
        year: String(year),
        tenantSlug: tenant.slug,
        startsOn: data.template?.startsOn ?? payload.startsOn,
        endsOn: data.template?.endsOn ?? payload.endsOn,
        autosave: Boolean((data.template?.settings as Record<string, unknown> | undefined)?.autosave ?? payload.autosave),
        progressBar: Boolean((data.template?.settings as Record<string, unknown> | undefined)?.progressBar ?? payload.progressBar),
      },
      sections: data.sections,
      documents: data.documents,
    }),
  )
})
