import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import {
  academicPeriods,
  academicYears,
  academicYearLevels,
  admissionApplications,
  enrollments,
  gradeSubjects,
  gradeRecords,
  grades,
  groups,
  learningAchievements,
  schoolBranches,
  subjects,
  students,
  academicAreas,
  gradingScales,
  performanceRanges,
  competencies,
  achievementIndicators,
  evaluationActivities,
  activityScores,
  academicObservations,
  observationBank,
  supportStrategies,
  teachers,
  courseSubjects,
  teacherResponsibilities,
  gradingScaleAssignments,
  academicYearJourneys,
  academicYearJourneySlots,
  groupJourneyOptions,
  groupTimetableEntries,
  users,
  userRoles,
  roles,
  attendanceRecords,
} from '@ofir/db'
import {
  PERMISSIONS,
  achievementSchema,
  academicGradeSchema,
  academicYearLevelSchema,
  academicPeriodSchema,
  academicPeriodStatusSchema,
  academicYearSchema,
  annualReportCardFiltersSchema,
  gradeSubjectSchema,
  courseSchema,
  paginationSchema,
  gradebookFiltersSchema,
  gradebookSaveSchema,
  reportCardFiltersSchema,
  attendanceFiltersSchema,
  attendanceSaveSchema,
  subjectSchema,
  academicAreaSchema,
  gradingScaleSchema,
  performanceRangeSchema,
  competencySchema,
  achievementIndicatorSchema,
  evaluationActivitySchema,
  activityScoreSchema,
  academicObservationSchema,
  observationBankSchema,
  supportStrategySchema,
  teacherSchema,
  courseSubjectSchema,
  teacherResponsibilitySchema,
  gradingScaleAssignmentSchema,
  academicYearJourneySchema,
  academicYearJourneySlotSchema,
  groupJourneyOptionSchema,
  timetableGenerationSchema,
  timetableEntryUpdateSchema,
  timetableStatusSchema,
} from '@ofir/shared'
import { AppError } from '../lib/errors'
import { resolveDisplayedGradeValue, resolveGradingScaleForGrade } from '../lib/grading-scale-resolution'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'
import { calculateAchievementScore, calculateAnnualScore, calculateSubjectPeriodScore, calculatePerformanceLevel } from '../lib/grading-calculator'

export const academicRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

academicRoutes.use('*', tenantMiddleware, authMiddleware)

const todayIsoDate = () => new Date().toISOString().slice(0, 10)
const weekdayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
type Weekday = (typeof weekdayOrder)[number]

const weekdayOrderMap = new Map<Weekday, number>(weekdayOrder.map((day, index) => [day, index]))
const buildTimetableSlotKey = (dayOfWeek: string, slotOrder: number) => `${dayOfWeek}:${slotOrder}`
const compareClockTime = (left: string, right: string) => left.localeCompare(right)

const resolveAcademicYearStatus = ({
  startsOn,
  endsOn,
  isActive,
}: {
  startsOn: string
  endsOn: string
  isActive: boolean
}) => {
  if (endsOn < todayIsoDate()) return 'cerrado'
  if (isActive) return 'activo'
  if (startsOn > todayIsoDate()) return 'planeado'
  return 'planeado'
}

const validateDateWindow = (startsOn: string, endsOn: string, entityName: string) => {
  if (startsOn > endsOn) {
    throw new AppError(`La fecha inicial de ${entityName} no puede ser mayor que la fecha final`, 400)
  }
}

const ensureAcademicYearUpdateIsSafe = async ({
  db,
  tenantId,
  academicYearId,
  year,
  startsOn,
  endsOn,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  year: number
  startsOn: string
  endsOn: string
}) => {
  const [currentYear] = await db
    .select({
      id: academicYears.id,
      year: academicYears.year,
      startsOn: academicYears.startsOn,
      endsOn: academicYears.endsOn,
    })
    .from(academicYears)
    .where(and(eq(academicYears.id, academicYearId), eq(academicYears.tenantId, tenantId), eq(academicYears.isDeleted, false)))
    .limit(1)

  if (!currentYear) throw new AppError('Año lectivo no encontrado', 404)

  const [[periodsUsage], [coursesUsage], [admissionsUsage], [enrollmentsUsage]] = await Promise.all([
    db
      .select({ total: count() })
      .from(academicPeriods)
      .where(
        and(
          eq(academicPeriods.tenantId, tenantId),
          eq(academicPeriods.academicYearId, academicYearId),
          eq(academicPeriods.isDeleted, false),
        ),
      ),
    db
      .select({ total: count() })
      .from(groups)
      .where(
        and(
          eq(groups.tenantId, tenantId),
          eq(groups.academicYearId, academicYearId),
          eq(groups.isDeleted, false),
        ),
      ),
    db
      .select({ total: count() })
      .from(admissionApplications)
      .where(
        and(
          eq(admissionApplications.tenantId, tenantId),
          eq(admissionApplications.academicYearId, academicYearId),
          eq(admissionApplications.isDeleted, false),
        ),
      ),
    db
      .select({ total: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.academicYearId, academicYearId),
          eq(enrollments.isDeleted, false),
        ),
      ),
  ])

  const hasOperationalUsage =
    (periodsUsage?.total ?? 0) > 0 ||
    (coursesUsage?.total ?? 0) > 0 ||
    (admissionsUsage?.total ?? 0) > 0 ||
    (enrollmentsUsage?.total ?? 0) > 0

  if (!hasOperationalUsage) return

  if (currentYear.year !== year) {
    throw new AppError('No puedes cambiar el número de un año lectivo que ya tiene operación asociada.', 409)
  }

  if (currentYear.startsOn !== startsOn || currentYear.endsOn !== endsOn) {
    throw new AppError('No puedes cambiar las fechas de un año lectivo que ya tiene periodos, cursos, inscripciones o matrículas.', 409)
  }
}

const validateAcademicPeriodWeight = async ({
  db,
  tenantId,
  academicYearId,
  weight,
  periodId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  weight: number
  periodId?: string
}) => {
  const existingPeriods = await db
    .select({ id: academicPeriods.id, weight: academicPeriods.weight })
    .from(academicPeriods)
    .where(
      and(
        eq(academicPeriods.tenantId, tenantId),
        eq(academicPeriods.academicYearId, academicYearId),
        eq(academicPeriods.isDeleted, false),
        periodId ? ne(academicPeriods.id, periodId) : undefined,
      ),
    )

  const totalWeight = existingPeriods.reduce((sum, item) => sum + item.weight, 0) + weight

  if (totalWeight > 100) {
    throw new AppError(`La suma de pesos de los periodos no puede superar 100. Con este cambio quedaría en ${totalWeight}.`, 409)
  }
}

const ensureAcademicYearWeightsAreComplete = async ({
  db,
  tenantId,
  academicYearId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
}) => {
  const periods = await db
    .select({ weight: academicPeriods.weight })
    .from(academicPeriods)
    .where(
      and(
        eq(academicPeriods.tenantId, tenantId),
        eq(academicPeriods.academicYearId, academicYearId),
        eq(academicPeriods.isDeleted, false),
      ),
    )

  const totalWeight = periods.reduce((sum, item) => sum + item.weight, 0)

  if (totalWeight !== 100) {
    throw new AppError(`Para activar el año lectivo, los periodos deben sumar exactamente 100. Hoy suman ${totalWeight}.`, 409)
  }
}

const ensureAcademicYearDeletable = async (db: AppContextVariables['db'], tenantId: string, academicYearId: string) => {
  const [[periodsUsage], [coursesUsage], [admissionsUsage], [enrollmentsUsage]] = await Promise.all([
    db
      .select({ total: count() })
      .from(academicPeriods)
      .where(
        and(
          eq(academicPeriods.tenantId, tenantId),
          eq(academicPeriods.academicYearId, academicYearId),
          eq(academicPeriods.isDeleted, false),
        ),
      ),
    db
      .select({ total: count() })
      .from(groups)
      .where(
        and(
          eq(groups.tenantId, tenantId),
          eq(groups.academicYearId, academicYearId),
          eq(groups.isDeleted, false),
        ),
      ),
    db
      .select({ total: count() })
      .from(admissionApplications)
      .where(
        and(
          eq(admissionApplications.tenantId, tenantId),
          eq(admissionApplications.academicYearId, academicYearId),
          eq(admissionApplications.isDeleted, false),
        ),
      ),
    db
      .select({ total: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.academicYearId, academicYearId),
          eq(enrollments.isDeleted, false),
        ),
      ),
  ])

  if ((periodsUsage?.total ?? 0) > 0) {
    throw new AppError('No puedes eliminar este año lectivo porque tiene periodos asociados.', 409)
  }
  if ((coursesUsage?.total ?? 0) > 0) {
    throw new AppError('No puedes eliminar este año lectivo porque tiene cursos asociados.', 409)
  }
  if ((admissionsUsage?.total ?? 0) > 0) {
    throw new AppError('No puedes eliminar este año lectivo porque tiene inscripciones asociadas.', 409)
  }
  if ((enrollmentsUsage?.total ?? 0) > 0) {
    throw new AppError('No puedes eliminar este año lectivo porque tiene matrículas asociadas.', 409)
  }
}

const ensureGradeDeletable = async (db: AppContextVariables['db'], tenantId: string, gradeId: string) => {
  const [[coursesUsage], [admissionsUsage], [enrollmentsUsage]] = await Promise.all([
    db
      .select({ total: count() })
      .from(groups)
      .where(and(eq(groups.tenantId, tenantId), eq(groups.gradeId, gradeId), eq(groups.isDeleted, false))),
    db
      .select({ total: count() })
      .from(admissionApplications)
      .where(
        and(
          eq(admissionApplications.tenantId, tenantId),
          eq(admissionApplications.requestedGradeId, gradeId),
          eq(admissionApplications.isDeleted, false),
        ),
      ),
    db
      .select({ total: count() })
      .from(enrollments)
      .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.gradeId, gradeId), eq(enrollments.isDeleted, false))),
  ])

  if ((coursesUsage?.total ?? 0) > 0) {
    throw new AppError('No puedes eliminar este grado porque tiene cursos asociados.', 409)
  }
  if ((admissionsUsage?.total ?? 0) > 0) {
    throw new AppError('No puedes eliminar este grado porque tiene inscripciones asociadas.', 409)
  }
  if ((enrollmentsUsage?.total ?? 0) > 0) {
    throw new AppError('No puedes eliminar este grado porque tiene matrículas asociadas.', 409)
  }
}

const ensureCourseDeletable = async (db: AppContextVariables['db'], tenantId: string, courseId: string) => {
  const [[admissionsUsage], [enrollmentsUsage]] = await Promise.all([
    db
      .select({ total: count() })
      .from(admissionApplications)
      .where(
        and(
          eq(admissionApplications.tenantId, tenantId),
          eq(admissionApplications.requestedGroupId, courseId),
          eq(admissionApplications.isDeleted, false),
        ),
      ),
    db
      .select({ total: count() })
      .from(enrollments)
      .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.groupId, courseId), eq(enrollments.isDeleted, false))),
  ])

  if ((admissionsUsage?.total ?? 0) > 0) {
    throw new AppError('No puedes eliminar este curso porque tiene inscripciones asociadas.', 409)
  }
  if ((enrollmentsUsage?.total ?? 0) > 0) {
    throw new AppError('No puedes eliminar este curso porque tiene matrículas asociadas.', 409)
  }
}

const ensureCourseUpdateIsSafe = async ({
  db,
  tenantId,
  courseId,
  academicYearId,
  gradeId,
  capacity,
}: {
  db: AppContextVariables['db']
  tenantId: string
  courseId: string
  academicYearId: string
  gradeId: string
  capacity: number
}) => {
  const [currentCourse] = await db
    .select({
      id: groups.id,
      academicYearId: groups.academicYearId,
      gradeId: groups.gradeId,
    })
    .from(groups)
    .where(and(eq(groups.id, courseId), eq(groups.tenantId, tenantId), eq(groups.isDeleted, false)))
    .limit(1)

  if (!currentCourse) throw new AppError('Curso no encontrado', 404)

  const [[admissionsUsage], [enrollmentsUsage]] = await Promise.all([
    db
      .select({ total: count() })
      .from(admissionApplications)
      .where(
        and(
          eq(admissionApplications.tenantId, tenantId),
          eq(admissionApplications.requestedGroupId, courseId),
          eq(admissionApplications.isDeleted, false),
        ),
      ),
    db
      .select({ total: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.groupId, courseId),
          eq(enrollments.isDeleted, false),
          ne(enrollments.enrollmentStatus, 'cancelled'),
        ),
      ),
  ])

  const hasUsage = (admissionsUsage?.total ?? 0) > 0 || (enrollmentsUsage?.total ?? 0) > 0

  if (hasUsage && currentCourse.academicYearId !== academicYearId) {
    throw new AppError('No puedes mover un curso en uso a otro año lectivo.', 409)
  }

  if (hasUsage && currentCourse.gradeId !== gradeId) {
    throw new AppError('No puedes cambiar el grado de un curso que ya tiene uso operativo.', 409)
  }

  if ((enrollmentsUsage?.total ?? 0) > capacity) {
    throw new AppError('La nueva capacidad no puede quedar por debajo de las matrículas activas o pendientes del curso.', 409)
  }
}

academicRoutes.get('/years', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')
  const offset = (filters.page - 1) * filters.pageSize
  const searchFilter = filters.query ? ilike(academicYears.name, `%${filters.query}%`) : undefined
  const whereClause = and(eq(academicYears.tenantId, tenantId), eq(academicYears.isDeleted, false), searchFilter)

  const items = await db
    .select()
    .from(academicYears)
    .where(whereClause)
    .orderBy(desc(academicYears.year), asc(academicYears.name))
    .limit(filters.pageSize)
    .offset(offset)
  const [totalRow] = await db.select({ total: count() }).from(academicYears).where(whereClause)

  return c.json(ok('Años lectivos cargados', {
    items: items.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      name: item.name,
      year: item.year,
      startsOn: item.startsOn,
      endsOn: item.endsOn,
      status: resolveAcademicYearStatus({
        startsOn: item.startsOn,
        endsOn: item.endsOn,
        isActive: item.isActive,
      }),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }))
})

academicRoutes.post('/years', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicYearSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  validateDateWindow(payload.startsOn, payload.endsOn, 'el año lectivo')
  if (payload.status === 'activo') {
    throw new AppError('Crea primero el año lectivo como planeado, configura periodos que sumen 100 y luego actívalo.', 409)
  }
  const [item] = await db.insert(academicYears).values({
    tenantId,
    name: payload.name,
    year: payload.year,
    startsOn: payload.startsOn,
    endsOn: payload.endsOn,
    isActive: false,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()
  if (!item) throw new AppError('No fue posible crear el año lectivo', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_years', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Año lectivo creado', { id: item.id }), 201)
})

academicRoutes.put('/years/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicYearSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')
  validateDateWindow(payload.startsOn, payload.endsOn, 'el año lectivo')
  await ensureAcademicYearUpdateIsSafe({
    db,
    tenantId,
    academicYearId: id,
    year: payload.year,
    startsOn: payload.startsOn,
    endsOn: payload.endsOn,
  })
  if (payload.status === 'activo') {
    await ensureAcademicYearWeightsAreComplete({
      db,
      tenantId,
      academicYearId: id,
    })
  }
  if (payload.status === 'activo') {
    await db
      .update(academicYears)
      .set({ isActive: false, updatedAt: new Date(), updatedBy: user.id })
      .where(
        and(
          eq(academicYears.tenantId, tenantId),
          eq(academicYears.isDeleted, false),
          ne(academicYears.id, id),
        ),
      )
  }
  const [item] = await db.update(academicYears).set({
    name: payload.name,
    year: payload.year,
    startsOn: payload.startsOn,
    endsOn: payload.endsOn,
    isActive: payload.status === 'activo',
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(and(eq(academicYears.id, id), eq(academicYears.tenantId, tenantId), eq(academicYears.isDeleted, false))).returning()
  if (!item) throw new AppError('Año lectivo no encontrado', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_years', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Año lectivo actualizado', { id }))
})

academicRoutes.delete('/years/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  await ensureAcademicYearDeletable(db, tenantId, id)
  await db.update(academicYears).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(academicYears.id, id), eq(academicYears.tenantId, tenantId)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_years', entityId: id, action: 'delete' })
  return c.json(ok('Año lectivo eliminado', { id }))
})

academicRoutes.get('/periods', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')
  const offset = (filters.page - 1) * filters.pageSize
  const searchFilter = filters.query ? or(ilike(academicPeriods.name, `%${filters.query}%`), ilike(academicPeriods.code, `%${filters.query}%`)) : undefined
  const whereClause = and(eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.isDeleted, false), searchFilter)
  const items = await db
    .select({ period: academicPeriods, yearName: academicYears.name })
    .from(academicPeriods)
    .leftJoin(academicYears, and(eq(academicYears.id, academicPeriods.academicYearId), eq(academicYears.tenantId, tenantId)))
    .where(whereClause)
    .orderBy(desc(academicPeriods.createdAt), asc(academicPeriods.code))
    .limit(filters.pageSize)
    .offset(offset)
  const [totalRow] = await db.select({ total: count() }).from(academicPeriods).where(whereClause)
  return c.json(ok('Periodos cargados', {
    items: items.map(({ period, yearName }) => ({
      id: period.id,
      tenantId: period.tenantId,
      academicYearId: period.academicYearId,
      academicYearName: yearName ?? '',
      name: period.name,
      code: period.code,
      startsOn: period.startsOn,
      endsOn: period.endsOn,
      weight: period.weight,
      status: period.status,
      createdAt: period.createdAt.toISOString(),
      updatedAt: period.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }))
})

academicRoutes.post('/periods', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicPeriodSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  validateDateWindow(payload.startsOn, payload.endsOn, 'el periodo')
  const [academicYear] = await db
    .select({ startsOn: academicYears.startsOn, endsOn: academicYears.endsOn })
    .from(academicYears)
    .where(
      and(
        eq(academicYears.id, payload.academicYearId),
        eq(academicYears.tenantId, tenantId),
        eq(academicYears.isDeleted, false),
      ),
    )
    .limit(1)
  if (!academicYear) throw new AppError('Año lectivo no encontrado para el periodo', 404)
  if (payload.startsOn < academicYear.startsOn || payload.endsOn > academicYear.endsOn) {
    throw new AppError('El periodo debe quedar dentro del rango del año lectivo seleccionado', 409)
  }
  await validateAcademicPeriodWeight({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    weight: payload.weight,
  })
  const [item] = await db.insert(academicPeriods).values({ tenantId, ...payload, createdBy: user.id, updatedBy: user.id }).returning()
  if (!item) throw new AppError('No fue posible crear el periodo', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_periods', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Periodo creado', { id: item.id }), 201)
})

academicRoutes.put('/periods/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicPeriodSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')
  validateDateWindow(payload.startsOn, payload.endsOn, 'el periodo')
  const [currentPeriod] = await db
    .select({ status: academicPeriods.status, academicYearId: academicPeriods.academicYearId })
    .from(academicPeriods)
    .where(and(eq(academicPeriods.id, id), eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.isDeleted, false)))
    .limit(1)
  if (!currentPeriod) throw new AppError('Periodo no encontrado', 404)
  if (currentPeriod.status === 'published' || currentPeriod.status === 'closed') {
    throw new AppError('No puedes editar un periodo publicado o cerrado. Reábrelo primero si necesitas ajustar la configuración.', 409)
  }
  const [academicYear] = await db
    .select({ startsOn: academicYears.startsOn, endsOn: academicYears.endsOn })
    .from(academicYears)
    .where(
      and(
        eq(academicYears.id, payload.academicYearId),
        eq(academicYears.tenantId, tenantId),
        eq(academicYears.isDeleted, false),
      ),
    )
    .limit(1)
  if (!academicYear) throw new AppError('Año lectivo no encontrado para el periodo', 404)
  if (payload.startsOn < academicYear.startsOn || payload.endsOn > academicYear.endsOn) {
    throw new AppError('El periodo debe quedar dentro del rango del año lectivo seleccionado', 409)
  }
  await validateAcademicPeriodWeight({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    weight: payload.weight,
    periodId: id,
  })
  const [item] = await db.update(academicPeriods).set({ ...payload, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(academicPeriods.id, id), eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.isDeleted, false))).returning()
  if (!item) throw new AppError('Periodo no encontrado', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_periods', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Periodo actualizado', { id }))
})

academicRoutes.patch('/periods/:id/status', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicPeriodStatusSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [period] = await db
    .select({
      id: academicPeriods.id,
      academicYearId: academicPeriods.academicYearId,
      status: academicPeriods.status,
      name: academicPeriods.name,
    })
    .from(academicPeriods)
    .where(and(eq(academicPeriods.id, id), eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.isDeleted, false)))
    .limit(1)

  if (!period) throw new AppError('Periodo no encontrado', 404)
  if (period.status === payload.status) {
    throw new AppError('El periodo ya tiene ese estado.', 409)
  }

  const allowedTransitions: Record<string, string[]> = {
    open: ['published'],
    published: ['open', 'closed'],
    closed: ['open'],
  }

  if (!(allowedTransitions[period.status] ?? []).includes(payload.status)) {
    throw new AppError('La transición de estado solicitada no está permitida para este periodo.', 409)
  }

  let recalculatedGradeRecords = 0
  if (payload.status === 'published') {
    const combinations = await db
      .select({
        groupId: evaluationActivities.groupId,
        subjectId: evaluationActivities.subjectId,
      })
      .from(evaluationActivities)
      .where(and(
        eq(evaluationActivities.tenantId, tenantId),
        eq(evaluationActivities.academicYearId, period.academicYearId),
        eq(evaluationActivities.academicPeriodId, id),
        eq(evaluationActivities.isDeleted, false),
      ))

    const uniqueCombinations = new Map<string, { groupId: string; subjectId: string }>()
    for (const combination of combinations) {
      uniqueCombinations.set(`${combination.groupId}:${combination.subjectId}`, combination)
    }

    for (const combination of uniqueCombinations.values()) {
      recalculatedGradeRecords += await calculateAndPersistPeriodGrades({
        db,
        tenantId,
        userId: user.id,
        academicYearId: period.academicYearId,
        academicPeriodId: id,
        groupId: combination.groupId,
        subjectId: combination.subjectId,
      })
    }
  }

  const [updated] = await db
    .update(academicPeriods)
    .set({
      status: payload.status,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(and(eq(academicPeriods.id, id), eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.isDeleted, false)))
    .returning({ id: academicPeriods.id, status: academicPeriods.status, academicYearId: academicPeriods.academicYearId })

  if (!updated) throw new AppError('No fue posible actualizar el estado del periodo.', 500)

  const summary = await collectAcademicPeriodSummary({
    db,
    tenantId,
    academicYearId: updated.academicYearId,
    academicPeriodId: updated.id,
  })

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'academic_periods',
    entityId: id,
    action: 'status_update',
    changes: {
      from: period.status,
      to: payload.status,
      recalculatedGradeRecords,
      summary,
    },
  })

  return c.json(ok('Estado del periodo actualizado', {
    id: updated.id,
    status: updated.status,
    summary,
    recalculatedGradeRecords,
  }))
})

academicRoutes.delete('/periods/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const [period] = await db
    .select({ status: academicPeriods.status })
    .from(academicPeriods)
    .where(and(eq(academicPeriods.id, id), eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.isDeleted, false)))
    .limit(1)
  if (!period) throw new AppError('Periodo no encontrado', 404)
  if (period.status === 'published' || period.status === 'closed') {
    throw new AppError('No puedes eliminar un periodo publicado o cerrado.', 409)
  }
  await db.update(academicPeriods).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(academicPeriods.id, id), eq(academicPeriods.tenantId, tenantId)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_periods', entityId: id, action: 'delete' })
  return c.json(ok('Periodo eliminado', { id }))
})

academicRoutes.get('/grades', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')
  const offset = (filters.page - 1) * filters.pageSize
  const searchFilter = filters.query ? ilike(grades.name, `%${filters.query}%`) : undefined
  const whereClause = and(eq(grades.tenantId, tenantId), eq(grades.isDeleted, false), searchFilter)
  const items = await db.select().from(grades).where(whereClause).orderBy(asc(grades.orderNumber), asc(grades.level), asc(grades.name)).limit(filters.pageSize).offset(offset)
  const [totalRow] = await db.select({ total: count() }).from(grades).where(whereClause)
  return c.json(ok('Grados cargados', {
    items: items.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      name: item.name,
      level: item.level,
      levelName: item.levelName ?? null,
      orderNumber: item.orderNumber ?? 0,
      status: 'activo',
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }))
})

academicRoutes.post('/grades', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicGradeSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  const [item] = await db.insert(grades).values({
    tenantId,
    name: payload.name,
    level: payload.level,
    levelName: payload.levelName || null,
    orderNumber: payload.orderNumber ?? 0,
    createdBy: user.id,
    updatedBy: user.id
  }).returning()
  if (!item) throw new AppError('No fue posible crear el grado', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grades', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Grado creado', { id: item.id }), 201)
})

academicRoutes.put('/grades/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicGradeSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')
  const [item] = await db.update(grades).set({
    name: payload.name,
    level: payload.level,
    levelName: payload.levelName || null,
    orderNumber: payload.orderNumber ?? 0,
    updatedAt: new Date(),
    updatedBy: user.id
  }).where(and(eq(grades.id, id), eq(grades.tenantId, tenantId), eq(grades.isDeleted, false))).returning()
  if (!item) throw new AppError('Grado no encontrado', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grades', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Grado actualizado', { id }))
})

academicRoutes.delete('/grades/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  await ensureGradeDeletable(db, tenantId, id)
  await db.update(grades).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(grades.id, id), eq(grades.tenantId, tenantId)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grades', entityId: id, action: 'delete' })
  return c.json(ok('Grado eliminado', { id }))
})

