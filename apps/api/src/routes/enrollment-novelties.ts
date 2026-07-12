import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  academicYears,
  enrollments,
  enrollmentNovelties,
  grades,
  groups,
  schoolBranches,
  students,
} from '@ofir/db'
import {
  PERMISSIONS,
  enrollmentNoveltyCreateSchema,
  enrollmentUpdateSchema,
} from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { validateEnrollmentPlacement } from '../lib/enrollment-placement'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const enrollmentNoveltyRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

enrollmentNoveltyRoutes.use('*', authMiddleware, tenantMiddleware)

const NOVELTY_ALLOWED_STATUS: Record<string, string[]> = {
  withdrawal: ['withdrawn', 'cancelled'],
  transfer: ['withdrawn', 'cancelled'],
  group_change: ['active', 'pending'],
  branch_change: ['active', 'pending'],
  reentry: ['active', 'pending'],
  graduation: ['graduated'],
  cancellation: ['cancelled'],
}

const serializeNovelty = (novelty: typeof enrollmentNovelties.$inferSelect) => ({
  id: novelty.id,
  enrollmentId: novelty.enrollmentId,
  studentId: novelty.studentId,
  academicYearId: novelty.academicYearId,
  noveltyType: novelty.noveltyType,
  effectiveDate: novelty.effectiveDate,
  reasonCode: novelty.reasonCode,
  reasonLabel: novelty.reasonLabel,
  notes: novelty.notes,
  fromGradeId: novelty.fromGradeId,
  fromGroupId: novelty.fromGroupId,
  toGradeId: novelty.toGradeId,
  toGroupId: novelty.toGroupId,
  destinationInstitution: novelty.destinationInstitution,
  documentReference: novelty.documentReference,
  metadata: novelty.metadata,
  createdAt: novelty.createdAt.toISOString(),
  updatedAt: novelty.updatedAt.toISOString(),
})

enrollmentNoveltyRoutes.get(
  '/enrollments/:enrollmentId/novelties',
  requirePermission(PERMISSIONS.ACADEMIC_READ),
  async (c) => {
    const db = c.get('db')
    const tenantId = c.get('tenantId')
    const enrollmentId = c.req.param('enrollmentId')

    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.id, enrollmentId),
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.isDeleted, false),
        ),
      )
      .limit(1)
    if (!enrollment) throw new AppError('Matrícula no encontrada', 404)

    const items = await db
      .select()
      .from(enrollmentNovelties)
      .where(
        and(
          eq(enrollmentNovelties.tenantId, tenantId),
          eq(enrollmentNovelties.enrollmentId, enrollmentId),
          eq(enrollmentNovelties.isDeleted, false),
        ),
      )
      .orderBy(desc(enrollmentNovelties.effectiveDate), desc(enrollmentNovelties.createdAt))

    return c.json(ok('Novedades de la matrícula cargadas', { items: items.map(serializeNovelty) }))
  },
)

enrollmentNoveltyRoutes.get(
  '/students/:studentId/novelties',
  requirePermission(PERMISSIONS.ACADEMIC_READ),
  async (c) => {
    const db = c.get('db')
    const tenantId = c.get('tenantId')
    const studentId = c.req.param('studentId')

    const [student] = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.id, studentId), eq(students.tenantId, tenantId), eq(students.isDeleted, false)))
      .limit(1)
    if (!student) throw new AppError('Estudiante no encontrado', 404)

    const items = await db
      .select()
      .from(enrollmentNovelties)
      .where(
        and(
          eq(enrollmentNovelties.tenantId, tenantId),
          eq(enrollmentNovelties.studentId, studentId),
          eq(enrollmentNovelties.isDeleted, false),
        ),
      )
      .orderBy(desc(enrollmentNovelties.effectiveDate), desc(enrollmentNovelties.createdAt))

    return c.json(ok('Historial de novedades del estudiante cargado', { items: items.map(serializeNovelty) }))
  },
)

