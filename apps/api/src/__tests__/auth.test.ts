import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authMiddleware } from '../middleware/auth'
import { AppError } from '../lib/errors'
import * as jwt from '../lib/jwt'

vi.mock('../lib/jwt')

describe('authMiddleware', () => {
  const mockNext = vi.fn()
  const mockEnv = { JWT_SECRET: 'test-secret' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockContext = (headers: Record<string, string> = {}) => {
    const context: any = {
      req: {
        header: (name: string) => headers[name.toLowerCase()],
      },
      env: mockEnv,
      set: vi.fn(),
      get: vi.fn(),
    }
    return context
  }

  it('debe rechazar petición sin header Authorization', async () => {
    const c = createMockContext()
    
    await expect(authMiddleware(c, mockNext)).rejects.toThrow(AppError)
    await expect(authMiddleware(c, mockNext)).rejects.toThrow('No autorizado')
  })

  it('debe rechazar token inválido', async () => {
    const c = createMockContext({ authorization: 'Bearer invalid-token' })
    vi.mocked(jwt.verifyAccessToken).mockRejectedValue(new Error('Invalid token'))

    await expect(authMiddleware(c, mockNext)).rejects.toThrow(AppError)
  })

  it('debe rechazar token expirado con mensaje específico', async () => {
    const c = createMockContext({ authorization: 'Bearer expired-token' })
    vi.mocked(jwt.verifyAccessToken).mockRejectedValue(
      new Error('"exp" claim timestamp check failed')
    )

    await expect(authMiddleware(c, mockNext)).rejects.toThrow('Sesion expirada')
  })

  it('debe aceptar token válido y establecer usuario en contexto', async () => {
    const mockUser = {
      id: 'user-123',
      tenantId: 'tenant-456',
      email: 'test@example.com',
      fullName: 'Test User',
      roleCodes: ['admin'],
      permissions: ['academic.read'],
      branchId: null,
    }
    const c = createMockContext({ authorization: 'Bearer valid-token' })
    vi.mocked(jwt.verifyAccessToken).mockResolvedValue(mockUser)

    await authMiddleware(c, mockNext)

    expect(c.set).toHaveBeenCalledWith('user', mockUser)
    expect(c.set).toHaveBeenCalledWith('tenantId', mockUser.tenantId)
    expect(mockNext).toHaveBeenCalled()
  })
})