academicRoutes.get('/year-levels', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', paginationSchema.extend({
  academicYearId: z.string().uuid().optional().or(z.literal('')).or(z.null()),
  journeyId: z.string().uuid().optional().or(z.literal('')).or(z.null()),
})), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')
  const offset = (filters.page - 1) * filters.pageSize
  const whereClause = and(
    eq(academicYearLevels.tenantId, tenantId),
    eq(academicYearLevels.isDeleted, false),
    filters.query ? ilike(academicYearLevels.name, `%${filters.query}%`) : undefined,
    filters.academicYearId ? eq(academicYearLevels.academicYearId, filters.academicYearId) : undefined,
    filters.journeyId ? eq(academicYearLevels.journeyId, filters.journeyId) : undefined,
  )

  const items = await db
    .select({
      id: academicYearLevels.id,
      tenantId: academicYearLevels.tenantId,
      academicYearId: academicYearLevels.academicYearId,
      academicYearName: academicYears.name,
      journeyId: academicYearLevels.journeyId,
      journeyName: academicYearJourneys.name,
      levelCode: academicYearLevels.levelCode,
      name: academicYearLevels.name,
      orderNumber: academicYearLevels.orderNumber,
      isActive: academicYearLevels.isActive,
      createdAt: academicYearLevels.createdAt,
      updatedAt: academicYearLevels.updatedAt,
    })
    .from(academicYearLevels)
    .innerJoin(academicYears, eq(academicYears.id, academicYearLevels.academicYearId))
    .leftJoin(academicYearJourneys, eq(academicYearJourneys.id, academicYearLevels.journeyId))
    .where(whereClause)
    .orderBy(asc(academicYears.year), asc(academicYearLevels.orderNumber), asc(academicYearLevels.name))
    .limit(filters.pageSize)
    .offset(offset)

  const [totalRow] = await db.select({ total: count() }).from(academicYearLevels).where(whereClause)
  return c.json(ok('Niveles educativos cargados', {
    items: items.map((item) => ({
      ...item,
      journeyId: item.journeyId ?? null,
      journeyName: item.journeyName ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }))
})

academicRoutes.post('/year-levels', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicYearLevelSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  if (payload.journeyId) {
    const [journey] = await db
      .select({ id: academicYearJourneys.id })
      .from(academicYearJourneys)
      .where(and(
        eq(academicYearJourneys.tenantId, tenantId),
        eq(academicYearJourneys.id, payload.journeyId),
        eq(academicYearJourneys.academicYearId, payload.academicYearId),
        eq(academicYearJourneys.isDeleted, false),
      ))
      .limit(1)
    if (!journey) throw new AppError('La jornada seleccionada no pertenece al año lectivo indicado.', 409)
  }

  const [item] = await db.insert(academicYearLevels).values({
    tenantId,
    academicYearId: payload.academicYearId,
    journeyId: payload.journeyId || null,
    levelCode: payload.levelCode,
    name: payload.name,
    orderNumber: payload.orderNumber ?? 0,
    isActive: payload.isActive ?? true,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()
  if (!item) throw new AppError('No fue posible crear el nivel educativo', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_year_levels', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Nivel educativo creado', { id: item.id }), 201)
})

academicRoutes.put('/year-levels/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicYearLevelSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  if (payload.journeyId) {
    const [journey] = await db
      .select({ id: academicYearJourneys.id })
      .from(academicYearJourneys)
      .where(and(
        eq(academicYearJourneys.tenantId, tenantId),
        eq(academicYearJourneys.id, payload.journeyId),
        eq(academicYearJourneys.academicYearId, payload.academicYearId),
        eq(academicYearJourneys.isDeleted, false),
      ))
      .limit(1)
    if (!journey) throw new AppError('La jornada seleccionada no pertenece al año lectivo indicado.', 409)
  }

  const [item] = await db.update(academicYearLevels).set({
    academicYearId: payload.academicYearId,
    journeyId: payload.journeyId || null,
    levelCode: payload.levelCode,
    name: payload.name,
    orderNumber: payload.orderNumber ?? 0,
    isActive: payload.isActive ?? true,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(and(eq(academicYearLevels.id, id), eq(academicYearLevels.tenantId, tenantId), eq(academicYearLevels.isDeleted, false))).returning()
  if (!item) throw new AppError('Nivel educativo no encontrado', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_year_levels', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Nivel educativo actualizado', { id }))
})

academicRoutes.delete('/year-levels/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  await db.update(academicYearLevels).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(academicYearLevels.id, id), eq(academicYearLevels.tenantId, tenantId), eq(academicYearLevels.isDeleted, false)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_year_levels', entityId: id, action: 'delete' })
  return c.json(ok('Nivel educativo eliminado', { id }))
})

academicRoutes.get('/courses', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const filters = c.req.valid('query')
  const offset = (filters.page - 1) * filters.pageSize
  const searchFilter = filters.query ? ilike(groups.name, `%${filters.query}%`) : undefined

  let teacherFilter
  if (user && user.roleCodes && user.roleCodes.includes('teacher')) {
    const teacherRecord = await db.query.teachers.findFirst({
      where: and(eq(teachers.tenantId, tenantId), eq(teachers.userId, user.id), eq(teachers.isDeleted, false))
    })
    if (teacherRecord) {
      const assignments = await db
        .select({ groupId: courseSubjects.groupId })
        .from(courseSubjects)
        .where(and(
          eq(courseSubjects.tenantId, tenantId),
          eq(courseSubjects.teacherId, teacherRecord.id),
          eq(courseSubjects.isDeleted, false)
        ))
      const groupIds = assignments.map(a => a.groupId)
      if (groupIds.length > 0) {
        teacherFilter = inArray(groups.id, groupIds)
      } else {
        return c.json(ok('Cursos cargados', { items: [], total: 0, page: filters.page, pageSize: filters.pageSize }))
      }
    } else {
      return c.json(ok('Cursos cargados', { items: [], total: 0, page: filters.page, pageSize: filters.pageSize }))
    }
  }

  const whereClause = and(eq(groups.tenantId, tenantId), eq(groups.isDeleted, false), searchFilter, teacherFilter)
  const items = await db
    .select({ group: groups, year: academicYears, grade: grades, branchName: schoolBranches.name })
    .from(groups)
    .leftJoin(academicYears, and(eq(academicYears.id, groups.academicYearId), eq(academicYears.tenantId, tenantId)))
    .leftJoin(grades, and(eq(grades.id, groups.gradeId), eq(grades.tenantId, tenantId)))
    .leftJoin(schoolBranches, and(eq(schoolBranches.id, groups.branchId), eq(schoolBranches.tenantId, tenantId)))
    .where(whereClause)
    .orderBy(desc(groups.createdAt), asc(groups.name))
    .limit(filters.pageSize)
    .offset(offset)
  const [totalRow] = await db.select({ total: count() }).from(groups).where(whereClause)
  return c.json(ok('Cursos cargados', {
    items: items.map(({ group, year, grade, branchName }) => ({
      id: group.id,
      tenantId: group.tenantId,
      academicYearId: group.academicYearId ?? '',
      academicYearName: year?.name ?? '',
      gradeId: group.gradeId,
      gradeName: grade?.name ?? '',
      branchId: group.branchId,
      branchName: branchName ?? null,
      name: group.name,
      capacity: group.capacity,
      status: year?.endsOn && year.endsOn < todayIsoDate() ? 'cerrado' : 'activo',
      inheritedStartsOn: year?.startsOn ?? null,
      inheritedEndsOn: year?.endsOn ?? null,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }))
})

academicRoutes.post('/courses', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', courseSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  const [item] = await db.insert(groups).values({
    tenantId,
    academicYearId: payload.academicYearId,
    gradeId: payload.gradeId,
    branchId: payload.branchId || null,
    name: payload.name,
    capacity: payload.capacity,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()
  if (!item) throw new AppError('No fue posible crear el curso', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'groups', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Curso creado', { id: item.id }), 201)
})

academicRoutes.put('/courses/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', courseSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')
  await ensureCourseUpdateIsSafe({
    db,
    tenantId,
    courseId: id,
    academicYearId: payload.academicYearId,
    gradeId: payload.gradeId,
    capacity: payload.capacity,
  })
  const [item] = await db.update(groups).set({
    academicYearId: payload.academicYearId,
    gradeId: payload.gradeId,
    branchId: payload.branchId || null,
    name: payload.name,
    capacity: payload.capacity,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(and(eq(groups.id, id), eq(groups.tenantId, tenantId), eq(groups.isDeleted, false))).returning()
  if (!item) throw new AppError('Curso no encontrado', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'groups', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Curso actualizado', { id }))
})

academicRoutes.delete('/courses/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  await ensureCourseDeletable(db, tenantId, id)
  await db.update(groups).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(groups.id, id), eq(groups.tenantId, tenantId)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'groups', entityId: id, action: 'delete' })
  return c.json(ok('Curso eliminado', { id }))
})

const readPaginationFilters = (c: any) => {
  const query = c.req.query('query') ?? ''
  const page = Math.max(Number(c.req.query('page') ?? '1') || 1, 1)
  const pageSize = Math.min(Math.max(Number(c.req.query('pageSize') ?? '10') || 10, 1), 100)
  return { query, page, pageSize, offset: (page - 1) * pageSize }
}

const ensureSubjectDeletable = async (db: AppContextVariables['db'], tenantId: string, subjectId: string) => {
  const [[gradeUsage], [achievementUsage], [recordUsage]] = await Promise.all([
    db.select({ total: count() }).from(gradeSubjects).where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.subjectId, subjectId), eq(gradeSubjects.isDeleted, false))),
    db.select({ total: count() }).from(learningAchievements).where(and(eq(learningAchievements.tenantId, tenantId), eq(learningAchievements.subjectId, subjectId), eq(learningAchievements.isDeleted, false))),
    db.select({ total: count() }).from(gradeRecords).where(and(eq(gradeRecords.tenantId, tenantId), eq(gradeRecords.subjectId, subjectId), eq(gradeRecords.isDeleted, false))),
  ])

  if ((gradeUsage?.total ?? 0) > 0) throw new AppError('No puedes eliminar esta materia porque ya está asignada a grados.', 409)
  if ((achievementUsage?.total ?? 0) > 0) throw new AppError('No puedes eliminar esta materia porque tiene logros asociados.', 409)
  if ((recordUsage?.total ?? 0) > 0) throw new AppError('No puedes eliminar esta materia porque tiene notas registradas.', 409)
}

const ensureGradeSubjectPlacement = async ({
  db,
  tenantId,
  academicYearId,
  gradeId,
  subjectId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  gradeId: string
  subjectId: string
}) => {
  const [grade] = await db
    .select({ id: grades.id })
    .from(grades)
    .where(and(eq(grades.id, gradeId), eq(grades.tenantId, tenantId), eq(grades.isDeleted, false)))
    .limit(1)
  if (!grade) throw new AppError('El grado seleccionado no existe.', 404)

  const [subject] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.tenantId, tenantId), eq(subjects.isDeleted, false)))
    .limit(1)
  if (!subject) throw new AppError('La materia seleccionada no existe.', 404)

  const [academicYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.id, academicYearId), eq(academicYears.tenantId, tenantId), eq(academicYears.isDeleted, false)))
    .limit(1)
  if (!academicYear) throw new AppError('El año lectivo seleccionado no existe.', 404)
}

const ensureTeacherExists = async (db: AppContextVariables['db'], tenantId: string, teacherId: string) => {
  const [teacher] = await db
    .select({ id: teachers.id, maxWeeklyHours: teachers.maxWeeklyHours, fullName: teachers.fullName })
    .from(teachers)
    .where(and(eq(teachers.id, teacherId), eq(teachers.tenantId, tenantId), eq(teachers.isDeleted, false), eq(teachers.status, 'active')))
    .limit(1)
  if (!teacher) throw new AppError('Docente no encontrado o inactivo.', 404)
  return teacher
}

const ensureCourseSubjectPlacement = async ({
  db,
  tenantId,
  academicYearId,
  groupId,
  subjectId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  groupId: string
  subjectId: string
}) => {
  const [group] = await db
    .select({ id: groups.id, academicYearId: groups.academicYearId, gradeId: groups.gradeId })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.tenantId, tenantId), eq(groups.isDeleted, false)))
    .limit(1)
  if (!group) throw new AppError('El curso seleccionado no existe.', 404)
  if (group.academicYearId !== academicYearId) throw new AppError('El curso seleccionado no pertenece al año lectivo indicado.', 409)

  const [assignment] = await db
    .select({ id: gradeSubjects.id })
    .from(gradeSubjects)
    .where(and(
      eq(gradeSubjects.tenantId, tenantId),
      eq(gradeSubjects.academicYearId, academicYearId),
      eq(gradeSubjects.gradeId, group.gradeId),
      eq(gradeSubjects.subjectId, subjectId),
      eq(gradeSubjects.isDeleted, false),
    ))
    .limit(1)
  if (!assignment) {
    throw new AppError('La materia no está asignada a la malla del grado de este curso.', 409)
  }

  return group
}

const getTeacherAssignedHours = async ({
  db,
  tenantId,
  academicYearId,
  teacherId,
  excludeCourseSubjectId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  teacherId: string
  excludeCourseSubjectId?: string
}) => {
  const rows = await db
    .select({ weeklyHours: courseSubjects.weeklyHours, id: courseSubjects.id })
    .from(courseSubjects)
    .where(and(
      eq(courseSubjects.tenantId, tenantId),
      eq(courseSubjects.academicYearId, academicYearId),
      eq(courseSubjects.teacherId, teacherId),
      eq(courseSubjects.isDeleted, false),
      excludeCourseSubjectId ? ne(courseSubjects.id, excludeCourseSubjectId) : undefined,
    ))
  return rows.reduce((acc, row) => acc + (row.weeklyHours ?? 0), 0)
}

const ensureTeacherWorkloadWithinLimit = async ({
  db,
  tenantId,
  academicYearId,
  teacherId,
  weeklyHours,
  excludeCourseSubjectId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  teacherId: string
  weeklyHours: number
  excludeCourseSubjectId?: string
}) => {
  const teacher = await ensureTeacherExists(db, tenantId, teacherId)
  const totalHours = await getTeacherAssignedHours({ db, tenantId, academicYearId, teacherId, excludeCourseSubjectId })

  if (totalHours + weeklyHours > teacher.maxWeeklyHours) {
    throw new AppError(`El docente supera el límite semanal permitido de ${teacher.maxWeeklyHours} horas. Ya tiene ${totalHours}h asignadas y estás intentando sumar ${weeklyHours}h.`, 400)
  }
}

const ensureTeacherDeletable = async (db: AppContextVariables['db'], tenantId: string, teacherId: string) => {
  const [[courseAssignmentUsage], [responsibilityUsage], [activityUsage], [strategyUsage]] = await Promise.all([
    db.select({ total: count() }).from(courseSubjects).where(and(eq(courseSubjects.tenantId, tenantId), eq(courseSubjects.teacherId, teacherId), eq(courseSubjects.isDeleted, false))),
    db.select({ total: count() }).from(teacherResponsibilities).where(and(eq(teacherResponsibilities.tenantId, tenantId), eq(teacherResponsibilities.teacherId, teacherId), eq(teacherResponsibilities.isDeleted, false))),
    db.select({ total: count() }).from(evaluationActivities).where(and(eq(evaluationActivities.tenantId, tenantId), eq(evaluationActivities.teacherId, teacherId), eq(evaluationActivities.isDeleted, false))),
    db.select({ total: count() }).from(supportStrategies).where(and(eq(supportStrategies.tenantId, tenantId), eq(supportStrategies.teacherId, teacherId), eq(supportStrategies.isDeleted, false))),
  ])

  if ((courseAssignmentUsage?.total ?? 0) > 0) throw new AppError('No se puede eliminar el docente porque tiene asignaciones académicas activas.', 409)
  if ((responsibilityUsage?.total ?? 0) > 0) throw new AppError('No se puede eliminar el docente porque tiene responsabilidades institucionales activas.', 409)
  if ((activityUsage?.total ?? 0) > 0) throw new AppError('No se puede eliminar el docente porque tiene actividades evaluativas asociadas.', 409)
  if ((strategyUsage?.total ?? 0) > 0) throw new AppError('No se puede eliminar el docente porque tiene estrategias de apoyo asociadas.', 409)
}

const ensureTeacherUserLinkIsValid = async ({
  db,
  tenantId,
  userId,
  teacherIdToExclude,
}: {
  db: AppContextVariables['db']
  tenantId: string
  userId?: string | null
  teacherIdToExclude?: string
}) => {
  if (!userId) return

  const [userRecord] = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId), eq(users.isDeleted, false)))
    .limit(1)
  if (!userRecord) throw new AppError('El usuario seleccionado no existe.', 404)
  if (userRecord.status !== 'active') throw new AppError('El usuario seleccionado está inactivo.', 409)

  const [linkedTeacher] = await db
    .select({ id: teachers.id })
    .from(teachers)
    .where(and(
      eq(teachers.tenantId, tenantId),
      eq(teachers.userId, userId),
      eq(teachers.isDeleted, false),
      teacherIdToExclude ? ne(teachers.id, teacherIdToExclude) : undefined,
    ))
    .limit(1)
  if (linkedTeacher) throw new AppError('Ese usuario ya está vinculado a otro docente.', 409)
}

const ensureTeacherResponsibilityPlacement = async ({
  db,
  tenantId,
  academicYearId,
  teacherId,
  responsibilityType,
  scopeType,
  branchId,
  levelName,
  gradeId,
  groupId,
  title,
  responsibilityIdToExclude,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  teacherId: string
  responsibilityType: 'group_director' | 'coordinator'
  scopeType?: 'global' | 'branch' | 'level' | 'grade' | 'group'
  branchId?: string | null
  levelName?: string | null
  gradeId?: string | null
  groupId?: string | null
  title?: string | null
  responsibilityIdToExclude?: string
}) => {
  await ensureTeacherExists(db, tenantId, teacherId)

  const [academicYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.id, academicYearId), eq(academicYears.tenantId, tenantId), eq(academicYears.isDeleted, false)))
    .limit(1)
  if (!academicYear) throw new AppError('El año lectivo seleccionado no existe.', 404)

  if (responsibilityType === 'group_director') {
    if (!groupId) throw new AppError('Debes seleccionar un curso para asignar un director de grupo.', 400)

    const [group] = await db
      .select({ id: groups.id, academicYearId: groups.academicYearId })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.tenantId, tenantId), eq(groups.isDeleted, false)))
      .limit(1)
    if (!group) throw new AppError('El curso seleccionado no existe.', 404)
    if (group.academicYearId !== academicYearId) throw new AppError('El curso no pertenece al año lectivo seleccionado.', 409)

    const [existingDirector] = await db
      .select({ id: teacherResponsibilities.id })
      .from(teacherResponsibilities)
      .where(and(
        eq(teacherResponsibilities.tenantId, tenantId),
        eq(teacherResponsibilities.academicYearId, academicYearId),
        eq(teacherResponsibilities.responsibilityType, 'group_director'),
        eq(teacherResponsibilities.groupId, groupId),
        eq(teacherResponsibilities.isDeleted, false),
        responsibilityIdToExclude ? ne(teacherResponsibilities.id, responsibilityIdToExclude) : undefined,
      ))
      .limit(1)
    if (existingDirector) throw new AppError('Ese curso ya tiene un director de grupo asignado.', 409)
  }

  if (responsibilityType === 'coordinator') {
    if (!title?.trim()) {
      throw new AppError('Debes indicar el cargo o alcance de la coordinación.', 400)
    }
    if (scopeType === 'level' && !levelName) {
      throw new AppError('Debes seleccionar el nivel de la coordinación.', 400)
    }
    if (scopeType === 'grade' && !gradeId) {
      throw new AppError('Debes seleccionar el grado de la coordinación.', 400)
    }
    if (scopeType === 'group') {
      throw new AppError('La coordinación no usa alcance por curso. Usa director de grupo para ese caso.', 400)
    }
  }
}

const ensureGradingScaleAssignmentPlacement = async ({
  db,
  tenantId,
  academicYearId,
  gradingScaleId,
  scopeType,
  levelName,
  gradeId,
  assignmentIdToExclude,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  gradingScaleId: string
  scopeType: 'level' | 'grade'
  levelName?: string | null
  gradeId?: string | null
  assignmentIdToExclude?: string
}) => {
  const [scale] = await db
    .select({ id: gradingScales.id })
    .from(gradingScales)
    .where(and(eq(gradingScales.id, gradingScaleId), eq(gradingScales.tenantId, tenantId), eq(gradingScales.isDeleted, false)))
    .limit(1)
  if (!scale) throw new AppError('La escala seleccionada no existe.', 404)

  if (scopeType === 'level' && !levelName) {
    throw new AppError('Debes seleccionar el nivel académico.', 400)
  }

  if (scopeType === 'grade') {
    if (!gradeId) throw new AppError('Debes seleccionar el grado.', 400)
    const [grade] = await db
      .select({ id: grades.id, levelName: grades.levelName })
      .from(grades)
      .where(and(eq(grades.id, gradeId), eq(grades.tenantId, tenantId), eq(grades.isDeleted, false)))
      .limit(1)
    if (!grade) throw new AppError('El grado seleccionado no existe.', 404)
  }

  const [existing] = await db
    .select({ id: gradingScaleAssignments.id })
    .from(gradingScaleAssignments)
    .where(and(
      eq(gradingScaleAssignments.tenantId, tenantId),
      eq(gradingScaleAssignments.academicYearId, academicYearId),
      eq(gradingScaleAssignments.scopeType, scopeType),
      scopeType === 'level'
        ? eq(gradingScaleAssignments.levelName, levelName || '')
        : isNull(gradingScaleAssignments.levelName),
      scopeType === 'grade'
        ? eq(gradingScaleAssignments.gradeId, gradeId || '')
        : isNull(gradingScaleAssignments.gradeId),
      eq(gradingScaleAssignments.isDeleted, false),
      assignmentIdToExclude ? ne(gradingScaleAssignments.id, assignmentIdToExclude) : undefined,
    ))
    .limit(1)

  if (existing) {
    throw new AppError('Ya existe una asignación de escala para ese alcance en el año lectivo seleccionado.', 409)
  }
}

const ensureAcademicYearJourneyPlacement = async ({
  db,
  tenantId,
  academicYearId,
  branchId,
  targetLevelName,
  targetGradeId,
  code,
  startsAt,
  endsAt,
  journeyIdToExclude,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  branchId?: string | null
  targetLevelName?: string | null
  targetGradeId?: string | null
  code: string
  startsAt: string
  endsAt: string
  journeyIdToExclude?: string
}) => {
  if (compareClockTime(startsAt, endsAt) >= 0) {
    throw new AppError('La hora inicial de la jornada debe ser menor a la hora final.', 400)
  }

  const [academicYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.id, academicYearId), eq(academicYears.tenantId, tenantId), eq(academicYears.isDeleted, false)))
    .limit(1)
  if (!academicYear) throw new AppError('El año lectivo seleccionado no existe.', 404)

  if (branchId) {
    const [branch] = await db
      .select({ id: schoolBranches.id })
      .from(schoolBranches)
      .where(and(eq(schoolBranches.id, branchId), eq(schoolBranches.tenantId, tenantId), eq(schoolBranches.isDeleted, false)))
      .limit(1)
    if (!branch) throw new AppError('La sede seleccionada no existe.', 404)
  }

  if (targetGradeId) {
    const [grade] = await db
      .select({ id: grades.id, levelName: grades.levelName })
      .from(grades)
      .where(and(eq(grades.id, targetGradeId), eq(grades.tenantId, tenantId), eq(grades.isDeleted, false)))
      .limit(1)
    if (!grade) throw new AppError('El grado objetivo de la jornada no existe.', 404)
    if (targetLevelName && grade.levelName !== targetLevelName) {
      throw new AppError('El grado objetivo no coincide con el nivel seleccionado para la jornada.', 409)
    }
  }

  const [existingJourney] = await db
    .select({ id: academicYearJourneys.id })
    .from(academicYearJourneys)
    .where(and(
      eq(academicYearJourneys.tenantId, tenantId),
      eq(academicYearJourneys.academicYearId, academicYearId),
      branchId ? eq(academicYearJourneys.branchId, branchId) : isNull(academicYearJourneys.branchId),
      eq(academicYearJourneys.code, code.trim()),
      eq(academicYearJourneys.isDeleted, false),
      journeyIdToExclude ? ne(academicYearJourneys.id, journeyIdToExclude) : undefined,
    ))
    .limit(1)
  if (existingJourney) throw new AppError('Ya existe una jornada con ese código en el mismo año lectivo y sede.', 409)
}

const ensureJourneySlotPlacement = async ({
  db,
  tenantId,
  journeyId,
  dayOfWeek,
  slotOrder,
  startsAt,
  endsAt,
  journeySlotIdToExclude,
}: {
  db: AppContextVariables['db']
  tenantId: string
  journeyId: string
  dayOfWeek: Weekday
  slotOrder: number
  startsAt: string
  endsAt: string
  journeySlotIdToExclude?: string
}) => {
  if (compareClockTime(startsAt, endsAt) >= 0) {
    throw new AppError('La hora inicial de la franja debe ser menor a la hora final.', 400)
  }

  const [journey] = await db
    .select({ id: academicYearJourneys.id })
    .from(academicYearJourneys)
    .where(and(eq(academicYearJourneys.id, journeyId), eq(academicYearJourneys.tenantId, tenantId), eq(academicYearJourneys.isDeleted, false)))
    .limit(1)
  if (!journey) throw new AppError('La jornada seleccionada no existe.', 404)

  const [existingSlot] = await db
    .select({ id: academicYearJourneySlots.id })
    .from(academicYearJourneySlots)
    .where(and(
      eq(academicYearJourneySlots.tenantId, tenantId),
      eq(academicYearJourneySlots.journeyId, journeyId),
      eq(academicYearJourneySlots.dayOfWeek, dayOfWeek),
      eq(academicYearJourneySlots.slotOrder, slotOrder),
      eq(academicYearJourneySlots.isDeleted, false),
      journeySlotIdToExclude ? ne(academicYearJourneySlots.id, journeySlotIdToExclude) : undefined,
    ))
    .limit(1)
  if (existingSlot) throw new AppError('Ya existe una franja con ese orden para el mismo día en la jornada.', 409)
}

const ensureGroupJourneyOptionPlacement = async ({
  db,
  tenantId,
  academicYearId,
  groupId,
  journeyId,
  optionIdToExclude,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  groupId: string
  journeyId: string
  optionIdToExclude?: string
}) => {
  const [group] = await db
    .select({ id: groups.id, academicYearId: groups.academicYearId, gradeId: groups.gradeId, levelName: grades.levelName })
    .from(groups)
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .where(and(eq(groups.id, groupId), eq(groups.tenantId, tenantId), eq(groups.isDeleted, false)))
    .limit(1)
  if (!group) throw new AppError('El curso seleccionado no existe.', 404)
  if (group.academicYearId !== academicYearId) throw new AppError('El curso no pertenece al año lectivo seleccionado.', 409)

  const [journey] = await db
    .select({
      id: academicYearJourneys.id,
      academicYearId: academicYearJourneys.academicYearId,
      targetLevelName: academicYearJourneys.targetLevelName,
      targetGradeId: academicYearJourneys.targetGradeId,
    })
    .from(academicYearJourneys)
    .where(and(eq(academicYearJourneys.id, journeyId), eq(academicYearJourneys.tenantId, tenantId), eq(academicYearJourneys.isDeleted, false)))
    .limit(1)
  if (!journey) throw new AppError('La jornada seleccionada no existe.', 404)
  if (journey.academicYearId !== academicYearId) throw new AppError('La jornada no pertenece al año lectivo seleccionado.', 409)
  if (journey.targetLevelName && journey.targetLevelName !== group.levelName) {
    throw new AppError('La jornada seleccionada fue creada para otro nivel académico.', 409)
  }
  if (journey.targetGradeId && journey.targetGradeId !== group.gradeId) {
    throw new AppError('La jornada seleccionada fue creada para otro grado.', 409)
  }

  const [existingOption] = await db
    .select({ id: groupJourneyOptions.id })
    .from(groupJourneyOptions)
    .where(and(
      eq(groupJourneyOptions.tenantId, tenantId),
      eq(groupJourneyOptions.academicYearId, academicYearId),
      eq(groupJourneyOptions.groupId, groupId),
      eq(groupJourneyOptions.journeyId, journeyId),
      eq(groupJourneyOptions.isDeleted, false),
      optionIdToExclude ? ne(groupJourneyOptions.id, optionIdToExclude) : undefined,
    ))
    .limit(1)
  if (existingOption) throw new AppError('Ese curso ya tiene registrada esa jornada como opción.', 409)
}