enrollmentNoveltyRoutes.post(
  '/novelties',
  requirePermission(PERMISSIONS.ACADEMIC_WRITE),
  zValidator('json', enrollmentNoveltyCreateSchema),
  async (c) => {
    const db = c.get('db')
    const tenantId = c.get('tenantId')
    const user = c.get('user')
    const payload = c.req.valid('json')

    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.id, payload.enrollmentId),
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.isDeleted, false),
        ),
      )
      .limit(1)
    if (!enrollment) throw new AppError('Matrícula no encontrada', 404)

    if ((payload.toGradeId || payload.toGroupId) && (payload.noveltyType === 'group_change' || payload.noveltyType === 'branch_change')) {
      await validateEnrollmentPlacement({
        db,
        tenantId,
        academicYearId: enrollment.academicYearId,
        gradeId: payload.toGradeId || enrollment.gradeId,
        groupId: payload.toGroupId || null,
      })
    }

    if (payload.toGradeId) {
      const [grade] = await db
        .select({ id: grades.id })
        .from(grades)
        .where(and(eq(grades.id, payload.toGradeId), eq(grades.tenantId, tenantId), eq(grades.isDeleted, false)))
        .limit(1)
      if (!grade) throw new AppError('El grado destino no existe', 400)
    }
    if (payload.toGroupId) {
      const [group] = await db
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.id, payload.toGroupId), eq(groups.tenantId, tenantId), eq(groups.isDeleted, false)))
        .limit(1)
      if (!group) throw new AppError('El grupo destino no existe', 400)
    }

    const now = new Date()
    const effectiveDate = payload.effectiveDate

    const [novelty] = await db
      .insert(enrollmentNovelties)
      .values({
        tenantId,
        enrollmentId: enrollment.id,
        studentId: enrollment.studentId,
        academicYearId: enrollment.academicYearId,
        noveltyType: payload.noveltyType,
        effectiveDate,
        reasonCode: payload.reasonCode || null,
        reasonLabel: payload.reasonLabel || null,
        notes: payload.notes || null,
        fromGradeId: enrollment.gradeId,
        fromGroupId: enrollment.groupId,
        toGradeId: payload.toGradeId || null,
        toGroupId: payload.toGroupId || null,
        destinationInstitution: payload.destinationInstitution || null,
        documentReference: payload.documentReference || null,
        metadata: { source: 'admin' },
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    if (!novelty) throw new AppError('No fue posible registrar la novedad', 500)

    const allowedStatuses = NOVELTY_ALLOWED_STATUS[payload.noveltyType] ?? []
    const nextEnrollmentStatus = allowedStatuses[0] ?? enrollment.enrollmentStatus
    const nextEnrollmentUpdate: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: user.id,
    }
    if (nextEnrollmentStatus !== enrollment.enrollmentStatus) {
      nextEnrollmentUpdate.enrollmentStatus = nextEnrollmentStatus
      nextEnrollmentUpdate.status = nextEnrollmentStatus === 'cancelled' || nextEnrollmentStatus === 'withdrawn' ? 'inactive' : enrollment.status
    }
    if (payload.toGradeId) {
      nextEnrollmentUpdate.gradeId = payload.toGradeId
    }
    if (payload.toGroupId) {
      nextEnrollmentUpdate.groupId = payload.toGroupId
    }

    await db
      .update(enrollments)
      .set(nextEnrollmentUpdate)
      .where(eq(enrollments.id, enrollment.id))

    await writeAuditLog(db, {
      tenantId,
      actorUserId: user.id,
      entity: 'enrollment_novelties',
      entityId: novelty.id,
      action: 'create',
      changes: {
        noveltyType: payload.noveltyType,
        effectiveDate,
        fromGradeId: enrollment.gradeId,
        toGradeId: payload.toGradeId || null,
        fromGroupId: enrollment.groupId,
        toGroupId: payload.toGroupId || null,
        enrollmentStatus: nextEnrollmentStatus,
      },
      ipAddress: c.req.header('cf-connecting-ip'),
    })

    return c.json(created('Novedad registrada', { id: novelty.id }), 201)
  },
)

