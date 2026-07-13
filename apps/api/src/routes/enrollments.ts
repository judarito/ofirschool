import { and, asc, count, desc, eq, ilike, inArray, ne, notExists, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { academicPeriods, academicYears, admissionApplications, enrollments, gradeRecords, grades, groups, students, subjects, supportStrategies } from '@ofir/db'
import {
  annualPromotionDecisionSchema,
  annualPromotionPreviewSchema,
  PERMISSIONS,
  enrollmentBatchCreateSchema,
  enrollmentCandidateFiltersSchema,
  enrollmentContinuityPreviewSchema,
  enrollmentCreateSchema,
  enrollmentFiltersSchema,
} from '@ofir/shared'
import { AppError } from '../lib/errors'
import { resolveGradingScaleForGrade } from '../lib/grading-scale-resolution'
import { created, ok } from '../lib/http'
import { validateEnrollmentPlacement } from '../lib/enrollment-placement'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'
import { calculateAnnualScore } from '../lib/grading-calculator'

export const enrollmentRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

enrollmentRoutes.use('*', tenantMiddleware, authMiddleware)

const buildStudentSearchFilter = (queryTerm: string | undefined) =>
  queryTerm
    ? or(
        ilike(students.firstName, `%${queryTerm}%`),
        ilike(students.middleName, `%${queryTerm}%`),
        ilike(students.lastName, `%${queryTerm}%`),
        ilike(students.documentNumber, `%${queryTerm}%`),
        sql`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}) ILIKE ${`%${queryTerm}%`}`,
      )
    : undefined

const resolveSuggestedGrade = ({
  mode,
  previousGradeId,
  previousGradeLevel,
  gradeCatalog,
}: {
  mode: 'renewal' | 'promotion' | 'auto_promotion'
  previousGradeId: string
  previousGradeLevel: number | null
  gradeCatalog: Array<{ id: string; name: string; level: number }>
}) => {
  if (mode === 'renewal') {
    return gradeCatalog.find((item) => item.id === previousGradeId) ?? null
  }

  if (previousGradeLevel === null) return null

  return gradeCatalog
    .filter((item) => item.level > previousGradeLevel)
    .sort((left, right) => left.level - right.level)[0] ?? null
}

const getTargetYear = async (db: AppContextVariables['db'], tenantId: string, year: number) => {
  const [targetYear] = await db
    .select({ id: academicYears.id, name: academicYears.name, year: academicYears.year })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, year), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!targetYear) throw new AppError('Año lectivo no encontrado', 404)
  return targetYear
}

