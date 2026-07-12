import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { academicYears, committeeAttendees, committeeDecisions, committeeMeetings, enrollments, grades, groups, students } from '@ofir/db'
import { PERMISSIONS, committeeDecisionCreateSchema, committeeMeetingCreateSchema, committeeMeetingUpdateSchema, paginationSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const committeeRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

committeeRoutes.use('*', authMiddleware, tenantMiddleware)

committeeRoutes.get('/', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')
  const offset = (filters.page - 1) * filters.pageSize

  const searchFilter = filters.query ? or(ilike(committeeMeetings.title, `%${filters.query}%`), ilike(committeeMeetings.committeeType, `%${filters.query}%`)) : undefined
  const whereClause = and(eq(committeeMeetings.tenantId, tenantId), eq(committeeMeetings.isDeleted, false), searchFilter)

  const items = await db
    .select({
      id: committeeMeetings.id,
      committeeType: committeeMeetings.committeeType,
      meetingDate: committeeMeetings.meetingDate,
      title: committeeMeetings.title,
      meetingNumber: committeeMeetings.meetingNumber,
      status: committeeMeetings.status,
      academicYearName: academicYears.name,
      createdAt: committeeMeetings.createdAt,
    })
    .from(committeeMeetings)
    .leftJoin(academicYears, eq(academicYears.id, committeeMeetings.academicYearId))
    .where(whereClause)
    .orderBy(desc(committeeMeetings.meetingDate), desc(committeeMeetings.createdAt))
    .limit(filters.pageSize)
    .offset(offset)

  const [totalRow] = await db.select({ total: count() }).from(committeeMeetings).where(whereClause)

  return c.json(ok('Comités cargados', {
    items: items.map((item) => ({
      id: item.id,
      committeeType: item.committeeType,
      meetingDate: item.meetingDate,
      title: item.title,
      meetingNumber: item.meetingNumber,
      status: item.status,
      academicYearName: item.academicYearName ?? '',
      createdAt: item.createdAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }))
})

committeeRoutes.get('/:id', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [meeting] = await db
    .select()
    .from(committeeMeetings)
    .where(and(eq(committeeMeetings.id, id), eq(committeeMeetings.tenantId, tenantId), eq(committeeMeetings.isDeleted, false)))
    .limit(1)

  if (!meeting) throw new AppError('Comité no encontrado', 404)

  const attendees = await db
    .select({ id: committeeAttendees.id, fullName: committeeAttendees.fullName, role: committeeAttendees.role, attended: committeeAttendees.attended })
    .from(committeeAttendees)
    .where(and(eq(committeeAttendees.committeeMeetingId, id), eq(committeeAttendees.isDeleted, false)))
    .orderBy(asc(committeeAttendees.fullName))

  const decisions = await db
    .select({
      id: committeeDecisions.id,
      decisionType: committeeDecisions.decisionType,
      description: committeeDecisions.description,
      decision: committeeDecisions.decision,
      justification: committeeDecisions.justification,
      resultScore: committeeDecisions.resultScore,
      studentId: committeeDecisions.studentId,
      studentName: students.firstName,
      enrollmentGrade: grades.name,
      enrollmentGroup: groups.name,
    })
    .from(committeeDecisions)
    .leftJoin(students, eq(students.id, committeeDecisions.studentId))
    .leftJoin(enrollments, eq(enrollments.id, committeeDecisions.enrollmentId))
    .leftJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .where(and(eq(committeeDecisions.committeeMeetingId, id), eq(committeeDecisions.isDeleted, false)))

  return c.json(ok('Comité cargado', {
    id: meeting.id,
    academicYearId: meeting.academicYearId,
    committeeType: meeting.committeeType,
    meetingDate: meeting.meetingDate,
    title: meeting.title,
    objective: meeting.objective,
    callTo: meeting.callTo,
    development: meeting.development,
    conclusions: meeting.conclusions,
    meetingNumber: meeting.meetingNumber,
    status: meeting.status,
    approvedAt: meeting.approvedAt?.toISOString() ?? null,
    attendees: attendees.map((a) => ({ id: a.id, fullName: a.fullName, role: a.role, attended: a.attended })),
    decisions: decisions.map((d) => ({
      id: d.id,
      decisionType: d.decisionType,
      description: d.description,
      decision: d.decision,
      justification: d.justification,
      resultScore: d.resultScore ? Number(d.resultScore) : null,
      studentId: d.studentId,
      studentName: d.studentName ?? null,
      enrollmentGrade: d.enrollmentGrade ?? null,
      enrollmentGroup: d.enrollmentGroup ?? null,
    })),
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
  }))
})

committeeRoutes.post('/', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', committeeMeetingCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [existing] = await db
    .select({ meetingNumber: committeeMeetings.meetingNumber })
    .from(committeeMeetings)
    .where(and(eq(committeeMeetings.tenantId, tenantId), eq(committeeMeetings.academicYearId, payload.academicYearId), eq(committeeMeetings.isDeleted, false)))
    .orderBy(desc(committeeMeetings.meetingNumber))
    .limit(1)

  const meetingNumber = (existing?.meetingNumber ?? 0) + 1

  const [meeting] = await db
    .insert(committeeMeetings)
    .values({
      tenantId,
      academicYearId: payload.academicYearId,
      committeeType: payload.committeeType,
      meetingDate: payload.meetingDate,
      title: payload.title,
      objective: payload.objective || null,
      callTo: payload.callTo || null,
      meetingNumber,
      status: 'draft',
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning()

  if (!meeting) throw new AppError('No fue posible crear el comité', 500)

  if (payload.attendees.length) {
    await db.insert(committeeAttendees).values(
      payload.attendees.map((attendee) => ({
        tenantId,
        committeeMeetingId: meeting.id,
        userId: attendee.userId || null,
        fullName: attendee.fullName,
        role: attendee.role,
        attended: true,
        createdBy: user.id,
        updatedBy: user.id,
      })),
    )
  }

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'committee_meetings',
    entityId: meeting.id,
    action: 'create',
    changes: { committeeType: payload.committeeType, meetingDate: payload.meetingDate, title: payload.title },
  })

  return c.json(created('Comité creado', { id: meeting.id, meetingNumber: meeting.meetingNumber }), 201)
})

committeeRoutes.put('/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', committeeMeetingUpdateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [existing] = await db
    .select()
    .from(committeeMeetings)
    .where(and(eq(committeeMeetings.id, id), eq(committeeMeetings.tenantId, tenantId), eq(committeeMeetings.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Comité no encontrado', 404)
  if (existing.status === 'approved') throw new AppError('No puedes modificar un comité aprobado', 409)

  const now = new Date()
  const updateData: Record<string, unknown> = {
    development: payload.development ?? existing.development,
    conclusions: payload.conclusions ?? existing.conclusions,
    status: payload.status ?? existing.status,
    updatedAt: now,
    updatedBy: user.id,
  }

  if (payload.status === 'approved') {
    updateData.approvedAt = now
    updateData.approvedBy = user.id
  }

  const [updated] = await db
    .update(committeeMeetings)
    .set(updateData)
    .where(eq(committeeMeetings.id, id))
    .returning()

  if (!updated) throw new AppError('No fue posible actualizar el comité', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'committee_meetings',
    entityId: id,
    action: payload.status === 'approved' ? 'approve' : 'update',
    changes: { status: updated.status, development: payload.development ? true : false },
  })

  return c.json(ok('Comité actualizado', { id: updated.id, status: updated.status }))
})

committeeRoutes.delete('/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  const [existing] = await db
    .select()
    .from(committeeMeetings)
    .where(and(eq(committeeMeetings.id, id), eq(committeeMeetings.tenantId, tenantId), eq(committeeMeetings.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Comité no encontrado', 404)
  if (existing.status === 'approved') throw new AppError('No puedes eliminar un comité aprobado', 409)

  await db.update(committeeMeetings).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(eq(committeeMeetings.id, id))
  await db.update(committeeAttendees).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(eq(committeeAttendees.committeeMeetingId, id))
  await db.update(committeeDecisions).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(eq(committeeDecisions.committeeMeetingId, id))

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'committee_meetings', entityId: id, action: 'delete' })
  return c.json(ok('Comité eliminado', { id }))
})

committeeRoutes.post('/:id/decisions', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', committeeDecisionCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [meeting] = await db
    .select({ status: committeeMeetings.status })
    .from(committeeMeetings)
    .where(and(eq(committeeMeetings.id, id), eq(committeeMeetings.tenantId, tenantId), eq(committeeMeetings.isDeleted, false)))
    .limit(1)

  if (!meeting) throw new AppError('Comité no encontrado', 404)
  if (meeting.status === 'approved') throw new AppError('No puedes agregar decisiones a un comité aprobado', 409)

  const [decision] = await db
    .insert(committeeDecisions)
    .values({
      tenantId,
      committeeMeetingId: id,
      studentId: payload.studentId || null,
      enrollmentId: payload.enrollmentId || null,
      decisionType: payload.decisionType,
      description: payload.description,
      decision: payload.decision,
      justification: payload.justification || null,
      resultScore: payload.resultScore ? String(payload.resultScore) : null,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning()

  if (!decision) throw new AppError('No fue posible crear la decisión', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'committee_decisions',
    entityId: decision.id,
    action: 'create',
    changes: { committeeMeetingId: id, decisionType: payload.decisionType, decision: payload.decision },
  })

  return c.json(created('Decisión registrada', { id: decision.id }), 201)
})