const upsertPreferredJourneyOption = async ({
  db,
  tenantId,
  academicYearId,
  groupId,
  selectedOptionId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  groupId: string
  selectedOptionId: string
}) => {
  await db
    .update(groupJourneyOptions)
    .set({
      isPreferred: false,
      updatedAt: new Date(),
    })
    .where(and(
      eq(groupJourneyOptions.tenantId, tenantId),
      eq(groupJourneyOptions.academicYearId, academicYearId),
      eq(groupJourneyOptions.groupId, groupId),
      eq(groupJourneyOptions.isDeleted, false),
      ne(groupJourneyOptions.id, selectedOptionId),
    ))
}

const pickJourneyForGroup = <T extends { journeyId: string; journeyName?: string | null; priority: number; isPreferred: boolean }>(options: T[]) => {
  const sorted = [...options].sort((left, right) => {
    if (left.isPreferred !== right.isPreferred) return left.isPreferred ? -1 : 1
    return left.priority - right.priority
  })
  return sorted[0] ?? null
}

const generateGroupTimetable = async ({
  db,
  tenantId,
  academicYearId,
  group,
  options,
  existingTeacherSlotKeys,
  overwriteExisting,
  userId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  group: { id: string; name: string; gradeName: string | null }
  options: Array<{ journeyId: string; journeyName: string | null; priority: number; isPreferred: boolean }>
  existingTeacherSlotKeys: Set<string>
  overwriteExisting: boolean
  userId: string
}) => {
  const preferredOption = pickJourneyForGroup(options)
  if (!preferredOption) {
    return {
      generatedEntries: 0,
      journeyId: null,
      journeyName: null,
      conflicts: ['No hay jornadas configuradas para este curso.'],
      blocked: true,
    }
  }

  const slots = await db
    .select({
      id: academicYearJourneySlots.id,
      dayOfWeek: academicYearJourneySlots.dayOfWeek,
      slotOrder: academicYearJourneySlots.slotOrder,
      startsAt: academicYearJourneySlots.startsAt,
      endsAt: academicYearJourneySlots.endsAt,
      slotType: academicYearJourneySlots.slotType,
    })
    .from(academicYearJourneySlots)
    .where(and(
      eq(academicYearJourneySlots.tenantId, tenantId),
      eq(academicYearJourneySlots.journeyId, preferredOption.journeyId),
      eq(academicYearJourneySlots.isDeleted, false),
    ))
    .orderBy(asc(academicYearJourneySlots.dayOfWeek), asc(academicYearJourneySlots.slotOrder))

  const classSlots = slots
    .filter((slot) => slot.slotType === 'class')
    .sort((left, right) => {
      const leftDay = weekdayOrderMap.get(left.dayOfWeek as Weekday) ?? 99
      const rightDay = weekdayOrderMap.get(right.dayOfWeek as Weekday) ?? 99
      if (leftDay !== rightDay) return leftDay - rightDay
      return left.slotOrder - right.slotOrder
    })

  if (classSlots.length === 0) {
    return {
      generatedEntries: 0,
      journeyId: preferredOption.journeyId,
      journeyName: preferredOption.journeyName ?? null,
      conflicts: ['La jornada elegida no tiene franjas de clase configuradas.'],
      blocked: true,
    }
  }

  const assignments = await db
    .select({
      id: courseSubjects.id,
      subjectId: courseSubjects.subjectId,
      subjectName: subjects.name,
      weeklyHours: courseSubjects.weeklyHours,
      teacherId: courseSubjects.teacherId,
      teacherName: teachers.fullName,
    })
    .from(courseSubjects)
    .leftJoin(subjects, eq(subjects.id, courseSubjects.subjectId))
    .leftJoin(teachers, eq(teachers.id, courseSubjects.teacherId))
    .where(and(
      eq(courseSubjects.tenantId, tenantId),
      eq(courseSubjects.academicYearId, academicYearId),
      eq(courseSubjects.groupId, group.id),
      eq(courseSubjects.isDeleted, false),
    ))
    .orderBy(desc(courseSubjects.weeklyHours), asc(subjects.name))

  if (assignments.length === 0) {
    return {
      generatedEntries: 0,
      journeyId: preferredOption.journeyId,
      journeyName: preferredOption.journeyName ?? null,
      conflicts: ['El curso no tiene materias por curso configuradas todavía.'],
      blocked: true,
    }
  }

  const conflicts: string[] = []
  const missingTeachers = assignments.filter((assignment) => !assignment.teacherId)
  if (missingTeachers.length > 0) {
    conflicts.push(`Faltan docentes en: ${missingTeachers.map((assignment) => assignment.subjectName ?? 'Materia sin nombre').join(', ')}.`)
  }

  const requiredBlocks = assignments.reduce((acc, assignment) => acc + Math.max(assignment.weeklyHours ?? 0, 0), 0)
  if (requiredBlocks > classSlots.length) {
    conflicts.push(`La jornada ${preferredOption.journeyName ?? ''} solo tiene ${classSlots.length} bloques de clase y el curso requiere ${requiredBlocks}.`)
  }

  if (missingTeachers.length > 0 || requiredBlocks > classSlots.length) {
    return {
      generatedEntries: 0,
      journeyId: preferredOption.journeyId,
      journeyName: preferredOption.journeyName ?? null,
      conflicts,
      blocked: true,
    }
  }

  if (overwriteExisting) {
    await db
      .update(groupTimetableEntries)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(and(
        eq(groupTimetableEntries.tenantId, tenantId),
        eq(groupTimetableEntries.academicYearId, academicYearId),
        eq(groupTimetableEntries.groupId, group.id),
        eq(groupTimetableEntries.isDeleted, false),
      ))
  }

  const groupUsedKeys = new Set<string>()
  const teacherUsedKeys = new Set(existingTeacherSlotKeys)
  const assignmentUsageByDay = new Map<string, Set<string>>()
  const generatedRows: Array<{
    tenantId: string
    academicYearId: string
    groupId: string
    journeyId: string
    journeySlotId: string
    courseSubjectId: string | null
    subjectId: string
    teacherId: string | null
    dayOfWeek: string
    slotOrder: number
    entryType: 'class'
    status: 'draft'
    notes: string | null
    createdBy: string
    updatedBy: string
  }> = []

  for (const assignment of assignments) {
    let placed = 0
    while (placed < assignment.weeklyHours) {
      const selectedSlot = classSlots.find((slot) => {
        const slotKey = buildTimetableSlotKey(slot.dayOfWeek, slot.slotOrder)
        if (groupUsedKeys.has(slotKey)) return false
        if (assignment.teacherId && teacherUsedKeys.has(`${assignment.teacherId}:${slotKey}`)) return false

        const dailySubjects = assignmentUsageByDay.get(slot.dayOfWeek) ?? new Set<string>()
        if (dailySubjects.has(assignment.subjectId) && assignments.length > 1) return false

        return true
      })

      if (!selectedSlot) {
        conflicts.push(`No fue posible ubicar todas las horas de ${assignment.subjectName ?? 'la materia'} para ${group.gradeName ?? 'el curso'} ${group.name}.`)
        break
      }

      const slotKey = buildTimetableSlotKey(selectedSlot.dayOfWeek, selectedSlot.slotOrder)
      groupUsedKeys.add(slotKey)
      if (assignment.teacherId) {
        teacherUsedKeys.add(`${assignment.teacherId}:${slotKey}`)
        existingTeacherSlotKeys.add(`${assignment.teacherId}:${slotKey}`)
      }

      const dailySubjects = assignmentUsageByDay.get(selectedSlot.dayOfWeek) ?? new Set<string>()
      dailySubjects.add(assignment.subjectId)
      assignmentUsageByDay.set(selectedSlot.dayOfWeek, dailySubjects)

      generatedRows.push({
        tenantId,
        academicYearId,
        groupId: group.id,
        journeyId: preferredOption.journeyId,
        journeySlotId: selectedSlot.id,
        courseSubjectId: assignment.id,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId ?? null,
        dayOfWeek: selectedSlot.dayOfWeek,
        slotOrder: selectedSlot.slotOrder,
        entryType: 'class',
        status: 'draft',
        notes: null,
        createdBy: userId,
        updatedBy: userId,
      })
      placed += 1
    }
  }

  if (generatedRows.length > 0) {
    await db.insert(groupTimetableEntries).values(generatedRows)
  }

  return {
    generatedEntries: generatedRows.length,
    journeyId: preferredOption.journeyId,
    journeyName: preferredOption.journeyName ?? null,
    conflicts,
    blocked: false,
  }
}

const ensureTimetableEntryEditable = async ({
  db,
  tenantId,
  entryId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  entryId: string
}) => {
  const [entry] = await db
    .select({
      id: groupTimetableEntries.id,
      academicYearId: groupTimetableEntries.academicYearId,
      groupId: groupTimetableEntries.groupId,
      journeyId: groupTimetableEntries.journeyId,
      journeySlotId: groupTimetableEntries.journeySlotId,
      teacherId: groupTimetableEntries.teacherId,
      status: groupTimetableEntries.status,
    })
    .from(groupTimetableEntries)
    .where(and(eq(groupTimetableEntries.id, entryId), eq(groupTimetableEntries.tenantId, tenantId), eq(groupTimetableEntries.isDeleted, false)))
    .limit(1)

  if (!entry) throw new AppError('Bloque de horario no encontrado.', 404)
  if (entry.status === 'locked') throw new AppError('El bloque está bloqueado y no admite ajustes manuales.', 409)
  return entry
}

const ensureTimetableSlotAvailable = async ({
  db,
  tenantId,
  entryId,
  academicYearId,
  groupId,
  teacherId,
  journeyId,
  journeySlotId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  entryId: string
  academicYearId: string
  groupId: string
  teacherId?: string | null
  journeyId: string
  journeySlotId: string
}) => {
  const [journey] = await db
    .select({
      id: academicYearJourneys.id,
      academicYearId: academicYearJourneys.academicYearId,
    })
    .from(academicYearJourneys)
    .where(and(eq(academicYearJourneys.id, journeyId), eq(academicYearJourneys.tenantId, tenantId), eq(academicYearJourneys.isDeleted, false)))
    .limit(1)
  if (!journey) throw new AppError('La jornada seleccionada no existe.', 404)
  if (journey.academicYearId !== academicYearId) throw new AppError('La jornada no pertenece al año lectivo del bloque.', 409)

  const [slot] = await db
    .select({
      id: academicYearJourneySlots.id,
      journeyId: academicYearJourneySlots.journeyId,
      dayOfWeek: academicYearJourneySlots.dayOfWeek,
      slotOrder: academicYearJourneySlots.slotOrder,
    })
    .from(academicYearJourneySlots)
    .where(and(eq(academicYearJourneySlots.id, journeySlotId), eq(academicYearJourneySlots.tenantId, tenantId), eq(academicYearJourneySlots.isDeleted, false)))
    .limit(1)
  if (!slot) throw new AppError('La franja seleccionada no existe.', 404)
  if (slot.journeyId !== journeyId) throw new AppError('La franja seleccionada no pertenece a la jornada indicada.', 409)

  const [groupJourneyOption] = await db
    .select({ id: groupJourneyOptions.id })
    .from(groupJourneyOptions)
    .where(and(
      eq(groupJourneyOptions.tenantId, tenantId),
      eq(groupJourneyOptions.academicYearId, academicYearId),
      eq(groupJourneyOptions.groupId, groupId),
      eq(groupJourneyOptions.journeyId, journeyId),
      eq(groupJourneyOptions.isDeleted, false),
    ))
    .limit(1)
  if (!groupJourneyOption) throw new AppError('El curso no tiene esta jornada configurada como opción válida.', 409)

  const [groupConflict] = await db
    .select({ id: groupTimetableEntries.id })
    .from(groupTimetableEntries)
    .where(and(
      eq(groupTimetableEntries.tenantId, tenantId),
      eq(groupTimetableEntries.academicYearId, academicYearId),
      eq(groupTimetableEntries.groupId, groupId),
      eq(groupTimetableEntries.dayOfWeek, slot.dayOfWeek),
      eq(groupTimetableEntries.slotOrder, slot.slotOrder),
      eq(groupTimetableEntries.isDeleted, false),
      ne(groupTimetableEntries.id, entryId),
    ))
    .limit(1)
  if (groupConflict) throw new AppError('Ese curso ya tiene otro bloque asignado en la franja seleccionada.', 409)

  if (teacherId) {
    const [teacherConflict] = await db
      .select({ id: groupTimetableEntries.id })
      .from(groupTimetableEntries)
      .where(and(
        eq(groupTimetableEntries.tenantId, tenantId),
        eq(groupTimetableEntries.academicYearId, academicYearId),
        eq(groupTimetableEntries.teacherId, teacherId),
        eq(groupTimetableEntries.dayOfWeek, slot.dayOfWeek),
        eq(groupTimetableEntries.slotOrder, slot.slotOrder),
        eq(groupTimetableEntries.isDeleted, false),
        ne(groupTimetableEntries.id, entryId),
      ))
      .limit(1)
    if (teacherConflict) throw new AppError('El docente ya está ocupado en la franja seleccionada.', 409)
  }

  return slot
}

const ensureAchievementPlacement = async ({
  db,
  tenantId,
  academicYearId,
  academicPeriodId,
  gradeId,
  subjectId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  academicPeriodId: string
  gradeId: string
  subjectId: string
}) => {
  const [grade] = await db
    .select({ id: grades.id })
    .from(grades)
    .where(and(eq(grades.id, gradeId), eq(grades.tenantId, tenantId), eq(grades.isDeleted, false)))
    .limit(1)
  if (!grade) throw new AppError('El grado seleccionado no existe.', 404)

  const [period] = await db
    .select({ id: academicPeriods.id })
    .from(academicPeriods)
    .where(and(eq(academicPeriods.id, academicPeriodId), eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.academicYearId, academicYearId), eq(academicPeriods.isDeleted, false)))
    .limit(1)
  if (!period) throw new AppError('El periodo seleccionado no pertenece al año lectivo indicado.', 409)

  const [assignment] = await db
    .select({ id: gradeSubjects.id })
    .from(gradeSubjects)
    .where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.academicYearId, academicYearId), eq(gradeSubjects.gradeId, gradeId), eq(gradeSubjects.subjectId, subjectId), eq(gradeSubjects.isDeleted, false)))
    .limit(1)
  if (!assignment) throw new AppError('Debes asignar primero esta materia al grado antes de crear logros.', 409)
}

const ensureGradebookPlacement = async ({
  db,
  tenantId,
  academicYearId,
  academicPeriodId,
  groupId,
  subjectId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  academicPeriodId: string
  groupId: string
  subjectId: string
}) => {
  const [group] = await db
    .select({ id: groups.id, gradeId: groups.gradeId })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.tenantId, tenantId), eq(groups.academicYearId, academicYearId), eq(groups.isDeleted, false)))
    .limit(1)
  if (!group) throw new AppError('El curso seleccionado no pertenece al año lectivo indicado.', 409)

  const [period] = await db
    .select({ id: academicPeriods.id })
    .from(academicPeriods)
    .where(and(eq(academicPeriods.id, academicPeriodId), eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.academicYearId, academicYearId), eq(academicPeriods.isDeleted, false)))
    .limit(1)
  if (!period) throw new AppError('El periodo seleccionado no pertenece al año lectivo indicado.', 409)

  const [assignment] = await db
    .select({ id: gradeSubjects.id })
    .from(gradeSubjects)
    .where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.academicYearId, academicYearId), eq(gradeSubjects.gradeId, group.gradeId), eq(gradeSubjects.subjectId, subjectId), eq(gradeSubjects.isDeleted, false)))
    .limit(1)
  if (!assignment) throw new AppError('Debes asignar primero esta materia al grado antes de registrar notas.', 409)
}

const ensureAttendancePlacement = async ({
  db,
  tenantId,
  academicYearId,
  academicPeriodId,
  groupId,
  subjectId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  academicPeriodId: string
  groupId: string
  subjectId: string
}) => {
  await ensureGradebookPlacement({ db, tenantId, academicYearId, academicPeriodId, groupId, subjectId })
}

const ensureTeacherCanManageGroupSubject = async ({
  db,
  tenantId,
  user,
  academicYearId,
  groupId,
  subjectId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  user: AppContextVariables['user']
  academicYearId: string
  groupId: string
  subjectId: string
}) => {
  if (!user.roleCodes.includes('teacher')) return

  const teacherRecord = await db.query.teachers.findFirst({
    where: and(eq(teachers.tenantId, tenantId), eq(teachers.userId, user.id), eq(teachers.isDeleted, false))
  })
  if (!teacherRecord) throw new AppError('Usuario no está registrado como docente activo', 403)

  const assignment = await db.query.courseSubjects.findFirst({
    where: and(
      eq(courseSubjects.tenantId, tenantId),
      eq(courseSubjects.academicYearId, academicYearId),
      eq(courseSubjects.groupId, groupId),
      eq(courseSubjects.subjectId, subjectId),
      eq(courseSubjects.teacherId, teacherRecord.id),
      eq(courseSubjects.isDeleted, false),
    ),
  })

  if (!assignment) {
    throw new AppError('No tienes asignada esta asignatura en este curso.', 403)
  }
}

const ensureActivePeriod = async (
  db: AppContextVariables['db'],
  tenantId: string,
  academicPeriodId: string
) => {
  const [period] = await db
    .select({ status: academicPeriods.status })
    .from(academicPeriods)
    .where(and(eq(academicPeriods.id, academicPeriodId), eq(academicPeriods.tenantId, tenantId)))
    .limit(1)

  if (!period) throw new AppError('El periodo académico seleccionado no existe.', 404)
  if (period.status === 'closed' || period.status === 'published') {
    throw new AppError('El periodo académico se encuentra cerrado o publicado. No es posible realizar modificaciones.', 403)
  }
}

const collectAcademicPeriodSummary = async ({
  db,
  tenantId,
  academicYearId,
  academicPeriodId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  academicYearId: string
  academicPeriodId: string
}) => {
  const [[enrollmentRow], [gradeRow], [attendanceRow], [activitiesRow], [activityScoresRow], [observationRow], [supportRow]] = await Promise.all([
    db.select({ total: count() }).from(enrollments).where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.academicYearId, academicYearId),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled'),
    )),
    db.select({ total: count() }).from(gradeRecords).where(and(
      eq(gradeRecords.tenantId, tenantId),
      eq(gradeRecords.academicPeriodId, academicPeriodId),
      eq(gradeRecords.isDeleted, false),
    )),
    db.select({ total: count() }).from(attendanceRecords).where(and(
      eq(attendanceRecords.tenantId, tenantId),
      eq(attendanceRecords.academicPeriodId, academicPeriodId),
      eq(attendanceRecords.isDeleted, false),
    )),
    db.select({ total: count() }).from(evaluationActivities).where(and(
      eq(evaluationActivities.tenantId, tenantId),
      eq(evaluationActivities.academicYearId, academicYearId),
      eq(evaluationActivities.academicPeriodId, academicPeriodId),
      eq(evaluationActivities.isDeleted, false),
    )),
    db.select({ total: count() }).from(activityScores)
      .innerJoin(evaluationActivities, eq(evaluationActivities.id, activityScores.activityId))
      .where(and(
        eq(activityScores.tenantId, tenantId),
        eq(activityScores.isDeleted, false),
        eq(evaluationActivities.tenantId, tenantId),
        eq(evaluationActivities.academicYearId, academicYearId),
        eq(evaluationActivities.academicPeriodId, academicPeriodId),
        eq(evaluationActivities.isDeleted, false),
      )),
    db.select({ total: count() }).from(academicObservations).where(and(
      eq(academicObservations.tenantId, tenantId),
      eq(academicObservations.academicPeriodId, academicPeriodId),
      eq(academicObservations.isDeleted, false),
    )),
    db.select({ total: count() }).from(supportStrategies).where(and(
      eq(supportStrategies.tenantId, tenantId),
      eq(supportStrategies.academicPeriodId, academicPeriodId),
      eq(supportStrategies.isDeleted, false),
    )),
  ])

  return {
    enrollments: enrollmentRow?.total ?? 0,
    gradeRecords: gradeRow?.total ?? 0,
    attendanceRecords: attendanceRow?.total ?? 0,
    evaluationActivities: activitiesRow?.total ?? 0,
    activityScores: activityScoresRow?.total ?? 0,
    observations: observationRow?.total ?? 0,
    supportStrategies: supportRow?.total ?? 0,
  }
}

const calculateAndPersistPeriodGrades = async ({
  db,
  tenantId,
  userId,
  academicYearId,
  academicPeriodId,
  groupId,
  subjectId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  userId: string
  academicYearId: string
  academicPeriodId: string
  groupId: string
  subjectId: string
}) => {
  const activities = await db
    .select()
    .from(evaluationActivities)
    .where(and(
      eq(evaluationActivities.tenantId, tenantId),
      eq(evaluationActivities.academicYearId, academicYearId),
      eq(evaluationActivities.academicPeriodId, academicPeriodId),
      eq(evaluationActivities.groupId, groupId),
      eq(evaluationActivities.subjectId, subjectId),
      eq(evaluationActivities.isDeleted, false),
    ))

  if (activities.length === 0) return 0

  const [group] = await db
    .select({ gradeId: groups.gradeId })
    .from(groups)
    .where(and(eq(groups.tenantId, tenantId), eq(groups.id, groupId), eq(groups.isDeleted, false)))
    .limit(1)

  if (!group?.gradeId) throw new AppError('No se encontró el grado del curso para recalcular notas.', 404)

  const resolvedScale = await resolveGradingScaleForGrade({
    db,
    tenantId,
    academicYearId,
    gradeId: group.gradeId,
  })

  const enrolledStudents = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.groupId, groupId),
      eq(enrollments.academicYearId, academicYearId),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled'),
    ))

  const studentIds = enrolledStudents.map((item) => item.studentId)
  if (studentIds.length === 0) return 0

  const activityIds = activities.map((activity) => activity.id)
  const scores = await db
    .select()
    .from(activityScores)
    .where(and(
      eq(activityScores.tenantId, tenantId),
      eq(activityScores.isDeleted, false),
      inArray(activityScores.activityId, activityIds),
      inArray(activityScores.studentId, studentIds),
    ))

  const achievements = await db
    .select()
    .from(learningAchievements)
    .where(and(
      eq(learningAchievements.tenantId, tenantId),
      eq(learningAchievements.academicYearId, academicYearId),
      eq(learningAchievements.academicPeriodId, academicPeriodId),
      eq(learningAchievements.subjectId, subjectId),
      eq(learningAchievements.isDeleted, false),
    ))

  const achievementsMap = new Map<string, typeof achievements[number]>()
  for (const achievement of achievements) {
    achievementsMap.set(achievement.id, achievement)
  }

  let updatedCount = 0
  for (const studentId of studentIds) {
    const studentScores = scores.filter((item) => item.studentId === studentId)
    const scoresByAchievement = new Map<string, { score: number; weight: number }[]>()

    for (const scoreRow of studentScores) {
      const activity = activities.find((item) => item.id === scoreRow.activityId)
      if (!activity) continue
      const current = scoresByAchievement.get(activity.achievementId) ?? []
      current.push({ score: Number(scoreRow.score), weight: Number(activity.weightPercentage) })
      scoresByAchievement.set(activity.achievementId, current)
    }

    const computedAchievements: { score: number; weight: number }[] = []
    for (const [achievementId, achievementScores] of scoresByAchievement.entries()) {
      const achievement = achievementsMap.get(achievementId)
      const achievementWeight = achievement ? achievement.weight : 100
      const achievementScore = calculateAchievementScore(
        achievementScores.map((item) => ({ score: item.score, weightPercentage: item.weight })),
      )
      computedAchievements.push({ score: achievementScore, weight: achievementWeight })
    }

    if (computedAchievements.length === 0) continue

    const finalScore = calculateSubjectPeriodScore(computedAchievements)
    const [existing] = await db
      .select({ id: gradeRecords.id })
      .from(gradeRecords)
      .where(and(
        eq(gradeRecords.tenantId, tenantId),
        eq(gradeRecords.studentId, studentId),
        eq(gradeRecords.subjectId, subjectId),
        eq(gradeRecords.academicPeriodId, academicPeriodId),
        eq(gradeRecords.isDeleted, false),
      ))
      .limit(1)

    if (existing) {
      await db.update(gradeRecords).set({
        score: String(finalScore),
        gradeValue: resolveDisplayedGradeValue({ score: finalScore, scale: resolvedScale }),
        gradeValueType: resolvedScale.scaleType,
        maxScore: String(resolvedScale.maxValue),
        notes: 'Nota calculada automáticamente a partir de las actividades evaluativas.',
        groupId,
        academicYearId,
        updatedAt: new Date(),
        updatedBy: userId,
      }).where(eq(gradeRecords.id, existing.id))
    } else {
      await db.insert(gradeRecords).values({
        tenantId,
        studentId,
        subjectId,
        academicPeriodId,
        score: String(finalScore),
        gradeValue: resolveDisplayedGradeValue({ score: finalScore, scale: resolvedScale }),
        gradeValueType: resolvedScale.scaleType,
        maxScore: String(resolvedScale.maxValue),
        notes: 'Nota calculada automáticamente a partir de las actividades evaluativas.',
        groupId,
        academicYearId,
        createdBy: userId,
        updatedBy: userId,
      })
    }

    updatedCount += 1
  }

  return updatedCount
}


academicRoutes.get('/subjects', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const { query, page, pageSize, offset } = readPaginationFilters(c)
  const searchFilter = query ? or(
    ilike(subjects.name, `%${query}%`),
    ilike(subjects.code, `%${query}%`),
    ilike(subjects.area, `%${query}%`),
    ilike(academicAreas.name, `%${query}%`)
  ) : undefined
  const whereClause = and(eq(subjects.tenantId, tenantId), eq(subjects.isDeleted, false), searchFilter)

  const items = await db
    .select({
      subject: subjects,
      area: academicAreas,
    })
    .from(subjects)
    .leftJoin(academicAreas, eq(subjects.academicAreaId, academicAreas.id))
    .where(whereClause)
    .orderBy(asc(subjects.name))
    .limit(pageSize)
    .offset(offset)

  const [totalRow] = await db
    .select({ total: count() })
    .from(subjects)
    .leftJoin(academicAreas, eq(subjects.academicAreaId, academicAreas.id))
    .where(whereClause)

  return c.json(ok('Materias cargadas', {
    items: items.map(({ subject, area }) => ({
      id: subject.id,
      tenantId: subject.tenantId,
      academicAreaId: subject.academicAreaId ?? null,
      academicAreaName: area ? area.name : null,
      name: subject.name,
      code: subject.code,
      area: subject.area ?? (area ? area.name : null),
      createdAt: subject.createdAt.toISOString(),
      updatedAt: subject.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  }))
})

academicRoutes.post('/subjects', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', subjectSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  const [item] = await db.insert(subjects).values({
    tenantId,
    name: payload.name,
    code: payload.code,
    area: payload.area || null,
    academicAreaId: payload.academicAreaId || null,
    createdBy: user.id,
    updatedBy: user.id
  }).returning()
  if (!item) throw new AppError('No fue posible crear la materia', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'subjects', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Materia creada', { id: item.id }), 201)
})

