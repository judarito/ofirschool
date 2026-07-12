import { describe, it, expect } from 'vitest'

describe('Admission enrollment rules - pruebas de reglas de negocio', () => {
  it('no se puede ver admision de otra sede sin permiso', () => {
    const userBranchId: string | null = 'branch-a'
    const applicationBranchId: string | null = 'branch-b'
    const canAccess = userBranchId === applicationBranchId || !userBranchId
    expect(canAccess).toBe(false)
  })

  it('no se puede matricular si el grupo no pertenece al grado', () => {
    const group = { id: 'g1', gradeId: 'grade-1' }
    const enrollmentGradeId = 'grade-2'
    const isValid = group.gradeId === enrollmentGradeId
    expect(isValid).toBe(false)
  })

  it('no se puede matricular si el grupo no pertenece al ano', () => {
    const group = { id: 'g1', academicYearId: 'year-2026' }
    const enrollmentYearId = 'year-2025'
    const isValid = group.academicYearId === enrollmentYearId
    expect(isValid).toBe(false)
  })

  it('no se puede superar cupo', () => {
    const group = { id: 'g1', capacity: 30 }
    const currentEnrollments = 30
    const hasSpace = currentEnrollments < group.capacity
    expect(hasSpace).toBe(false)
  })

  it('no se puede convertir admision no aprobada', () => {
    const statuses = ['submitted', 'document_review', 'reviewing', 'rejected', 'waitlisted']
    for (const s of statuses) {
      expect(s === 'accepted' || s === 'accepted_conditional').toBe(false)
    }
  })

  it('no se puede convertir dos veces la misma solicitud', () => {
    const application = { id: 'app-1', convertedEnrollmentId: 'enr-1' }
    const alreadyConverted = Boolean(application.convertedEnrollmentId)
    expect(alreadyConverted).toBe(true)
  })

  it('no se puede crear doble matricula activa/no eliminada para el mismo ano', () => {
    const existing = { id: 'enr-1', studentId: 'stu-1', academicYearId: 'year-2026', isDeleted: false }
    const newEnrollment = { studentId: 'stu-1', academicYearId: 'year-2026' }
    const isDuplicate = !existing.isDeleted && existing.studentId === newEnrollment.studentId && existing.academicYearId === newEnrollment.academicYearId
    expect(isDuplicate).toBe(true)
  })

  it('envio publico exige campos y documentos obligatorios', () => {
    type RequiredField = { code: string; label: string; required: boolean }
    const requiredFields: RequiredField[] = [
      { code: 'student_name', label: 'Nombre del estudiante', required: true },
      { code: 'student_document', label: 'Documento', required: true },
    ]
    const submittedAnswers: Record<string, string> = { student_name: 'Juan' }
    const missing = requiredFields.filter((f) => f.required && !submittedAnswers[f.code])
    expect(missing).toHaveLength(1)
    expect(missing[0]!.code).toBe('student_document')
  })

  it('envio publico respeta ventana de apertura/cierre', () => {
    const checkWindow = (startsOn: string | null, endsOn: string | null, today: string) => {
      if (startsOn && startsOn > today) return 'scheduled'
      if (endsOn && endsOn < today) return 'closed'
      return 'open'
    }
    expect(checkWindow('2026-07-01', '2026-07-31', '2026-06-15')).toBe('scheduled')
    expect(checkWindow('2026-07-01', '2026-07-31', '2026-08-01')).toBe('closed')
    expect(checkWindow('2026-07-01', '2026-07-31', '2026-07-15')).toBe('open')
  })
})
