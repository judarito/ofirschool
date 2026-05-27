import { and, count, eq, ne } from 'drizzle-orm'
import { academicYears, enrollments, grades, groups } from '@ofir/db'
import { AppError } from './errors'
import type { AppContextVariables } from '../types'

type PlacementValidationInput = {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  gradeId: string
  groupId?: string | null
}

export const validateEnrollmentPlacement = async ({
  db,
  tenantId,
  academicYearId,
  gradeId,
  groupId,
}: PlacementValidationInput) => {
  const [academicYear] = await db
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

  if (!academicYear) throw new AppError('El año lectivo seleccionado no existe', 404)

  const [grade] = await db
    .select({ id: grades.id })
    .from(grades)
    .where(and(eq(grades.id, gradeId), eq(grades.tenantId, tenantId), eq(grades.isDeleted, false)))
    .limit(1)

  if (!grade) throw new AppError('El grado seleccionado no existe', 404)

  if (!groupId) return

  const [group] = await db
    .select({
      id: groups.id,
      capacity: groups.capacity,
    })
    .from(groups)
    .where(
      and(
        eq(groups.id, groupId),
        eq(groups.tenantId, tenantId),
        eq(groups.academicYearId, academicYearId),
        eq(groups.gradeId, gradeId),
        eq(groups.isDeleted, false),
      ),
    )
    .limit(1)

  if (!group) {
    throw new AppError('El grupo seleccionado no pertenece al grado o al año lectivo indicado', 409)
  }

  const [occupancy] = await db
    .select({ total: count() })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.academicYearId, academicYearId),
        eq(enrollments.groupId, groupId),
        eq(enrollments.isDeleted, false),
        ne(enrollments.enrollmentStatus, 'cancelled'),
      ),
    )

  if ((occupancy?.total ?? 0) >= group.capacity) {
    throw new AppError('El grupo seleccionado ya no tiene cupos disponibles', 409)
  }
}
