import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { coexistenceCases, coexistenceInterventions, coexistenceInvolvedPersons, grades, groups, students } from '@ofir/db'
import { PERMISSIONS, coexistenceCaseCreateSchema, coexistenceCaseUpdateSchema, coexistenceInterventionCreateSchema, paginationSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const coexistenceRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

coexistenceRoutes.use('*', authMiddleware, tenantMiddleware)

coexistenceRoutes.get('/', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')
  const offset = (filters.page - 1) * filters.pageSize

  const searchFilter = filters.query
    ? or(
        ilike(students.firstName, `%${filters.query}%`),
        ilike(students.lastName, `%${filters.query}%`),
        ilike(coexistenceCases.category, `%${filters.query}%`),
        ilike(coexistenceCases.description, `%${filters.query}%`),
      )
    : undefined
  const whereClause = and(eq(coexistenceCases.tenantId, tenantId), eq(coexistenceCases.isDeleted, false), searchFilter)

  const items = await db
    .select({
      id: coexistenceCases.id,
      incidentDate: coexistenceCases.incidentDate,
      classification: coexistenceCases.classification,
      category: coexistenceCases.category,
      description: sql<string>`LEFT(${coexistenceCases.description}, 200)`,
      status: coexistenceCases.status,
      priority: coexistenceCases.priority,
      isConfidential: coexistenceCases.isConfidential,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      gradeName: grades.name,
      groupName: groups.name,
      createdAt: coexistenceCases.createdAt,
    })
    .from(coexistenceCases)
    .leftJoin(students, eq(students.id, coexistenceCases.studentId))
    .leftJoin(grades, eq(grades.id, students.branchId))
    .leftJoin(groups, eq(groups.id, students.branchId))
    .where(whereClause)
    .orderBy(desc(coexistenceCases.incidentDate), desc(coexistenceCases.createdAt))
    .limit(filters.pageSize)
    .offset(offset)

  const [totalRow] = await db.select({ total: count() }).from(coexistenceCases).where(whereClause)

  return c.json(ok('Casos de convivencia cargados', {
    items: items.map((item) => ({
      id: item.id,
      incidentDate: item.incidentDate,
      classification: item.classification,
      category: item.category,
      description: item.description,
      status: item.status,
      priority: item.priority,
      isConfidential: item.isConfidential,
      studentName: [item.studentFirstName, item.studentLastName].filter(Boolean).join(' '),
      createdAt: item.createdAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }))
})

coexistenceRoutes.get('/:id', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [kase] = await db
    .select()
    .from(coexistenceCases)
    .where(and(eq(coexistenceCases.id, id), eq(coexistenceCases.tenantId, tenantId), eq(coexistenceCases.isDeleted, false)))
    .limit(1)

  if (!kase) throw new AppError('Caso no encontrado', 404)

  const involved = await db
    .select()
    .from(coexistenceInvolvedPersons)
    .where(and(eq(coexistenceInvolvedPersons.coexistenceCaseId, id), eq(coexistenceInvolvedPersons.isDeleted, false)))

  const interventions = await db
    .select()
    .from(coexistenceInterventions)
    .where(and(eq(coexistenceInterventions.coexistenceCaseId, id), eq(coexistenceInterventions.isDeleted, false)))
    .orderBy(asc(coexistenceInterventions.interventionDate))

  return c.json(ok('Caso cargado', {
    id: kase.id,
    academicYearId: kase.academicYearId,
    studentId: kase.studentId,
    reporterName: kase.reporterName,
    incidentDate: kase.incidentDate,
    reportedAt: kase.reportedAt.toISOString(),
    classification: kase.classification,
    category: kase.category,
    description: kase.description,
    evidence: kase.evidence,
    immediateActions: kase.immediateActions,
    status: kase.status,
    priority: kase.priority,
    assignedTo: kase.assignedTo,
    resolvedAt: kase.resolvedAt?.toISOString() ?? null,
    resolutionNotes: kase.resolutionNotes,
    isConfidential: kase.isConfidential,
    involvedPersons: involved.map((p) => ({
      id: p.id,
      studentId: p.studentId,
      personName: p.personName,
      role: p.role,
      notes: p.notes,
    })),
    interventions: interventions.map((i) => ({
      id: i.id,
      interventionType: i.interventionType,
      description: i.description,
      performedByName: i.performedByName,
      interventionDate: i.interventionDate,
      followUpDate: i.followUpDate,
      outcome: i.outcome,
      status: i.status,
    })),
    createdAt: kase.createdAt.toISOString(),
    updatedAt: kase.updatedAt.toISOString(),
  }))
})

coexistenceRoutes.post('/', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', coexistenceCaseCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [kase] = await db
    .insert(coexistenceCases)
    .values({
      tenantId,
      academicYearId: payload.academicYearId,
      studentId: payload.studentId,
      reporterUserId: user.id,
      reporterName: payload.reporterName || null,
      incidentDate: payload.incidentDate,
      classification: payload.classification,
      category: payload.category,
      description: payload.description,
      evidence: payload.evidence || null,
      immediateActions: payload.immediateActions || null,
      status: 'open',
      priority: payload.priority,
      assignedTo: payload.assignedTo || null,
      isConfidential: payload.isConfidential,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning()

  if (!kase) throw new AppError('No fue posible crear el caso', 500)

  if (payload.involvedPersons.length) {
    await db.insert(coexistenceInvolvedPersons).values(
      payload.involvedPersons.map((person) => ({
        tenantId,
        coexistenceCaseId: kase.id,
        studentId: person.studentId || null,
        personName: person.personName,
        role: person.role,
        notes: person.notes || null,
        createdBy: user.id,
        updatedBy: user.id,
      })),
    )
  }

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'coexistence_cases',
    entityId: kase.id,
    action: 'create',
    changes: { classification: payload.classification, category: payload.category, studentId: payload.studentId },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(created('Caso de convivencia creado', { id: kase.id }), 201)
})

coexistenceRoutes.put('/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', coexistenceCaseUpdateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [existing] = await db
    .select()
    .from(coexistenceCases)
    .where(and(eq(coexistenceCases.id, id), eq(coexistenceCases.tenantId, tenantId), eq(coexistenceCases.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Caso no encontrado', 404)

  const now = new Date()
  const updateData: Record<string, unknown> = {
    updatedAt: now,
    updatedBy: user.id,
  }

  if (payload.status !== undefined) {
    updateData.status = payload.status
    if (payload.status === 'resolved' || payload.status === 'closed') {
      updateData.resolvedAt = now
      updateData.resolutionNotes = payload.resolutionNotes ?? existing.resolutionNotes
    }
  }
  if (payload.priority !== undefined) updateData.priority = payload.priority
  if (payload.assignedTo !== undefined) updateData.assignedTo = payload.assignedTo
  if (payload.evidence !== undefined) updateData.evidence = payload.evidence
  if (payload.immediateActions !== undefined) updateData.immediateActions = payload.immediateActions
  if (payload.resolutionNotes !== undefined) updateData.resolutionNotes = payload.resolutionNotes

  const [updated] = await db
    .update(coexistenceCases)
    .set(updateData)
    .where(eq(coexistenceCases.id, id))
    .returning()

  if (!updated) throw new AppError('No fue posible actualizar el caso', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'coexistence_cases',
    entityId: id,
    action: 'update',
    changes: payload as Record<string, unknown>,
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(ok('Caso actualizado', { id: updated.id, status: updated.status }))
})

coexistenceRoutes.post('/:id/interventions', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', coexistenceInterventionCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [kase] = await db
    .select({ id: coexistenceCases.id })
    .from(coexistenceCases)
    .where(and(eq(coexistenceCases.id, id), eq(coexistenceCases.tenantId, tenantId), eq(coexistenceCases.isDeleted, false)))
    .limit(1)

  if (!kase) throw new AppError('Caso no encontrado', 404)

  const [intervention] = await db
    .insert(coexistenceInterventions)
    .values({
      tenantId,
      coexistenceCaseId: id,
      interventionType: payload.interventionType,
      description: payload.description,
      performedBy: user.id,
      performedByName: payload.performedByName || null,
      interventionDate: payload.interventionDate,
      followUpDate: payload.followUpDate || null,
      outcome: payload.outcome || null,
      status: payload.status,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning()

  if (!intervention) throw new AppError('No fue posible registrar la intervención', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'coexistence_interventions',
    entityId: intervention.id,
    action: 'create',
    changes: { coexistenceCaseId: id, interventionType: payload.interventionType },
  })

  return c.json(created('Intervención registrada', { id: intervention.id }), 201)
})