const buildAcademicYearPerformanceMap = async ({
  db,
  tenantId,
  academicYearId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
}) => {
  const studentGradeRows = await db
    .select({
      studentId: enrollments.studentId,
      gradeId: enrollments.gradeId,
    })
    .from(enrollments)
    .where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.academicYearId, academicYearId),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled'),
    ))

  const gradeIdByStudent = new Map(
    studentGradeRows
      .filter((row): row is { studentId: string; gradeId: string } => Boolean(row.gradeId))
      .map((row) => [row.studentId, row.gradeId]),
  )

  const uniqueGradeIds = [...new Set([...gradeIdByStudent.values()])]
  const scaleByGradeId = new Map<string, Awaited<ReturnType<typeof resolveGradingScaleForGrade>>>()
  for (const gradeId of uniqueGradeIds) {
    scaleByGradeId.set(gradeId, await resolveGradingScaleForGrade({ db, tenantId, academicYearId, gradeId }))
  }

  const defaultPassingValue = scaleByGradeId.values().next().value?.passingValue ?? 3

  const periods = await db
    .select({ id: academicPeriods.id, weight: academicPeriods.weight })
    .from(academicPeriods)
    .where(and(
      eq(academicPeriods.tenantId, tenantId),
      eq(academicPeriods.academicYearId, academicYearId),
      eq(academicPeriods.isDeleted, false),
    ))

  const periodWeightById = new Map(periods.map((period) => [period.id, period.weight]))

  const annualGradeRows = await db
    .select({
      studentId: gradeRecords.studentId,
      subjectId: gradeRecords.subjectId,
      subjectName: subjects.name,
      periodId: gradeRecords.academicPeriodId,
      score: gradeRecords.score,
    })
    .from(gradeRecords)
    .innerJoin(subjects, eq(subjects.id, gradeRecords.subjectId))
    .where(and(
      eq(gradeRecords.tenantId, tenantId),
      eq(gradeRecords.academicYearId, academicYearId),
      eq(gradeRecords.isDeleted, false),
      eq(subjects.isDeleted, false),
    ))

  const subjectScoresByStudent = new Map<string, Map<string, { subjectName: string; periods: Array<{ score: number; weightPercentage: number }> }>>()
  for (const row of annualGradeRows) {
    const periodWeight = periodWeightById.get(row.periodId)
    if (periodWeight === undefined) continue

    const subjectMap = subjectScoresByStudent.get(row.studentId) ?? new Map<string, { subjectName: string; periods: Array<{ score: number; weightPercentage: number }> }>()
    const subjectEntry = subjectMap.get(row.subjectId) ?? {
      subjectName: row.subjectName,
      periods: [],
    }
    subjectEntry.periods.push({
      score: Number(row.score),
      weightPercentage: periodWeight,
    })
    subjectMap.set(row.subjectId, subjectEntry)
    subjectScoresByStudent.set(row.studentId, subjectMap)
  }

  const pendingSupportRows = await db
    .select({
      studentId: supportStrategies.studentId,
      subjectId: supportStrategies.subjectId,
    })
    .from(supportStrategies)
    .where(and(
      eq(supportStrategies.tenantId, tenantId),
      eq(supportStrategies.academicYearId, academicYearId),
      eq(supportStrategies.status, 'pending'),
      eq(supportStrategies.isDeleted, false),
    ))

  const pendingSupportCountByStudent = new Map<string, number>()
  for (const row of pendingSupportRows) {
    pendingSupportCountByStudent.set(row.studentId, (pendingSupportCountByStudent.get(row.studentId) ?? 0) + 1)
  }

  const performanceByStudent = new Map<string, {
    annualAverage: number | null
    passingSubjects: number
    failedSubjects: number
    pendingSupportStrategies: number
    failedSubjectNames: string[]
    passingValue: number
  }>()

  for (const [studentId, subjectMap] of subjectScoresByStudent.entries()) {
    const annualSubjectScores: Array<{ subjectName: string; score: number }> = []
    for (const subjectEntry of subjectMap.values()) {
      if (subjectEntry.periods.length === 0) continue
      annualSubjectScores.push({
        subjectName: subjectEntry.subjectName,
        score: calculateAnnualScore(subjectEntry.periods),
      })
    }

    const studentGradeId = gradeIdByStudent.get(studentId)
    const passingValue = studentGradeId ? (scaleByGradeId.get(studentGradeId)?.passingValue ?? defaultPassingValue) : defaultPassingValue
    const passingSubjects = annualSubjectScores.filter((item) => item.score >= passingValue)
    const failedSubjects = annualSubjectScores.filter((item) => item.score < passingValue)
    const annualAverage = annualSubjectScores.length
      ? Number((annualSubjectScores.reduce((sum, item) => sum + item.score, 0) / annualSubjectScores.length).toFixed(2))
      : null

    performanceByStudent.set(studentId, {
      annualAverage,
      passingSubjects: passingSubjects.length,
      failedSubjects: failedSubjects.length,
      pendingSupportStrategies: pendingSupportCountByStudent.get(studentId) ?? 0,
      failedSubjectNames: failedSubjects.map((item) => item.subjectName),
      passingValue,
    })
  }

  return { defaultPassingValue, performanceByStudent }
}

const resolveSuggestedPromotionStatus = ({
  annualAverage,
  failedSubjects,
  pendingSupportStrategies,
}: {
  annualAverage: number | null
  failedSubjects: number
  pendingSupportStrategies: number
}) => {
  if (annualAverage === null) return 'pending' as const
  if (failedSubjects > 0) return 'not_promoted' as const
  if (pendingSupportStrategies > 0) return 'conditional' as const
  return 'promoted' as const
}

