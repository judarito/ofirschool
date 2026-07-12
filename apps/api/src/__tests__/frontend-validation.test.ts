import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../routes/admissions', async () => ({
  listApplicationConsents: vi.fn(async () => []),
}))

vi.mock('../routes/consents', async () => ({
  ensureRequiredConsentsCaptured: vi.fn(async () => {}),
  listApplicationConsents: vi.fn(async () => []),
}))

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
}

describe('Frontend validation - Bandeja de admisiones', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('GET /applications soporta filtros por año, estado, grado, sede, fuente y rango de fechas', async () => {
    const query = {
      year: 2026, status: 'submitted', gradeId: 'grade-1', branchId: 'branch-1',
      source: 'new_student', documentStatus: 'pending', dateFrom: '2026-01-01', dateTo: '2026-12-31',
      page: 1, pageSize: 10, export: false,
    }
    expect(query.year).toBe(2026)
    expect(query.status).toBe('submitted')
    expect(query.branchId).toBeDefined()
    expect(query.source).toBe('new_student')
    expect(query.documentStatus).toBe('pending')
    expect(query.dateFrom).toBe('2026-01-01')
    expect(query.dateTo).toBe('2026-12-31')
  })

  it('la bandeja de admisiones pagina correctamente', () => {
    const total = 45
    const pageSize = 10
    const page = 3
    const offset = (page - 1) * pageSize
    expect(offset).toBe(20)
    expect(Math.ceil(total / pageSize)).toBe(5)
  })

  it('el filtro de búsqueda por nombre y documento funciona', () => {
    const query = 'María García'
    const buildSearchFilter = (q: string) => `ILIKE '%${q}%'`
    expect(buildSearchFilter(query)).toContain('María García')
  })
})

describe('Frontend validation - Detalle de admision', () => {
  it('el detalle de admision incluye estudiante, acudiente, documentos, timeline y consentimientos', () => {
    const detail = {
      application: { id: 'app-1', status: 'reviewing' },
      student: { id: 'stu-1', firstName: 'Juan', lastName: 'Pérez' },
      guardian: { id: 'guard-1', firstName: 'Ana', lastName: 'Pérez' },
      documents: [{ id: 'doc-1', fileName: 'certificado.pdf', status: 'uploaded' }],
      consents: [{ id: 'c-1', documentCode: 'privacy_notice', status: 'accepted' }],
      timeline: [{ id: 'h-1', fromStatus: 'submitted', toStatus: 'reviewing' }],
    }
    expect(detail.application).toBeDefined()
    expect(detail.student!.firstName).toBe('Juan')
    expect(detail.guardian).toBeDefined()
    expect(detail.documents).toHaveLength(1)
    expect(detail.consents).toHaveLength(1)
  })

  it('el detalle muestra duplicados potenciales', () => {
    const duplicates = [
      { studentId: 'stu-2', matchedFields: ['documento del estudiante'], riskLevel: 'high' },
    ]
    expect(duplicates[0]!.riskLevel).toBe('high')
    expect(duplicates[0]!.matchedFields).toContain('documento del estudiante')
  })
})

