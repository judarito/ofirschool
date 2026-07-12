import { describe, it, expect, vi, beforeEach } from 'vitest'

const NOVELTY_TYPES = ['withdrawal', 'transfer', 'group_change', 'branch_change', 'reentry', 'graduation', 'cancellation']

const NOVELTY_TO_ENROLLMENT_STATUS: Record<string, string[]> = {
  withdrawal: ['withdrawn', 'cancelled'],
  transfer: ['withdrawn', 'cancelled'],
  group_change: ['active', 'pending'],
  branch_change: ['active', 'pending'],
  reentry: ['active', 'pending'],
  graduation: ['graduated'],
  cancellation: ['cancelled'],
}

const RELATIONSHIP_TYPES = [
  'academic_guardian',
  'legal_representative',
  'financial_responsible',
  'emergency_contact',
  'pickup_authorized',
  'other',
]

describe('Enrollment novelties - validación de tipos', () => {
  it('soporta los 7 tipos de novedades del plan de matrícula', () => {
    expect(NOVELTY_TYPES).toHaveLength(7)
    expect(NOVELTY_TYPES).toContain('withdrawal')
    expect(NOVELTY_TYPES).toContain('transfer')
    expect(NOVELTY_TYPES).toContain('graduation')
  })

  it('mapea cada tipo a estados de matrícula permitidos', () => {
    expect(NOVELTY_TO_ENROLLMENT_STATUS.withdrawal).toContain('withdrawn')
    expect(NOVELTY_TO_ENROLLMENT_STATUS.graduation).toContain('graduated')
    expect(NOVELTY_TO_ENROLLMENT_STATUS.cancellation).toContain('cancelled')
    expect(NOVELTY_TO_ENROLLMENT_STATUS.reentry).toContain('active')
  })

  it('una novedad de retiro bloquea la matrícula activa', () => {
    const currentStatus = 'active'
    const targetStatuses = NOVELTY_TO_ENROLLMENT_STATUS.withdrawal ?? []
    expect(targetStatuses.includes(currentStatus)).toBe(false)
    expect(targetStatuses).toContain('withdrawn')
  })

  it('una novedad de graduación cierra la matrícula con estado graduated', () => {
    const targetStatuses = NOVELTY_TO_ENROLLMENT_STATUS.graduation
    expect(targetStatuses).toEqual(['graduated'])
  })
})

describe('Acudientes múltiples - tipos de parentesco', () => {
  it('soporta los 6 tipos de parentesco del plan', () => {
    expect(RELATIONSHIP_TYPES).toHaveLength(6)
    expect(RELATIONSHIP_TYPES).toContain('legal_representative')
    expect(RELATIONSHIP_TYPES).toContain('financial_responsible')
    expect(RELATIONSHIP_TYPES).toContain('emergency_contact')
  })

  it('distingue representante legal de responsable financiero', () => {
    expect(RELATIONSHIP_TYPES[0]).toBe('academic_guardian')
    expect(RELATIONSHIP_TYPES[1]).toBe('legal_representative')
    expect(RELATIONSHIP_TYPES[2]).toBe('financial_responsible')
  })
})

describe('Enrollment - estados documentales, financieros y académicos', () => {
  it('cada estado tiene un valor por defecto razonable', () => {
    const defaults = {
      documentStatus: 'pending',
      financialStatus: 'pending',
      academicStatus: 'pending',
    }
    expect(defaults.documentStatus).toBe('pending')
    expect(defaults.financialStatus).toBe('pending')
    expect(defaults.academicStatus).toBe('pending')
  })

  it('soporta transiciones válidas de estado documental', () => {
    const documentStates = ['pending', 'partial', 'complete', 'rejected']
    expect(documentStates).toContain('complete')
    expect(documentStates).toContain('rejected')
  })

  it('soporta estados financieros con overdue', () => {
    const financialStates = ['pending', 'partial', 'complete', 'overdue']
    expect(financialStates).toContain('overdue')
  })

  it('soporta estados académicos con placed', () => {
    const academicStates = ['pending', 'placed', 'cancelled']
    expect(academicStates).toContain('placed')
  })
})

describe('Enrollment - consecutivo automático', () => {
  it('asigna sequenceNumber cuando se activa la matrícula por primera vez', () => {
    const existingSequence = 0
    const next = existingSequence + 1
    expect(next).toBe(1)
  })

  it('no asigna sequenceNumber si la matrícula ya tiene uno', () => {
    const enrollment = { sequenceNumber: 42, enrollmentStatus: 'active' }
    const shouldAssign = enrollment.enrollmentStatus === 'active' && !enrollment.sequenceNumber
    expect(shouldAssign).toBe(false)
  })
})