const buildContinuityPreview = async ({
  db,
  tenantId,
  year,
  mode,
  sourceGradeId,
  query,
}: {
  db: AppContextVariables['db']
  tenantId: string
  year: number
  mode: 'renewal' | 'promotion' | 'auto_promotion'
  sourceGradeId?: string | null
  query?: string
}) => {
  const targetYear = await getTargetYear(db, tenantId, year)
  const [sourceYear] = await db
    .select({ id: academicYears.id, name: academicYears.name, year: academicYears.year })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, year - 1), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!sourceYear) throw new AppError('No existe año lectivo anterior para construir continuidad masiva', 404)

  const { defaultPassingValue, performanceByStudent } = await buildAcademicYearPerformanceMap({
    db,
    tenantId,
    academicYearId: sourceYear.id,
  })

  const gradeCatalog = await db
    .select({ id: grades.id, name: grades.name, level: grades.level })
    .from(grades)
    .where(and(eq(grades.tenantId, tenantId), eq(grades.isDeleted, false)))
    .orderBy(asc(grades.level), asc(grades.name))

  const targetGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      gradeId: groups.gradeId,
      capacity: groups.capacity,
    })
    .from(groups)
    .where(
      and(
        eq(groups.tenantId, tenantId),
        eq(groups.academicYearId, targetYear.id),
        eq(groups.isDeleted, false),
      ),
    )
    .orderBy(asc(groups.name))

  const targetGroupIds = targetGroups.map((group) => group.id)
  const occupancies = targetGroupIds.length
    ? await db
        .select({
          groupId: enrollments.groupId,
          total: count(),
        })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.tenantId, tenantId),
            eq(enrollments.academicYearId, targetYear.id),
            inArray(enrollments.groupId, targetGroupIds),
            eq(enrollments.isDeleted, false),
            ne(enrollments.enrollmentStatus, 'cancelled'),
          ),
        )
        .groupBy(enrollments.groupId)
    : []

  const occupancyByGroupId = new Map(
    occupancies
      .filter((item): item is { groupId: string; total: number } => Boolean(item.groupId))
      .map((item) => [item.groupId, item.total]),
  )
  const groupsByGradeId = new Map<string, Array<{
    id: string
    name: string
    gradeId: string
    capacity: number
    occupiedCount: number
    availableSeats: number
  }>>()

  for (const group of targetGroups) {
    const occupiedCount = occupancyByGroupId.get(group.id) ?? 0
    const entry = {
      id: group.id,
      name: group.name,
      gradeId: group.gradeId,
      capacity: group.capacity,
      occupiedCount,
      availableSeats: Math.max(group.capacity - occupiedCount, 0),
    }
    const existing = groupsByGradeId.get(group.gradeId) ?? []
    existing.push(entry)
    groupsByGradeId.set(group.gradeId, existing)
  }

  const queryTerm = query?.trim()
  const targetEnrollmentExists = db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, students.id),
        eq(enrollments.academicYearId, targetYear.id),
        eq(enrollments.isDeleted, false),
      ),
    )

  const rows = await db
    .select({
      studentId: students.id,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      documentType: students.documentType,
      documentNumber: students.documentNumber,
      previousEnrollmentId: enrollments.id,
      previousAcademicYearName: academicYears.name,
      previousGradeId: grades.id,
      previousGradeName: grades.name,
      previousGradeLevel: grades.level,
      previousGroupId: groups.id,
      previousGroupName: groups.name,
      previousEnrollmentStatus: enrollments.enrollmentStatus,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .leftJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.academicYearId, sourceYear.id),
        eq(enrollments.isDeleted, false),
        ne(enrollments.enrollmentStatus, 'cancelled'),
        sourceGradeId ? eq(enrollments.gradeId, sourceGradeId) : undefined,
        buildStudentSearchFilter(queryTerm),
        notExists(targetEnrollmentExists),
      ),
    )
    .orderBy(asc(grades.level), asc(groups.name), asc(students.firstName), asc(students.lastName))

  const items = rows.map((row) => {
    const academicSummary = performanceByStudent.get(row.studentId) ?? {
      annualAverage: null,
      passingSubjects: 0,
      failedSubjects: 0,
      pendingSupportStrategies: 0,
      failedSubjectNames: [],
      passingValue: defaultPassingValue,
    }
    const suggestedGrade = row.previousGradeId
      ? resolveSuggestedGrade({
          mode,
          previousGradeId: row.previousGradeId,
          previousGradeLevel: row.previousGradeLevel ?? null,
          gradeCatalog,
        })
      : null

    const issues: string[] = []
    if (!row.previousGradeId) issues.push('La matrícula anterior no tiene grado asignado')
    if (!suggestedGrade) {
      issues.push(
        mode === 'renewal'
          ? 'No fue posible resolver el mismo grado en el catálogo actual'
          : 'No existe un grado siguiente configurado para esta cohorte',
      )
    }

    if (mode !== 'renewal') {
      if (academicSummary.failedSubjects > 0) {
        const failedNames = academicSummary.failedSubjectNames.slice(0, 3).join(', ')
        issues.push(
          `Registra ${academicSummary.failedSubjects} materias por debajo de la nota mínima (${academicSummary.passingValue.toFixed(2)})${failedNames ? `: ${failedNames}` : ''}`,
        )
      }
      if (academicSummary.pendingSupportStrategies > 0) {
        issues.push(`Tiene ${academicSummary.pendingSupportStrategies} planes de apoyo pendientes en el año anterior`)
      }
    }

    return {
      studentId: row.studentId,
      studentName: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
      studentDocument: `${row.documentType} ${row.documentNumber}`.trim(),
      previousEnrollmentId: row.previousEnrollmentId,
      previousAcademicYearName: row.previousAcademicYearName,
      previousGradeId: row.previousGradeId ?? '',
      previousGradeName: row.previousGradeName ?? 'Sin grado',
      previousGroupId: row.previousGroupId,
      previousGroupName: row.previousGroupName ?? null,
      suggestedGradeId: suggestedGrade?.id ?? null,
      suggestedGradeName: suggestedGrade?.name ?? null,
      suggestedEnrollmentType: mode,
      suggestedGroupOptions: suggestedGrade ? (groupsByGradeId.get(suggestedGrade.id) ?? []) : [],
      academicSummary,
      issues,
      eligible: issues.length === 0,
    }
  })

  return {
    targetAcademicYearId: targetYear.id,
    targetAcademicYearName: targetYear.name,
    sourceAcademicYearId: sourceYear.id,
    sourceAcademicYearName: sourceYear.name,
    mode,
    totalCandidates: items.length,
    eligibleCandidates: items.filter((item) => item.eligible).length,
    blockedCandidates: items.filter((item) => !item.eligible).length,
    items,
  }
}