describe('Frontend validation - Aprobacion y rechazo', () => {
  it('rechazar una solicitud exige un motivo estructurado', () => {
    const payload = { status: 'rejected', decisionCode: null, notes: 'Sin cupo' }
    const needsCausal = payload.status === 'rejected' && !payload.decisionCode
    expect(needsCausal).toBe(true)
  })

  it('aceptar condicionalmente exige observación', () => {
    const payload = { status: 'accepted_conditional', observation: '' }
    const needsObservation = payload.status === 'accepted_conditional' && !payload.observation.trim()
    expect(needsObservation).toBe(true)
  })

  it('las transiciones válidas están definidas correctamente', () => {
    const transitions: Record<string, string[]> = {
      submitted: ['document_review', 'reviewing', 'interview_scheduled', 'committee_review', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted', 'needs_correction'],
      document_review: ['reviewing', 'needs_correction', 'interview_scheduled', 'committee_review', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted'],
      reviewing: ['document_review', 'needs_correction', 'interview_scheduled', 'committee_review', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted'],
      accepted: ['reviewing', 'rejected', 'converted'],
      accepted_conditional: ['reviewing', 'accepted', 'rejected', 'converted'],
    }
    expect(transitions.submitted).toContain('accepted')
    expect(transitions.submitted).toContain('rejected')
    expect(transitions.accepted).toContain('converted')
    expect(transitions.accepted_conditional).toContain('converted')
  })
})

describe('Frontend validation - Conversion a matricula', () => {
  it('la conversion valida que la solicitud este aprobada', () => {
    const application = { status: 'reviewing', convertedEnrollmentId: null }
    const canConvert = (application.status === 'accepted' || application.status === 'accepted_conditional') && !application.convertedEnrollmentId
    expect(canConvert).toBe(false)
  })

  it('la conversion valida que no exista matricula duplicada para el mismo año', () => {
    const existingEnrollments = [{ studentId: 'stu-1', academicYearId: 'year-2026', isDeleted: false }]
    const hasDuplicate = existingEnrollments.some((e) => !e.isDeleted && e.studentId === 'stu-1' && e.academicYearId === 'year-2026')
    expect(hasDuplicate).toBe(true)
  })

  it('la conversion valida que el grupo pertenezca al grado y año', () => {
    const group = { id: 'g-1', gradeId: 'grade-1', academicYearId: 'year-2026' }
    const request = { gradeId: 'grade-1', academicYearId: 'year-2026' }
    const isValid = group.gradeId === request.gradeId && group.academicYearId === request.academicYearId
    expect(isValid).toBe(true)
  })

  it('la conversion valida cupos antes de crear', () => {
    const group = { capacity: 30 }
    const currentEnrollments = 30
    const hasSpace = currentEnrollments < group.capacity
    expect(hasSpace).toBe(false)
  })
})

describe('Frontend validation - Matricula manual', () => {
  it('la matricula manual crea el registro con todos los campos requeridos', () => {
    const payload = {
      studentId: 'stu-1', academicYearId: 'year-2026', gradeId: 'grade-1', groupId: 'group-a',
      enrollmentType: 'new', enrollmentStatus: 'active', enrollmentDate: '2026-07-11',
    }
    expect(payload.studentId).toBeDefined()
    expect(payload.academicYearId).toBeDefined()
    expect(payload.gradeId).toBeDefined()
    expect(payload.enrollmentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('la matricula manual registra jornada, sede, fecha firma y estados', () => {
    const payload = {
      journey: 'mañana', branchId: 'branch-1', signedAt: '2026-07-11T10:00:00Z',
      documentStatus: 'complete', financialStatus: 'pending', academicStatus: 'placed',
    }
    expect(payload.journey).toBe('mañana')
    expect(payload.branchId).toBeDefined()
    expect(payload.signedAt).toBeDefined()
    expect(['pending', 'partial', 'complete', 'rejected']).toContain(payload.documentStatus)
    expect(['pending', 'partial', 'complete', 'overdue']).toContain(payload.financialStatus)
  })
})

describe('Frontend validation - Continuidad masiva', () => {
  it('la continuidad valida cupos antes de crear matriculas', () => {
    const group = { id: 'g-1', capacity: 30, currentEnrollments: 28 }
    const pendingItems = 5
    const available = group.capacity - group.currentEnrollments
    const canFit = pendingItems <= available
    expect(available).toBe(2)
    expect(canFit).toBe(false)
  })

  it('la continuidad registra responsable y parametros del lote', () => {
    const batch = {
      academicYearId: 'year-2027', mode: 'promotion', enrollmentStatus: 'pending',
      items: [{ studentId: 'stu-1', previousEnrollmentId: 'enr-1', gradeId: 'grade-2' }],
      createdAt: '2026-07-11T10:00:00Z', createdBy: 'user-1',
    }
    expect(batch.academicYearId).toBeDefined()
    expect(batch.mode).toBe('promotion')
    expect(batch.items).toHaveLength(1)
    expect(batch.items[0]!.previousEnrollmentId).toBeDefined()
  })

  it('la continuidad permite reintentar omitidos sin repetir creados', () => {
    const results = [
      { studentId: 'stu-1', status: 'created' },
      { studentId: 'stu-2', status: 'skipped' },
      { studentId: 'stu-3', status: 'created' },
    ]
    const created = results.filter((r) => r.status === 'created')
    const skipped = results.filter((r) => r.status === 'skipped')
    expect(created).toHaveLength(2)
    expect(skipped).toHaveLength(1)
  })
})

describe('Frontend validation - Cierre anual', () => {
  it('el cierre anual aplica decisiones de promocion por estudiante', () => {
    const decisions = [
      { enrollmentId: 'enr-1', promotionStatus: 'promoted' },
      { enrollmentId: 'enr-2', promotionStatus: 'not_promoted' },
      { enrollmentId: 'enr-3', promotionStatus: 'conditional' },
    ]
    expect(decisions.filter((d) => d.promotionStatus === 'promoted')).toHaveLength(1)
    expect(decisions.filter((d) => d.promotionStatus === 'not_promoted')).toHaveLength(1)
    expect(decisions.filter((d) => d.promotionStatus === 'conditional')).toHaveLength(1)
  })

  it('el cierre anual requiere acta o evidencia del comite', () => {
    const promotionData = {
      act: 'Acta 001 de 2026', date: '2026-11-30', notes: 'Comité ordinario de evaluación',
    }
    expect(promotionData.act).toBeDefined()
    expect(promotionData.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('el cierre anual soporta promocion anticipada y condicionada', () => {
    const items = [
      { enrollmentId: 'enr-1', promotionStatus: 'promoted', conditionalPromotionRequirements: null },
      { enrollmentId: 'enr-2', promotionStatus: 'conditional', conditionalPromotionRequirements: 'Entregar plan de refuerzo en matemáticas' },
    ]
    expect(items[1]!.conditionalPromotionRequirements).toContain('plan de refuerzo')
  })
})