academicRoutes.put('/subjects/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', subjectSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')
  const [item] = await db.update(subjects).set({
    name: payload.name,
    code: payload.code,
    area: payload.area || null,
    academicAreaId: payload.academicAreaId || null,
    updatedAt: new Date(),
    updatedBy: user.id
  }).where(and(eq(subjects.id, id), eq(subjects.tenantId, tenantId), eq(subjects.isDeleted, false))).returning()
  if (!item) throw new AppError('Materia no encontrada', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'subjects', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Materia actualizada', { id }))
})

academicRoutes.delete('/subjects/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  await ensureSubjectDeletable(db, tenantId, id)
  await db.update(subjects).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(subjects.id, id), eq(subjects.tenantId, tenantId), eq(subjects.isDeleted, false)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'subjects', entityId: id, action: 'delete' })
  return c.json(ok('Materia eliminada', { id }))
})

academicRoutes.get('/grade-subjects', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const { query, page, pageSize, offset } = readPaginationFilters(c)
  const academicYearId = c.req.query('academicYearId') ?? ''
  const gradeId = c.req.query('gradeId') ?? ''
  const user = c.get('user')
  const searchFilter = query ? or(ilike(subjects.name, `%${query}%`), ilike(grades.name, `%${query}%`)) : undefined

  let teacherFilter
  if (user && user.roleCodes && user.roleCodes.includes('teacher')) {
    const teacherRecord = await db.query.teachers.findFirst({
      where: and(eq(teachers.tenantId, tenantId), eq(teachers.userId, user.id), eq(teachers.isDeleted, false))
    })
    if (teacherRecord) {
      const assignments = await db
        .select({ subjectId: courseSubjects.subjectId })
        .from(courseSubjects)
        .where(and(
          eq(courseSubjects.tenantId, tenantId),
          eq(courseSubjects.teacherId, teacherRecord.id),
          eq(courseSubjects.isDeleted, false)
        ))
      const subjectIds = [...new Set(assignments.map(a => a.subjectId))]
      if (subjectIds.length > 0) {
        teacherFilter = inArray(gradeSubjects.subjectId, subjectIds)
      } else {
        return c.json(ok('Materias por grado cargadas', { items: [], total: 0, page, pageSize }))
      }
    } else {
      return c.json(ok('Materias por grado cargadas', { items: [], total: 0, page, pageSize }))
    }
  }

  const whereClause = and(
    eq(gradeSubjects.tenantId, tenantId),
    eq(gradeSubjects.isDeleted, false),
    academicYearId ? eq(gradeSubjects.academicYearId, academicYearId) : undefined,
    gradeId ? eq(gradeSubjects.gradeId, gradeId) : undefined,
    searchFilter,
    teacherFilter,
  )
  const items = await db
    .select({ item: gradeSubjects, year: academicYears, grade: grades, subject: subjects })
    .from(gradeSubjects)
    .innerJoin(academicYears, eq(academicYears.id, gradeSubjects.academicYearId))
    .innerJoin(grades, eq(grades.id, gradeSubjects.gradeId))
    .innerJoin(subjects, eq(subjects.id, gradeSubjects.subjectId))
    .where(whereClause)
    .orderBy(desc(gradeSubjects.createdAt), asc(subjects.name))
    .limit(pageSize)
    .offset(offset)
  const [totalRow] = await db.select({ total: count() }).from(gradeSubjects).innerJoin(grades, eq(grades.id, gradeSubjects.gradeId)).innerJoin(subjects, eq(subjects.id, gradeSubjects.subjectId)).where(whereClause)
  return c.json(ok('Materias por grado cargadas', {
    items: items.map(({ item, year, grade, subject }) => ({
      id: item.id,
      tenantId: item.tenantId,
      academicYearId: item.academicYearId,
      academicYearName: year.name,
      gradeId: grade.id,
      gradeName: grade.name,
      subjectId: item.subjectId,
      subjectName: subject.name,
      weeklyHours: item.weeklyHours,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  }))
})

academicRoutes.post('/grade-subjects', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', gradeSubjectSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  await ensureGradeSubjectPlacement({ db, tenantId, academicYearId: payload.academicYearId, gradeId: payload.gradeId, subjectId: payload.subjectId })
  const [existing] = await db.select({ id: gradeSubjects.id }).from(gradeSubjects).where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.academicYearId, payload.academicYearId), eq(gradeSubjects.gradeId, payload.gradeId), eq(gradeSubjects.subjectId, payload.subjectId), eq(gradeSubjects.isDeleted, false))).limit(1)
  if (existing) throw new AppError('Esta materia ya está asignada al grado seleccionado.', 409)
  const [item] = await db.insert(gradeSubjects).values({ tenantId, ...payload, createdBy: user.id, updatedBy: user.id }).returning()
  if (!item) throw new AppError('No fue posible asignar la materia al grado', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grade_subjects', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Materia asignada al grado', { id: item.id }), 201)
})

academicRoutes.put('/grade-subjects/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', gradeSubjectSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')
  await ensureGradeSubjectPlacement({ db, tenantId, academicYearId: payload.academicYearId, gradeId: payload.gradeId, subjectId: payload.subjectId })
  const [item] = await db.update(gradeSubjects).set({ ...payload, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(gradeSubjects.id, id), eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.isDeleted, false))).returning()
  if (!item) throw new AppError('Asignación no encontrada', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grade_subjects', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Asignación actualizada', { id }))
})

academicRoutes.delete('/grade-subjects/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const [assignment] = await db
    .select({ gradeId: gradeSubjects.gradeId, subjectId: gradeSubjects.subjectId, academicYearId: gradeSubjects.academicYearId })
    .from(gradeSubjects)
    .where(and(eq(gradeSubjects.id, id), eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.isDeleted, false)))
    .limit(1)
  if (!assignment) throw new AppError('Asignación no encontrada', 404)
  const [achievementUsage] = await db
    .select({ total: count() })
    .from(learningAchievements)
    .where(and(
      eq(learningAchievements.tenantId, tenantId),
      eq(learningAchievements.isDeleted, false),
      eq(learningAchievements.gradeId, assignment.gradeId),
      eq(learningAchievements.subjectId, assignment.subjectId),
    ))
  if ((achievementUsage?.total ?? 0) > 0) throw new AppError('No puedes eliminar esta asignación porque tiene logros asociados en ese grado.', 409)
  await db.update(gradeSubjects).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(gradeSubjects.id, id), eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.isDeleted, false)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grade_subjects', entityId: id, action: 'delete' })
  return c.json(ok('Asignación eliminada', { id }))
})

// === DOCENTES Y ASIGNACIONES ACADÉMICAS ===

academicRoutes.get('/teachers', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')
  const offset = (filters.page - 1) * filters.pageSize
  const searchFilter = filters.query ? ilike(teachers.fullName, `%${filters.query}%`) : undefined
  const whereClause = and(eq(teachers.tenantId, tenantId), eq(teachers.isDeleted, false), searchFilter)
  
  const items = await db.select().from(teachers).where(whereClause).orderBy(asc(teachers.fullName)).limit(filters.pageSize).offset(offset)
  const [totalRow] = await db.select({ total: count() }).from(teachers).where(whereClause)
  
  return c.json(ok('Docentes cargados', {
    items: items.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      userId: item.userId,
      fullName: item.fullName,
      email: item.email,
      phone: item.phone,
      specialty: item.specialty,
      status: item.status,
      maxWeeklyHours: item.maxWeeklyHours,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }))
})

academicRoutes.get('/teacher-user-candidates', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const userItems = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      status: users.status,
      linkedTeacherId: teachers.id,
    })
    .from(users)
    .leftJoin(teachers, and(eq(teachers.userId, users.id), eq(teachers.tenantId, tenantId), eq(teachers.isDeleted, false)))
    .where(and(eq(users.tenantId, tenantId), eq(users.isDeleted, false)))
    .orderBy(asc(users.fullName))

  const roleRows = await db
    .select({
      userId: userRoles.userId,
      roleCode: roles.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.isDeleted, false), eq(roles.isDeleted, false)))

  const rolesByUser = roleRows.reduce<Record<string, string[]>>((acc, row) => {
    const bucket = acc[row.userId] ?? (acc[row.userId] = [])
    if (row.roleCode) bucket.push(row.roleCode)
    return acc
  }, {})

  return c.json(ok('Usuarios candidatos cargados', {
    items: userItems.map((item) => {
      const roleCodes = [...new Set(rolesByUser[item.id] ?? [])]
      return {
        id: item.id,
        fullName: item.fullName,
        email: item.email,
        status: item.status,
        roleCodes,
        hasTeacherRole: roleCodes.includes('teacher'),
        linkedTeacherId: item.linkedTeacherId ?? null,
      }
    }),
  }))
})

academicRoutes.post('/teachers', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', teacherSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  await ensureTeacherUserLinkIsValid({ db, tenantId, userId: payload.userId || null })

  const [item] = await db.insert(teachers).values({
    tenantId,
    userId: payload.userId || null,
    fullName: payload.fullName,
    email: payload.email || null,
    phone: payload.phone || null,
    specialty: payload.specialty || null,
    status: payload.status,
    maxWeeklyHours: payload.maxWeeklyHours,
    createdBy: user.id,
    updatedBy: user.id
  }).returning()
  
  if (!item) throw new AppError('No fue posible crear el docente', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'teachers', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Docente creado', { id: item.id }), 201)
})

academicRoutes.put('/teachers/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', teacherSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  await ensureTeacherUserLinkIsValid({ db, tenantId, userId: payload.userId || null, teacherIdToExclude: id })

  const [item] = await db.update(teachers).set({
    userId: payload.userId || null,
    fullName: payload.fullName,
    email: payload.email || null,
    phone: payload.phone || null,
    specialty: payload.specialty || null,
    status: payload.status,
    maxWeeklyHours: payload.maxWeeklyHours,
    updatedAt: new Date(),
    updatedBy: user.id
  }).where(and(eq(teachers.id, id), eq(teachers.tenantId, tenantId), eq(teachers.isDeleted, false))).returning()
  
  if (!item) throw new AppError('Docente no encontrado', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'teachers', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Docente actualizado', { id }))
})

academicRoutes.delete('/teachers/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  await ensureTeacherDeletable(db, tenantId, id)
  await db.update(teachers).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(teachers.id, id), eq(teachers.tenantId, tenantId)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'teachers', entityId: id, action: 'delete' })
  return c.json(ok('Docente eliminado', { id }))
})

academicRoutes.get('/course-subjects', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const academicYearId = c.req.query('academicYearId')
  const groupId = c.req.query('groupId')
  let teacherId = c.req.query('teacherId')

  if (user.roleCodes.includes('teacher')) {
    const teacherRecord = await db.query.teachers.findFirst({
      where: and(eq(teachers.tenantId, tenantId), eq(teachers.userId, user.id), eq(teachers.isDeleted, false)),
    })
    if (!teacherRecord) throw new AppError('Usuario no está registrado como docente activo', 403)
    teacherId = teacherRecord.id
  }
  
  const conditions = [
    eq(courseSubjects.tenantId, tenantId),
    eq(courseSubjects.isDeleted, false)
  ]
  if (academicYearId) conditions.push(eq(courseSubjects.academicYearId, academicYearId))
  if (groupId) conditions.push(eq(courseSubjects.groupId, groupId))
  if (teacherId) conditions.push(eq(courseSubjects.teacherId, teacherId))
  
  const items = await db
    .select({
      id: courseSubjects.id,
      tenantId: courseSubjects.tenantId,
      academicYearId: courseSubjects.academicYearId,
      academicYearName: academicYears.name,
      groupId: courseSubjects.groupId,
      groupName: groups.name,
      gradeName: grades.name,
      subjectId: courseSubjects.subjectId,
      subjectName: subjects.name,
      weeklyHours: courseSubjects.weeklyHours,
      teacherId: courseSubjects.teacherId,
      teacherName: teachers.fullName,
      createdAt: courseSubjects.createdAt,
      updatedAt: courseSubjects.updatedAt
    })
    .from(courseSubjects)
    .leftJoin(academicYears, eq(academicYears.id, courseSubjects.academicYearId))
    .leftJoin(groups, eq(groups.id, courseSubjects.groupId))
    .leftJoin(grades, eq(grades.id, groups.gradeId))
    .leftJoin(subjects, eq(subjects.id, courseSubjects.subjectId))
    .leftJoin(teachers, eq(teachers.id, courseSubjects.teacherId))
    .where(and(...conditions))
    .orderBy(asc(groups.name), asc(subjects.name))
    
  return c.json(ok('Materias por grupo cargadas', {
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    }))
  }))
})

academicRoutes.post('/course-subjects', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', courseSubjectSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  await ensureCourseSubjectPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    groupId: payload.groupId,
    subjectId: payload.subjectId,
  })

  const [existingAssignment] = await db
    .select({ id: courseSubjects.id })
    .from(courseSubjects)
    .where(and(
      eq(courseSubjects.tenantId, tenantId),
      eq(courseSubjects.academicYearId, payload.academicYearId),
      eq(courseSubjects.groupId, payload.groupId),
      eq(courseSubjects.subjectId, payload.subjectId),
      eq(courseSubjects.isDeleted, false),
    ))
    .limit(1)
  if (existingAssignment) throw new AppError('Esta materia ya está asignada a ese curso.', 409)

  if (payload.teacherId) {
    await ensureTeacherWorkloadWithinLimit({
      db,
      tenantId,
      academicYearId: payload.academicYearId,
      teacherId: payload.teacherId,
      weeklyHours: payload.weeklyHours,
    })
  }

  const [item] = await db.insert(courseSubjects).values({
    tenantId,
    academicYearId: payload.academicYearId,
    groupId: payload.groupId,
    subjectId: payload.subjectId,
    weeklyHours: payload.weeklyHours,
    teacherId: payload.teacherId || null,
    createdBy: user.id,
    updatedBy: user.id
  }).returning()
  
  if (!item) throw new AppError('No fue posible asignar la materia al grupo', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'course_subjects', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Materia asignada al grupo', { id: item.id }), 201)
})

academicRoutes.put('/course-subjects/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', courseSubjectSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  await ensureCourseSubjectPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    groupId: payload.groupId,
    subjectId: payload.subjectId,
  })

  const [existingAssignment] = await db
    .select({ id: courseSubjects.id })
    .from(courseSubjects)
    .where(and(
      eq(courseSubjects.tenantId, tenantId),
      eq(courseSubjects.academicYearId, payload.academicYearId),
      eq(courseSubjects.groupId, payload.groupId),
      eq(courseSubjects.subjectId, payload.subjectId),
      eq(courseSubjects.isDeleted, false),
      ne(courseSubjects.id, id),
    ))
    .limit(1)
  if (existingAssignment) throw new AppError('Esta materia ya está asignada a ese curso.', 409)

  if (payload.teacherId) {
    await ensureTeacherWorkloadWithinLimit({
      db,
      tenantId,
      academicYearId: payload.academicYearId,
      teacherId: payload.teacherId,
      weeklyHours: payload.weeklyHours,
      excludeCourseSubjectId: id,
    })
  }

  const [item] = await db.update(courseSubjects).set({
    academicYearId: payload.academicYearId,
    groupId: payload.groupId,
    subjectId: payload.subjectId,
    weeklyHours: payload.weeklyHours,
    teacherId: payload.teacherId || null,
    updatedAt: new Date(),
    updatedBy: user.id
  }).where(and(eq(courseSubjects.id, id), eq(courseSubjects.tenantId, tenantId), eq(courseSubjects.isDeleted, false))).returning()
  
  if (!item) throw new AppError('Asignación no encontrada', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'course_subjects', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Asignación actualizada', { id }))
})

academicRoutes.delete('/course-subjects/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  
  await db.update(courseSubjects).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(courseSubjects.id, id), eq(courseSubjects.tenantId, tenantId), eq(courseSubjects.isDeleted, false)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'course_subjects', entityId: id, action: 'delete' })
  return c.json(ok('Asignación eliminada', { id }))
})

academicRoutes.get('/teacher-responsibilities', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const academicYearId = c.req.query('academicYearId')
  const responsibilityType = c.req.query('responsibilityType')
  const teacherId = c.req.query('teacherId')

  const conditions = [
    eq(teacherResponsibilities.tenantId, tenantId),
    eq(teacherResponsibilities.isDeleted, false),
  ]
  if (academicYearId) conditions.push(eq(teacherResponsibilities.academicYearId, academicYearId))
  if (responsibilityType) conditions.push(eq(teacherResponsibilities.responsibilityType, responsibilityType))
  if (teacherId) conditions.push(eq(teacherResponsibilities.teacherId, teacherId))

  const items = await db
    .select({
      id: teacherResponsibilities.id,
      tenantId: teacherResponsibilities.tenantId,
      academicYearId: teacherResponsibilities.academicYearId,
      academicYearName: academicYears.name,
      teacherId: teacherResponsibilities.teacherId,
      teacherName: teachers.fullName,
      responsibilityType: teacherResponsibilities.responsibilityType,
      scopeType: teacherResponsibilities.scopeType,
      branchId: teacherResponsibilities.branchId,
      levelName: teacherResponsibilities.levelName,
      gradeId: teacherResponsibilities.gradeId,
      groupId: teacherResponsibilities.groupId,
      groupName: groups.name,
      gradeName: grades.name,
      title: teacherResponsibilities.title,
      notes: teacherResponsibilities.notes,
      createdAt: teacherResponsibilities.createdAt,
      updatedAt: teacherResponsibilities.updatedAt,
    })
    .from(teacherResponsibilities)
    .innerJoin(teachers, eq(teachers.id, teacherResponsibilities.teacherId))
    .innerJoin(academicYears, eq(academicYears.id, teacherResponsibilities.academicYearId))
    .leftJoin(groups, eq(groups.id, teacherResponsibilities.groupId))
    .leftJoin(grades, or(eq(grades.id, groups.gradeId), eq(grades.id, teacherResponsibilities.gradeId)))
    .where(and(...conditions))
    .orderBy(asc(teacherResponsibilities.responsibilityType), asc(teachers.fullName), asc(groups.name))

  return c.json(ok('Responsabilidades docentes cargadas', {
    items: items.map((item) => ({
      ...item,
      responsibilityType: item.responsibilityType as 'group_director' | 'coordinator',
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  }))
})

academicRoutes.post('/teacher-responsibilities', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', teacherResponsibilitySchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  await ensureTeacherResponsibilityPlacement({
    db,
    tenantId,
      academicYearId: payload.academicYearId,
      teacherId: payload.teacherId,
      responsibilityType: payload.responsibilityType,
      scopeType: payload.responsibilityType === 'group_director' ? 'group' : payload.scopeType,
      branchId: payload.responsibilityType === 'coordinator' ? payload.branchId || null : null,
      levelName: payload.responsibilityType === 'coordinator' ? payload.levelName || null : null,
      gradeId: payload.responsibilityType === 'coordinator' ? payload.gradeId || null : null,
      groupId: payload.groupId || null,
      title: payload.title || null,
  })

  const [item] = await db.insert(teacherResponsibilities).values({
    tenantId,
    academicYearId: payload.academicYearId,
    teacherId: payload.teacherId,
    responsibilityType: payload.responsibilityType,
    scopeType: payload.responsibilityType === 'group_director' ? 'group' : payload.scopeType,
    branchId: payload.branchId || null,
    levelName: payload.levelName || null,
    gradeId: payload.gradeId || null,
    groupId: payload.groupId || null,
    title: payload.title || null,
    notes: payload.notes || null,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()

  if (!item) throw new AppError('No fue posible registrar la responsabilidad docente.', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'teacher_responsibilities', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Responsabilidad docente creada', { id: item.id }), 201)
})

academicRoutes.put('/teacher-responsibilities/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', teacherResponsibilitySchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  await ensureTeacherResponsibilityPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    teacherId: payload.teacherId,
    responsibilityType: payload.responsibilityType,
    scopeType: payload.responsibilityType === 'group_director' ? 'group' : payload.scopeType,
    branchId: payload.responsibilityType === 'coordinator' ? payload.branchId || null : null,
    levelName: payload.responsibilityType === 'coordinator' ? payload.levelName || null : null,
    gradeId: payload.responsibilityType === 'coordinator' ? payload.gradeId || null : null,
    groupId: payload.groupId || null,
    title: payload.title || null,
    responsibilityIdToExclude: id,
  })

  const [item] = await db.update(teacherResponsibilities).set({
    academicYearId: payload.academicYearId,
    teacherId: payload.teacherId,
    responsibilityType: payload.responsibilityType,
    groupId: payload.groupId || null,
    title: payload.title || null,
    notes: payload.notes || null,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(and(eq(teacherResponsibilities.id, id), eq(teacherResponsibilities.tenantId, tenantId), eq(teacherResponsibilities.isDeleted, false))).returning()

  if (!item) throw new AppError('Responsabilidad docente no encontrada.', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'teacher_responsibilities', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Responsabilidad docente actualizada', { id }))
})

academicRoutes.delete('/teacher-responsibilities/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  await db.update(teacherResponsibilities).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(teacherResponsibilities.id, id), eq(teacherResponsibilities.tenantId, tenantId), eq(teacherResponsibilities.isDeleted, false)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'teacher_responsibilities', entityId: id, action: 'delete' })
  return c.json(ok('Responsabilidad docente eliminada', { id }))
})

academicRoutes.get('/journeys', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const academicYearId = c.req.query('academicYearId')
  const branchId = c.req.query('branchId')

  const conditions = [
    eq(academicYearJourneys.tenantId, tenantId),
    eq(academicYearJourneys.isDeleted, false),
  ]
  if (academicYearId) conditions.push(eq(academicYearJourneys.academicYearId, academicYearId))
  if (branchId) conditions.push(eq(academicYearJourneys.branchId, branchId))

  const items = await db
    .select({
      id: academicYearJourneys.id,
      tenantId: academicYearJourneys.tenantId,
      academicYearId: academicYearJourneys.academicYearId,
      academicYearName: academicYears.name,
      branchId: academicYearJourneys.branchId,
      branchName: schoolBranches.name,
      targetLevelName: academicYearJourneys.targetLevelName,
      targetGradeId: academicYearJourneys.targetGradeId,
      targetGradeName: grades.name,
      name: academicYearJourneys.name,
      code: academicYearJourneys.code,
      startsAt: academicYearJourneys.startsAt,
      endsAt: academicYearJourneys.endsAt,
      isActive: academicYearJourneys.isActive,
      createdAt: academicYearJourneys.createdAt,
      updatedAt: academicYearJourneys.updatedAt,
    })
    .from(academicYearJourneys)
    .innerJoin(academicYears, eq(academicYears.id, academicYearJourneys.academicYearId))
    .leftJoin(schoolBranches, eq(schoolBranches.id, academicYearJourneys.branchId))
    .leftJoin(grades, eq(grades.id, academicYearJourneys.targetGradeId))
    .where(and(...conditions))
    .orderBy(desc(academicYears.year), asc(schoolBranches.name), asc(academicYearJourneys.name))

  return c.json(ok('Jornadas cargadas', {
    items: items.map((item) => ({
      ...item,
      branchId: item.branchId ?? null,
      branchName: item.branchName ?? null,
      targetLevelName: item.targetLevelName ?? null,
      targetGradeId: item.targetGradeId ?? null,
      targetGradeName: item.targetGradeName ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  }))
})

academicRoutes.post('/journeys', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicYearJourneySchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  await ensureAcademicYearJourneyPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    branchId: payload.branchId || null,
    targetLevelName: payload.targetLevelName || null,
    targetGradeId: payload.targetGradeId || null,
    code: payload.code,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
  })

  const [item] = await db.insert(academicYearJourneys).values({
    tenantId,
    academicYearId: payload.academicYearId,
    branchId: payload.branchId || null,
    targetLevelName: payload.targetLevelName || null,
    targetGradeId: payload.targetGradeId || null,
    name: payload.name,
    code: payload.code.trim(),
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    isActive: payload.isActive,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()

  if (!item) throw new AppError('No fue posible crear la jornada.', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_year_journeys', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Jornada creada', { id: item.id }), 201)
})

academicRoutes.put('/journeys/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicYearJourneySchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  await ensureAcademicYearJourneyPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    branchId: payload.branchId || null,
    targetLevelName: payload.targetLevelName || null,
    targetGradeId: payload.targetGradeId || null,
    code: payload.code,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    journeyIdToExclude: id,
  })

  const [item] = await db.update(academicYearJourneys).set({
    academicYearId: payload.academicYearId,
    branchId: payload.branchId || null,
    targetLevelName: payload.targetLevelName || null,
    targetGradeId: payload.targetGradeId || null,
    name: payload.name,
    code: payload.code.trim(),
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    isActive: payload.isActive,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(and(eq(academicYearJourneys.id, id), eq(academicYearJourneys.tenantId, tenantId), eq(academicYearJourneys.isDeleted, false))).returning()

  if (!item) throw new AppError('Jornada no encontrada.', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_year_journeys', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Jornada actualizada', { id }))
})

academicRoutes.delete('/journeys/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  const [[slotUsage], [groupUsage], [timetableUsage]] = await Promise.all([
    db.select({ total: count() }).from(academicYearJourneySlots).where(and(eq(academicYearJourneySlots.tenantId, tenantId), eq(academicYearJourneySlots.journeyId, id), eq(academicYearJourneySlots.isDeleted, false))),
    db.select({ total: count() }).from(groupJourneyOptions).where(and(eq(groupJourneyOptions.tenantId, tenantId), eq(groupJourneyOptions.journeyId, id), eq(groupJourneyOptions.isDeleted, false))),
    db.select({ total: count() }).from(groupTimetableEntries).where(and(eq(groupTimetableEntries.tenantId, tenantId), eq(groupTimetableEntries.journeyId, id), eq(groupTimetableEntries.isDeleted, false))),
  ])

  if ((slotUsage?.total ?? 0) > 0) throw new AppError('No se puede eliminar la jornada porque tiene franjas horarias asociadas.', 409)
  if ((groupUsage?.total ?? 0) > 0) throw new AppError('No se puede eliminar la jornada porque está asociada a cursos.', 409)
  if ((timetableUsage?.total ?? 0) > 0) throw new AppError('No se puede eliminar la jornada porque ya tiene horarios generados.', 409)

  await db.update(academicYearJourneys).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(academicYearJourneys.id, id), eq(academicYearJourneys.tenantId, tenantId), eq(academicYearJourneys.isDeleted, false)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_year_journeys', entityId: id, action: 'delete' })
  return c.json(ok('Jornada eliminada', { id }))
})