enrollmentRoutes.get('/candidates', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', enrollmentCandidateFiltersSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')

  const [targetYear] = await db
    .select({ id: academicYears.id, year: academicYears.year })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, filters.year), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!targetYear) throw new AppError('Año lectivo no encontrado', 404)

  const queryTerm = filters.query?.trim()
  const currentYearEnrollment = db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, students.id),
        eq(enrollments.academicYearId, targetYear.id),
        eq(enrollments.isDeleted, false),
      ),
    )

  const whereClause = and(
    eq(students.tenantId, tenantId),
    eq(students.isDeleted, false),
    notExists(currentYearEnrollment),
    queryTerm
      ? or(
          ilike(students.firstName, `%${queryTerm}%`),
          ilike(students.middleName, `%${queryTerm}%`),
          ilike(students.lastName, `%${queryTerm}%`),
          ilike(students.documentNumber, `%${queryTerm}%`),
          sql`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}) ILIKE ${`%${queryTerm}%`}`,
        )
      : undefined,
  )

  const offset = (filters.page - 1) * filters.pageSize
  const rows = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      documentType: students.documentType,
      documentNumber: students.documentNumber,
    })
    .from(students)
    .where(whereClause)
    .orderBy(asc(students.firstName), asc(students.lastName))
    .limit(filters.pageSize)
    .offset(offset)

  const [totalRow] = await db.select({ total: count() }).from(students).where(whereClause)
  const studentIds = rows.map((row) => row.id)

  const previousRows = studentIds.length
    ? await db
        .select({
          enrollmentId: enrollments.id,
          studentId: enrollments.studentId,
          academicYearId: enrollments.academicYearId,
          academicYearName: academicYears.name,
          year: academicYears.year,
          gradeId: enrollments.gradeId,
          gradeName: grades.name,
          groupId: enrollments.groupId,
          groupName: groups.name,
          enrollmentType: enrollments.enrollmentType,
          enrollmentStatus: enrollments.enrollmentStatus,
          enrollmentDate: enrollments.enrollmentDate,
        })
        .from(enrollments)
        .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
        .leftJoin(grades, eq(grades.id, enrollments.gradeId))
        .leftJoin(groups, eq(groups.id, enrollments.groupId))
        .where(
          and(
            eq(enrollments.tenantId, tenantId),
            eq(enrollments.isDeleted, false),
            inArray(enrollments.studentId, studentIds),
          ),
        )
        .orderBy(desc(academicYears.year), desc(enrollments.enrollmentDate))
    : []

  const latestEnrollmentByStudent = new Map<string, typeof previousRows[number]>()
  previousRows.forEach((row) => {
    if (!latestEnrollmentByStudent.has(row.studentId)) {
      latestEnrollmentByStudent.set(row.studentId, row)
    }
  })

  const admissionRows = studentIds.length
    ? await db
        .select({
          id: admissionApplications.id,
          studentId: admissionApplications.studentId,
          status: admissionApplications.status,
          requestedGradeId: admissionApplications.requestedGradeId,
          requestedGradeName: grades.name,
          requestedGroupId: admissionApplications.requestedGroupId,
          requestedGroupName: groups.name,
          source: admissionApplications.source,
          submittedAt: admissionApplications.submittedAt,
          createdAt: admissionApplications.createdAt,
        })
        .from(admissionApplications)
        .leftJoin(grades, eq(grades.id, admissionApplications.requestedGradeId))
        .leftJoin(groups, eq(groups.id, admissionApplications.requestedGroupId))
        .where(
          and(
            eq(admissionApplications.tenantId, tenantId),
            eq(admissionApplications.academicYearId, targetYear.id),
            eq(admissionApplications.isDeleted, false),
            inArray(admissionApplications.studentId, studentIds),
          ),
        )
        .orderBy(desc(admissionApplications.submittedAt), desc(admissionApplications.createdAt))
    : []

  const admissionByStudent = new Map<string, typeof admissionRows[number]>()
  admissionRows.forEach((row) => {
    if (!admissionByStudent.has(row.studentId)) {
      admissionByStudent.set(row.studentId, row)
    }
  })

  return c.json(ok('Candidatos a matrícula cargados', {
    items: rows.map((row) => {
      const latestEnrollment = latestEnrollmentByStudent.get(row.id)
      const admissionApplication = admissionByStudent.get(row.id)
      return {
        studentId: row.id,
        studentName: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
        studentDocument: `${row.documentType} ${row.documentNumber}`.trim(),
        admissionApplication: admissionApplication
          ? {
              id: admissionApplication.id,
              status: admissionApplication.status,
              requestedGradeId: admissionApplication.requestedGradeId,
              requestedGradeName: admissionApplication.requestedGradeName ?? '',
              requestedGroupId: admissionApplication.requestedGroupId,
              requestedGroupName: admissionApplication.requestedGroupName ?? null,
              source: admissionApplication.source,
            }
          : null,
        latestEnrollment: latestEnrollment
          ? {
              id: latestEnrollment.enrollmentId,
              academicYearId: latestEnrollment.academicYearId,
              academicYearName: latestEnrollment.academicYearName ?? '',
              year: latestEnrollment.year,
              gradeId: latestEnrollment.gradeId,
              gradeName: latestEnrollment.gradeName ?? '',
              groupId: latestEnrollment.groupId,
              groupName: latestEnrollment.groupName ?? null,
              enrollmentType: latestEnrollment.enrollmentType,
              enrollmentStatus: latestEnrollment.enrollmentStatus,
              enrollmentDate: latestEnrollment.enrollmentDate.toISOString(),
            }
          : null,
        recommendedEnrollmentType: latestEnrollment
          ? latestEnrollment.year < targetYear.year
            ? 'renewal'
            : latestEnrollment.enrollmentType === 'transfer'
              ? 'transfer'
              : 'renewal'
          : 'new',
      }
    }),
    total: totalRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }))
})

