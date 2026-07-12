import { and, eq } from 'drizzle-orm'
import { enrollments, groups, schoolBranches, students } from '@ofir/db'
import { AppError } from './errors'
import type { AppContextVariables } from '../types'
import type { SessionUser } from '@ofir/shared'

type BranchAccessInput = {
  db: AppContextVariables['db']
  tenantId: string
  user: SessionUser
}

export const assertUserCanAccessBranch = (user: SessionUser, branchId: string | null | undefined) => {
  if (user.branchId && branchId !== user.branchId) {
    throw new AppError('No tiene permisos para acceder a registros de otra sede', 403)
  }
}

const ensureBranchExists = async ({
  db,
  tenantId,
  branchId,
}: BranchAccessInput & {
  branchId: string
}) => {
  const [branch] = await db
    .select({ id: schoolBranches.id })
    .from(schoolBranches)
    .where(and(eq(schoolBranches.id, branchId), eq(schoolBranches.tenantId, tenantId), eq(schoolBranches.isDeleted, false)))
    .limit(1)

  if (!branch) throw new AppError('La sede seleccionada no existe', 404)
}

export const resolveBranchFilter = async ({
  db,
  tenantId,
  user,
  requestedBranchId,
}: BranchAccessInput & {
  requestedBranchId?: string | null
}) => {
  if (user.branchId) {
    if (requestedBranchId && requestedBranchId !== user.branchId) {
      throw new AppError('No tiene permisos para consultar otra sede', 403)
    }

    return user.branchId
  }

  if (!requestedBranchId) return undefined

  await ensureBranchExists({ db, tenantId, user, branchId: requestedBranchId })
  return requestedBranchId
}

export const getGroupBranchId = async ({
  db,
  tenantId,
  groupId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  groupId: string
}) => {
  const [group] = await db
    .select({ branchId: groups.branchId })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.tenantId, tenantId), eq(groups.isDeleted, false)))
    .limit(1)

  if (!group) throw new AppError('El grupo seleccionado no existe', 404)
  return group.branchId
}

export const assertGroupWithinUserBranch = async ({
  db,
  tenantId,
  user,
  groupId,
}: BranchAccessInput & {
  groupId?: string | null
}) => {
  if (!user.branchId) return

  if (!groupId) {
    throw new AppError('Selecciona un grupo para crear matrículas desde una sesión restringida a sede', 400)
  }

  const groupBranchId = await getGroupBranchId({ db, tenantId, groupId })
  assertUserCanAccessBranch(user, groupBranchId)
}

export const assertStudentWithinUserBranch = async ({
  db,
  tenantId,
  user,
  studentId,
}: BranchAccessInput & {
  studentId: string
}) => {
  if (!user.branchId) return

  const [student] = await db
    .select({ branchId: students.branchId })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.tenantId, tenantId), eq(students.isDeleted, false)))
    .limit(1)

  if (!student) throw new AppError('Estudiante no encontrado', 404)

  if (student.branchId === user.branchId) return

  const enrollmentBranches = await db
    .select({ branchId: groups.branchId })
    .from(enrollments)
    .leftJoin(groups, and(eq(groups.id, enrollments.groupId), eq(groups.tenantId, tenantId), eq(groups.isDeleted, false)))
    .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.studentId, studentId), eq(enrollments.isDeleted, false)))

  if (enrollmentBranches.some((row) => row.branchId === user.branchId)) return

  throw new AppError('No tiene permisos para acceder a estudiantes de otra sede', 403)
}