enrollmentNoveltyRoutes.patch(
  '/enrollments/:id',
  requirePermission(PERMISSIONS.ACADEMIC_WRITE),
  zValidator('json', enrollmentUpdateSchema),
  async (c) => {
    const db = c.get('db')
    const tenantId = c.get('tenantId')
    const user = c.get('user')
    const id = c.req.param('id')
    const payload = c.req.valid('json')

    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.id, id),
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.isDeleted, false),
        ),
      )
      .limit(1)
    if (!enrollment) throw new AppError('Matrícula no encontrada', 404)

    if (payload.branchId) {
      const [branch] = await db
        .select({ id: schoolBranches.id })
        .from(schoolBranches)
        .where(
          and(
            eq(schoolBranches.id, payload.branchId),
            eq(schoolBranches.tenantId, tenantId),
            eq(schoolBranches.isDeleted, false),
          ),
        )
        .limit(1)
      if (!branch) throw new AppError('La sede indicada no existe', 400)
    }

    const update: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: user.id,
    }
    if (payload.journey !== undefined) update.journey = payload.journey || null
    if (payload.branchId !== undefined) update.branchId = payload.branchId || null
    if (payload.signedAt) update.signedAt = new Date(payload.signedAt)
    if (payload.documentStatus) update.documentStatus = payload.documentStatus
    if (payload.financialStatus) update.financialStatus = payload.financialStatus
    if (payload.academicStatus) update.academicStatus = payload.academicStatus
    if (payload.enrollmentStatus) {
      update.enrollmentStatus = payload.enrollmentStatus
      if (payload.enrollmentStatus === 'cancelled' || payload.enrollmentStatus === 'withdrawn') {
        update.status = 'inactive'
      } else if (payload.enrollmentStatus === 'active') {
        update.status = 'active'
      }
    }

    if (payload.enrollmentStatus === 'active' && !enrollment.sequenceNumber) {
      const [lastSequenceRow] = await db
        .select({ value: count() })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.tenantId, tenantId),
            eq(enrollments.academicYearId, enrollment.academicYearId),
            eq(enrollments.isDeleted, false),
          ),
        )
      const lastSequence = lastSequenceRow?.value ?? 0
      update.sequenceNumber = Number(lastSequence) + 1
    }

    const [updated] = await db
      .update(enrollments)
      .set(update)
      .where(eq(enrollments.id, id))
      .returning()

    if (!updated) throw new AppError('No fue posible actualizar la matrícula', 500)

    await writeAuditLog(db, {
      tenantId,
      actorUserId: user.id,
      entity: 'enrollments',
      entityId: id,
      action: 'update',
      changes: { from: enrollment, to: updated, payload },
      ipAddress: c.req.header('cf-connecting-ip'),
    })

    return c.json(ok('Matrícula actualizada', {
      id: updated.id,
      enrollmentStatus: updated.enrollmentStatus,
      enrollmentDate: updated.enrollmentDate.toISOString(),
      journey: updated.journey ?? null,
      branchId: updated.branchId ?? null,
      signedAt: updated.signedAt?.toISOString() ?? null,
      documentStatus: updated.documentStatus,
      financialStatus: updated.financialStatus,
      academicStatus: updated.academicStatus,
      sequenceNumber: updated.sequenceNumber ?? null,
    }))
  },
)

enrollmentNoveltyRoutes.get(
  '/academic-years/:academicYearId/sequence-stats',
  requirePermission(PERMISSIONS.ACADEMIC_READ),
  async (c) => {
    const db = c.get('db')
    const tenantId = c.get('tenantId')
    const academicYearId = c.req.param('academicYearId')

    const [year] = await db
      .select({ id: academicYears.id })
      .from(academicYears)
      .where(
        and(
          eq(academicYears.id, academicYearId),
          eq(academicYears.tenantId, tenantId),
          eq(academicYears.isDeleted, false),
        ),
      )
      .limit(1)
    if (!year) throw new AppError('Año lectivo no encontrado', 404)

    const items = await db
      .select({ noveltyType: enrollmentNovelties.noveltyType, total: count() })
      .from(enrollmentNovelties)
      .where(
        and(
          eq(enrollmentNovelties.tenantId, tenantId),
          eq(enrollmentNovelties.academicYearId, academicYearId),
          eq(enrollmentNovelties.isDeleted, false),
        ),
      )
      .groupBy(enrollmentNovelties.noveltyType)

    const stats: Record<string, number> = {}
    for (const row of items) {
      stats[row.noveltyType] = Number(row.total)
    }

    return c.json(ok('Resumen de novedades del año lectivo cargado', { academicYearId, stats }))
  },
)

export const getEnrollmentWithNovelties = async ({
  db,
  tenantId,
  enrollmentId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  enrollmentId: string
}) => {
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.id, enrollmentId),
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.isDeleted, false),
      ),
    )
    .limit(1)
  if (!enrollment) return null

  const novelties = await db
    .select()
    .from(enrollmentNovelties)
    .where(
      and(
        eq(enrollmentNovelties.tenantId, tenantId),
        eq(enrollmentNovelties.enrollmentId, enrollmentId),
        eq(enrollmentNovelties.isDeleted, false),
      ),
    )
    .orderBy(desc(enrollmentNovelties.effectiveDate))

  return { enrollment, novelties }
}

export const listStudentEnrollments = async ({
  db,
  tenantId,
  studentId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  studentId: string
}) => {
  return db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.isDeleted, false),
      ),
    )
    .orderBy(desc(enrollments.enrollmentDate))
}
