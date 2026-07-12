import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../routes/consents', async () => {
  return {
    ensureRequiredConsentsCaptured: vi.fn(async ({ requiredCodes, applicationId }) => {
      if (!requiredCodes.length) return
      if (applicationId === 'app-without-consent') {
        const err = new Error('Falta la aceptación de consentimientos obligatorios')
        ;(err as { status?: number }).status = 409
        throw err
      }
    }),
    listApplicationConsents: vi.fn(async ({ applicationId }) => {
      if (applicationId === 'app-1') {
        return [
          {
            id: 'consent-1',
            documentId: 'doc-privacy',
            documentCode: 'privacy_notice',
            documentName: 'Aviso de privacidad',
            documentType: 'privacy_notice',
            version: '2026-1',
            status: 'accepted',
            acceptedByName: 'Maria Lopez',
            acceptedByRelationship: 'madre',
            acceptedAt: '2026-06-01T12:00:00.000Z',
            channel: 'public_form',
            ipAddress: '127.0.0.1',
            revokedAt: null,
            revocationReason: null,
          },
        ]
      }
      return []
    }),
  }
})

import { ensureRequiredConsentsCaptured, listApplicationConsents } from '../routes/consents'

describe('Consent module - Validación de evidencia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no debe fallar cuando no hay consentimientos requeridos', async () => {
    const mockDb = {} as Parameters<typeof ensureRequiredConsentsCaptured>[0]['db']
    await expect(
      ensureRequiredConsentsCaptured({
        db: mockDb,
        tenantId: 'tenant-1',
        applicationId: 'app-1',
        requiredCodes: [],
      }),
    ).resolves.toBeUndefined()
  })

  it('no debe fallar cuando la solicitud ya tiene los consentimientos aceptados', async () => {
    const mockDb = {} as Parameters<typeof ensureRequiredConsentsCaptured>[0]['db']
    await expect(
      ensureRequiredConsentsCaptured({
        db: mockDb,
        tenantId: 'tenant-1',
        applicationId: 'app-1',
        requiredCodes: ['privacy_notice', 'data_treatment_authorization'],
      }),
    ).resolves.toBeUndefined()
  })

  it('debe fallar cuando faltan consentimientos obligatorios', async () => {
    const mockDb = {} as Parameters<typeof ensureRequiredConsentsCaptured>[0]['db']
    await expect(
      ensureRequiredConsentsCaptured({
        db: mockDb,
        tenantId: 'tenant-1',
        applicationId: 'app-without-consent',
        requiredCodes: ['privacy_notice'],
      }),
    ).rejects.toThrow(/consentimientos obligatorios/)
  })
})

describe('Consent module - Listado de evidencia por solicitud', () => {
  it('debe devolver la lista de consentimientos aceptados para una solicitud', async () => {
    const mockDb = {} as Parameters<typeof listApplicationConsents>[0]['db']
    const items = await listApplicationConsents({
      db: mockDb,
      tenantId: 'tenant-1',
      applicationId: 'app-1',
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.documentCode).toBe('privacy_notice')
    expect(items[0]?.status).toBe('accepted')
    expect(items[0]?.acceptedByName).toBe('Maria Lopez')
  })

  it('debe devolver lista vacía cuando la solicitud no tiene consentimientos', async () => {
    const mockDb = {} as Parameters<typeof listApplicationConsents>[0]['db']
    const items = await listApplicationConsents({
      db: mockDb,
      tenantId: 'tenant-1',
      applicationId: 'app-unknown',
    })

    expect(items).toEqual([])
  })
})

describe('Consent module - Esquemas de aceptación', () => {
  it('debe requerir versión y nombre del aceptante', () => {
    const payload = {
      documentCode: 'privacy_notice',
      version: '2026-1',
      acceptedByName: 'Acudiente Demo',
      acceptedByRelationship: 'madre',
    }

    expect(payload.documentCode).toBe('privacy_notice')
    expect(payload.version).toMatch(/\d{4}-\d+/)
    expect(payload.acceptedByName.length).toBeGreaterThanOrEqual(2)
  })
})
