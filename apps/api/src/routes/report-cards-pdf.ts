import { and, asc, count, eq, inArray, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import {
  academicPeriods,
  academicYears,
  enrollments,
  gradeSubjects,
  gradeRecords,
  grades,
  groups,
  learningAchievements,
  subjects,
  students,
  academicAreas,
  teachers,
  courseSubjects,
  teacherResponsibilities,
  academicObservations,
  supportStrategies,
  attendanceRecords
} from '@ofir/db'
import { PERMISSIONS, reportCardFiltersSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { calculatePerformanceLevel } from '../lib/grading-calculator'
import { resolveDisplayedGradeValue, resolveGradingScaleForGrade } from '../lib/grading-scale-resolution'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import type { AppContextVariables, Bindings } from '../types'

export const reportCardPdfRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

reportCardPdfRoutes.use('*', authMiddleware, tenantMiddleware)

// Cache global de fuentes para evitar descargas repetidas en la misma instancia de Cloudflare Worker
let regularFontBuffer: ArrayBuffer | null = null
let boldFontBuffer: ArrayBuffer | null = null

async function getFonts() {
  if (!regularFontBuffer) {
    regularFontBuffer = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf').then(res => res.arrayBuffer())
  }
  if (!boldFontBuffer) {
    boldFontBuffer = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Bold.ttf').then(res => res.arrayBuffer())
  }
  return { regularFontBytes: regularFontBuffer, boldFontBytes: boldFontBuffer }
}

async function getFontsSafe() {
  try {
    const { regularFontBytes, boldFontBytes } = await getFonts()
    return { regularFontBytes, boldFontBytes, useFallback: false }
  } catch (e) {
    console.warn("Failed to fetch custom fonts, using standard Helvetica fallback:", e)
    return { regularFontBytes: null, boldFontBytes: null, useFallback: true }
  }
}

// Helper para envolver y cortar textos de acuerdo al ancho de la columna
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const width = font.widthOfTextAtSize(testLine, fontSize)
    if (width > maxWidth) {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }
  return lines
}

// Colores de la paleta institucional
const COLOR_PRIMARY = rgb(0.06, 0.46, 0.43) // #0f766e - Teal
const COLOR_SECONDARY = rgb(0.28, 0.33, 0.41) // #475569 - Slate
const COLOR_TEXT = rgb(0.06, 0.09, 0.16) // #0f172a - Dark text
const COLOR_MUTED = rgb(0.5, 0.5, 0.5) // Gray
const COLOR_BG_CARD = rgb(0.97, 0.98, 0.99) // Soft slate
const COLOR_BORDER = rgb(0.88, 0.9, 0.92) // Light gray border

class PDFReportBuilder {
  doc: PDFDocument
  page!: any
  y!: number
  fonts: { regular: any; bold: any }
  margin = 40
  width = 612
  height = 792
  usableWidth = 532
  pageCount = 0

  constructor(doc: PDFDocument, fonts: { regular: any; bold: any }) {
    this.doc = doc
    this.fonts = fonts
    this.addPage()
  }

  addPage() {
    this.page = this.doc.addPage([this.width, this.height])
    this.y = this.height - 40
    this.pageCount++
    this.drawDecorations()
  }

  ensureSpace(needed: number) {
    if (this.y - needed < 40) {
      this.addPage()
    }
  }

  drawDecorations() {
    // Línea superior institucional
    this.page.drawLine({
      start: { x: this.margin, y: this.height - 20 },
      end: { x: this.width - this.margin, y: this.height - 20 },
      thickness: 1.5,
      color: COLOR_PRIMARY
    })

    // Pie de página con número de página
    this.page.drawText(`OfirSchool • Gestión Académica Inteligente`, {
      x: this.margin,
      y: 20,
      size: 8,
      font: this.fonts.regular,
      color: COLOR_MUTED
    })

    const pageText = `Página ${this.pageCount}`
    const pageTextWidth = this.fonts.regular.widthOfTextAtSize(pageText, 8)
    this.page.drawText(pageText, {
      x: this.width - this.margin - pageTextWidth,
      y: 20,
      size: 8,
      font: this.fonts.regular,
      color: COLOR_MUTED
    })
  }

  drawHeader(title: string, schoolName: string, branchName: string) {
    this.ensureSpace(60)
    // Nombre Institución
    this.page.drawText(schoolName.toUpperCase(), {
      x: this.margin,
      y: this.y - 12,
      size: 14,
      font: this.fonts.bold,
      color: COLOR_PRIMARY
    })
    
    // Nombre Sede
    this.page.drawText(`Sede: ${branchName}`, {
      x: this.margin,
      y: this.y - 26,
      size: 9,
      font: this.fonts.regular,
      color: COLOR_SECONDARY
    })

    // Título del Reporte
    const titleWidth = this.fonts.bold.widthOfTextAtSize(title, 12)
    this.page.drawText(title, {
      x: this.width - this.margin - titleWidth,
      y: this.y - 12,
      size: 12,
      font: this.fonts.bold,
      color: COLOR_SECONDARY
    })

    this.y -= 38
  }

  drawStudentBox(studentData: any, periodName: string, groupDirector: string | null) {
    this.ensureSpace(85)
    
    // Contenedor con borde
    const boxHeight = 75
    this.page.drawRectangle({
      x: this.margin,
      y: this.y - boxHeight,
      width: this.usableWidth,
      height: boxHeight,
      color: COLOR_BG_CARD,
      borderColor: COLOR_BORDER,
      borderWidth: 1
    })

    const padding = 12
    const startX = this.margin + padding
    const colWidth = (this.usableWidth - padding * 2) / 2
    let currentY = this.y - padding - 8

    // Fila 1: Estudiante | Año
    this.page.drawText("Estudiante:", { x: startX, y: currentY, size: 8, font: this.fonts.bold, color: COLOR_SECONDARY })
    this.page.drawText(studentData.fullName, { x: startX + 60, y: currentY, size: 9, font: this.fonts.bold, color: COLOR_TEXT })

    this.page.drawText("Año Lectivo:", { x: startX + colWidth, y: currentY, size: 8, font: this.fonts.bold, color: COLOR_SECONDARY })
    this.page.drawText(studentData.yearName, { x: startX + colWidth + 65, y: currentY, size: 9, font: this.fonts.regular, color: COLOR_TEXT })

    // Fila 2: Documento | Periodo/Corte
    currentY -= 16
    this.page.drawText("Documento:", { x: startX, y: currentY, size: 8, font: this.fonts.bold, color: COLOR_SECONDARY })
    this.page.drawText(studentData.document, { x: startX + 60, y: currentY, size: 9, font: this.fonts.regular, color: COLOR_TEXT })

    this.page.drawText("Periodo:", { x: startX + colWidth, y: currentY, size: 8, font: this.fonts.bold, color: COLOR_SECONDARY })
    this.page.drawText(periodName, { x: startX + colWidth + 65, y: currentY, size: 9, font: this.fonts.regular, color: COLOR_TEXT })

    // Fila 3: Grado y Grupo | Director
    currentY -= 16
    this.page.drawText("Curso:", { x: startX, y: currentY, size: 8, font: this.fonts.bold, color: COLOR_SECONDARY })
    const courseText = `${studentData.gradeName}${studentData.groupName ? ` • ${studentData.groupName}` : ''}`
    this.page.drawText(courseText, { x: startX + 60, y: currentY, size: 9, font: this.fonts.regular, color: COLOR_TEXT })

    this.page.drawText("Director:", { x: startX + colWidth, y: currentY, size: 8, font: this.fonts.bold, color: COLOR_SECONDARY })
    this.page.drawText(groupDirector || 'Sin asignar', { x: startX + colWidth + 65, y: currentY, size: 9, font: this.fonts.regular, color: COLOR_TEXT })

    this.y -= boxHeight + 15
  }

  drawSummaryCards(summary: any) {
    this.ensureSpace(55)

    const cardCount = 4
    const spacing = 10
    const cardWidth = (this.usableWidth - spacing * (cardCount - 1)) / cardCount
    const cardHeight = 45

    const cards = [
      { label: 'Promedio Corte', value: summary.averageScore !== null ? Number(summary.averageScore).toFixed(2) : 'Pendiente' },
      { label: 'Fallas / Inasistencia', value: `${summary.attendance.absent} fallas` },
      { label: 'Materias Evaluadas', value: `${summary.subjectsWithGrades} / ${summary.totalSubjects}` },
      { label: 'Apoyos Pendientes', value: String(summary.pendingSupportStrategies) }
    ]

    let currentX = this.margin
    for (const card of cards) {
      this.page.drawRectangle({
        x: currentX,
        y: this.y - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: COLOR_BG_CARD,
        borderColor: COLOR_BORDER,
        borderWidth: 1
      })

      // Label
      const labelWidth = this.fonts.regular.widthOfTextAtSize(card.label, 7)
      this.page.drawText(card.label, {
        x: currentX + (cardWidth - labelWidth) / 2,
        y: this.y - 14,
        size: 7,
        font: this.fonts.regular,
        color: COLOR_SECONDARY
      })

      // Value
      const valueWidth = this.fonts.bold.widthOfTextAtSize(card.value, 11)
      this.page.drawText(card.value, {
        x: currentX + (cardWidth - valueWidth) / 2,
        y: this.y - 32,
        size: 11,
        font: this.fonts.bold,
        color: COLOR_PRIMARY
      })

      currentX += cardWidth + spacing
    }

    this.y -= cardHeight + 20
  }

  drawTable(headers: string[], colWidths: number[], subjects: any[]) {
    // Dibujar cabecera
    this.ensureSpace(25)
    this.page.drawRectangle({
      x: this.margin,
      y: this.y - 20,
      width: this.usableWidth,
      height: 20,
      color: COLOR_PRIMARY
    })

    let currentX = this.margin
    for (let i = 0; i < headers.length; i++) {
      const headerText = headers[i] ?? ''
      const colWidth = colWidths[i] ?? 100
      this.page.drawText(headerText, {
        x: currentX + 6,
        y: this.y - 14,
        size: 8,
        font: this.fonts.bold,
        color: rgb(1, 1, 1)
      })
      currentX += colWidth
    }
    this.y -= 20

    // Renderizar materias
    for (const subject of subjects) {
      const col1Width = colWidths[0] ?? 150
      const col2Width = colWidths[1] ?? 45
      const col3Width = colWidths[2] ?? 75
      const col4Width = colWidths[3] ?? 45
      const col5Width = colWidths[4] ?? 217

      const subjectNameLines = wrapText(subject.subjectName, col1Width - 12, this.fonts.bold, 9)
      const metaLines: string[] = []
      if (subject.teacherName) metaLines.push(`Docente: ${subject.teacherName}`)
      if (subject.academicAreaName) metaLines.push(`Área: ${subject.academicAreaName}`)
      
      const obsLines: string[] = []
      for (const obs of subject.observations) {
        const typeLabel = obs.type === 'strength' ? 'Fortaleza' : obs.type === 'difficulty' ? 'Dificultad' : obs.type === 'recommendation' ? 'Recomendación' : 'General'
        obsLines.push(...wrapText(`${typeLabel}: ${obs.text}`, col5Width - 12, this.fonts.regular, 8))
      }

      for (const sup of subject.supportStrategies) {
        const statusLabel = sup.status === 'approved' ? 'Aprobado' : sup.status === 'rejected' ? 'No Aprobado' : 'Pendiente'
        const scoreText = sup.resultScore !== null ? ` (Nota: ${Number(sup.resultScore).toFixed(1)})` : ''
        obsLines.push(...wrapText(`Apoyo [${statusLabel}]: ${sup.description}${scoreText}`, col5Width - 12, this.fonts.regular, 8))
      }

      const leftColLinesCount = subjectNameLines.length + metaLines.length
      const rightColLinesCount = obsLines.length
      
      const subjectHeight = Math.max(leftColLinesCount * 12 + 10, rightColLinesCount * 10 + 15, 30)

      this.ensureSpace(subjectHeight + 5)

      // Fondo alternado para filas
      this.page.drawRectangle({
        x: this.margin,
        y: this.y - subjectHeight,
        width: this.usableWidth,
        height: subjectHeight,
        borderColor: COLOR_BORDER,
        borderWidth: 0.5
      })

      // Columna 1: Materia e información
      let itemY = this.y - 12
      for (const line of subjectNameLines) {
        this.page.drawText(line, { x: this.margin + 6, y: itemY, size: 9, font: this.fonts.bold, color: COLOR_TEXT })
        itemY -= 11
      }
      for (const line of metaLines) {
        this.page.drawText(line, { x: this.margin + 6, y: itemY, size: 7.5, font: this.fonts.regular, color: COLOR_MUTED })
        itemY -= 9
      }

      // Columna 2: Calificación
      const scoreStr = subject.score !== null ? Number(subject.score).toFixed(2) : 'Pendiente'
      this.page.drawText(scoreStr, {
        x: this.margin + col1Width + 6,
        y: this.y - 14,
        size: 9,
        font: this.fonts.bold,
        color: subject.score !== null ? COLOR_TEXT : COLOR_MUTED
      })

      // Columna 3: Desempeño
      const performanceStr = subject.institutionalLabel || subject.performanceLevel || '-'
      this.page.drawText(performanceStr, {
        x: this.margin + col1Width + col2Width + 6,
        y: this.y - 14,
        size: 8,
        font: this.fonts.regular,
        color: COLOR_SECONDARY
      })

      // Columna 4: Asistencia (Fallas)
      const absCount = subject.attendance ? subject.attendance.absent : 0
      const absStr = `${absCount} fallas`
      this.page.drawText(absStr, {
        x: this.margin + col1Width + col2Width + col3Width + 6,
        y: this.y - 14,
        size: 8,
        font: this.fonts.regular,
        color: absCount > 0 ? COLOR_SECONDARY : COLOR_MUTED
      })

      // Columna 5: Seguimiento y Novedades (Logros, observaciones)
      let obsY = this.y - 12
      if (obsLines.length > 0) {
        for (const line of obsLines) {
          this.page.drawText(line, {
            x: this.margin + col1Width + col2Width + col3Width + col4Width + 6,
            y: obsY,
            size: 7.5,
            font: this.fonts.regular,
            color: COLOR_TEXT
          })
          obsY -= 10
        }
      } else {
        this.page.drawText('Sin novedades registradas', {
          x: this.margin + col1Width + col2Width + col3Width + col4Width + 6,
          y: this.y - 14,
          size: 7.5,
          font: this.fonts.regular,
          color: COLOR_MUTED
        })
      }

      this.y -= subjectHeight
    }
    this.y -= 15
  }

  drawSignatures(groupDirector: string | null) {
    this.ensureSpace(100)

    const sigWidth = 160
    const spacing = 120
    const startX = this.margin + 40

    // Firma Director de Grupo
    this.page.drawLine({
      start: { x: startX, y: this.y - 50 },
      end: { x: startX + sigWidth, y: this.y - 50 },
      thickness: 0.8,
      color: COLOR_SECONDARY
    })
    this.page.drawText("Director de Grupo", {
      x: startX + 35,
      y: this.y - 62,
      size: 8,
      font: this.fonts.bold,
      color: COLOR_TEXT
    })
    this.page.drawText(groupDirector || 'Firma Docente', {
      x: startX + 10,
      y: this.y - 74,
      size: 7.5,
      font: this.fonts.regular,
      color: COLOR_MUTED
    })

    // Firma Rectoría / Secretaría
    const rectX = startX + sigWidth + spacing
    this.page.drawLine({
      start: { x: rectX, y: this.y - 50 },
      end: { x: rectX + sigWidth, y: this.y - 50 },
      thickness: 0.8,
      color: COLOR_SECONDARY
    })
    this.page.drawText("Rectoría / Secretaría", {
      x: rectX + 30,
      y: this.y - 62,
      size: 8,
      font: this.fonts.bold,
      color: COLOR_TEXT
    })
    this.page.drawText("Firma Autorizada", {
      x: rectX + 45,
      y: this.y - 74,
      size: 7.5,
      font: this.fonts.regular,
      color: COLOR_MUTED
    })

    this.y -= 90
  }
}

// ----------------------------------------------------
// IMPLEMENTACIÓN DE ENDPOINTS
// ----------------------------------------------------

async function fetchReportCardData(db: any, tenantId: string, studentId: string, academicYearId: string, academicPeriodId: string) {
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
    .innerJoin(students, and(eq(students.id, enrollments.studentId), eq(students.tenantId, tenantId)))
    .innerJoin(academicYears, and(eq(academicYears.id, enrollments.academicYearId), eq(academicYears.tenantId, tenantId)))
    .innerJoin(academicPeriods, and(eq(academicPeriods.id, academicPeriodId), eq(academicPeriods.tenantId, tenantId)))
    .innerJoin(grades, and(eq(grades.id, enrollments.gradeId), eq(grades.tenantId, tenantId)))
    .leftJoin(groups, and(eq(groups.id, enrollments.groupId), eq(groups.tenantId, tenantId)))
    .where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.studentId, studentId),
      eq(enrollments.academicYearId, academicYearId),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled'),
      eq(students.isDeleted, false),
      eq(academicYears.isDeleted, false),
      eq(academicPeriods.academicYearId, academicYearId),
      eq(academicPeriods.isDeleted, false),
      eq(grades.isDeleted, false),
    ))
    .limit(1)

  if (!enrollment) return null

  const resolvedScale = await resolveGradingScaleForGrade({
    db,
    tenantId,
    academicYearId,
    gradeId: enrollment.gradeId,
  })

  const gradeSubjectRows = await db
    .select({
      subjectId: subjects.id,
      subjectName: subjects.name,
      academicAreaName: academicAreas.name,
    })
    .from(gradeSubjects)
    .innerJoin(subjects, and(eq(subjects.id, gradeSubjects.subjectId), eq(subjects.tenantId, tenantId)))
    .leftJoin(academicAreas, and(eq(academicAreas.id, subjects.academicAreaId), eq(academicAreas.tenantId, tenantId)))
    .where(and(
      eq(gradeSubjects.tenantId, tenantId),
      eq(gradeSubjects.academicYearId, academicYearId),
      eq(gradeSubjects.gradeId, enrollment.gradeId),
      eq(gradeSubjects.isDeleted, false),
      eq(subjects.isDeleted, false),
    ))
    .orderBy(asc(academicAreas.orderNumber), asc(subjects.name))

  const subjectIds = gradeSubjectRows.map((item: any) => item.subjectId)

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
          eq(gradeRecords.studentId, studentId),
          eq(gradeRecords.academicPeriodId, academicPeriodId),
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
          eq(academicObservations.studentId, studentId),
          eq(academicObservations.academicYearId, academicYearId),
          eq(academicObservations.academicPeriodId, academicPeriodId),
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
        .leftJoin(learningAchievements, and(eq(learningAchievements.id, supportStrategies.achievementId), eq(learningAchievements.tenantId, tenantId)))
        .where(and(
          eq(supportStrategies.tenantId, tenantId),
          eq(supportStrategies.studentId, studentId),
          eq(supportStrategies.academicYearId, academicYearId),
          eq(supportStrategies.academicPeriodId, academicPeriodId),
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
          eq(attendanceRecords.studentId, studentId),
          eq(attendanceRecords.academicYearId, academicYearId),
          eq(attendanceRecords.academicPeriodId, academicPeriodId),
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
        .leftJoin(teachers, and(eq(teachers.id, courseSubjects.teacherId), eq(teachers.tenantId, tenantId)))
        .where(and(
          eq(courseSubjects.tenantId, tenantId),
          eq(courseSubjects.academicYearId, academicYearId),
          eq(courseSubjects.groupId, enrollment.groupId),
          eq(courseSubjects.isDeleted, false),
        ))
      : Promise.resolve([]),
    enrollment.groupId
      ? db
        .select({ teacherName: teachers.fullName })
        .from(teacherResponsibilities)
        .innerJoin(teachers, and(eq(teachers.id, teacherResponsibilities.teacherId), eq(teachers.tenantId, tenantId)))
        .where(and(
          eq(teacherResponsibilities.tenantId, tenantId),
          eq(teacherResponsibilities.academicYearId, academicYearId),
          eq(teacherResponsibilities.groupId, enrollment.groupId),
          eq(teacherResponsibilities.responsibilityType, 'group_director'),
          eq(teacherResponsibilities.isDeleted, false),
        ))
        .limit(1)
      : Promise.resolve([]),
  ])

  const gradesBySubject = new Map(gradeRows.map((row: any) => [row.subjectId, row]))
  const teachersBySubject = new Map(teacherRows.map((row: any) => [row.subjectId, row.teacherName]))

  const observationsBySubject = new Map<string, Array<{ id: string; type: string; text: string }>>()
  for (const row of observationRows) {
    const current = observationsBySubject.get(row.subjectId) ?? []
    current.push({ id: row.id, type: row.observationType, text: row.text })
    observationsBySubject.set(row.subjectId, current)
  }

  const supportBySubject = new Map<string, Array<any>>()
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

  const reportSubjects = gradeSubjectRows.map((subject: any) => {
    const grade = gradesBySubject.get(subject.subjectId) as any
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

  const scoredSubjects = reportSubjects.filter((sub: any) => typeof sub.score === 'number')
  const averageScore = scoredSubjects.length
    ? Number((scoredSubjects.reduce((sum: number, sub: any) => sum + Number(sub.score), 0) / scoredSubjects.length).toFixed(2))
    : null

  const pendingSupportStrategies = reportSubjects.reduce(
    (sum: number, sub: any) => sum + sub.supportStrategies.filter((item: any) => item.status === 'pending').length,
    0,
  )

  return {
    student: {
      id: enrollment.studentId,
      fullName: [enrollment.firstName, enrollment.middleName, enrollment.lastName].filter(Boolean).join(' '),
      document: `${enrollment.documentType} ${enrollment.documentNumber}`.trim(),
      yearName: enrollment.academicYearName,
      gradeName: enrollment.gradeName,
      groupName: enrollment.groupName,
    },
    academicPeriod: {
      name: enrollment.academicPeriodName,
    },
    groupDirector: groupDirectorRow[0]?.teacherName ?? null,
    summary: {
      subjectsWithGrades: scoredSubjects.length,
      totalSubjects: reportSubjects.length,
      averageScore,
      attendance: overallAttendance,
      pendingSupportStrategies,
    },
    subjects: reportSubjects
  }
}

// ----------------------------------------------------
// ENDPOINT: Generar PDF individual
// ----------------------------------------------------
reportCardPdfRoutes.get('/report-cards/:studentId/pdf', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('query', reportCardFiltersSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const studentId = c.req.param('studentId')
  const { academicYearId, academicPeriodId } = c.req.valid('query')

  const user = c.get('user')
  if (user?.branchId) {
    const [enrollment] = await db
      .select({ branchId: groups.branchId })
      .from(enrollments)
      .innerJoin(groups, and(eq(groups.id, enrollments.groupId), eq(groups.tenantId, tenantId)))
      .where(and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.academicYearId, academicYearId),
        eq(enrollments.isDeleted, false)
      ))
      .limit(1)

    if (enrollment && enrollment.branchId && enrollment.branchId !== user.branchId) {
      throw new AppError('No tienes permiso para operar sobre estudiantes de esta sede.', 403)
    }
  }

  // Obtener datos
  const data = await fetchReportCardData(db, tenantId, studentId, academicYearId, academicPeriodId)
  if (!data) throw new AppError('No se encontró matrícula activa o datos para el boletín.', 404)

  // Crear PDF
  const pdfDoc = await PDFDocument.create()
  const { regularFontBytes, boldFontBytes, useFallback } = await getFontsSafe()

  const fonts = {
    regular: useFallback ? await pdfDoc.embedFont(StandardFonts.Helvetica) : await pdfDoc.embedFont(regularFontBytes!),
    bold: useFallback ? await pdfDoc.embedFont(StandardFonts.HelveticaBold) : await pdfDoc.embedFont(boldFontBytes!)
  }

  const builder = new PDFReportBuilder(pdfDoc, fonts)
  builder.drawHeader("BOLETÍN DE CALIFICACIONES", "OFIR SCHOOL", "Principal")
  builder.drawStudentBox(data.student, data.academicPeriod.name, data.groupDirector)
  builder.drawSummaryCards(data.summary)
  
  const headers = ["ASIGNATURA", "NOTA", "DESEMPEÑO", "FALLAS", "SEGUIMIENTO / NOVEDADES"]
  const colWidths = [150, 45, 75, 45, 217]
  builder.drawTable(headers, colWidths, data.subjects)
  builder.drawSignatures(data.groupDirector)

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Boletin_${data.student.fullName.replace(/\s+/g, '_')}_Periodo.pdf"`
    }
  })
})

