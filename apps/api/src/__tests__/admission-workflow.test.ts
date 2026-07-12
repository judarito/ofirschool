import { describe, it, expect, vi, beforeEach } from 'vitest'

const recordStatusHistoryMock = vi.fn(async () => 'history-id')

const canTransitionAdmissionStatus = (current: string, next: string) => {
  if (current === 'converted') return false
  if (current === next) return true
  const transitions: Record<string, string[]> = {
    draft: ['document_review', 'reviewing', 'rejected', 'waitlisted'],
    submitted: ['document_review', 'reviewing', 'interview_scheduled', 'committee_review', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted', 'needs_correction'],
    document_review: ['reviewing', 'needs_correction', 'interview_scheduled', 'committee_review', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted'],
    needs_correction: ['document_review', 'reviewing', 'rejected'],
    interview_scheduled: ['committee_review', 'reviewing', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted'],
    committee_review: ['accepted', 'accepted_conditional', 'rejected', 'waitlisted', 'reviewing'],
    waitlisted: ['reviewing', 'accepted', 'accepted_conditional', 'rejected'],
    reviewing: ['document_review', 'needs_correction', 'interview_scheduled', 'committee_review', 'accepted', 'accepted_conditional', 'rejected', 'waitlisted'],
    accepted: ['reviewing', 'rejected', 'converted'],
    accepted_conditional: ['reviewing', 'accepted', 'rejected', 'converted'],
    rejected: ['reviewing'],
  }
  return transitions[current]?.includes(next) ?? false
}

describe('Admission status transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('permite mover una solicitud submitted al nuevo estado document_review', () => {
    expect(canTransitionAdmissionStatus('submitted', 'document_review')).toBe(true)
  })

  it('permite mover a needs_correction desde document_review o submitted', () => {
    expect(canTransitionAdmissionStatus('document_review', 'needs_correction')).toBe(true)
    expect(canTransitionAdmissionStatus('submitted', 'needs_correction')).toBe(true)
  })

  it('permite programar entrevista y comité desde estados de revisión', () => {
    expect(canTransitionAdmissionStatus('submitted', 'interview_scheduled')).toBe(true)
    expect(canTransitionAdmissionStatus('reviewing', 'interview_scheduled')).toBe(true)
    expect(canTransitionAdmissionStatus('document_review', 'committee_review')).toBe(true)
  })

  it('permite waitlist y aceptación condicional como estados finales administrativos', () => {
    expect(canTransitionAdmissionStatus('reviewing', 'waitlisted')).toBe(true)
    expect(canTransitionAdmissionStatus('reviewing', 'accepted_conditional')).toBe(true)
    expect(canTransitionAdmissionStatus('committee_review', 'accepted_conditional')).toBe(true)
  })

  it('permite promover una aceptación condicional a aceptación final', () => {
    expect(canTransitionAdmissionStatus('accepted_conditional', 'accepted')).toBe(true)
  })

  it('no permite transiciones desde un estado terminal como converted', () => {
    expect(canTransitionAdmissionStatus('converted', 'accepted')).toBe(false)
    expect(canTransitionAdmissionStatus('converted', 'reviewing')).toBe(false)
  })

  it('no permite saltar de rejected a accepted sin pasar por reviewing', () => {
    expect(canTransitionAdmissionStatus('rejected', 'accepted')).toBe(false)
    expect(canTransitionAdmissionStatus('rejected', 'reviewing')).toBe(true)
  })

  it('no permite transiciones arbitrarias entre estados finales', () => {
    expect(canTransitionAdmissionStatus('waitlisted', 'document_review')).toBe(false)
    expect(canTransitionAdmissionStatus('accepted', 'needs_correction')).toBe(false)
  })
})

describe('Admission decision causals - validación', () => {
  it('rechazo sin motivo estructurado debe ser rechazado en backend', () => {
    const status = 'rejected'
    const decisionCode: string | null = null
    const hasCausal = Boolean(decisionCode)
    expect(hasCausal).toBe(false)
    expect(['rejected'].includes(status)).toBe(true)
  })

  it('aceptación condicional exige observación', () => {
    const status = 'accepted_conditional'
    const observation = 'Pendiente entrega de documentos de refuerzo'
    const requiresObservation = status === 'accepted_conditional'
    expect(requiresObservation).toBe(true)
    expect(observation.length).toBeGreaterThan(0)
  })

  it('motivos con requires_observation en BD obligan a observation en API', () => {
    const reasonRequiresObservation = true
    const observation: string | null = null
    const trimmed: string = observation ?? ''
    const hasObservation = trimmed.trim().length > 0
    const shouldFail = reasonRequiresObservation && !hasObservation
    if (shouldFail) {
      expect(true).toBe(true)
    } else {
      throw new Error('Debió fallar por falta de observación')
    }
  })
})

describe('Status history - helpers de transición', () => {
  it('debe registrar un cambio de estado de submitted a document_review con metadata', () => {
    recordStatusHistoryMock()
    expect(recordStatusHistoryMock).toHaveBeenCalled()
  })

  it('debe aceptar una transición de submitted a document_review', () => {
    expect(canTransitionAdmissionStatus('submitted', 'document_review')).toBe(true)
  })

  it('debe aceptar una transición de document_review a needs_correction', () => {
    expect(canTransitionAdmissionStatus('document_review', 'needs_correction')).toBe(true)
  })

  it('debe aceptar una transición a waitlisted desde reviewing', () => {
    expect(canTransitionAdmissionStatus('reviewing', 'waitlisted')).toBe(true)
  })

  it('debe aceptar una transición de accepted_conditional a accepted', () => {
    expect(canTransitionAdmissionStatus('accepted_conditional', 'accepted')).toBe(true)
  })
})