enrollmentRoutes.get('/continuity-preview', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', enrollmentContinuityPreviewSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')

  const preview = await buildContinuityPreview({
    db,
    tenantId,
    year: filters.year,
    mode: filters.mode,
    sourceGradeId: filters.sourceGradeId || null,
    query: filters.query,
  })

  return c.json(ok('Vista previa de continuidad cargada', preview))
})

enrollmentRoutes.get('/annual-promotion-preview', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', annualPromotionPreviewSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')

  const targetYear = await getTargetYear(db, tenantId, filters.year)
  const { defaultPassingValue, performanceByStudent } = await buildAcademicYearPerformanceMap({
    db,
    tenantId,
    academicYearId: targetYear.id,
  })

  const queryTerm = filters.query?.trim()
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      documentType: students.documentType,
      documentNumber: students.documentNumber,
      gradeId: grades.id,
      gradeName: grades.name,
      groupId: groups.id,
      groupName: groups.name,
      promotionStatus: enrollments.promotionStatus,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .leftJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.academicYearId, targetYear.id),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled'),
      filters.gradeId ? eq(enrollments.gradeId, filters.gradeId) : undefined,
      filters.groupId ? eq(enrollments.groupId, filters.groupId) : undefined,
      queryTerm ? or(
        ilike(students.firstName, `%${queryTerm}%`),
        ilike(students.middleName, `%${queryTerm}%`),
        ilike(students.lastName, `%${queryTerm}%`),
        ilike(students.documentNumber, `%${queryTerm}%`),
        sql`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}) ILIKE ${`%${queryTerm}%`}`,
      ) : undefined,
    ))
    .orderBy(asc(grades.level), asc(groups.name), asc(students.firstName), asc(students.lastName))

  const items = rows.map((row) => {
    const academicSummary = performanceByStudent.get(row.studentId) ?? {
      annualAverage: null,
      passingSubjects: 0,
      failedSubjects: 0,
      pendingSupportStrategies: 0,
      failedSubjectNames: [],
      passingValue: defaultPassingValue,
    }

    const suggestedPromotionStatus = resolveSuggestedPromotionStatus(academicSummary)
    const issues: string[] = []
    if (academicSummary.annualAverage === null) issues.push('No tiene cierre anual suficiente para decidir promoción')
    if (academicSummary.failedSubjects > 0) issues.push(`Presenta ${academicSummary.failedSubjects} materias perdidas`)
    if (academicSummary.pendingSupportStrategies > 0) issues.push(`Tiene ${academicSummary.pendingSupportStrategies} planes de apoyo pendientes`)

    return {
      enrollmentId: row.enrollmentId,
      studentId: row.studentId,
      studentName: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '),
      studentDocument: `${row.documentType} ${row.documentNumber}`.trim(),
      gradeId: row.gradeId,
      gradeName: row.gradeName ?? 'Sin grado',
      groupId: row.groupId,
      groupName: row.groupName ?? null,
      currentPromotionStatus: row.promotionStatus as 'pending' | 'promoted' | 'not_promoted' | 'conditional' | null,
      suggestedPromotionStatus,
      academicSummary,
      issues,
    }
  })

  return c.json(ok('Vista previa de cierre anual cargada', {
    academicYearId: targetYear.id,
    academicYearName: targetYear.name,
    totalStudents: items.length,
    promotedCount: items.filter((item) => item.suggestedPromotionStatus === 'promoted').length,
    conditionalCount: items.filter((item) => item.suggestedPromotionStatus === 'conditional').length,
    notPromotedCount: items.filter((item) => item.suggestedPromotionStatus === 'not_promoted').length,
    pendingCount: items.filter((item) => item.suggestedPromotionStatus === 'pending').length,
    items,
  }))
})