academicRoutes.get('/journey-slots', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const journeyId = c.req.query('journeyId')
  if (!journeyId) throw new AppError('Debes indicar la jornada a consultar.', 400)

  const items = await db
    .select({
      id: academicYearJourneySlots.id,
      tenantId: academicYearJourneySlots.tenantId,
      journeyId: academicYearJourneySlots.journeyId,
      journeyName: academicYearJourneys.name,
      dayOfWeek: academicYearJourneySlots.dayOfWeek,
      slotOrder: academicYearJourneySlots.slotOrder,
      startsAt: academicYearJourneySlots.startsAt,
      endsAt: academicYearJourneySlots.endsAt,
      slotType: academicYearJourneySlots.slotType,
      label: academicYearJourneySlots.label,
      createdAt: academicYearJourneySlots.createdAt,
      updatedAt: academicYearJourneySlots.updatedAt,
    })
    .from(academicYearJourneySlots)
    .innerJoin(academicYearJourneys, eq(academicYearJourneys.id, academicYearJourneySlots.journeyId))
    .where(and(eq(academicYearJourneySlots.tenantId, tenantId), eq(academicYearJourneySlots.journeyId, journeyId), eq(academicYearJourneySlots.isDeleted, false)))
    .orderBy(asc(academicYearJourneySlots.dayOfWeek), asc(academicYearJourneySlots.slotOrder))

  return c.json(ok('Franjas horarias cargadas', {
    items: items.map((item) => ({
      ...item,
      label: item.label ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  }))
})

academicRoutes.post('/journey-slots', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicYearJourneySlotSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  await ensureJourneySlotPlacement({
    db,
    tenantId,
    journeyId: payload.journeyId,
    dayOfWeek: payload.dayOfWeek,
    slotOrder: payload.slotOrder,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
  })

  const [item] = await db.insert(academicYearJourneySlots).values({
    tenantId,
    journeyId: payload.journeyId,
    dayOfWeek: payload.dayOfWeek,
    slotOrder: payload.slotOrder,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    slotType: payload.slotType,
    label: payload.label || null,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()

  if (!item) throw new AppError('No fue posible crear la franja horaria.', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_year_journey_slots', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Franja horaria creada', { id: item.id }), 201)
})

academicRoutes.put('/journey-slots/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicYearJourneySlotSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  await ensureJourneySlotPlacement({
    db,
    tenantId,
    journeyId: payload.journeyId,
    dayOfWeek: payload.dayOfWeek,
    slotOrder: payload.slotOrder,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    journeySlotIdToExclude: id,
  })

  const [item] = await db.update(academicYearJourneySlots).set({
    journeyId: payload.journeyId,
    dayOfWeek: payload.dayOfWeek,
    slotOrder: payload.slotOrder,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    slotType: payload.slotType,
    label: payload.label || null,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(and(eq(academicYearJourneySlots.id, id), eq(academicYearJourneySlots.tenantId, tenantId), eq(academicYearJourneySlots.isDeleted, false))).returning()

  if (!item) throw new AppError('Franja horaria no encontrada.', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_year_journey_slots', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Franja horaria actualizada', { id }))
})

academicRoutes.delete('/journey-slots/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  const [[timetableUsage]] = await Promise.all([
    db.select({ total: count() }).from(groupTimetableEntries).where(and(eq(groupTimetableEntries.tenantId, tenantId), eq(groupTimetableEntries.journeySlotId, id), eq(groupTimetableEntries.isDeleted, false))),
  ])
  if ((timetableUsage?.total ?? 0) > 0) throw new AppError('No se puede eliminar la franja porque ya está siendo usada en horarios generados.', 409)

  await db.update(academicYearJourneySlots).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(academicYearJourneySlots.id, id), eq(academicYearJourneySlots.tenantId, tenantId), eq(academicYearJourneySlots.isDeleted, false)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_year_journey_slots', entityId: id, action: 'delete' })
  return c.json(ok('Franja horaria eliminada', { id }))
})

academicRoutes.get('/group-journey-options', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const academicYearId = c.req.query('academicYearId')
  const groupId = c.req.query('groupId')
  const journeyId = c.req.query('journeyId')

  const conditions = [
    eq(groupJourneyOptions.tenantId, tenantId),
    eq(groupJourneyOptions.isDeleted, false),
  ]
  if (academicYearId) conditions.push(eq(groupJourneyOptions.academicYearId, academicYearId))
  if (groupId) conditions.push(eq(groupJourneyOptions.groupId, groupId))
  if (journeyId) conditions.push(eq(groupJourneyOptions.journeyId, journeyId))

  const items = await db
    .select({
      id: groupJourneyOptions.id,
      tenantId: groupJourneyOptions.tenantId,
      academicYearId: groupJourneyOptions.academicYearId,
      academicYearName: academicYears.name,
      groupId: groupJourneyOptions.groupId,
      groupName: groups.name,
      gradeName: grades.name,
      journeyId: groupJourneyOptions.journeyId,
      journeyName: academicYearJourneys.name,
      journeyCode: academicYearJourneys.code,
      branchName: schoolBranches.name,
      priority: groupJourneyOptions.priority,
      isPreferred: groupJourneyOptions.isPreferred,
      createdAt: groupJourneyOptions.createdAt,
      updatedAt: groupJourneyOptions.updatedAt,
    })
    .from(groupJourneyOptions)
    .innerJoin(academicYears, eq(academicYears.id, groupJourneyOptions.academicYearId))
    .innerJoin(groups, eq(groups.id, groupJourneyOptions.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(academicYearJourneys, eq(academicYearJourneys.id, groupJourneyOptions.journeyId))
    .leftJoin(schoolBranches, eq(schoolBranches.id, academicYearJourneys.branchId))
    .where(and(...conditions))
    .orderBy(asc(groups.name), desc(groupJourneyOptions.isPreferred), asc(groupJourneyOptions.priority), asc(academicYearJourneys.name))

  return c.json(ok('Opciones de jornada por curso cargadas', {
    items: items.map((item) => ({
      ...item,
      branchName: item.branchName ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  }))
})

academicRoutes.post('/group-journey-options', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', groupJourneyOptionSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  await ensureGroupJourneyOptionPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    groupId: payload.groupId,
    journeyId: payload.journeyId,
  })

  const [item] = await db.insert(groupJourneyOptions).values({
    tenantId,
    academicYearId: payload.academicYearId,
    groupId: payload.groupId,
    journeyId: payload.journeyId,
    priority: payload.priority,
    isPreferred: payload.isPreferred,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()

  if (!item) throw new AppError('No fue posible registrar la opción de jornada.', 500)
  if (payload.isPreferred) {
    await upsertPreferredJourneyOption({
      db,
      tenantId,
      academicYearId: payload.academicYearId,
      groupId: payload.groupId,
      selectedOptionId: item.id,
    })
  }
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'group_journey_options', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Opción de jornada registrada', { id: item.id }), 201)
})

academicRoutes.put('/group-journey-options/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', groupJourneyOptionSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  await ensureGroupJourneyOptionPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    groupId: payload.groupId,
    journeyId: payload.journeyId,
    optionIdToExclude: id,
  })

  const [item] = await db.update(groupJourneyOptions).set({
    academicYearId: payload.academicYearId,
    groupId: payload.groupId,
    journeyId: payload.journeyId,
    priority: payload.priority,
    isPreferred: payload.isPreferred,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(and(eq(groupJourneyOptions.id, id), eq(groupJourneyOptions.tenantId, tenantId), eq(groupJourneyOptions.isDeleted, false))).returning()

  if (!item) throw new AppError('Opción de jornada no encontrada.', 404)
  if (payload.isPreferred) {
    await upsertPreferredJourneyOption({
      db,
      tenantId,
      academicYearId: payload.academicYearId,
      groupId: payload.groupId,
      selectedOptionId: id,
    })
  }
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'group_journey_options', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Opción de jornada actualizada', { id }))
})

academicRoutes.delete('/group-journey-options/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  const [currentOption] = await db
    .select({
      academicYearId: groupJourneyOptions.academicYearId,
      groupId: groupJourneyOptions.groupId,
      journeyId: groupJourneyOptions.journeyId,
      isPreferred: groupJourneyOptions.isPreferred,
    })
    .from(groupJourneyOptions)
    .where(and(eq(groupJourneyOptions.id, id), eq(groupJourneyOptions.tenantId, tenantId), eq(groupJourneyOptions.isDeleted, false)))
    .limit(1)
  if (!currentOption) throw new AppError('Opción de jornada no encontrada.', 404)

  const [[timetableUsage]] = await Promise.all([
    db.select({ total: count() }).from(groupTimetableEntries).where(and(eq(groupTimetableEntries.tenantId, tenantId), eq(groupTimetableEntries.groupId, currentOption.groupId), eq(groupTimetableEntries.journeyId, currentOption.journeyId), eq(groupTimetableEntries.isDeleted, false))),
  ])
  if ((timetableUsage?.total ?? 0) > 0) throw new AppError('No se puede eliminar la opción porque ese curso ya tiene un horario generado con esa jornada.', 409)

  await db.update(groupJourneyOptions).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(groupJourneyOptions.id, id), eq(groupJourneyOptions.tenantId, tenantId), eq(groupJourneyOptions.isDeleted, false)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'group_journey_options', entityId: id, action: 'delete' })
  return c.json(ok('Opción de jornada eliminada', { id }))
})

academicRoutes.get('/timetable', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const academicYearId = c.req.query('academicYearId')
  const groupId = c.req.query('groupId')
  const journeyId = c.req.query('journeyId')
  let teacherId = c.req.query('teacherId')

  if (!academicYearId) throw new AppError('Debes indicar el año lectivo.', 400)

  if (user.roleCodes.includes('teacher')) {
    const teacherRecord = await db.query.teachers.findFirst({
      where: and(eq(teachers.tenantId, tenantId), eq(teachers.userId, user.id), eq(teachers.isDeleted, false)),
    })
    if (!teacherRecord) throw new AppError('Usuario no está registrado como docente activo', 403)
    teacherId = teacherRecord.id
  }

  const conditions = [
    eq(groupTimetableEntries.tenantId, tenantId),
    eq(groupTimetableEntries.academicYearId, academicYearId),
    eq(groupTimetableEntries.isDeleted, false),
  ]
  if (groupId) conditions.push(eq(groupTimetableEntries.groupId, groupId))
  if (journeyId) conditions.push(eq(groupTimetableEntries.journeyId, journeyId))
  if (teacherId) conditions.push(eq(groupTimetableEntries.teacherId, teacherId))

  const items = await db
    .select({
      id: groupTimetableEntries.id,
      tenantId: groupTimetableEntries.tenantId,
      academicYearId: groupTimetableEntries.academicYearId,
      groupId: groupTimetableEntries.groupId,
      groupName: groups.name,
      gradeName: grades.name,
      journeyId: groupTimetableEntries.journeyId,
      journeyName: academicYearJourneys.name,
      journeySlotId: groupTimetableEntries.journeySlotId,
      courseSubjectId: groupTimetableEntries.courseSubjectId,
      subjectId: groupTimetableEntries.subjectId,
      subjectName: subjects.name,
      teacherId: groupTimetableEntries.teacherId,
      teacherName: teachers.fullName,
      branchName: schoolBranches.name,
      dayOfWeek: groupTimetableEntries.dayOfWeek,
      slotOrder: groupTimetableEntries.slotOrder,
      startsAt: academicYearJourneySlots.startsAt,
      endsAt: academicYearJourneySlots.endsAt,
      entryType: groupTimetableEntries.entryType,
      status: groupTimetableEntries.status,
      notes: groupTimetableEntries.notes,
      createdAt: groupTimetableEntries.createdAt,
      updatedAt: groupTimetableEntries.updatedAt,
    })
    .from(groupTimetableEntries)
    .innerJoin(groups, eq(groups.id, groupTimetableEntries.groupId))
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .innerJoin(academicYearJourneys, eq(academicYearJourneys.id, groupTimetableEntries.journeyId))
    .innerJoin(academicYearJourneySlots, eq(academicYearJourneySlots.id, groupTimetableEntries.journeySlotId))
    .innerJoin(subjects, eq(subjects.id, groupTimetableEntries.subjectId))
    .leftJoin(teachers, eq(teachers.id, groupTimetableEntries.teacherId))
    .leftJoin(schoolBranches, eq(schoolBranches.id, academicYearJourneys.branchId))
    .where(and(...conditions))
    .orderBy(asc(groups.name), asc(groupTimetableEntries.dayOfWeek), asc(groupTimetableEntries.slotOrder))

  const sortedItems = items.sort((left, right) => {
    if (left.groupName !== right.groupName) return left.groupName.localeCompare(right.groupName)
    const leftDay = weekdayOrderMap.get(left.dayOfWeek as Weekday) ?? 99
    const rightDay = weekdayOrderMap.get(right.dayOfWeek as Weekday) ?? 99
    if (leftDay !== rightDay) return leftDay - rightDay
    return left.slotOrder - right.slotOrder
  })

  return c.json(ok('Horario cargado', {
    items: sortedItems.map((item) => ({
      ...item,
      courseSubjectId: item.courseSubjectId ?? null,
      teacherId: item.teacherId ?? null,
      teacherName: item.teacherName ?? null,
      branchName: item.branchName ?? null,
      notes: item.notes ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  }))
})

academicRoutes.put('/timetable/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', timetableEntryUpdateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const entry = await ensureTimetableEntryEditable({ db, tenantId, entryId: id })
  const slot = await ensureTimetableSlotAvailable({
    db,
    tenantId,
    entryId: id,
    academicYearId: entry.academicYearId,
    groupId: entry.groupId,
    teacherId: entry.teacherId,
    journeyId: payload.journeyId,
    journeySlotId: payload.journeySlotId,
  })

  const [updated] = await db
    .update(groupTimetableEntries)
    .set({
      journeyId: payload.journeyId,
      journeySlotId: payload.journeySlotId,
      dayOfWeek: slot.dayOfWeek,
      slotOrder: slot.slotOrder,
      notes: payload.notes || null,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(and(eq(groupTimetableEntries.id, id), eq(groupTimetableEntries.tenantId, tenantId), eq(groupTimetableEntries.isDeleted, false)))
    .returning()

  if (!updated) throw new AppError('No fue posible actualizar el bloque del horario.', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'group_timetable_entries', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Bloque de horario actualizado', { id }))
})

academicRoutes.patch('/timetable/status', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', timetableStatusSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const conditions = [
    eq(groupTimetableEntries.tenantId, tenantId),
    eq(groupTimetableEntries.academicYearId, payload.academicYearId),
    eq(groupTimetableEntries.isDeleted, false),
  ]
  if (payload.groupId) conditions.push(eq(groupTimetableEntries.groupId, payload.groupId))
  if (payload.journeyId) conditions.push(eq(groupTimetableEntries.journeyId, payload.journeyId))

  const entries = await db
    .select({ id: groupTimetableEntries.id, status: groupTimetableEntries.status })
    .from(groupTimetableEntries)
    .where(and(...conditions))

  if (entries.length === 0) throw new AppError('No se encontraron bloques para actualizar el estado.', 404)
  if (payload.status === 'draft' && entries.some((entry) => entry.status === 'locked')) {
    throw new AppError('No puedes devolver a borrador bloques que ya están bloqueados.', 409)
  }

  await db
    .update(groupTimetableEntries)
    .set({
      status: payload.status,
      updatedAt: new Date(),
      updatedBy: user.id,
    })
    .where(and(...conditions))

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'group_timetable_entries',
    entityId: payload.academicYearId,
    action: 'status_change',
    changes: payload,
  })

  return c.json(ok('Estado del horario actualizado', {
    academicYearId: payload.academicYearId,
    status: payload.status,
    affectedEntries: entries.length,
  }))
})

academicRoutes.post('/timetable/generate', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', timetableGenerationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [academicYear] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(and(eq(academicYears.id, payload.academicYearId), eq(academicYears.tenantId, tenantId), eq(academicYears.isDeleted, false)))
    .limit(1)
  if (!academicYear) throw new AppError('El año lectivo seleccionado no existe.', 404)

  const groupsToGenerate = await db
    .select({
      id: groups.id,
      name: groups.name,
      gradeName: grades.name,
    })
    .from(groups)
    .innerJoin(grades, eq(grades.id, groups.gradeId))
    .where(and(
      eq(groups.tenantId, tenantId),
      eq(groups.academicYearId, payload.academicYearId),
      eq(groups.isDeleted, false),
      payload.groupIds.length ? inArray(groups.id, payload.groupIds) : undefined,
    ))
    .orderBy(asc(groups.name))

  if (groupsToGenerate.length === 0) throw new AppError('No se encontraron cursos para generar el horario.', 404)

  const optionRows = await db
    .select({
      groupId: groupJourneyOptions.groupId,
      journeyId: groupJourneyOptions.journeyId,
      journeyName: academicYearJourneys.name,
      priority: groupJourneyOptions.priority,
      isPreferred: groupJourneyOptions.isPreferred,
    })
    .from(groupJourneyOptions)
    .innerJoin(academicYearJourneys, eq(academicYearJourneys.id, groupJourneyOptions.journeyId))
    .where(and(
      eq(groupJourneyOptions.tenantId, tenantId),
      eq(groupJourneyOptions.academicYearId, payload.academicYearId),
      eq(groupJourneyOptions.isDeleted, false),
      inArray(groupJourneyOptions.groupId, groupsToGenerate.map((group) => group.id)),
    ))
    .orderBy(desc(groupJourneyOptions.isPreferred), asc(groupJourneyOptions.priority), asc(academicYearJourneys.name))

  const optionsByGroup = optionRows.reduce<Record<string, typeof optionRows>>((acc, row) => {
    const bucket = acc[row.groupId] ?? (acc[row.groupId] = [])
    bucket.push(row)
    return acc
  }, {})

  const existingEntries = await db
    .select({
      groupId: groupTimetableEntries.groupId,
      teacherId: groupTimetableEntries.teacherId,
      dayOfWeek: groupTimetableEntries.dayOfWeek,
      slotOrder: groupTimetableEntries.slotOrder,
    })
    .from(groupTimetableEntries)
    .where(and(
      eq(groupTimetableEntries.tenantId, tenantId),
      eq(groupTimetableEntries.academicYearId, payload.academicYearId),
      eq(groupTimetableEntries.isDeleted, false),
      payload.overwriteExisting && groupsToGenerate.length
        ? undefined
        : undefined,
    ))

  const targetGroupIds = new Set(groupsToGenerate.map((group) => group.id))
  const existingTeacherSlotKeys = new Set(
    existingEntries
      .filter((entry) => entry.teacherId && !(payload.overwriteExisting && targetGroupIds.has(entry.groupId)))
      .map((entry) => `${entry.teacherId}:${buildTimetableSlotKey(entry.dayOfWeek, entry.slotOrder)}`),
  )

  const result = {
    academicYearId: payload.academicYearId,
    generatedGroups: 0,
    generatedEntries: 0,
    blockedGroups: [] as string[],
    conflicts: [] as string[],
    groups: [] as Array<{
      groupId: string
      groupName: string
      gradeName: string | null
      journeyId: string | null
      journeyName: string | null
      generatedEntries: number
      conflicts: string[]
    }>,
  }

  for (const group of groupsToGenerate) {
    const groupOptions = optionsByGroup[group.id] ?? []
    const summary = await generateGroupTimetable({
      db,
      tenantId,
      academicYearId: payload.academicYearId,
      group,
      options: groupOptions,
      existingTeacherSlotKeys,
      overwriteExisting: payload.overwriteExisting,
      userId: user.id,
    })

    if (summary.blocked) result.blockedGroups.push(group.id)
    else result.generatedGroups += 1
    result.generatedEntries += summary.generatedEntries
    result.conflicts.push(...summary.conflicts.map((conflict) => `${group.gradeName ?? 'Curso'} ${group.name}: ${conflict}`))
    result.groups.push({
      groupId: group.id,
      groupName: group.name,
      gradeName: group.gradeName ?? null,
      journeyId: summary.journeyId,
      journeyName: summary.journeyName,
      generatedEntries: summary.generatedEntries,
      conflicts: summary.conflicts,
    })
  }

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'group_timetable_entries',
    entityId: payload.academicYearId,
    action: 'generate',
    changes: {
      academicYearId: payload.academicYearId,
      groupIds: payload.groupIds,
      overwriteExisting: payload.overwriteExisting,
      generatedGroups: result.generatedGroups,
      generatedEntries: result.generatedEntries,
      blockedGroups: result.blockedGroups,
    },
  })

  return c.json(ok('Horario generado', result))
})

academicRoutes.get('/achievements', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const { query, page, pageSize, offset } = readPaginationFilters(c)
  const academicYearId = c.req.query('academicYearId') ?? ''
  const academicPeriodId = c.req.query('academicPeriodId') ?? ''
  const gradeId = c.req.query('gradeId') ?? ''
  const subjectId = c.req.query('subjectId') ?? ''
  const searchFilter = query ? or(ilike(learningAchievements.title, `%${query}%`), ilike(learningAchievements.code, `%${query}%`), ilike(subjects.name, `%${query}%`)) : undefined
  const whereClause = and(
    eq(learningAchievements.tenantId, tenantId),
    eq(learningAchievements.isDeleted, false),
    academicYearId ? eq(learningAchievements.academicYearId, academicYearId) : undefined,
    academicPeriodId ? eq(learningAchievements.academicPeriodId, academicPeriodId) : undefined,
    gradeId ? eq(learningAchievements.gradeId, gradeId) : undefined,
    subjectId ? eq(learningAchievements.subjectId, subjectId) : undefined,
    searchFilter,
  )
  const items = await db
    .select({ 
      item: learningAchievements, 
      year: academicYears, 
      period: academicPeriods, 
      grade: grades, 
      subject: subjects,
      competency: competencies
    })
    .from(learningAchievements)
    .innerJoin(academicYears, eq(academicYears.id, learningAchievements.academicYearId))
    .innerJoin(academicPeriods, eq(academicPeriods.id, learningAchievements.academicPeriodId))
    .innerJoin(grades, eq(grades.id, learningAchievements.gradeId))
    .innerJoin(subjects, eq(subjects.id, learningAchievements.subjectId))
    .leftJoin(competencies, eq(competencies.id, learningAchievements.competencyId))
    .where(whereClause)
    .orderBy(asc(learningAchievements.orderNumber), desc(learningAchievements.createdAt))
    .limit(pageSize)
    .offset(offset)

  const [totalRow] = await db.select({ total: count() }).from(learningAchievements).innerJoin(subjects, eq(subjects.id, learningAchievements.subjectId)).where(whereClause)

  const achievementIds = items.map(({ item }) => item.id)
  const allIndicators = achievementIds.length
    ? await db
        .select()
        .from(achievementIndicators)
        .where(and(
          eq(achievementIndicators.tenantId, tenantId),
          eq(achievementIndicators.isDeleted, false),
          inArray(achievementIndicators.achievementId, achievementIds)
        ))
        .orderBy(asc(achievementIndicators.orderNumber))
    : []
  
  const indicatorsMap = new Map<string, any[]>()
  for (const ind of allIndicators) {
    if (!indicatorsMap.has(ind.achievementId)) {
      indicatorsMap.set(ind.achievementId, [])
    }
    indicatorsMap.get(ind.achievementId)!.push({
      id: ind.id,
      tenantId: ind.tenantId,
      achievementId: ind.achievementId,
      description: ind.description,
      orderNumber: ind.orderNumber,
      isActive: ind.isActive,
      createdAt: ind.createdAt.toISOString(),
      updatedAt: ind.updatedAt.toISOString(),
    })
  }

  return c.json(ok('Logros cargados', {
    items: items.map(({ item, year, period, grade, subject, competency }) => ({
      id: item.id,
      tenantId: item.tenantId,
      academicYearId: item.academicYearId,
      academicYearName: year.name,
      academicPeriodId: item.academicPeriodId,
      academicPeriodName: period.name,
      gradeId: item.gradeId,
      gradeName: grade.name,
      subjectId: item.subjectId,
      subjectName: subject.name,
      code: item.code,
      title: item.title,
      description: item.description,
      weight: item.weight,
      competencyId: item.competencyId,
      competencyName: competency ? competency.name : null,
      orderNumber: item.orderNumber,
      expectedPerformance: item.expectedPerformance,
      indicators: indicatorsMap.get(item.id) || [],
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  }))
})

academicRoutes.post('/achievements', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', achievementSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  await ensureAchievementPlacement({ db, tenantId, academicYearId: payload.academicYearId, academicPeriodId: payload.academicPeriodId, gradeId: payload.gradeId, subjectId: payload.subjectId })
  const [item] = await db.insert(learningAchievements).values({ tenantId, ...payload, createdBy: user.id, updatedBy: user.id }).returning()
  if (!item) throw new AppError('No fue posible crear el logro', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'learning_achievements', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Logro creado', { id: item.id }), 201)
})

academicRoutes.put('/achievements/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', achievementSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')
  await ensureAchievementPlacement({ db, tenantId, academicYearId: payload.academicYearId, academicPeriodId: payload.academicPeriodId, gradeId: payload.gradeId, subjectId: payload.subjectId })
  const [item] = await db.update(learningAchievements).set({ ...payload, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(learningAchievements.id, id), eq(learningAchievements.tenantId, tenantId), eq(learningAchievements.isDeleted, false))).returning()
  if (!item) throw new AppError('Logro no encontrado', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'learning_achievements', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Logro actualizado', { id }))
})

academicRoutes.delete('/achievements/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  await db.update(learningAchievements).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(learningAchievements.id, id), eq(learningAchievements.tenantId, tenantId), eq(learningAchievements.isDeleted, false)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'learning_achievements', entityId: id, action: 'delete' })
  return c.json(ok('Logro eliminado', { id }))
})

academicRoutes.get('/gradebook', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', gradebookFiltersSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')
  await ensureGradebookPlacement({ db, tenantId, academicYearId: filters.academicYearId, academicPeriodId: filters.academicPeriodId, groupId: filters.groupId, subjectId: filters.subjectId })

  const [group] = await db
    .select({ gradeId: groups.gradeId })
    .from(groups)
    .where(and(eq(groups.tenantId, tenantId), eq(groups.id, filters.groupId), eq(groups.isDeleted, false)))
    .limit(1)

  if (!group?.gradeId) throw new AppError('No se encontró el grado del curso seleccionado.', 404)

  const resolvedScale = await resolveGradingScaleForGrade({
    db,
    tenantId,
    academicYearId: filters.academicYearId,
    gradeId: group.gradeId,
  })

  const enrolledStudents = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      documentType: students.documentType,
      documentNumber: students.documentNumber,
      groupName: groups.name,
      periodName: academicPeriods.name,
      subjectName: subjects.name,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(academicPeriods, eq(academicPeriods.id, filters.academicPeriodId))
    .innerJoin(subjects, eq(subjects.id, filters.subjectId))
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.academicYearId, filters.academicYearId),
        eq(enrollments.groupId, filters.groupId),
        eq(enrollments.isDeleted, false),
        ne(enrollments.enrollmentStatus, 'cancelled'),
        eq(students.isDeleted, false),
      ),
    )
    .orderBy(asc(students.firstName), asc(students.lastName))

  const studentIds = enrolledStudents.map((item) => item.studentId)
  const gradeRows = studentIds.length
    ? await db
      .select()
      .from(gradeRecords)
      .where(and(eq(gradeRecords.tenantId, tenantId), eq(gradeRecords.subjectId, filters.subjectId), eq(gradeRecords.academicPeriodId, filters.academicPeriodId), eq(gradeRecords.isDeleted, false), or(...studentIds.map((studentId) => eq(gradeRecords.studentId, studentId)))))
    : []

  const gradeByStudentId = new Map<string, typeof gradeRows[number]>()
  for (const row of gradeRows) {
    if (!gradeByStudentId.has(row.studentId)) gradeByStudentId.set(row.studentId, row)
  }

  return c.json(ok('Libro de notas cargado', {
    items: enrolledStudents.map((item) => {
      const record = gradeByStudentId.get(item.studentId)
      return {
        studentId: item.studentId,
        studentName: [item.firstName, item.middleName, item.lastName].filter(Boolean).join(' '),
        studentDocument: `${item.documentType} ${item.documentNumber}`.trim(),
        enrollmentId: item.enrollmentId,
        groupId: filters.groupId,
        groupName: item.groupName,
        gradeRecordId: record?.id ?? null,
        subjectId: filters.subjectId,
        subjectName: item.subjectName,
        academicPeriodId: filters.academicPeriodId,
        academicPeriodName: item.periodName,
        score: record ? Number(record.score) : null,
        gradeValue: record?.gradeValue ?? (record ? resolveDisplayedGradeValue({ score: Number(record.score), scale: resolvedScale }) : null),
        gradeValueType: record?.gradeValueType ?? resolvedScale.scaleType,
        maxScore: record ? Number(record.maxScore) : resolvedScale.maxValue,
        notes: record?.notes ?? null,
      }
    }),
    scale: {
      id: resolvedScale.id,
      name: resolvedScale.name,
      minValue: resolvedScale.minValue,
      maxValue: resolvedScale.maxValue,
      passingValue: resolvedScale.passingValue,
      decimalPlaces: resolvedScale.decimalPlaces,
      scaleType: resolvedScale.scaleType,
      ranges: resolvedScale.ranges,
    },
  }))
})

