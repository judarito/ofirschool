import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { academicPeriods, academicYears, enrollments, gradeRecords, grades, groups, issuedDocuments, subjects, students } from '@ofir/db'
import { PERMISSIONS, officialDocumentRequestSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

const crypto = globalThis.crypto

export const officialDocumentRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

officialDocumentRoutes.use('*', authMiddleware, tenantMiddleware)

const generateVerificationCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'OFIR-'
  for (let i = 0; i < 12; i++) {
    code += chars[crypto.getRandomValues(new Uint8Array(1))[0] % chars.length]
  }
  return code
}

const getNextConsecutive = async (db: AppContextVariables['db'], tenantId: string, academicYearId: string, documentType: string) => {
  const [last] = await db
    .select({ max: sql<number>`COALESCE(MAX(consecutive_number), 0)` })
    .from(issuedDocuments)
    .where(and(eq(issuedDocuments.tenantId, tenantId), eq(issuedDocuments.academicYearId, academicYearId), eq(issuedDocuments.documentType, documentType)))
  return (last?.max ?? 0) + 1
}

const buildPdf = async (title: string, content: string, footerInfo: string) => {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()
  const margin = 50

  page.drawRectangle({ x: 0, y: height - 3, width, height: 3, color: rgb(0.06, 0.46, 0.43) })

  page.drawText(title, { x: margin, y: height - 45, size: 16, font: bold, color: rgb(0.06, 0.46, 0.43) })
  page.drawLine({ start: { x: margin, y: height - 50 }, end: { x: width - margin, y: height - 50 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) })

  let y = height - 80
  for (const line of content.split('\n')) {
    if (y < 60) continue
    page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) })
    y -= 15
  }

  page.drawLine({ start: { x: margin, y: 50 }, end: { x: width - margin, y: 50 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  page.drawText(footerInfo, { x: margin, y: 35, size: 7, font, color: rgb(0.5, 0.5, 0.5) })

  return pdfDoc.save()
}

officialDocumentRoutes.post('/generate', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', officialDocumentRequestSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')
  const payload = c.req.valid('json')

  const [student] = await db.select().from(students).where(and(eq(students.id, payload.studentId), eq(students.isDeleted, false))).limit(1)
  if (!student) throw new AppError('Estudiante no encontrado', 404)

  const [year] = await db.select({ name: academicYears.name }).from(academicYears).where(and(eq(academicYears.id, payload.academicYearId), eq(academicYears.tenantId, tenantId))).limit(1)
  if (!year) throw new AppError('Año lectivo no encontrado', 404)

  const [enrollment] = await db.select({
    id: enrollments.id, gradeName: grades.name, groupName: groups.name,
  }).from(enrollments).leftJoin(grades, eq(grades.id, enrollments.gradeId))
    .leftJoin(groups, eq(groups.id, enrollments.groupId))
    .where(and(eq(enrollments.id, payload.enrollmentId || ''), eq(enrollments.tenantId, tenantId), eq(enrollments.isDeleted, false)))
    .limit(1)

  const consecutive = await getNextConsecutive(db, tenantId, payload.academicYearId, payload.documentType)
  const verificationCode = generateVerificationCode()

  const studentName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ')
  const studentDoc = `${student.documentType} ${student.documentNumber}`.trim()
  const issuerName = user.fullName || 'Sistema'

  let content = ''
  let title = ''

  if (payload.documentType === 'study_certificate') {
    title = 'CERTIFICADO DE ESTUDIO'
    content = [
      `El(colegio) certifica que ${studentName}, identificado con ${studentDoc},`,
      `cursó durante el año lectivo ${year.name} en el grado ${enrollment?.gradeName ?? 'N/A'}`,
      `${enrollment?.groupName ? `grupo ${enrollment.groupName}` : ''}.`,
      '',
      `Se expide el presente certificado a solicitud del interesado.`,
      `Consecutivo No. ${consecutive}`,
      `Código de verificación: ${verificationCode}`,
    ].join('\n')
  } else if (payload.documentType === 'enrollment_certificate') {
    title = 'CONSTANCIA DE MATRÍCULA'
    content = [
      `El(colegio) hace constar que ${studentName}, identificado con ${studentDoc},`,
      `se encuentra matriculado en el grado ${enrollment?.gradeName ?? 'N/A'}`,
      `${enrollment?.groupName ? `grupo ${enrollment.groupName}` : ''}`,
      `durante el año lectivo ${year.name}.`,
      '',
      `Consecutivo No. ${consecutive}`,
      `Código de verificación: ${verificationCode}`,
    ].join('\n')
  } else if (payload.documentType === 'grade_certificate') {
    title = 'CERTIFICADO DE NOTAS'
    const periods = await db.select({ id: academicPeriods.id, name: academicPeriods.name })
      .from(academicPeriods).where(and(eq(academicPeriods.academicYearId, payload.academicYearId), eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.isDeleted, false)))
      .orderBy(asc(academicPeriods.startsOn))

    const gradesData = await db.select({
      subjectName: subjects.name, score: gradeRecords.score, periodName: academicPeriods.name,
    }).from(gradeRecords).innerJoin(subjects, eq(subjects.id, gradeRecords.subjectId))
      .leftJoin(academicPeriods, eq(academicPeriods.id, gradeRecords.academicPeriodId))
      .where(and(eq(gradeRecords.studentId, payload.studentId), eq(gradeRecords.tenantId, tenantId), eq(gradeRecords.isDeleted, false)))
      .orderBy(asc(subjects.name), asc(academicPeriods.startsOn))

    const lineParts = ['', `El(colegio) certifica las siguientes calificaciones de ${studentName} durante ${year.name}:`, '']
    const periodNames = [...new Set(gradesData.map((g) => g.periodName))]
    for (const subject of [...new Set(gradesData.map((g) => g.subjectName))]) {
      const subjectGrades = gradesData.filter((g) => g.subjectName === subject)
      const gradeStr = subjectGrades.map((g) => `${g.periodName}: ${g.score}`).join(' | ')
      lineParts.push(`${subject}: ${gradeStr}`)
    }
    lineParts.push('', `Consecutivo No. ${consecutive}`, `Código de verificación: ${verificationCode}`)
    content = lineParts.join('\n')
  } else if (payload.documentType === 'coexistence_record') {
    title = 'HISTORIAL DE CONVIVENCIA ESCOLAR'
    content = [
      `Observador del estudiante: ${studentName}, identificado con ${studentDoc}.`,
      '',
      `Los eventos de convivencia registrados durante el año lectivo ${year.name}`,
      `se encuentran documentados en el módulo de convivencia escolar.`,
      '',
      `Este documento es un extracto oficial del observador del estudiante.`,
      `Consecutivo No. ${consecutive}`,
      `Código de verificación: ${verificationCode}`,
    ].join('\n')
  }

  const footerInfo = `OfirSchool • Documento oficial • Consecutivo ${consecutive} • Código: ${verificationCode} • Emitido por: ${issuerName}`
  const pdfBytes = await buildPdf(title, content, footerInfo)

  const [record] = await db.insert(issuedDocuments).values({
    tenantId, documentType: payload.documentType,
    academicYearId: payload.academicYearId, studentId: payload.studentId,
    enrollmentId: payload.enrollmentId || null,
    consecutiveNumber: consecutive, verificationCode,
    issuedByName: issuerName, validUntil: null,
    metadata: { purpose: payload.purpose || null },
    createdBy: user.id, updatedBy: user.id,
  }).returning({ id: issuedDocuments.id, consecutiveNumber: issuedDocuments.consecutiveNumber, verificationCode: issuedDocuments.verificationCode })

  await writeAuditLog(db, {
    tenantId, actorUserId: user.id, entity: 'issued_documents', entityId: record.id,
    action: 'generate', changes: { documentType: payload.documentType, studentId: payload.studentId, consecutive: record.consecutiveNumber },
  })

  return new Response(pdfBytes as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${payload.documentType}_${studentName.replace(/\s+/g, '_')}.pdf"`,
      'X-Consecutive': String(record.consecutiveNumber),
      'X-Verification-Code': record.verificationCode,
    },
  })
})

officialDocumentRoutes.get('/verify/:code', async (c) => {
  const db = c.get('db')
  const code = c.req.param('code')

  const [doc] = await db.select({
    id: issuedDocuments.id,
    documentType: issuedDocuments.documentType,
    consecutiveNumber: issuedDocuments.consecutiveNumber,
    issuedByName: issuedDocuments.issuedByName,
    issuedAt: issuedDocuments.issuedAt,
    studentId: issuedDocuments.studentId,
    academicYearId: issuedDocuments.academicYearId,
    studentName: students.firstName,
  }).from(issuedDocuments).leftJoin(students, eq(students.id, issuedDocuments.studentId))
    .where(and(eq(issuedDocuments.verificationCode, code), eq(issuedDocuments.isDeleted, false)))
    .limit(1)

  if (!doc) throw new AppError('Documento no encontrado o código inválido', 404)

  return c.json(ok('Documento verificado', {
    documentType: doc.documentType,
    consecutiveNumber: doc.consecutiveNumber,
    issuedByName: doc.issuedByName,
    issuedAt: doc.issuedAt.toISOString(),
    studentName: doc.studentName ?? 'No disponible',
    isValid: true,
  }))
})