enrollmentRoutes.get('/', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', enrollmentFiltersSchema), async (c) => {
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

  const queryTerm = filters.query?.trim()
  const whereClause = and(
    eq(enrollments.tenantId, tenantId),
    eq(enrollments.isDeleted, false),
    academicYearId ? eq(enrollments.academicYearId, academicYearId) : undefined,
    filters.gradeId ? eq(enrollments.gradeId, filters.gradeId) : undefined,
    filters.groupId ? eq(enrollments.groupId, filters.groupId) : undefined,
    queryTerm
      ? or(
          ilike(students.firstName, `%${queryTerm}%`),
          ilike(students.middleName, `%${queryTerm}%`),
          ilike(students.lastName, `%${queryTerm}%`),
          ilike(students.documentNumber, `%${queryTerm}%`),
          sql`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName}) ILIKE ${`%${queryTerm}%`}`,
        )
      : undefined,
  )

  const totalResult = await db
    .select({ total: count() })
    .from(enrollments)
    .leftJoin(students, eq(students.id, enrollments.studentId))
    .where(whereClause)
  const total = totalResult[0]?.total ?? 0

  const offset = (filters.page - 1) * filters.pageSize

  const rows = await db
    .select({
      enrollment: enrollments,
      studentFirstName: students.firstName,
      studentMiddleName: students.middleName,
      studentLastName: students.lastName,
      studentDocumentType: students.documentType,
      studentDocumentNumber: students.documentNumber,
      academicYearName: academicYears.name,
      gradeName: grades.name,
      groupName: groups.name,
    })
    .from(enrollments)
    .leftJoin(students, eq(students.id, enrollments.studentId))
    .leftJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .leftJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .where(
      whereClause,
    )
    .orderBy(desc(enrollments.enrollmentDate), asc(students.firstName))
    .limit(filters.pageSize)
    .offset(offset)

  return c.json(
    ok('Matrículas cargadas', {
      items: rows.map(({ enrollment, studentFirstName, studentMiddleName, studentLastName, studentDocumentType, studentDocumentNumber, academicYearName, gradeName, groupName }) => ({
        id: enrollment.id,
        studentId: enrollment.studentId,
        studentName: [studentFirstName, studentMiddleName, studentLastName].filter(Boolean).join(' '),
        studentDocument: `${studentDocumentType ?? ''} ${studentDocumentNumber ?? ''}`.trim(),
        academicYearId: enrollment.academicYearId,
        academicYearName: academicYearName ?? '',
        gradeId: enrollment.gradeId,
        gradeName: gradeName ?? '',
        groupId: enrollment.groupId,
        groupName: groupName ?? null,
        branchId: enrollment.branchId,
        journey: enrollment.journey,
        enrollmentType: enrollment.enrollmentType,
        enrollmentStatus: enrollment.enrollmentStatus,
        enrollmentDate: enrollment.enrollmentDate.toISOString(),
        admissionApplicationId: enrollment.admissionApplicationId,
        previousEnrollmentId: enrollment.previousEnrollmentId,
        promotionStatus: enrollment.promotionStatus,
      })),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  )
})

enrollmentRoutes.post('/', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', enrollmentCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, payload.studentId),
        eq(enrollments.academicYearId, payload.academicYearId),
        eq(enrollments.isDeleted, false),
      ),
    )
    .limit(1)

  if (existing) throw new AppError('El estudiante ya tiene matrícula para ese año lectivo', 409)

  if (payload.enrollmentType !== 'new' && !payload.previousEnrollmentId) {
    throw new AppError('Las renovaciones, promociones y traslados internos deben referenciar la matrícula anterior', 400)
  }

  if (payload.previousEnrollmentId) {
    const [previousEnrollment] = await db
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        academicYearId: enrollments.academicYearId,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.id, payload.previousEnrollmentId),
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.isDeleted, false),
        ),
      )
      .limit(1)

    if (!previousEnrollment) throw new AppError('La matrícula anterior no existe', 404)
    if (previousEnrollment.studentId !== payload.studentId) {
      throw new AppError('La matrícula anterior no corresponde al estudiante seleccionado', 409)
    }
    if (previousEnrollment.academicYearId === payload.academicYearId) {
      throw new AppError('La matrícula anterior debe pertenecer a otro año lectivo', 409)
    }
  }

  let admissionApplicationToConvert: { id: string; status: string; shouldApprove: boolean } | null = null

  if (payload.admissionApplicationId) {
    const [application] = await db
      .select({
        id: admissionApplications.id,
        studentId: admissionApplications.studentId,
        academicYearId: admissionApplications.academicYearId,
        status: admissionApplications.status,
      })
      .from(admissionApplications)
      .where(
        and(
          eq(admissionApplications.id, payload.admissionApplicationId),
          eq(admissionApplications.tenantId, tenantId),
          eq(admissionApplications.isDeleted, false),
        ),
      )
      .limit(1)

    if (!application) throw new AppError('La inscripción asociada no existe', 404)
    if (application.studentId !== payload.studentId) {
      throw new AppError('La inscripción asociada no corresponde al estudiante seleccionado', 409)
    }
    if (application.academicYearId !== payload.academicYearId) {
      throw new AppError('La inscripción asociada no pertenece al mismo año lectivo', 409)
    }
    if (application.status !== 'accepted' && application.status !== 'converted') {
      if (!payload.approveAdmissionIfNeeded) {
        throw new AppError(
          'La inscripción asociada no está aprobada. Confirma si quieres aprobarla y continuar con la matrícula.',
          409,
          { status: application.status, admissionApplicationId: application.id },
          'ADMISSION_APPROVAL_REQUIRED',
        )
      }
      admissionApplicationToConvert = { id: application.id, status: application.status, shouldApprove: true }
    } else {
      admissionApplicationToConvert = { id: application.id, status: application.status, shouldApprove: false }
    }
  }

  await validateEnrollmentPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    gradeId: payload.gradeId,
    groupId: payload.groupId || null,
  })

  const [item] = await db
    .insert(enrollments)
    .values({
      tenantId,
      studentId: payload.studentId,
      academicYearId: payload.academicYearId,
      gradeId: payload.gradeId,
      groupId: payload.groupId || null,
      branchId: payload.branchId || null,
      journey: payload.journey || null,
      admissionApplicationId: payload.admissionApplicationId || null,
      previousEnrollmentId: payload.previousEnrollmentId || null,
      enrollmentType: payload.enrollmentType,
      enrollmentStatus: payload.enrollmentStatus,
      enrollmentDate: new Date(`${payload.enrollmentDate}T00:00:00.000Z`),
      status: payload.enrollmentStatus === 'active' ? 'active' : 'pending',
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: enrollments.id })

  if (!item) throw new AppError('No fue posible crear la matrícula', 500)

  if (admissionApplicationToConvert) {
    await db
      .update(admissionApplications)
      .set({
        ...(admissionApplicationToConvert.shouldApprove
          ? {
              status: 'accepted',
              acceptedAt: new Date(),
              reviewedAt: new Date(),
              reviewedBy: user.id,
            }
          : {}),
        convertedEnrollmentId: item.id,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(admissionApplications.id, admissionApplicationToConvert.id))
  }

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'enrollments',
    entityId: item.id,
    action: 'create',
    changes: payload as Record<string, unknown>,
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(created('Matrícula creada', { id: item.id }), 201)
})