academicRoutes.get('/report-cards/student', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', reportCardFiltersSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')

  const [enrollment] = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      documentType: students.documentType,
      documentNumber: students.documentNumber,
      academicYearId: academicYears.id,
      academicYearName: academicYears.name,
      academicPeriodId: academicPeriods.id,
      academicPeriodName: academicPeriods.name,
      academicPeriodWeight: academicPeriods.weight,
      academicPeriodStatus: academicPeriods.status,
      gradeId: grades.id,
      gradeName: grades.name,
      groupId: groups.id,
      groupName: groups.name,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .innerJoin(academicPeriods, eq(academicPeriods.id, filters.academicPeriodId))
    .innerJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.studentId, filters.studentId),
      eq(enrollments.academicYearId, filters.academicYearId),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled'),
      eq(students.isDeleted, false),
      eq(academicYears.isDeleted, false),
      eq(academicPeriods.tenantId, tenantId),
      eq(academicPeriods.academicYearId, filters.academicYearId),
      eq(academicPeriods.isDeleted, false),
      eq(grades.isDeleted, false),
    ))
    .limit(1)

  if (!enrollment) {
    throw new AppError('No se encontró matrícula activa del estudiante para el año y periodo seleccionados.', 404)
  }

  const resolvedScale = await resolveGradingScaleForGrade({
    db,
    tenantId,
    academicYearId: filters.academicYearId,
    gradeId: enrollment.gradeId,
  })

  const gradeSubjectRows = await db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      academicAreaName: academicAreas.name,
    })
    .from(gradeSubjects)
    .innerJoin(subjects, eq(subjects.id, gradeSubjects.subjectId))
    .leftJoin(academicAreas, eq(academicAreas.id, subjects.academicAreaId))
    .where(and(
      eq(gradeSubjects.tenantId, tenantId),
      eq(gradeSubjects.academicYearId, filters.academicYearId),
      eq(gradeSubjects.gradeId, enrollment.gradeId),
      eq(gradeSubjects.isDeleted, false),
      eq(subjects.isDeleted, false),
    ))
    .orderBy(asc(academicAreas.orderNumber), asc(subjects.name))

  const subjectIds = gradeSubjectRows.map((item) => item.subjectId)

  const [gradeRows, observationRows, supportRows, attendanceRows, teacherRows, groupDirectorRow] = await Promise.all([
    subjectIds.length
      ? db
        .select({
          subjectId: gradeRecords.subjectId,
          score: gradeRecords.score,
          gradeValue: gradeRecords.gradeValue,
          gradeValueType: gradeRecords.gradeValueType,
          maxScore: gradeRecords.maxScore,
          notes: gradeRecords.notes,
        })
        .from(gradeRecords)
        .where(and(
          eq(gradeRecords.tenantId, tenantId),
          eq(gradeRecords.studentId, filters.studentId),
          eq(gradeRecords.academicPeriodId, filters.academicPeriodId),
          eq(gradeRecords.isDeleted, false),
          inArray(gradeRecords.subjectId, subjectIds),
        ))
      : Promise.resolve([]),
    subjectIds.length
      ? db
        .select({
          id: academicObservations.id,
          subjectId: academicObservations.subjectId,
          observationType: academicObservations.observationType,
          text: academicObservations.text,
        })
        .from(academicObservations)
        .where(and(
          eq(academicObservations.tenantId, tenantId),
          eq(academicObservations.studentId, filters.studentId),
          eq(academicObservations.academicYearId, filters.academicYearId),
          eq(academicObservations.academicPeriodId, filters.academicPeriodId),
          eq(academicObservations.isDeleted, false),
          inArray(academicObservations.subjectId, subjectIds),
        ))
      : Promise.resolve([]),
    subjectIds.length
      ? db
        .select({
          id: supportStrategies.id,
          subjectId: supportStrategies.subjectId,
          description: supportStrategies.description,
          dueDate: supportStrategies.dueDate,
          status: supportStrategies.status,
          resultScore: supportStrategies.resultScore,
          achievementCode: learningAchievements.code,
        })
        .from(supportStrategies)
        .leftJoin(learningAchievements, eq(learningAchievements.id, supportStrategies.achievementId))
        .where(and(
          eq(supportStrategies.tenantId, tenantId),
          eq(supportStrategies.studentId, filters.studentId),
          eq(supportStrategies.academicYearId, filters.academicYearId),
          eq(supportStrategies.academicPeriodId, filters.academicPeriodId),
          eq(supportStrategies.isDeleted, false),
          inArray(supportStrategies.subjectId, subjectIds),
        ))
      : Promise.resolve([]),
    subjectIds.length
      ? db
        .select({
          subjectId: attendanceRecords.subjectId,
          status: attendanceRecords.status,
        })
        .from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.tenantId, tenantId),
          eq(attendanceRecords.studentId, filters.studentId),
          eq(attendanceRecords.academicYearId, filters.academicYearId),
          eq(attendanceRecords.academicPeriodId, filters.academicPeriodId),
          eq(attendanceRecords.isDeleted, false),
          inArray(attendanceRecords.subjectId, subjectIds),
        ))
      : Promise.resolve([]),
    enrollment.groupId
      ? db
        .select({
          subjectId: courseSubjects.subjectId,
          teacherName: teachers.fullName,
        })
        .from(courseSubjects)
        .leftJoin(teachers, eq(teachers.id, courseSubjects.teacherId))
        .where(and(
          eq(courseSubjects.tenantId, tenantId),
          eq(courseSubjects.academicYearId, filters.academicYearId),
          eq(courseSubjects.groupId, enrollment.groupId),
          eq(courseSubjects.isDeleted, false),
        ))
      : Promise.resolve([]),
    enrollment.groupId
      ? db
        .select({ teacherName: teachers.fullName })
        .from(teacherResponsibilities)
        .innerJoin(teachers, eq(teachers.id, teacherResponsibilities.teacherId))
        .where(and(
          eq(teacherResponsibilities.tenantId, tenantId),
          eq(teacherResponsibilities.academicYearId, filters.academicYearId),
          eq(teacherResponsibilities.groupId, enrollment.groupId),
          eq(teacherResponsibilities.responsibilityType, 'group_director'),
          eq(teacherResponsibilities.isDeleted, false),
        ))
        .limit(1)
      : Promise.resolve([]),
  ])

  const gradesBySubject = new Map(gradeRows.map((row) => [row.subjectId, row]))
  const teachersBySubject = new Map(teacherRows.map((row) => [row.subjectId, row.teacherName]))

  const observationsBySubject = new Map<string, Array<{ id: string; type: string; text: string }>>()
  for (const row of observationRows) {
    const current = observationsBySubject.get(row.subjectId) ?? []
    current.push({ id: row.id, type: row.observationType, text: row.text })
    observationsBySubject.set(row.subjectId, current)
  }

  const supportBySubject = new Map<string, Array<{
    id: string
    achievementCode: string | null
    description: string
    dueDate: string | null
    status: string
    resultScore: number | null
  }>>()
  for (const row of supportRows) {
    const current = supportBySubject.get(row.subjectId) ?? []
    current.push({
      id: row.id,
      achievementCode: row.achievementCode ?? null,
      description: row.description,
      dueDate: row.dueDate ?? null,
      status: row.status,
      resultScore: row.resultScore ? Number(row.resultScore) : null,
    })
    supportBySubject.set(row.subjectId, current)
  }

  const attendanceBySubject = new Map<string, { absent: number; late: number; excused: number; present: number }>()
  const overallAttendance = { absent: 0, late: 0, excused: 0, present: 0 }
  for (const row of attendanceRows) {
    if (!row.subjectId) continue
    const current = attendanceBySubject.get(row.subjectId) ?? { absent: 0, late: 0, excused: 0, present: 0 }
    if (row.status === 'absent') {
      current.absent += 1
      overallAttendance.absent += 1
    } else if (row.status === 'late') {
      current.late += 1
      overallAttendance.late += 1
    } else if (row.status === 'excused') {
      current.excused += 1
      overallAttendance.excused += 1
    } else {
      current.present += 1
      overallAttendance.present += 1
    }
    attendanceBySubject.set(row.subjectId, current)
  }

  const reportSubjects = gradeSubjectRows.map((subject) => {
    const grade = gradesBySubject.get(subject.subjectId)
    const numericScore = grade ? Number(grade.score) : null
    const performance = numericScore === null ? null : calculatePerformanceLevel(numericScore, resolvedScale.ranges)
    return {
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      academicAreaName: subject.academicAreaName ?? null,
      teacherName: teachersBySubject.get(subject.subjectId) ?? null,
      score: numericScore,
      gradeValue: grade?.gradeValue ?? (numericScore === null ? null : resolveDisplayedGradeValue({ score: numericScore, scale: resolvedScale })),
      gradeValueType: grade?.gradeValueType ?? resolvedScale.scaleType,
      maxScore: grade ? Number(grade.maxScore) : null,
      performanceLevel: performance?.nationalLevel ?? null,
      institutionalLabel: performance?.institutionalLabel ?? null,
      isPassing: performance?.isPassing ?? null,
      notes: grade?.notes ?? null,
      attendance: attendanceBySubject.get(subject.subjectId) ?? { absent: 0, late: 0, excused: 0, present: 0 },
      observations: observationsBySubject.get(subject.subjectId) ?? [],
      supportStrategies: supportBySubject.get(subject.subjectId) ?? [],
    }
  })

  const scoredSubjects = reportSubjects.filter((subject) => typeof subject.score === 'number')
  const averageScore = scoredSubjects.length
    ? Number((scoredSubjects.reduce((sum, subject) => sum + Number(subject.score), 0) / scoredSubjects.length).toFixed(2))
    : null

  const pendingSupportStrategies = reportSubjects.reduce(
    (sum, subject) => sum + subject.supportStrategies.filter((item) => item.status === 'pending').length,
    0,
  )

  return c.json(ok('Boletín académico generado', {
    generatedAt: new Date().toISOString(),
    student: {
      id: enrollment.studentId,
      fullName: [enrollment.firstName, enrollment.middleName, enrollment.lastName].filter(Boolean).join(' '),
      document: `${enrollment.documentType} ${enrollment.documentNumber}`.trim(),
    },
    academicYear: {
      id: enrollment.academicYearId,
      name: enrollment.academicYearName,
    },
    academicPeriod: {
      id: enrollment.academicPeriodId,
      name: enrollment.academicPeriodName,
      weight: enrollment.academicPeriodWeight,
      status: enrollment.academicPeriodStatus,
    },
    enrollment: {
      id: enrollment.enrollmentId,
      gradeName: enrollment.gradeName,
      groupName: enrollment.groupName ?? null,
    },
    scale: {
      id: resolvedScale.id,
      name: resolvedScale.name,
      minValue: resolvedScale.minValue,
      passingValue: resolvedScale.passingValue,
      maxValue: resolvedScale.maxValue,
      decimalPlaces: resolvedScale.decimalPlaces,
      scaleType: resolvedScale.scaleType,
    },
    groupDirector: groupDirectorRow[0]?.teacherName ?? null,
    summary: {
      subjectsWithGrades: scoredSubjects.length,
      totalSubjects: reportSubjects.length,
      averageScore,
      attendance: overallAttendance,
      pendingSupportStrategies,
    },
    subjects: reportSubjects,
  }))
})

academicRoutes.get('/report-cards/student-annual', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', annualReportCardFiltersSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')

  const [enrollment] = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      documentType: students.documentType,
      documentNumber: students.documentNumber,
      academicYearId: academicYears.id,
      academicYearName: academicYears.name,
      gradeId: grades.id,
      gradeName: grades.name,
      groupId: groups.id,
      groupName: groups.name,
      promotionStatus: enrollments.promotionStatus,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(academicYears, eq(academicYears.id, enrollments.academicYearId))
    .innerJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.studentId, filters.studentId),
      eq(enrollments.academicYearId, filters.academicYearId),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled'),
      eq(students.isDeleted, false),
      eq(academicYears.isDeleted, false),
      eq(grades.isDeleted, false),
    ))
    .limit(1)

  if (!enrollment) {
    throw new AppError('No se encontró matrícula activa del estudiante para el año seleccionado.', 404)
  }

  const resolvedScale = await resolveGradingScaleForGrade({
    db,
    tenantId,
    academicYearId: filters.academicYearId,
    gradeId: enrollment.gradeId,
  })

  const periods = await db
    .select({
      id: academicPeriods.id,
      name: academicPeriods.name,
      weight: academicPeriods.weight,
    })
    .from(academicPeriods)
    .where(and(
      eq(academicPeriods.tenantId, tenantId),
      eq(academicPeriods.academicYearId, filters.academicYearId),
      eq(academicPeriods.isDeleted, false),
    ))
    .orderBy(asc(academicPeriods.startsOn), asc(academicPeriods.name))

  const periodById = new Map(periods.map((period) => [period.id, period]))

  const subjectAssignments = await db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      academicAreaName: academicAreas.name,
    })
    .from(gradeSubjects)
    .innerJoin(subjects, eq(subjects.id, gradeSubjects.subjectId))
    .leftJoin(academicAreas, eq(academicAreas.id, subjects.academicAreaId))
    .where(and(
      eq(gradeSubjects.tenantId, tenantId),
      eq(gradeSubjects.academicYearId, filters.academicYearId),
      eq(gradeSubjects.gradeId, enrollment.gradeId),
      eq(gradeSubjects.isDeleted, false),
      eq(subjects.isDeleted, false),
    ))
    .orderBy(asc(academicAreas.orderNumber), asc(subjects.name))

  const subjectIds = subjectAssignments.map((item) => item.subjectId)

  const [gradeRows, observationRows, supportRows, attendanceRows, teacherRows, groupDirectorRow] = await Promise.all([
    subjectIds.length
      ? db
        .select({
          subjectId: gradeRecords.subjectId,
          academicPeriodId: gradeRecords.academicPeriodId,
          score: gradeRecords.score,
          gradeValue: gradeRecords.gradeValue,
          gradeValueType: gradeRecords.gradeValueType,
        })
        .from(gradeRecords)
        .where(and(
          eq(gradeRecords.tenantId, tenantId),
          eq(gradeRecords.studentId, filters.studentId),
          eq(gradeRecords.academicYearId, filters.academicYearId),
          eq(gradeRecords.isDeleted, false),
          inArray(gradeRecords.subjectId, subjectIds),
        ))
      : Promise.resolve([]),
    subjectIds.length
      ? db
        .select({
          id: academicObservations.id,
          subjectId: academicObservations.subjectId,
          observationType: academicObservations.observationType,
          text: academicObservations.text,
        })
        .from(academicObservations)
        .where(and(
          eq(academicObservations.tenantId, tenantId),
          eq(academicObservations.studentId, filters.studentId),
          eq(academicObservations.academicYearId, filters.academicYearId),
          eq(academicObservations.isDeleted, false),
          inArray(academicObservations.subjectId, subjectIds),
        ))
      : Promise.resolve([]),
    subjectIds.length
      ? db
        .select({
          id: supportStrategies.id,
          subjectId: supportStrategies.subjectId,
          description: supportStrategies.description,
          dueDate: supportStrategies.dueDate,
          status: supportStrategies.status,
          resultScore: supportStrategies.resultScore,
          achievementCode: learningAchievements.code,
        })
        .from(supportStrategies)
        .leftJoin(learningAchievements, eq(learningAchievements.id, supportStrategies.achievementId))
        .where(and(
          eq(supportStrategies.tenantId, tenantId),
          eq(supportStrategies.studentId, filters.studentId),
          eq(supportStrategies.academicYearId, filters.academicYearId),
          eq(supportStrategies.isDeleted, false),
          inArray(supportStrategies.subjectId, subjectIds),
        ))
      : Promise.resolve([]),
    subjectIds.length
      ? db
        .select({
          subjectId: attendanceRecords.subjectId,
          status: attendanceRecords.status,
        })
        .from(attendanceRecords)
        .where(and(
          eq(attendanceRecords.tenantId, tenantId),
          eq(attendanceRecords.studentId, filters.studentId),
          eq(attendanceRecords.academicYearId, filters.academicYearId),
          eq(attendanceRecords.isDeleted, false),
          inArray(attendanceRecords.subjectId, subjectIds),
        ))
      : Promise.resolve([]),
    enrollment.groupId
      ? db
        .select({
          subjectId: courseSubjects.subjectId,
          teacherName: teachers.fullName,
        })
        .from(courseSubjects)
        .leftJoin(teachers, eq(teachers.id, courseSubjects.teacherId))
        .where(and(
          eq(courseSubjects.tenantId, tenantId),
          eq(courseSubjects.academicYearId, filters.academicYearId),
          eq(courseSubjects.groupId, enrollment.groupId),
          eq(courseSubjects.isDeleted, false),
        ))
      : Promise.resolve([]),
    enrollment.groupId
      ? db
        .select({ teacherName: teachers.fullName })
        .from(teacherResponsibilities)
        .innerJoin(teachers, eq(teachers.id, teacherResponsibilities.teacherId))
        .where(and(
          eq(teacherResponsibilities.tenantId, tenantId),
          eq(teacherResponsibilities.academicYearId, filters.academicYearId),
          eq(teacherResponsibilities.groupId, enrollment.groupId),
          eq(teacherResponsibilities.responsibilityType, 'group_director'),
          eq(teacherResponsibilities.isDeleted, false),
        ))
        .limit(1)
      : Promise.resolve([]),
  ])

  const teachersBySubject = new Map(teacherRows.map((row) => [row.subjectId, row.teacherName]))
  const observationsBySubject = new Map<string, Array<{ id: string; type: string; text: string }>>()
  for (const row of observationRows) {
    const current = observationsBySubject.get(row.subjectId) ?? []
    current.push({ id: row.id, type: row.observationType, text: row.text })
    observationsBySubject.set(row.subjectId, current)
  }
  const supportBySubject = new Map<string, Array<{ id: string; achievementCode: string | null; description: string; dueDate: string | null; status: string; resultScore: number | null }>>()
  for (const row of supportRows) {
    const current = supportBySubject.get(row.subjectId) ?? []
    current.push({
      id: row.id,
      achievementCode: row.achievementCode ?? null,
      description: row.description,
      dueDate: row.dueDate ?? null,
      status: row.status,
      resultScore: row.resultScore ? Number(row.resultScore) : null,
    })
    supportBySubject.set(row.subjectId, current)
  }
  const attendanceBySubject = new Map<string, { absent: number; late: number; excused: number; present: number }>()
  const overallAttendance = { absent: 0, late: 0, excused: 0, present: 0 }
  for (const row of attendanceRows) {
    if (!row.subjectId) continue
    const current = attendanceBySubject.get(row.subjectId) ?? { absent: 0, late: 0, excused: 0, present: 0 }
    if (row.status === 'absent') {
      current.absent += 1; overallAttendance.absent += 1
    } else if (row.status === 'late') {
      current.late += 1; overallAttendance.late += 1
    } else if (row.status === 'excused') {
      current.excused += 1; overallAttendance.excused += 1
    } else {
      current.present += 1; overallAttendance.present += 1
    }
    attendanceBySubject.set(row.subjectId, current)
  }

  const periodScoresBySubject = new Map<string, Array<{ academicPeriodId: string; academicPeriodName: string; weight: number; score: number | null }>>()
  for (const subject of subjectAssignments) {
    periodScoresBySubject.set(
      subject.subjectId,
      periods.map((period) => ({
        academicPeriodId: period.id,
        academicPeriodName: period.name,
        weight: period.weight,
        score: null,
      })),
    )
  }
  for (const row of gradeRows) {
    const periodList = periodScoresBySubject.get(row.subjectId)
    if (!periodList) continue
    const target = periodList.find((item) => item.academicPeriodId === row.academicPeriodId)
    if (target) target.score = Number(row.score)
  }

  const annualSubjects = subjectAssignments.map((subject) => {
    const periodScores = periodScoresBySubject.get(subject.subjectId) ?? []
    const scoredPeriods = periodScores.filter((item) => typeof item.score === 'number')
    const annualScore = scoredPeriods.length
      ? calculateAnnualScore(scoredPeriods.map((item) => ({ score: Number(item.score), weightPercentage: item.weight })))
      : null
    const performance = annualScore === null ? null : calculatePerformanceLevel(annualScore, resolvedScale.ranges)
    return {
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      academicAreaName: subject.academicAreaName ?? null,
      teacherName: teachersBySubject.get(subject.subjectId) ?? null,
      annualScore,
      annualGradeValue: annualScore === null ? null : resolveDisplayedGradeValue({ score: annualScore, scale: resolvedScale }),
      gradeValueType: resolvedScale.scaleType,
      performanceLevel: performance?.nationalLevel ?? null,
      institutionalLabel: performance?.institutionalLabel ?? null,
      isPassing: performance?.isPassing ?? null,
      periodScores,
      attendance: attendanceBySubject.get(subject.subjectId) ?? { absent: 0, late: 0, excused: 0, present: 0 },
      observations: observationsBySubject.get(subject.subjectId) ?? [],
      supportStrategies: supportBySubject.get(subject.subjectId) ?? [],
    }
  })

  const scoredSubjects = annualSubjects.filter((item) => typeof item.annualScore === 'number')
  const annualAverage = scoredSubjects.length
    ? Number((scoredSubjects.reduce((sum, item) => sum + Number(item.annualScore), 0) / scoredSubjects.length).toFixed(2))
    : null
  const failedSubjects = annualSubjects.filter((item) => item.isPassing === false).length
  const pendingSupportStrategies = annualSubjects.reduce((sum, item) => sum + item.supportStrategies.filter((strategy) => strategy.status === 'pending').length, 0)

  return c.json(ok('Boletín final anual generado', {
    generatedAt: new Date().toISOString(),
    student: {
      id: enrollment.studentId,
      fullName: [enrollment.firstName, enrollment.middleName, enrollment.lastName].filter(Boolean).join(' '),
      document: `${enrollment.documentType} ${enrollment.documentNumber}`.trim(),
    },
    academicYear: {
      id: enrollment.academicYearId,
      name: enrollment.academicYearName,
    },
    enrollment: {
      id: enrollment.enrollmentId,
      gradeName: enrollment.gradeName,
      groupName: enrollment.groupName ?? null,
      promotionStatus: enrollment.promotionStatus ?? null,
    },
    scale: {
      id: resolvedScale.id,
      name: resolvedScale.name,
      minValue: resolvedScale.minValue,
      passingValue: resolvedScale.passingValue,
      maxValue: resolvedScale.maxValue,
      decimalPlaces: resolvedScale.decimalPlaces,
      scaleType: resolvedScale.scaleType,
    },
    groupDirector: groupDirectorRow[0]?.teacherName ?? null,
    summary: {
      subjectsWithScores: scoredSubjects.length,
      totalSubjects: annualSubjects.length,
      annualAverage,
      failedSubjects,
      pendingSupportStrategies,
      attendance: overallAttendance,
    },
    subjects: annualSubjects,
  }))
})

academicRoutes.get('/attendance', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', attendanceFiltersSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const filters = c.req.valid('query')

  await ensureAttendancePlacement({
    db,
    tenantId,
    academicYearId: filters.academicYearId,
    academicPeriodId: filters.academicPeriodId,
    groupId: filters.groupId,
    subjectId: filters.subjectId,
  })

  await ensureTeacherCanManageGroupSubject({
    db,
    tenantId,
    user,
    academicYearId: filters.academicYearId,
    groupId: filters.groupId,
    subjectId: filters.subjectId,
  })

  const enrolledStudents = await db
    .select({
      studentId: students.id,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      documentType: students.documentType,
      documentNumber: students.documentNumber,
      groupName: groups.name,
      subjectName: subjects.name,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(groups, eq(groups.id, enrollments.groupId))
    .innerJoin(subjects, eq(subjects.id, filters.subjectId))
    .where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.academicYearId, filters.academicYearId),
      eq(enrollments.groupId, filters.groupId),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled'),
      eq(students.isDeleted, false),
    ))
    .orderBy(asc(students.firstName), asc(students.lastName))

  const existingRecords = await db
    .select()
    .from(attendanceRecords)
    .where(and(
      eq(attendanceRecords.tenantId, tenantId),
      eq(attendanceRecords.academicYearId, filters.academicYearId),
      eq(attendanceRecords.academicPeriodId, filters.academicPeriodId),
      eq(attendanceRecords.groupId, filters.groupId),
      eq(attendanceRecords.subjectId, filters.subjectId),
      eq(attendanceRecords.attendanceDate, filters.attendanceDate),
      eq(attendanceRecords.isDeleted, false),
    ))

  const recordByStudentId = new Map(existingRecords.map((row) => [row.studentId, row]))

  return c.json(ok('Asistencia cargada', {
    items: enrolledStudents.map((item) => {
      const record = recordByStudentId.get(item.studentId)
      return {
        recordId: record?.id ?? null,
        studentId: item.studentId,
        studentName: [item.firstName, item.middleName, item.lastName].filter(Boolean).join(' '),
        studentDocument: `${item.documentType} ${item.documentNumber}`.trim(),
        groupId: filters.groupId,
        groupName: item.groupName,
        subjectId: filters.subjectId,
        subjectName: item.subjectName,
        academicYearId: filters.academicYearId,
        academicPeriodId: filters.academicPeriodId,
        attendanceDate: filters.attendanceDate,
        status: (record?.status as 'present' | 'absent' | 'late' | 'excused' | undefined) ?? 'present',
        justified: record?.justified ?? false,
        notes: record?.notes ?? null,
      }
    }),
  }))
})