// ----------------------------------------------------
// ENDPOINT: Generar PDF concatenado por grupo
// ----------------------------------------------------
const batchPdfSchema = z.object({
  academicYearId: z.string().uuid(),
  academicPeriodId: z.string().uuid(),
  groupId: z.string().uuid()
})

reportCardPdfRoutes.post('/report-cards/batch-pdf', requirePermission(PERMISSIONS.ACADEMIC_READ), zValidator('json', batchPdfSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const { academicYearId, academicPeriodId, groupId } = c.req.valid('json')
  const user = c.get('user')
  if (user?.branchId) {
    const [groupRecord] = await db
      .select({ branchId: groups.branchId })
      .from(groups)
      .where(and(
        eq(groups.id, groupId),
        eq(groups.tenantId, tenantId),
        eq(groups.isDeleted, false)
      ))
      .limit(1)

    if (groupRecord && groupRecord.branchId && groupRecord.branchId !== user.branchId) {
      throw new AppError('No tienes permiso para operar en esta sede.', 403)
    }
  }

  // Obtener todos los estudiantes matriculados en el grupo
  const groupEnrollments = await db
    .select({
      studentId: enrollments.studentId
    })
    .from(enrollments)
    .where(and(
      eq(enrollments.tenantId, tenantId),
      eq(enrollments.academicYearId, academicYearId),
      eq(enrollments.groupId, groupId),
      eq(enrollments.isDeleted, false),
      ne(enrollments.enrollmentStatus, 'cancelled')
    ))

  if (groupEnrollments.length === 0) {
    throw new AppError('No hay estudiantes matriculados en este grupo para generar boletines.', 404)
  }

  // Crear PDF
  const pdfDoc = await PDFDocument.create()
  const { regularFontBytes, boldFontBytes, useFallback } = await getFontsSafe()

  const fonts = {
    regular: useFallback ? await pdfDoc.embedFont(StandardFonts.Helvetica) : await pdfDoc.embedFont(regularFontBytes!),
    bold: useFallback ? await pdfDoc.embedFont(StandardFonts.HelveticaBold) : await pdfDoc.embedFont(boldFontBytes!)
  }

  let generatedCount = 0
  for (const enrollment of groupEnrollments) {
    const data = await fetchReportCardData(db, tenantId, enrollment.studentId, academicYearId, academicPeriodId)
    if (!data) continue

    const builder = new PDFReportBuilder(pdfDoc, fonts)
    builder.drawHeader("BOLETÍN DE CALIFICACIONES", "OFIR SCHOOL", "Principal")
    builder.drawStudentBox(data.student, data.academicPeriod.name, data.groupDirector)
    builder.drawSummaryCards(data.summary)

    const headers = ["ASIGNATURA", "NOTA", "DESEMPEÑO", "FALLAS", "SEGUIMIENTO / NOVEDADES"]
    const colWidths = [150, 45, 75, 45, 217]
    builder.drawTable(headers, colWidths, data.subjects)
    builder.drawSignatures(data.groupDirector)

    generatedCount++
  }

  if (generatedCount === 0) {
    throw new AppError('No fue posible generar ningún boletín para el grupo.', 404)
  }

  const pdfBytes = await pdfDoc.save()

  return new Response(pdfBytes as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Boletines_Grupo_Lote.pdf"`
    }
  })
})
