import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { academicPeriods, academicYears, enrollments, grades, groups, schoolBranches } from '@ofir/db'
import { AppError } from '../lib/errors'
import { ok } from '../lib/http'
import type { AppContextVariables, Bindings } from '../types'

export const portalRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

portalRoutes.get('/student/:studentId', async (c) => {
  const db = c.get('db')
  const studentId = c.req.param('studentId')

  const enrollment = await db.select({
    id: enrollments.id,
    academicYearId: enrollments.academicYearId,
    academicYearName: academicYears.name,
    gradeId: enrollments.gradeId,
    gradeName: grades.name,
    groupId: enrollments.groupId,
    groupName: groups.name,
    branchId: enrollments.branchId,
    branchName: schoolBranches.name,
    status: enrollments.status,
  }).from(enrollments)
    .leftJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .leftJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .leftJoin(schoolBranches, eq(schoolBranches.id, enrollments.branchId))
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.isDeleted, false), eq(enrollments.enrollmentStatus, 'active')))
    .limit(1)

  if (!enrollment) throw new AppError('No se encontró matrícula activa', 404)

  return c.json(ok('Portal estudiante', {
    enrollment: {
      id: enrollment.id,
      academicYearName: enrollment.academicYearName,
      gradeName: enrollment.gradeName,
      groupName: enrollment.groupName,
      branchName: enrollment.branchName,
      status: enrollment.status,
    },
    reportCardUrl: `/api/academic/report-cards/${studentId}/pdf?academicYearId=${enrollment.academicYearId}&academicPeriodId=latest`,
  }))
})