enrollmentRoutes.post('/continuity-batch', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', enrollmentBatchCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [targetYear] = await db
    .select({ id: academicYears.id, name: academicYears.name })
    .from(academicYears)
    .where(and(eq(academicYears.id, payload.academicYearId), eq(academicYears.tenantId, tenantId), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!targetYear) throw new AppError('Año lectivo destino no encontrado', 404)

  const createdIds: string[] = []
  const skipped: Array<{ studentId: string; reason: string }> = []

  for (const item of payload.items) {
    const [previousEnrollment] = await db
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        academicYearId: enrollments.academicYearId,
        gradeId: enrollments.gradeId,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.id, item.previousEnrollmentId),
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.isDeleted, false),
        ),
      )
      .limit(1)

    if (!previousEnrollment) {
      skipped.push({ studentId: item.studentId, reason: 'La matrícula anterior no existe' })
      continue
    }

    if (previousEnrollment.studentId !== item.studentId) {
      skipped.push({ studentId: item.studentId, reason: 'La matrícula anterior no corresponde al estudiante' })
      continue
    }

    if (previousEnrollment.academicYearId === payload.academicYearId) {
      skipped.push({ studentId: item.studentId, reason: 'La matrícula anterior pertenece al mismo año lectivo' })
      continue
    }

    if (payload.mode === 'renewal' && previousEnrollment.gradeId !== item.gradeId) {
      skipped.push({ studentId: item.studentId, reason: 'La renovación debe conservar el mismo grado' })
      continue
    }

    if ((payload.mode === 'promotion' || payload.mode === 'auto_promotion') && previousEnrollment.gradeId === item.gradeId) {
      skipped.push({ studentId: item.studentId, reason: 'La promoción debe apuntar a un grado distinto al anterior' })
      continue
    }

    try {
      await validateEnrollmentPlacement({
        db,
        tenantId,
        academicYearId: payload.academicYearId,
        gradeId: item.gradeId,
        groupId: item.groupId || null,
      })
    } catch (error) {
      skipped.push({
        studentId: item.studentId,
        reason: error instanceof Error ? error.message : 'La ubicación académica seleccionada no es válida',
      })
      continue
    }

    const [existing] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.studentId, item.studentId),
          eq(enrollments.academicYearId, payload.academicYearId),
          eq(enrollments.isDeleted, false),
        ),
      )
      .limit(1)

    if (existing) {
      skipped.push({ studentId: item.studentId, reason: 'El estudiante ya tiene matrícula en el año destino' })
      continue
    }

    const [createdItem] = await db
      .insert(enrollments)
      .values({
        tenantId,
        studentId: item.studentId,
        academicYearId: payload.academicYearId,
        gradeId: item.gradeId,
        groupId: item.groupId || null,
        previousEnrollmentId: item.previousEnrollmentId,
        enrollmentType: payload.mode,
        enrollmentStatus: payload.enrollmentStatus,
        enrollmentDate: new Date(`${payload.enrollmentDate}T00:00:00.000Z`),
        status: payload.enrollmentStatus === 'active' ? 'active' : 'pending',
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: enrollments.id })

    if (!createdItem) {
      skipped.push({ studentId: item.studentId, reason: 'No fue posible crear la matrícula' })
      continue
    }

    createdIds.push(createdItem.id)

    await writeAuditLog(db, {
      tenantId,
      actorUserId: user.id,
      entity: 'enrollments',
      entityId: createdItem.id,
      action: 'continuity_batch_create',
      changes: {
        academicYearId: payload.academicYearId,
        previousEnrollmentId: item.previousEnrollmentId,
        gradeId: item.gradeId,
        groupId: item.groupId || null,
        mode: payload.mode,
      },
      ipAddress: c.req.header('cf-connecting-ip'),
    })
  }

  return c.json(ok(`Continuidad masiva procesada para ${targetYear.name}`, {
    createdCount: createdIds.length,
    skippedCount: skipped.length,
    createdIds,
    skipped,
  }))
})

