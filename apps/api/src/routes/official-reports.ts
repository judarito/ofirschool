import { and, asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { academicYears, enrollments, grades, groups, schoolBranches, students } from '@ofir/db'
import { PERMISSIONS, officialReportGenerateSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import type { AppContextVariables, Bindings } from '../types'

export const officialReportRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

officialReportRoutes.use('*', authMiddleware, tenantMiddleware)

const buildSimatRow = (row: {
  studentName: string; docType: string; docNumber: string; birthDate: string | null
  gender: string; gradeName: string; groupName: string | null
  branchName: string | null; department: string | null; city: string | null
  guardianName: string | null; guardianDoc: string | null; guardianPhone: string | null
  eps: string | null; sisbenLevel: string | null; address: string | null
}) => {
  const fields = [
    row.docType, row.docNumber, row.studentName, row.birthDate || '',
    row.gender || '', row.gradeName, row.groupName || '',
    row.branchName || '', row.department || '', row.city || '',
    row.guardianName || '', row.guardianDoc || '', row.guardianPhone || '',
    row.eps || '', row.sisbenLevel || '', row.address || '',
  ]
  return fields.map((f) => `"${(f || '').replace(/"/g, '""')}"`).join(',')
}

const buildC600BaseRow = (row: {
  docType: string; docNumber: string; studentName: string
  birthDate: string | null; gender: string; gradeName: string
  groupName: string | null; branchName: string | null
  department: string | null; city: string | null; sisbenLevel: string | null
}) => {
  return [
    row.docType, row.docNumber, row.studentName, row.birthDate || '',
    row.gender || '', row.gradeName, row.groupName || '',
    row.branchName || '', row.department || '', row.city || '',
    row.sisbenLevel || '',
  ].join('|')
}

officialReportRoutes.post('/generate', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('json', officialReportGenerateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const payload = c.req.valid('json')

  const [year] = await db.select({ id: academicYears.id, year: academicYears.year, name: academicYears.name })
    .from(academicYears)
    .where(and(eq(academicYears.id, payload.academicYearId), eq(academicYears.tenantId, tenantId)))
    .limit(1)

  if (!year) throw new AppError('Año lectivo no encontrado', 404)

  const whereClause = and(
    eq(enrollments.tenantId, tenantId),
    eq(enrollments.academicYearId, year.id),
    eq(enrollments.isDeleted, false),
    eq(enrollments.enrollmentStatus, 'active'),
  )

  const rows = await db.select({
    docType: students.documentType,
    docNumber: students.documentNumber,
    studentName: sql<string>`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName})`,
    birthDate: students.birthDate,
    gender: students.gender,
    eps: students.eps,
    sisbenLevel: students.sisbenLevel,
    address: students.address,
    department: students.department,
    city: students.city,
    gradeName: grades.name,
    groupName: groups.name,
    branchName: schoolBranches.name,
    guardianName: sql<string>`NULL`,
    guardianDoc: sql<string>`NULL`,
    guardianPhone: sql<string>`NULL`,
  })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .leftJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .leftJoin(schoolBranches, eq(schoolBranches.id, enrollments.branchId))
    .where(whereClause)
    .orderBy(asc(grades.level), asc(groups.name), asc(students.firstName))

  if (!rows.length) throw new AppError('No hay matrículas activas para generar el reporte', 404)

  let content: string
  let mimeType: string
  let filename: string

  if (payload.format === 'csv') {
    const headers = Object.keys(rows[0]).join(',')
    const headerRow = headers.split(',').map((h) => `"${h}"`).join(',')
    const dataRows = rows.map(buildSimatRow)
    content = [headerRow, ...dataRows].join('\n')
    mimeType = 'text/csv'
  } else {
    content = JSON.stringify(rows, null, 2)
    mimeType = 'application/json'
  }

  filename = `${payload.reportType}_${year.year}_${payload.format}.${payload.format === 'csv' ? 'csv' : 'json'}`

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': `${mimeType}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Total-Records': String(rows.length),
      'X-Academic-Year': String(year.year),
    },
  })
})