academicRoutes.post('/attendance', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', attendanceSaveSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  await ensureAttendancePlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    academicPeriodId: payload.academicPeriodId,
    groupId: payload.groupId,
    subjectId: payload.subjectId,
  })

  await ensureTeacherCanManageGroupSubject({
    db,
    tenantId,
    user,
    academicYearId: payload.academicYearId,
    groupId: payload.groupId,
    subjectId: payload.subjectId,
  })

  await ensureActivePeriod(db, tenantId, payload.academicPeriodId)

  const validEnrollments = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.academicYearId, payload.academicYearId),
      eq(enrollments.groupId, payload.groupId),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled'),
    ))

  const validStudentIds = new Set(validEnrollments.map((item) => item.studentId))
  for (const item of payload.items) {
    if (!validStudentIds.has(item.studentId)) {
      throw new AppError('Uno o más estudiantes ya no pertenecen al curso seleccionado.', 409)
    }
  }

  const existingRecords = await db
    .select({ id: attendanceRecords.id, studentId: attendanceRecords.studentId })
    .from(attendanceRecords)
    .where(and(
      eq(attendanceRecords.tenantId, tenantId),
      eq(attendanceRecords.academicYearId, payload.academicYearId),
      eq(attendanceRecords.academicPeriodId, payload.academicPeriodId),
      eq(attendanceRecords.groupId, payload.groupId),
      eq(attendanceRecords.subjectId, payload.subjectId),
      eq(attendanceRecords.attendanceDate, payload.attendanceDate),
      eq(attendanceRecords.isDeleted, false),
    ))

  const existingByStudent = new Map(existingRecords.map((row) => [row.studentId, row.id]))
  let updatedCount = 0

  for (const item of payload.items) {
    const existingId = existingByStudent.get(item.studentId)
    if (existingId) {
      await db.update(attendanceRecords).set({
        status: item.status,
        justified: item.justified,
        notes: item.notes || null,
        updatedAt: new Date(),
        updatedBy: user.id,
      }).where(and(eq(attendanceRecords.id, existingId), eq(attendanceRecords.tenantId, tenantId)))
      updatedCount += 1
      continue
    }

    await db.insert(attendanceRecords).values({
      tenantId,
      studentId: item.studentId,
      groupId: payload.groupId,
      subjectId: payload.subjectId,
      attendanceDate: payload.attendanceDate,
      status: item.status,
      notes: item.notes || null,
      academicYearId: payload.academicYearId,
      academicPeriodId: payload.academicPeriodId,
      justified: item.justified,
      createdBy: user.id,
      updatedBy: user.id,
    })
    updatedCount += 1
  }

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'attendance_records',
    entityId: `${payload.groupId}:${payload.subjectId}:${payload.attendanceDate}`,
    action: 'attendance_save',
    changes: {
      academicYearId: payload.academicYearId,
      academicPeriodId: payload.academicPeriodId,
      groupId: payload.groupId,
      subjectId: payload.subjectId,
      attendanceDate: payload.attendanceDate,
      items: payload.items.length,
    },
  })

  return c.json(ok('Asistencia guardada', { updatedCount }))
})

academicRoutes.post('/gradebook', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', gradebookSaveSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  await ensureGradebookPlacement({ db, tenantId, academicYearId: payload.academicYearId, academicPeriodId: payload.academicPeriodId, groupId: payload.groupId, subjectId: payload.subjectId })
  await ensureActivePeriod(db, tenantId, payload.academicPeriodId)

  const [group] = await db
    .select({ gradeId: groups.gradeId })
    .from(groups)
    .where(and(eq(groups.tenantId, tenantId), eq(groups.id, payload.groupId), eq(groups.isDeleted, false)))
    .limit(1)

  if (!group?.gradeId) throw new AppError('No se encontró el grado del curso seleccionado.', 404)

  const resolvedScale = await resolveGradingScaleForGrade({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    gradeId: group.gradeId,
  })

  let updatedCount = 0
  for (const item of payload.items) {
    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.studentId, item.studentId), eq(enrollments.academicYearId, payload.academicYearId), eq(enrollments.groupId, payload.groupId), eq(enrollments.isDeleted, false), ne(enrollments.enrollmentStatus, 'cancelled')))
      .limit(1)
    if (!enrollment) throw new AppError('Uno de los estudiantes ya no pertenece al curso seleccionado.', 409)

    const [existing] = await db
      .select({ id: gradeRecords.id })
      .from(gradeRecords)
      .where(and(eq(gradeRecords.tenantId, tenantId), eq(gradeRecords.studentId, item.studentId), eq(gradeRecords.subjectId, payload.subjectId), eq(gradeRecords.academicPeriodId, payload.academicPeriodId), eq(gradeRecords.isDeleted, false)))
      .limit(1)

    if (existing) {
      await db.update(gradeRecords).set({
        score: String(item.score),
        gradeValue: resolveDisplayedGradeValue({ score: Number(item.score), scale: resolvedScale }),
        gradeValueType: resolvedScale.scaleType,
        maxScore: String(item.maxScore),
        notes: item.notes || null,
        groupId: payload.groupId,
        academicYearId: payload.academicYearId,
        updatedAt: new Date(),
        updatedBy: user.id,
      }).where(eq(gradeRecords.id, existing.id))
    } else {
      await db.insert(gradeRecords).values({
        tenantId,
        studentId: item.studentId,
        subjectId: payload.subjectId,
        academicPeriodId: payload.academicPeriodId,
        score: String(item.score),
        gradeValue: resolveDisplayedGradeValue({ score: Number(item.score), scale: resolvedScale }),
        gradeValueType: resolvedScale.scaleType,
        maxScore: String(item.maxScore),
        notes: item.notes || null,
        groupId: payload.groupId,
        academicYearId: payload.academicYearId,
        createdBy: user.id,
        updatedBy: user.id,
      })
    }
    updatedCount += 1
  }

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'grade_records',
    entityId: payload.groupId,
    action: 'gradebook_save',
    changes: {
      academicYearId: payload.academicYearId,
      groupId: payload.groupId,
      subjectId: payload.subjectId,
      academicPeriodId: payload.academicPeriodId,
      updatedCount,
    },
    ipAddress: c.req.header('cf-connecting-ip'),
  })

  return c.json(ok('Notas guardadas', { updatedCount }))
})

// ─── SIEE Phase 1: Academic Areas CRUD ──────────────────────────

const ensureAcademicAreaDeletable = async (db: any, tenantId: string, id: string) => {
  const [referenced] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.academicAreaId, id), eq(subjects.tenantId, tenantId), eq(subjects.isDeleted, false)))
    .limit(1)
  if (referenced) {
    throw new AppError('No se puede eliminar el área académica porque tiene materias asociadas.', 409)
  }
}

academicRoutes.get('/academic-areas', requirePermission(PERMISSIONS.SIEE_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const { query, page, pageSize, offset } = readPaginationFilters(c)
  const searchFilter = query ? or(ilike(academicAreas.name, `%${query}%`), ilike(academicAreas.code, `%${query}%`)) : undefined
  const whereClause = and(eq(academicAreas.tenantId, tenantId), eq(academicAreas.isDeleted, false), searchFilter)

  const items = await db.select().from(academicAreas).where(whereClause).orderBy(asc(academicAreas.orderNumber), asc(academicAreas.name)).limit(pageSize).offset(offset)
  const [totalRow] = await db.select({ total: count() }).from(academicAreas).where(whereClause)

  return c.json(ok('Áreas académicas cargadas', {
    items: items.map((item) => ({
      id: item.id,
      tenantId: item.tenantId,
      name: item.name,
      code: item.code,
      description: item.description ?? null,
      color: item.color ?? null,
      orderNumber: item.orderNumber,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  }))
})

academicRoutes.post('/academic-areas', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', academicAreaSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [item] = await db.insert(academicAreas).values({
    tenantId,
    name: payload.name,
    code: payload.code,
    description: payload.description || null,
    color: payload.color || '#6366f1',
    orderNumber: payload.orderNumber ?? 0,
    isActive: payload.isActive ?? true,
    createdBy: user.id,
    updatedBy: user.id
  }).returning()

  if (!item) throw new AppError('No fue posible crear el área académica', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_areas', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Área académica creada', { id: item.id }), 201)
})

academicRoutes.put('/academic-areas/:id', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', academicAreaSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [item] = await db.update(academicAreas).set({
    name: payload.name,
    code: payload.code,
    description: payload.description || null,
    color: payload.color || '#6366f1',
    orderNumber: payload.orderNumber ?? 0,
    isActive: payload.isActive ?? true,
    updatedAt: new Date(),
    updatedBy: user.id
  }).where(and(eq(academicAreas.id, id), eq(academicAreas.tenantId, tenantId), eq(academicAreas.isDeleted, false))).returning()

  if (!item) throw new AppError('Área académica no encontrada', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_areas', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Área académica actualizada', { id }))
})

academicRoutes.delete('/academic-areas/:id', requirePermission(PERMISSIONS.SIEE_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  await ensureAcademicAreaDeletable(db, tenantId, id)
  await db.update(academicAreas).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(academicAreas.id, id), eq(academicAreas.tenantId, tenantId)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_areas', entityId: id, action: 'delete' })
  return c.json(ok('Área académica eliminada', { id }))
})

// ─── SIEE Phase 1: Grading Scales & Performance Ranges CRUD ─────

academicRoutes.get('/grading-scales', requirePermission(PERMISSIONS.SIEE_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const { query, page, pageSize, offset } = readPaginationFilters(c)
  const searchFilter = query ? ilike(gradingScales.name, `%${query}%`) : undefined
  const whereClause = and(eq(gradingScales.tenantId, tenantId), eq(gradingScales.isDeleted, false), searchFilter)

  const scales = await db.select().from(gradingScales).where(whereClause).orderBy(desc(gradingScales.isActive), asc(gradingScales.name)).limit(pageSize).offset(offset)
  const [totalRow] = await db.select({ total: count() }).from(gradingScales).where(whereClause)

  const items = []
  for (const scale of scales) {
    const ranges = await db.select().from(performanceRanges).where(and(eq(performanceRanges.gradingScaleId, scale.id), eq(performanceRanges.isDeleted, false))).orderBy(desc(performanceRanges.minScore))
    items.push({
      id: scale.id,
      tenantId: scale.tenantId,
      name: scale.name,
      minValue: scale.minValue,
      maxValue: scale.maxValue,
      passingValue: scale.passingValue,
      decimalPlaces: scale.decimalPlaces,
      scaleType: scale.scaleType,
      isActive: scale.isActive,
      ranges: ranges.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        gradingScaleId: r.gradingScaleId,
        nationalLevel: r.nationalLevel,
        institutionalLabel: r.institutionalLabel,
        minScore: r.minScore,
        maxScore: r.maxScore,
        isPassing: r.isPassing,
        color: r.color,
        description: r.description,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      createdAt: scale.createdAt.toISOString(),
      updatedAt: scale.updatedAt.toISOString(),
    })
  }

  return c.json(ok('Escalas de calificación cargadas', {
    items,
    total: totalRow?.total ?? 0,
    page,
    pageSize,
  }))
})

academicRoutes.post('/grading-scales', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', gradingScaleSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  // If set to active, deactivate all other scales for this tenant first
  if (payload.isActive) {
    await db.update(gradingScales).set({ isActive: false, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(gradingScales.tenantId, tenantId), eq(gradingScales.isActive, true)))
  }

  const [item] = await db.insert(gradingScales).values({
    tenantId,
    name: payload.name,
    minValue: String(payload.minValue),
    maxValue: String(payload.maxValue),
    passingValue: String(payload.passingValue),
    decimalPlaces: payload.decimalPlaces,
    scaleType: payload.scaleType,
    isActive: payload.isActive ?? true,
    createdBy: user.id,
    updatedBy: user.id
  }).returning()

  if (!item) throw new AppError('No fue posible crear la escala de calificación', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grading_scales', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Escala de calificación creada', { id: item.id }), 201)
})

academicRoutes.put('/grading-scales/:id', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', gradingScaleSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  if (payload.isActive) {
    await db.update(gradingScales).set({ isActive: false, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(gradingScales.tenantId, tenantId), eq(gradingScales.isActive, true), ne(gradingScales.id, id)))
  }

  const [item] = await db.update(gradingScales).set({
    name: payload.name,
    minValue: String(payload.minValue),
    maxValue: String(payload.maxValue),
    passingValue: String(payload.passingValue),
    decimalPlaces: payload.decimalPlaces,
    scaleType: payload.scaleType,
    isActive: payload.isActive ?? true,
    updatedAt: new Date(),
    updatedBy: user.id
  }).where(and(eq(gradingScales.id, id), eq(gradingScales.tenantId, tenantId), eq(gradingScales.isDeleted, false))).returning()

  if (!item) throw new AppError('Escala de calificación no encontrada', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grading_scales', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Escala de calificación actualizada', { id }))
})

academicRoutes.delete('/grading-scales/:id', requirePermission(PERMISSIONS.SIEE_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  // Mark the scale as deleted and also all its performance ranges
  await db.transaction(async (tx) => {
    await tx.update(gradingScales).set({ isDeleted: true, isActive: false, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(gradingScales.id, id), eq(gradingScales.tenantId, tenantId)))
    await tx.update(performanceRanges).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(performanceRanges.gradingScaleId, id), eq(performanceRanges.tenantId, tenantId)))
  })

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grading_scales', entityId: id, action: 'delete' })
  return c.json(ok('Escala de calificación eliminada', { id }))
})

academicRoutes.get('/performance-ranges', requirePermission(PERMISSIONS.SIEE_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const scaleId = c.req.query('gradingScaleId')

  const whereClause = and(
    eq(performanceRanges.tenantId, tenantId),
    eq(performanceRanges.isDeleted, false),
    scaleId ? eq(performanceRanges.gradingScaleId, scaleId) : undefined
  )
  const items = await db.select().from(performanceRanges).where(whereClause).orderBy(desc(performanceRanges.minScore))

  return c.json(ok('Rangos de desempeño cargados', {
    items: items.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      gradingScaleId: r.gradingScaleId,
      nationalLevel: r.nationalLevel,
      institutionalLabel: r.institutionalLabel,
      minScore: r.minScore,
      maxScore: r.maxScore,
      isPassing: r.isPassing,
      color: r.color,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
  }))
})

academicRoutes.post('/performance-ranges', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', performanceRangeSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [item] = await db.insert(performanceRanges).values({
    tenantId,
    gradingScaleId: payload.gradingScaleId,
    nationalLevel: payload.nationalLevel,
    institutionalLabel: payload.institutionalLabel,
    minScore: String(payload.minScore),
    maxScore: String(payload.maxScore),
    isPassing: payload.isPassing ?? true,
    color: payload.color || '#6366f1',
    description: payload.description || null,
    createdBy: user.id,
    updatedBy: user.id
  }).returning()

  if (!item) throw new AppError('No fue posible crear el rango de desempeño', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'performance_ranges', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Rango de desempeño creado', { id: item.id }), 201)
})

academicRoutes.put('/performance-ranges/:id', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', performanceRangeSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [item] = await db.update(performanceRanges).set({
    nationalLevel: payload.nationalLevel,
    institutionalLabel: payload.institutionalLabel,
    minScore: String(payload.minScore),
    maxScore: String(payload.maxScore),
    isPassing: payload.isPassing ?? true,
    color: payload.color || '#6366f1',
    description: payload.description || null,
    updatedAt: new Date(),
    updatedBy: user.id
  }).where(and(eq(performanceRanges.id, id), eq(performanceRanges.tenantId, tenantId), eq(performanceRanges.isDeleted, false))).returning()

  if (!item) throw new AppError('Rango de desempeño no encontrado', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'performance_ranges', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Rango de desempeño actualizado', { id }))
})

academicRoutes.delete('/performance-ranges/:id', requirePermission(PERMISSIONS.SIEE_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  await db.update(performanceRanges).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(performanceRanges.id, id), eq(performanceRanges.tenantId, tenantId)))
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'performance_ranges', entityId: id, action: 'delete' })
  return c.json(ok('Rango de desempeño eliminado', { id }))
})

academicRoutes.get('/grading-scale-assignments', requirePermission(PERMISSIONS.SIEE_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const academicYearId = c.req.query('academicYearId')

  const items = await db
    .select({
      id: gradingScaleAssignments.id,
      tenantId: gradingScaleAssignments.tenantId,
      academicYearId: gradingScaleAssignments.academicYearId,
      academicYearName: academicYears.name,
      gradingScaleId: gradingScaleAssignments.gradingScaleId,
      gradingScaleName: gradingScales.name,
      scopeType: gradingScaleAssignments.scopeType,
      levelName: gradingScaleAssignments.levelName,
      gradeId: gradingScaleAssignments.gradeId,
      gradeName: grades.name,
      title: gradingScaleAssignments.title,
      isActive: gradingScaleAssignments.isActive,
      createdAt: gradingScaleAssignments.createdAt,
      updatedAt: gradingScaleAssignments.updatedAt,
    })
    .from(gradingScaleAssignments)
    .innerJoin(gradingScales, eq(gradingScales.id, gradingScaleAssignments.gradingScaleId))
    .innerJoin(academicYears, eq(academicYears.id, gradingScaleAssignments.academicYearId))
    .leftJoin(grades, eq(grades.id, gradingScaleAssignments.gradeId))
    .where(and(
      eq(gradingScaleAssignments.tenantId, tenantId),
      eq(gradingScaleAssignments.isDeleted, false),
      academicYearId ? eq(gradingScaleAssignments.academicYearId, academicYearId) : undefined,
    ))
    .orderBy(asc(gradingScaleAssignments.scopeType), asc(grades.orderNumber), asc(gradingScales.name))

  return c.json(ok('Asignaciones de escala cargadas', {
    items: items.map((item) => ({
      ...item,
      scopeType: item.scopeType as 'level' | 'grade',
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  }))
})

academicRoutes.post('/grading-scale-assignments', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', gradingScaleAssignmentSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  await ensureGradingScaleAssignmentPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    gradingScaleId: payload.gradingScaleId,
    scopeType: payload.scopeType,
    levelName: payload.levelName || null,
    gradeId: payload.gradeId || null,
  })

  const [item] = await db.insert(gradingScaleAssignments).values({
    tenantId,
    academicYearId: payload.academicYearId,
    gradingScaleId: payload.gradingScaleId,
    scopeType: payload.scopeType,
    levelName: payload.scopeType === 'level' ? payload.levelName || null : null,
    gradeId: payload.scopeType === 'grade' ? payload.gradeId || null : null,
    title: payload.title || null,
    isActive: payload.isActive ?? true,
    createdBy: user.id,
    updatedBy: user.id,
  }).returning()

  if (!item) throw new AppError('No fue posible crear la asignación de escala.', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grading_scale_assignments', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Asignación de escala creada', { id: item.id }), 201)
})

academicRoutes.put('/grading-scale-assignments/:id', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', gradingScaleAssignmentSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  await ensureGradingScaleAssignmentPlacement({
    db,
    tenantId,
    academicYearId: payload.academicYearId,
    gradingScaleId: payload.gradingScaleId,
    scopeType: payload.scopeType,
    levelName: payload.levelName || null,
    gradeId: payload.gradeId || null,
    assignmentIdToExclude: id,
  })

  const [item] = await db.update(gradingScaleAssignments).set({
    academicYearId: payload.academicYearId,
    gradingScaleId: payload.gradingScaleId,
    scopeType: payload.scopeType,
    levelName: payload.scopeType === 'level' ? payload.levelName || null : null,
    gradeId: payload.scopeType === 'grade' ? payload.gradeId || null : null,
    title: payload.title || null,
    isActive: payload.isActive ?? true,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(and(eq(gradingScaleAssignments.id, id), eq(gradingScaleAssignments.tenantId, tenantId), eq(gradingScaleAssignments.isDeleted, false))).returning()

  if (!item) throw new AppError('Asignación de escala no encontrada.', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grading_scale_assignments', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Asignación de escala actualizada', { id }))
})

academicRoutes.delete('/grading-scale-assignments/:id', requirePermission(PERMISSIONS.SIEE_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  await db.update(gradingScaleAssignments).set({
    isDeleted: true,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(and(eq(gradingScaleAssignments.id, id), eq(gradingScaleAssignments.tenantId, tenantId), eq(gradingScaleAssignments.isDeleted, false)))

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'grading_scale_assignments', entityId: id, action: 'delete' })
  return c.json(ok('Asignación de escala eliminada', { id }))
})

// ─── SIEE Phase 2: Competencies CRUD ─────────────────────────────

academicRoutes.get('/competencies', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const areaId = c.req.query('academicAreaId')
  const subjectId = c.req.query('subjectId')
  const gradeId = c.req.query('gradeId')
  const { query, page, pageSize, offset } = readPaginationFilters(c)

  const whereClause = and(
    eq(competencies.tenantId, tenantId),
    eq(competencies.isDeleted, false),
    areaId ? eq(competencies.academicAreaId, areaId) : undefined,
    subjectId ? eq(competencies.subjectId, subjectId) : undefined,
    gradeId ? eq(competencies.gradeId, gradeId) : undefined,
    query ? ilike(competencies.name, `%${query}%`) : undefined
  )

  const items = await db
    .select({
      id: competencies.id,
      tenantId: competencies.tenantId,
      academicAreaId: competencies.academicAreaId,
      academicAreaName: academicAreas.name,
      subjectId: competencies.subjectId,
      subjectName: subjects.name,
      gradeId: competencies.gradeId,
      gradeName: grades.name,
      name: competencies.name,
      description: competencies.description,
      isActive: competencies.isActive,
      orderNumber: competencies.orderNumber,
      createdAt: competencies.createdAt,
      updatedAt: competencies.updatedAt,
    })
    .from(competencies)
    .innerJoin(academicAreas, eq(academicAreas.id, competencies.academicAreaId))
    .leftJoin(subjects, eq(subjects.id, competencies.subjectId))
    .leftJoin(grades, eq(grades.id, competencies.gradeId))
    .where(whereClause)
    .orderBy(asc(competencies.orderNumber), asc(competencies.name))
    .limit(pageSize)
    .offset(offset)

  const [totalRow] = await db
    .select({ total: count() })
    .from(competencies)
    .where(whereClause)

  return c.json(ok('Competencias cargadas', {
    items: items.map(item => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page,
    pageSize
  }))
})

academicRoutes.post('/competencies', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', competencySchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [item] = await db
    .insert(competencies)
    .values({
      tenantId,
      ...payload,
      subjectId: payload.subjectId || null,
      gradeId: payload.gradeId || null,
      description: payload.description || null,
      createdBy: user.id,
      updatedBy: user.id
    })
    .returning()

  if (!item) throw new AppError('No fue posible crear la competencia', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'competencies', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Competencia creada', { id: item.id }), 201)
})

academicRoutes.put('/competencies/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', competencySchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [item] = await db
    .update(competencies)
    .set({
      ...payload,
      subjectId: payload.subjectId || null,
      gradeId: payload.gradeId || null,
      description: payload.description || null,
      updatedAt: new Date(),
      updatedBy: user.id
    })
    .where(and(eq(competencies.id, id), eq(competencies.tenantId, tenantId), eq(competencies.isDeleted, false)))
    .returning()

  if (!item) throw new AppError('Competencia no encontrada', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'competencies', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Competencia actualizada', { id }))
})

academicRoutes.delete('/competencies/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  const [referenced] = await db
    .select({ id: learningAchievements.id })
    .from(learningAchievements)
    .where(and(eq(learningAchievements.competencyId, id), eq(learningAchievements.isDeleted, false)))
    .limit(1)
  if (referenced) {
    throw new AppError('No se puede eliminar la competencia porque tiene logros académicos asociados.', 409)
  }

  await db
    .update(competencies)
    .set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id })
    .where(and(eq(competencies.id, id), eq(competencies.tenantId, tenantId)))

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'competencies', entityId: id, action: 'delete' })
  return c.json(ok('Competencia eliminada', { id }))
})

// ─── SIEE Phase 2: Achievement Indicators CRUD ───────────────────

academicRoutes.get('/achievement-indicators', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const achievementId = c.req.query('achievementId')

  if (!achievementId) {
    throw new AppError('Debe especificar el logro (achievementId) para consultar sus indicadores.', 400)
  }

  const items = await db
    .select()
    .from(achievementIndicators)
    .where(and(
      eq(achievementIndicators.tenantId, tenantId),
      eq(achievementIndicators.achievementId, achievementId),
      eq(achievementIndicators.isDeleted, false)
    ))
    .orderBy(asc(achievementIndicators.orderNumber))

  return c.json(ok('Indicadores cargados', {
    items: items.map(item => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
  }))
})

academicRoutes.post('/achievement-indicators', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', achievementIndicatorSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [item] = await db
    .insert(achievementIndicators)
    .values({
      tenantId,
      ...payload,
      createdBy: user.id,
      updatedBy: user.id
    })
    .returning()

  if (!item) throw new AppError('No fue posible crear el indicador', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'achievement_indicators', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Indicador creado', { id: item.id }), 201)
})

academicRoutes.put('/achievement-indicators/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', achievementIndicatorSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [item] = await db
    .update(achievementIndicators)
    .set({
      ...payload,
      updatedAt: new Date(),
      updatedBy: user.id
    })
    .where(and(eq(achievementIndicators.id, id), eq(achievementIndicators.tenantId, tenantId), eq(achievementIndicators.isDeleted, false)))
    .returning()

  if (!item) throw new AppError('Indicador no encontrado', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'achievement_indicators', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Indicador actualizado', { id }))
})

academicRoutes.delete('/achievement-indicators/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  await db
    .update(achievementIndicators)
    .set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id })
    .where(and(eq(achievementIndicators.id, id), eq(achievementIndicators.tenantId, tenantId)))

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'achievement_indicators', entityId: id, action: 'delete' })
  return c.json(ok('Indicador eliminado', { id }))
})

// ─── SIEE Phase 3: Evaluation Activities CRUD ────────────────────