enrollmentRoutes.post('/annual-promotion-decisions', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', annualPromotionDecisionSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const updatedItems: Array<{ enrollmentId: string; promotionStatus: 'pending' | 'promoted' | 'not_promoted' | 'conditional' }> = []

  for (const item of payload.items) {
    const [updated] = await db
      .update(enrollments)
      .set({
        promotionStatus: item.promotionStatus,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(and(
        eq(enrollments.id, item.enrollmentId),
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.academicYearId, payload.academicYearId),
        eq(enrollments.isDeleted, false),
      ))
      .returning({ id: enrollments.id, promotionStatus: enrollments.promotionStatus })

    if (!updated) {
      throw new AppError('Una de las matrículas no existe o no pertenece al año lectivo seleccionado.', 404)
    }

    updatedItems.push({
      enrollmentId: updated.id,
      promotionStatus: updated.promotionStatus as 'pending' | 'promoted' | 'not_promoted' | 'conditional',
    })
  }

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'enrollments',
    entityId: payload.academicYearId,
    action: 'annual_promotion_decisions',
    changes: {
      academicYearId: payload.academicYearId,
      updatedCount: updatedItems.length,
      items: updatedItems,
    },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(ok('Decisiones de cierre anual aplicadas', {
    updatedCount: updatedItems.length,
    items: updatedItems,
  }))
})

enrollmentRoutes.get('/export/csv', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const year = Number(c.req.query('year') ?? '0')

  if (!Number.isInteger(year)) throw new AppError('Año lectivo requerido para exportación', 400)

  const [academicYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.tenantId, tenantId), eq(academicYears.year, year), eq(academicYears.isDeleted, false)))
    .limit(1)
  if (!academicYear) throw new AppError('Año lectivo no encontrado', 404)

  const rows = await db
    .select({
      id: enrollments.id,
      studentId: students.id,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentDocumentType: students.documentType,
      studentDocumentNumber: students.documentNumber,
      gradeName: grades.name,
      groupName: groups.name,
      enrollmentType: enrollments.enrollmentType,
      enrollmentStatus: enrollments.enrollmentStatus,
      documentStatus: enrollments.documentStatus,
      financialStatus: enrollments.financialStatus,
      academicStatus: enrollments.academicStatus,
      journey: enrollments.journey,
      sequenceNumber: enrollments.sequenceNumber,
      enrollmentDate: enrollments.enrollmentDate,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .leftJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.academicYearId, academicYear.id),
        eq(enrollments.isDeleted, false),
      ),
    )
    .orderBy(asc(enrollments.sequenceNumber), asc(enrollments.enrollmentDate))

  const header = 'consecutivo,estudiante,tipo_documento,numero_documento,grado,grupo,jornada,tipo_matricula,estado_matricula,estado_documental,estado_financiero,estado_academico,fecha_matricula\n'
  const bodyLines = rows.map((r) => [
    r.sequenceNumber ?? '', [r.studentFirstName, r.studentLastName].filter(Boolean).join(' '), r.studentDocumentType ?? '', r.studentDocumentNumber ?? '',
    r.gradeName ?? '', r.groupName ?? '', r.journey ?? '', r.enrollmentType ?? '', r.enrollmentStatus ?? '',
    r.documentStatus ?? '', r.financialStatus ?? '', r.academicStatus ?? '', r.enrollmentDate.toISOString(),
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')

  c.res.headers.set('Content-Type', 'text/csv; charset=utf-8')
  c.res.headers.set('Content-Disposition', `attachment; filename="matriculas-${year}.csv"`)
  return c.body(header + bodyLines)
})
