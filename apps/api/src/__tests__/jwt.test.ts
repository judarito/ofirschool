import { describe, it, expect } from 'vitest'
import { signAccessToken, verifyAccessToken } from '../lib/jwt'

describe('JWT utilities', () => {
  const secret = 'test-secret-key-for-testing-only'

  const mockUser = {
    id: 'user-123',
    tenantId: 'tenant-456',
    email: 'test@example.com',
    fullName: 'Test User',
    roleCodes: ['admin'],
    permissions: ['academic.read', 'academic.write'],
    branchId: null,
  }

  it('debe firmar y verificar un token válido', async () => {
    const token = await signAccessToken(mockUser, secret)
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')

    const verified = await verifyAccessToken(token, secret)
    expect(verified.id).toBe(mockUser.id)
    expect(verified.tenantId).toBe(mockUser.tenantId)
    expect(verified.email).toBe(mockUser.email)
  })

  it('debe rechazar token con secret incorrecto', async () => {
    const token = await signAccessToken(mockUser, secret)
    
    await expect(verifyAccessToken(token, 'wrong-secret')).rejects.toThrow()
  })

  it('debe rechazar token malformado', async () => {
    await expect(verifyAccessToken('invalid.token.format', secret)).rejects.toThrow()
  })

  it('debe incluir expiración en el token', async () => {
    const token = await signAccessToken(mockUser, secret)
    const verified = await verifyAccessToken(token, secret) as any
    
    expect(verified.exp).toBeDefined()
    expect(verified.iat).toBeDefined()
    expect(verified.exp).toBeGreaterThan(verified.iat)
  })
})