academicRoutes.get('/evaluation-activities', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const academicYearId = c.req.query('academicYearId') ?? ''
  const academicPeriodId = c.req.query('academicPeriodId') ?? ''
  const groupId = c.req.query('groupId') ?? ''
  const subjectId = c.req.query('subjectId') ?? ''

  const whereClause = and(
    eq(evaluationActivities.tenantId, tenantId),
    eq(evaluationActivities.isDeleted, false),
    academicYearId ? eq(evaluationActivities.academicYearId, academicYearId) : undefined,
    academicPeriodId ? eq(evaluationActivities.academicPeriodId, academicPeriodId) : undefined,
    groupId ? eq(evaluationActivities.groupId, groupId) : undefined,
    subjectId ? eq(evaluationActivities.subjectId, subjectId) : undefined
  )

  const items = await db
    .select({
      id: evaluationActivities.id,
      tenantId: evaluationActivities.tenantId,
      academicYearId: evaluationActivities.academicYearId,
      academicPeriodId: evaluationActivities.academicPeriodId,
      groupId: evaluationActivities.groupId,
      groupName: groups.name,
      subjectId: evaluationActivities.subjectId,
      subjectName: subjects.name,
      achievementId: evaluationActivities.achievementId,
      achievementCode: learningAchievements.code,
      achievementTitle: learningAchievements.title,
      name: evaluationActivities.name,
      description: evaluationActivities.description,
      activityType: evaluationActivities.activityType,
      weightPercentage: evaluationActivities.weightPercentage,
      maxScore: evaluationActivities.maxScore,
      dueDate: evaluationActivities.dueDate,
      isPublished: evaluationActivities.isPublished,
      createdAt: evaluationActivities.createdAt,
      updatedAt: evaluationActivities.updatedAt,
    })
    .from(evaluationActivities)
    .innerJoin(groups, eq(groups.id, evaluationActivities.groupId))
    .innerJoin(subjects, eq(subjects.id, evaluationActivities.subjectId))
    .innerJoin(learningAchievements, eq(learningAchievements.id, evaluationActivities.achievementId))
    .where(whereClause)
    .orderBy(asc(evaluationActivities.dueDate), asc(evaluationActivities.name))

  return c.json(ok('Actividades evaluativas cargadas', {
    items: items.map(item => ({
      ...item,
      weightPercentage: Number(item.weightPercentage),
      maxScore: Number(item.maxScore),
      dueDate: item.dueDate ? item.dueDate : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
  }))
})

academicRoutes.get('/evaluation-activities/:id', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [item] = await db
    .select({
      id: evaluationActivities.id,
      tenantId: evaluationActivities.tenantId,
      academicYearId: evaluationActivities.academicYearId,
      academicPeriodId: evaluationActivities.academicPeriodId,
      groupId: evaluationActivities.groupId,
      groupName: groups.name,
      subjectId: evaluationActivities.subjectId,
      subjectName: subjects.name,
      achievementId: evaluationActivities.achievementId,
      achievementCode: learningAchievements.code,
      achievementTitle: learningAchievements.title,
      name: evaluationActivities.name,
      description: evaluationActivities.description,
      activityType: evaluationActivities.activityType,
      weightPercentage: evaluationActivities.weightPercentage,
      maxScore: evaluationActivities.maxScore,
      dueDate: evaluationActivities.dueDate,
      isPublished: evaluationActivities.isPublished,
      createdAt: evaluationActivities.createdAt,
      updatedAt: evaluationActivities.updatedAt,
    })
    .from(evaluationActivities)
    .innerJoin(groups, eq(groups.id, evaluationActivities.groupId))
    .innerJoin(subjects, eq(subjects.id, evaluationActivities.subjectId))
    .innerJoin(learningAchievements, eq(learningAchievements.id, evaluationActivities.achievementId))
    .where(and(eq(evaluationActivities.id, id), eq(evaluationActivities.tenantId, tenantId), eq(evaluationActivities.isDeleted, false)))
    .limit(1)

  if (!item) throw new AppError('Actividad no encontrada', 404)

  return c.json(ok('Actividad evaluativa cargada', {
    ...item,
    weightPercentage: Number(item.weightPercentage),
    maxScore: Number(item.maxScore),
    dueDate: item.dueDate ? item.dueDate : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }))
})

academicRoutes.post('/evaluation-activities', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', evaluationActivitySchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  await ensureActivePeriod(db, tenantId, payload.academicPeriodId)

  if (user && user.roleCodes && user.roleCodes.includes('teacher')) {
    const teacherRecord = await db.query.teachers.findFirst({
      where: and(eq(teachers.tenantId, tenantId), eq(teachers.userId, user.id), eq(teachers.isDeleted, false))
    })
    if (!teacherRecord) throw new AppError('Usuario no está registrado como docente activo', 403)
    const assignment = await db.query.courseSubjects.findFirst({
      where: and(
        eq(courseSubjects.tenantId, tenantId),
        eq(courseSubjects.academicYearId, payload.academicYearId),
        eq(courseSubjects.groupId, payload.groupId),
        eq(courseSubjects.subjectId, payload.subjectId),
        eq(courseSubjects.teacherId, teacherRecord.id),
        eq(courseSubjects.isDeleted, false)
      )
    })
    if (!assignment) {
      throw new AppError('No tienes asignada esta asignatura en este grupo', 403)
    }
  }

  const [item] = await db
    .insert(evaluationActivities)
    .values({
      tenantId,
      ...payload,
      weightPercentage: String(payload.weightPercentage),
      maxScore: String(payload.maxScore),
      dueDate: payload.dueDate || null,
      description: payload.description || null,
      createdBy: user.id,
      updatedBy: user.id
    })
    .returning()

  if (!item) throw new AppError('No fue posible crear la actividad evaluativa', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'evaluation_activities', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Actividad evaluativa creada', { id: item.id }), 201)
})

academicRoutes.put('/evaluation-activities/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', evaluationActivitySchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [existing] = await db
    .select({ academicPeriodId: evaluationActivities.academicPeriodId })
    .from(evaluationActivities)
    .where(and(eq(evaluationActivities.id, id), eq(evaluationActivities.tenantId, tenantId), eq(evaluationActivities.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Actividad no encontrada', 404)
  await ensureActivePeriod(db, tenantId, existing.academicPeriodId)
  if (payload.academicPeriodId !== existing.academicPeriodId) {
    await ensureActivePeriod(db, tenantId, payload.academicPeriodId)
  }

  const [item] = await db
    .update(evaluationActivities)
    .set({
      ...payload,
      weightPercentage: String(payload.weightPercentage),
      maxScore: String(payload.maxScore),
      dueDate: payload.dueDate || null,
      description: payload.description || null,
      updatedAt: new Date(),
      updatedBy: user.id
    })
    .where(and(eq(evaluationActivities.id, id), eq(evaluationActivities.tenantId, tenantId), eq(evaluationActivities.isDeleted, false)))
    .returning()

  if (!item) throw new AppError('Actividad no encontrada', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'evaluation_activities', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Actividad evaluativa actualizada', { id }))
})

academicRoutes.delete('/evaluation-activities/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  const [existing] = await db
    .select({ academicPeriodId: evaluationActivities.academicPeriodId })
    .from(evaluationActivities)
    .where(and(eq(evaluationActivities.id, id), eq(evaluationActivities.tenantId, tenantId), eq(evaluationActivities.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Actividad no encontrada', 404)
  await ensureActivePeriod(db, tenantId, existing.academicPeriodId)

  await db.transaction(async (tx) => {
    await tx.update(activityScores).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(activityScores.activityId, id), eq(activityScores.tenantId, tenantId)))
    await tx.update(evaluationActivities).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id }).where(and(eq(evaluationActivities.id, id), eq(evaluationActivities.tenantId, tenantId)))
  })

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'evaluation_activities', entityId: id, action: 'delete' })
  return c.json(ok('Actividad evaluativa eliminada', { id }))
})

// ─── SIEE Phase 3: Activity Scores Endpoints ─────────────────────

academicRoutes.get('/evaluation-activities/:activityId/scores', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const activityId = c.req.param('activityId')

  const [activity] = await db
    .select()
    .from(evaluationActivities)
    .where(and(eq(evaluationActivities.id, activityId), eq(evaluationActivities.tenantId, tenantId), eq(evaluationActivities.isDeleted, false)))
    .limit(1)

  if (!activity) throw new AppError('Actividad no encontrada', 404)

  const [group] = await db
    .select({ gradeId: groups.gradeId })
    .from(groups)
    .where(and(eq(groups.tenantId, tenantId), eq(groups.id, activity.groupId), eq(groups.isDeleted, false)))
    .limit(1)

  const resolvedScale = group?.gradeId
    ? await resolveGradingScaleForGrade({
        db,
        tenantId,
        academicYearId: activity.academicYearId,
        gradeId: group.gradeId,
      })
    : null

  const enrolledStudents = await db
    .select({
      studentId: students.id,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      documentType: students.documentType,
      documentNumber: students.documentNumber,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.groupId, activity.groupId),
      eq(enrollments.academicYearId, activity.academicYearId),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled'),
      eq(students.isDeleted, false)
    ))
    .orderBy(asc(students.firstName), asc(students.lastName))

  const studentIds = enrolledStudents.map(s => s.studentId)
  const scores = studentIds.length 
    ? await db
        .select()
        .from(activityScores)
        .where(and(
          eq(activityScores.tenantId, tenantId),
          eq(activityScores.activityId, activityId),
          eq(activityScores.isDeleted, false),
          inArray(activityScores.studentId, studentIds)
        ))
    : []

  const scoresMap = new Map<string, typeof scores[number]>()
  for (const s of scores) {
    scoresMap.set(s.studentId, s)
  }

  return c.json(ok('Notas cargadas', {
    items: enrolledStudents.map(student => {
      const scoreObj = scoresMap.get(student.studentId)
      return {
        studentId: student.studentId,
        studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
        studentDocument: `${student.documentType} ${student.documentNumber}`.trim(),
        activityId,
        scoreId: scoreObj?.id ?? null,
        score: scoreObj ? Number(scoreObj.score) : null,
        gradeValue: scoreObj && resolvedScale ? resolveDisplayedGradeValue({ score: Number(scoreObj.score), scale: resolvedScale }) : null,
        performanceLevel: scoreObj?.performanceLevel ?? null,
        observations: scoreObj?.observations ?? null,
        gradedAt: scoreObj?.gradedAt ? scoreObj.gradedAt.toISOString() : null,
      }
    }),
    scale: resolvedScale
      ? {
          id: resolvedScale.id,
          name: resolvedScale.name,
          minValue: resolvedScale.minValue,
          maxValue: resolvedScale.maxValue,
          passingValue: resolvedScale.passingValue,
          decimalPlaces: resolvedScale.decimalPlaces,
          scaleType: resolvedScale.scaleType,
          ranges: resolvedScale.ranges,
        }
      : null,
  }))
})

academicRoutes.post('/evaluation-activities/:activityId/scores', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', z.object({
  scores: z.array(z.object({
    studentId: z.uuid(),
    score: z.coerce.number().min(0).max(100),
    observations: z.string().optional().or(z.null()),
  }))
})), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const activityId = c.req.param('activityId')
  const { scores } = c.req.valid('json')

  const [activity] = await db
    .select()
    .from(evaluationActivities)
    .where(and(eq(evaluationActivities.id, activityId), eq(evaluationActivities.tenantId, tenantId), eq(evaluationActivities.isDeleted, false)))
    .limit(1)

  if (!activity) throw new AppError('Actividad no encontrada', 404)
  await ensureActivePeriod(db, tenantId, activity.academicPeriodId)

  const [group] = await db
    .select({ gradeId: groups.gradeId })
    .from(groups)
    .where(and(eq(groups.tenantId, tenantId), eq(groups.id, activity.groupId), eq(groups.isDeleted, false)))
    .limit(1)

  const resolvedScale = group?.gradeId
    ? await resolveGradingScaleForGrade({
        db,
        tenantId,
        academicYearId: activity.academicYearId,
        gradeId: group.gradeId,
      })
    : null

  const ranges = resolvedScale?.ranges ?? []

  let updatedCount = 0
  for (const item of scores) {
    const perfRange = calculatePerformanceLevel(item.score, ranges)
    
    const [existing] = await db
      .select({ id: activityScores.id })
      .from(activityScores)
      .where(and(
        eq(activityScores.tenantId, tenantId),
        eq(activityScores.activityId, activityId),
        eq(activityScores.studentId, item.studentId),
        eq(activityScores.isDeleted, false)
      ))
      .limit(1)

    if (existing) {
      await db
        .update(activityScores)
        .set({
          score: String(item.score),
          performanceLevel: perfRange ? perfRange.nationalLevel : null,
          observations: item.observations || null,
          gradedAt: new Date(),
          gradedBy: user.id,
          updatedAt: new Date(),
          updatedBy: user.id
        })
        .where(eq(activityScores.id, existing.id))
    } else {
      await db
        .insert(activityScores)
        .values({
          tenantId,
          activityId,
          studentId: item.studentId,
          score: String(item.score),
          performanceLevel: perfRange ? perfRange.nationalLevel : null,
          observations: item.observations || null,
          gradedAt: new Date(),
          gradedBy: user.id,
          createdBy: user.id,
          updatedBy: user.id
        })
    }
    updatedCount++
  }

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'evaluation_activities', entityId: activityId, action: 'save_scores', changes: { updatedCount } })
  return c.json(ok('Notas guardadas', { updatedCount }))
})

// ─── SIEE Phase 3: Academic Observations CRUD ────────────────────

academicRoutes.get('/academic-observations', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const academicYearId = c.req.query('academicYearId') ?? ''
  const academicPeriodId = c.req.query('academicPeriodId') ?? ''
  const studentId = c.req.query('studentId') ?? ''
  const subjectId = c.req.query('subjectId') ?? ''

  const whereClause = and(
    eq(academicObservations.tenantId, tenantId),
    eq(academicObservations.isDeleted, false),
    academicYearId ? eq(academicObservations.academicYearId, academicYearId) : undefined,
    academicPeriodId ? eq(academicObservations.academicPeriodId, academicPeriodId) : undefined,
    studentId ? eq(academicObservations.studentId, studentId) : undefined,
    subjectId ? eq(academicObservations.subjectId, subjectId) : undefined
  )

  const items = await db
    .select({
      id: academicObservations.id,
      tenantId: academicObservations.tenantId,
      academicYearId: academicObservations.academicYearId,
      academicPeriodId: academicObservations.academicPeriodId,
      studentId: academicObservations.studentId,
      studentName: students.firstName,
      subjectId: academicObservations.subjectId,
      subjectName: subjects.name,
      achievementId: academicObservations.achievementId,
      achievementCode: learningAchievements.code,
      observationType: academicObservations.observationType,
      text: academicObservations.text,
      createdAt: academicObservations.createdAt,
      updatedAt: academicObservations.updatedAt,
    })
    .from(academicObservations)
    .innerJoin(students, eq(students.id, academicObservations.studentId))
    .innerJoin(subjects, eq(subjects.id, academicObservations.subjectId))
    .leftJoin(learningAchievements, eq(learningAchievements.id, academicObservations.achievementId))
    .where(whereClause)
    .orderBy(desc(academicObservations.createdAt))

  return c.json(ok('Observaciones cargadas', {
    items: items.map(item => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
  }))
})

academicRoutes.post('/academic-observations', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicObservationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  await ensureActivePeriod(db, tenantId, payload.academicPeriodId)

  const [item] = await db
    .insert(academicObservations)
    .values({
      tenantId,
      ...payload,
      achievementId: payload.achievementId || null,
      createdBy: user.id,
      updatedBy: user.id
    })
    .returning()

  if (!item) throw new AppError('No fue posible crear la observación', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_observations', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Observación creada', { id: item.id }), 201)
})

academicRoutes.put('/academic-observations/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', academicObservationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [existing] = await db
    .select({ academicPeriodId: academicObservations.academicPeriodId })
    .from(academicObservations)
    .where(and(eq(academicObservations.id, id), eq(academicObservations.tenantId, tenantId), eq(academicObservations.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Observación no encontrada', 404)
  await ensureActivePeriod(db, tenantId, existing.academicPeriodId)
  if (payload.academicPeriodId !== existing.academicPeriodId) {
    await ensureActivePeriod(db, tenantId, payload.academicPeriodId)
  }

  const [item] = await db
    .update(academicObservations)
    .set({
      ...payload,
      achievementId: payload.achievementId || null,
      updatedAt: new Date(),
      updatedBy: user.id
    })
    .where(and(eq(academicObservations.id, id), eq(academicObservations.tenantId, tenantId), eq(academicObservations.isDeleted, false)))
    .returning()

  if (!item) throw new AppError('Observación no encontrada', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_observations', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Observación actualizada', { id }))
})

academicRoutes.delete('/academic-observations/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  const [existing] = await db
    .select({ academicPeriodId: academicObservations.academicPeriodId })
    .from(academicObservations)
    .where(and(eq(academicObservations.id, id), eq(academicObservations.tenantId, tenantId), eq(academicObservations.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Observación no encontrada', 404)
  await ensureActivePeriod(db, tenantId, existing.academicPeriodId)

  await db
    .update(academicObservations)
    .set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id })
    .where(and(eq(academicObservations.id, id), eq(academicObservations.tenantId, tenantId)))

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'academic_observations', entityId: id, action: 'delete' })
  return c.json(ok('Observación eliminada', { id }))
})

// ─── SIEE Phase 3: Observation Bank CRUD ─────────────────────────

academicRoutes.get('/observation-bank', requirePermission(PERMISSIONS.SIEE_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const subjectId = c.req.query('subjectId')
  const gradeId = c.req.query('gradeId')
  const perfLevel = c.req.query('performanceLevel')

  const whereClause = and(
    eq(observationBank.tenantId, tenantId),
    eq(observationBank.isDeleted, false),
    subjectId ? eq(observationBank.subjectId, subjectId) : undefined,
    gradeId ? eq(observationBank.gradeId, gradeId) : undefined,
    perfLevel ? eq(observationBank.performanceLevel, perfLevel) : undefined
  )

  const items = await db
    .select({
      id: observationBank.id,
      tenantId: observationBank.tenantId,
      subjectId: observationBank.subjectId,
      subjectName: subjects.name,
      gradeId: observationBank.gradeId,
      gradeName: grades.name,
      performanceLevel: observationBank.performanceLevel,
      observationType: observationBank.observationType,
      text: observationBank.text,
      isActive: observationBank.isActive,
      createdAt: observationBank.createdAt,
      updatedAt: observationBank.updatedAt,
    })
    .from(observationBank)
    .leftJoin(subjects, eq(subjects.id, observationBank.subjectId))
    .leftJoin(grades, eq(grades.id, observationBank.gradeId))
    .where(whereClause)
    .orderBy(asc(observationBank.observationType))

  return c.json(ok('Banco de observaciones cargado', {
    items: items.map(item => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
  }))
})

academicRoutes.post('/observation-bank', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', observationBankSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [item] = await db
    .insert(observationBank)
    .values({
      tenantId,
      ...payload,
      subjectId: payload.subjectId || null,
      gradeId: payload.gradeId || null,
      performanceLevel: payload.performanceLevel || null,
      createdBy: user.id,
      updatedBy: user.id
    })
    .returning()

  if (!item) throw new AppError('No fue posible crear la observación en el banco', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'observation_bank', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Observación creada en el banco', { id: item.id }), 201)
})

academicRoutes.put('/observation-bank/:id', requirePermission(PERMISSIONS.SIEE_WRITE), zValidator('json', observationBankSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [item] = await db
    .update(observationBank)
    .set({
      ...payload,
      subjectId: payload.subjectId || null,
      gradeId: payload.gradeId || null,
      performanceLevel: payload.performanceLevel || null,
      updatedAt: new Date(),
      updatedBy: user.id
    })
    .where(and(eq(observationBank.id, id), eq(observationBank.tenantId, tenantId), eq(observationBank.isDeleted, false)))
    .returning()

  if (!item) throw new AppError('Observación del banco no encontrada', 404)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'observation_bank', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Observación del banco actualizada', { id }))
})

academicRoutes.delete('/observation-bank/:id', requirePermission(PERMISSIONS.SIEE_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  await db
    .update(observationBank)
    .set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id })
    .where(and(eq(observationBank.id, id), eq(observationBank.tenantId, tenantId)))

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'observation_bank', entityId: id, action: 'delete' })
  return c.json(ok('Observación del banco eliminada', { id }))
})

// ─── SIEE Phase 3: Support Strategies CRUD ───────────────────────

academicRoutes.get('/support-strategies', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const academicYearId = c.req.query('academicYearId') ?? ''
  const academicPeriodId = c.req.query('academicPeriodId') ?? ''
  const studentId = c.req.query('studentId') ?? ''
  const subjectId = c.req.query('subjectId') ?? ''

  const whereClause = and(
    eq(supportStrategies.tenantId, tenantId),
    eq(supportStrategies.isDeleted, false),
    academicYearId ? eq(supportStrategies.academicYearId, academicYearId) : undefined,
    academicPeriodId ? eq(supportStrategies.academicPeriodId, academicPeriodId) : undefined,
    studentId ? eq(supportStrategies.studentId, studentId) : undefined,
    subjectId ? eq(supportStrategies.subjectId, subjectId) : undefined
  )

  const items = await db
    .select({
      id: supportStrategies.id,
      tenantId: supportStrategies.tenantId,
      academicYearId: supportStrategies.academicYearId,
      academicPeriodId: supportStrategies.academicPeriodId,
      studentId: supportStrategies.studentId,
      studentName: students.firstName,
      subjectId: supportStrategies.subjectId,
      subjectName: subjects.name,
      achievementId: supportStrategies.achievementId,
      achievementCode: learningAchievements.code,
      teacherId: supportStrategies.teacherId,
      teacherName: teachers.fullName,
      description: supportStrategies.description,
      dueDate: supportStrategies.dueDate,
      status: supportStrategies.status,
      resultScore: supportStrategies.resultScore,
      createdAt: supportStrategies.createdAt,
      updatedAt: supportStrategies.updatedAt,
    })
    .from(supportStrategies)
    .innerJoin(students, eq(students.id, supportStrategies.studentId))
    .innerJoin(subjects, eq(subjects.id, supportStrategies.subjectId))
    .leftJoin(learningAchievements, eq(learningAchievements.id, supportStrategies.achievementId))
    .leftJoin(teachers, eq(teachers.id, supportStrategies.teacherId))
    .where(whereClause)
    .orderBy(desc(supportStrategies.createdAt))

  return c.json(ok('Estrategias de apoyo cargadas', {
    items: items.map(item => ({
      ...item,
      resultScore: item.resultScore ? Number(item.resultScore) : null,
      dueDate: item.dueDate ? item.dueDate : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
  }))
})

academicRoutes.post('/support-strategies', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', supportStrategySchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  await ensureActivePeriod(db, tenantId, payload.academicPeriodId)

  const [item] = await db
    .insert(supportStrategies)
    .values({
      tenantId,
      ...payload,
      achievementId: payload.achievementId || null,
      teacherId: payload.teacherId || null,
      dueDate: payload.dueDate || null,
      resultScore: payload.resultScore ? String(payload.resultScore) : null,
      createdBy: user.id,
      updatedBy: user.id
    })
    .returning()

  if (!item) throw new AppError('No fue posible crear la estrategia de apoyo', 500)
  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'support_strategies', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Estrategia de apoyo creada', { id: item.id }), 201)
})

academicRoutes.put('/support-strategies/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', supportStrategySchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [existing] = await db
    .select({ academicPeriodId: supportStrategies.academicPeriodId })
    .from(supportStrategies)
    .where(and(eq(supportStrategies.id, id), eq(supportStrategies.tenantId, tenantId), eq(supportStrategies.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Estrategia de apoyo no encontrada', 404)
  await ensureActivePeriod(db, tenantId, existing.academicPeriodId)
  if (payload.academicPeriodId !== existing.academicPeriodId) {
    await ensureActivePeriod(db, tenantId, payload.academicPeriodId)
  }

  const [item] = await db
    .update(supportStrategies)
    .set({
      ...payload,
      achievementId: payload.achievementId || null,
      teacherId: payload.teacherId || null,
      dueDate: payload.dueDate || null,
      resultScore: payload.resultScore ? String(payload.resultScore) : null,
      updatedAt: new Date(),
      updatedBy: user.id
    })
    .where(and(eq(supportStrategies.id, id), eq(supportStrategies.tenantId, tenantId), eq(supportStrategies.isDeleted, false)))
    .returning()

  if (!item) throw new AppError('Estrategia de apoyo no encontrada', 404)
  
  if (payload.status === 'approved' && payload.resultScore) {
    const [enrollment] = await db
      .select({ gradeId: enrollments.gradeId, groupId: enrollments.groupId })
      .from(enrollments)
      .where(and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, payload.studentId),
        eq(enrollments.academicYearId, payload.academicYearId),
        eq(enrollments.isDeleted, false),
        ne(enrollments.enrollmentStatus, 'cancelled'),
      ))
      .limit(1)

    const resolvedScale = enrollment?.gradeId
      ? await resolveGradingScaleForGrade({
          db,
          tenantId,
          academicYearId: payload.academicYearId,
          gradeId: enrollment.gradeId,
        })
      : null

    const [existingGrade] = await db
      .select()
      .from(gradeRecords)
      .where(and(
        eq(gradeRecords.tenantId, tenantId),
        eq(gradeRecords.studentId, payload.studentId),
        eq(gradeRecords.subjectId, payload.subjectId),
        eq(gradeRecords.academicPeriodId, payload.academicPeriodId),
        eq(gradeRecords.isDeleted, false)
      ))
      .limit(1)

    if (existingGrade) {
      const currentScore = Number(existingGrade.score)
      const newScore = Number(payload.resultScore)
      if (newScore > currentScore) {
        await db
          .update(gradeRecords)
          .set({
            score: String(newScore),
            gradeValue: resolvedScale ? resolveDisplayedGradeValue({ score: newScore, scale: resolvedScale }) : String(newScore),
            gradeValueType: resolvedScale?.scaleType ?? 'numeric',
            notes: `Nota recuperada vía Estrategia de Apoyo. Nota anterior: ${currentScore}`,
            updatedAt: new Date(),
            updatedBy: user.id
          })
          .where(eq(gradeRecords.id, existingGrade.id))
      }
    } else {
      await db
        .insert(gradeRecords)
        .values({
          tenantId,
          studentId: payload.studentId,
          subjectId: payload.subjectId,
          academicPeriodId: payload.academicPeriodId,
          score: String(payload.resultScore),
          gradeValue: resolvedScale ? resolveDisplayedGradeValue({ score: Number(payload.resultScore), scale: resolvedScale }) : String(payload.resultScore),
          gradeValueType: resolvedScale?.scaleType ?? 'numeric',
          maxScore: resolvedScale ? String(resolvedScale.maxValue) : '5.00',
          notes: 'Nota asignada vía Estrategia de Apoyo',
          groupId: enrollment?.groupId ?? null,
          academicYearId: payload.academicYearId,
          createdBy: user.id,
          updatedBy: user.id
        })
    }
  }

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'support_strategies', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Estrategia de apoyo actualizada', { id }))
})

academicRoutes.delete('/support-strategies/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const id = c.req.param('id')

  const [existing] = await db
    .select({ academicPeriodId: supportStrategies.academicPeriodId })
    .from(supportStrategies)
    .where(and(eq(supportStrategies.id, id), eq(supportStrategies.tenantId, tenantId), eq(supportStrategies.isDeleted, false)))
    .limit(1)

  if (!existing) throw new AppError('Estrategia de apoyo no encontrada', 404)
  await ensureActivePeriod(db, tenantId, existing.academicPeriodId)

  await db
    .update(supportStrategies)
    .set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id })
    .where(and(eq(supportStrategies.id, id), eq(supportStrategies.tenantId, tenantId)))

  await writeAuditLog(db, { tenantId, actorUserId: user.id, entity: 'support_strategies', entityId: id, action: 'delete' })
  return c.json(ok('Estrategia de apoyo eliminada', { id }))
})

// ─── SIEE Phase 3: Automatic Gradebook Calculation ───────────────

academicRoutes.post('/gradebook/calculate', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', z.object({
  academicYearId: z.uuid(),
  academicPeriodId: z.uuid(),
  groupId: z.uuid(),
  subjectId: z.uuid(),
})), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')
  await ensureActivePeriod(db, tenantId, payload.academicPeriodId)

  const activities = await db
    .select({ id: evaluationActivities.id })
    .from(evaluationActivities)
    .where(and(
      eq(evaluationActivities.tenantId, tenantId),
      eq(evaluationActivities.academicYearId, payload.academicYearId),
      eq(evaluationActivities.academicPeriodId, payload.academicPeriodId),
      eq(evaluationActivities.groupId, payload.groupId),
      eq(evaluationActivities.subjectId, payload.subjectId),
      eq(evaluationActivities.isDeleted, false)
    ))

  if (activities.length === 0) {
    throw new AppError('No hay actividades evaluativas creadas para esta asignatura y periodo.', 400)
  }
  const updatedCount = await calculateAndPersistPeriodGrades({
    db,
    tenantId,
    userId: user.id,
    academicYearId: payload.academicYearId,
    academicPeriodId: payload.academicPeriodId,
    groupId: payload.groupId,
    subjectId: payload.subjectId,
  })

  await writeAuditLog(db, {
    tenantId,
    actorUserId: user.id,
    entity: 'grade_records',
    entityId: payload.groupId,
    action: 'gradebook_calculate',
    changes: { ...payload, updatedCount }
  })

  return c.json(ok('Notas recalculadas y guardadas', { updatedCount }))
})