officialReportRoutes.get('/summary/:academicYearId', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const academicYearId = c.req.param('academicYearId')

  const total = await db.select({ count: sql<number>`count(*)` }).from(enrollments)
    .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.academicYearId, academicYearId), eq(enrollments.isDeleted, false)))

  const byGrade = await db.select({
    gradeName: grades.name, count: sql<number>`count(*)`,
  }).from(enrollments).innerJoin(grades, eq(grades.id, enrollments.gradeId))
    .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.academicYearId, academicYearId), eq(enrollments.isDeleted, false)))
    .groupBy(grades.name).orderBy(asc(grades.name))

  const byGender = await db.select({
    gender: students.gender, count: sql<number>`count(*)`,
  }).from(enrollments).innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.academicYearId, academicYearId), eq(enrollments.isDeleted, false)))
    .groupBy(students.gender)

  const byBranch = await db.select({
    branchName: schoolBranches.name, count: sql<number>`count(*)`,
  }).from(enrollments).leftJoin(schoolBranches, eq(schoolBranches.id, enrollments.branchId))
    .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.academicYearId, academicYearId), eq(enrollments.isDeleted, false)))
    .groupBy(schoolBranches.name)

  return c.json(ok('Resumen de matrícula', {
    totalEnrollments: Number(total[0]?.count ?? 0),
    byGrade, byGender, byBranch,
    generatedAt: new Date().toISOString(),
  }))
})

officialReportRoutes.get('/validate/:academicYearId', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const academicYearId = c.req.param('academicYearId')

  const enrollmentsData = await db.select({
    id: enrollments.id,
    docType: students.documentType,
    docNumber: students.documentNumber,
    studentName: sql<string>`concat_ws(' ', ${students.firstName}, ${students.middleName}, ${students.lastName})`,
    birthDate: students.birthDate,
    gender: students.gender,
    gradeName: grades.name,
    groupName: groups.name,
    branchName: schoolBranches.name,
    eps: students.eps,
    address: students.address,
    city: students.city,
    department: students.department,
  }).from(enrollments).innerJoin(students, eq(students.id, enrollments.studentId))
    .leftJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .leftJoin(schoolBranches, eq(schoolBranches.id, enrollments.branchId))
    .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.academicYearId, academicYearId), eq(enrollments.isDeleted, false)))

  const issues: Array<{ enrollmentId: string; studentName: string; field: string; issue: string; severity: 'error' | 'warning' }> = []

  for (const e of enrollmentsData) {
    if (!e.docType || !e.docNumber) issues.push({ enrollmentId: e.id, studentName: e.studentName, field: 'documento', issue: 'Tipo o número de documento faltante', severity: 'error' })
    if (!e.birthDate) issues.push({ enrollmentId: e.id, studentName: e.studentName, field: 'fecha_nacimiento', issue: 'Fecha de nacimiento no registrada', severity: 'warning' })
    if (!e.gender) issues.push({ enrollmentId: e.id, studentName: e.studentName, field: 'genero', issue: 'Género no registrado', severity: 'warning' })
    if (!e.gradeName) issues.push({ enrollmentId: e.id, studentName: e.studentName, field: 'grado', issue: 'Grado no asignado', severity: 'error' })
    if (!e.branchName) issues.push({ enrollmentId: e.id, studentName: e.studentName, field: 'sede', issue: 'Sede no asignada', severity: 'warning' })
    if (!e.city) issues.push({ enrollmentId: e.id, studentName: e.studentName, field: 'ciudad', issue: 'Ciudad no registrada', severity: 'warning' })
  }

  return c.json(ok('Validación de datos completada', {
    totalChecked: enrollmentsData.length,
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    issues: issues.slice(0, 50),
    canExport: issues.filter((i) => i.severity === 'error').length === 0,
  }))
})
