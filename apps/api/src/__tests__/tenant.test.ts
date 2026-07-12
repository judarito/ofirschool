import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tenantMiddleware } from '../middleware/tenant'
import { AppError } from '../lib/errors'

describe('tenantMiddleware', () => {
  const mockNext = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockContext = (
    user: any,
    headers: Record<string, string> = {},
    env: Record<string, string> = {}
  ) => {
    const context: any = {
      req: {
        header: (name: string) => headers[name.toLowerCase()],
      },
      env,
      set: vi.fn(),
      get: (key: string) => {
        if (key === 'user') return user
        return undefined
      },
    }
    return context
  }

  it('debe rechazar petición sin tenantId', async () => {
    const c = createMockContext(null, {}, {})

    await expect(tenantMiddleware(c, mockNext)).rejects.toThrow(AppError)
    await expect(tenantMiddleware(c, mockNext)).rejects.toThrow('Tenant no proporcionado')
  })

  it('debe usar tenantId del usuario autenticado', async () => {
    const user = { tenantId: 'user-tenant' }
    const c = createMockContext(user, {}, {})

    await tenantMiddleware(c, mockNext)

    expect(c.set).toHaveBeenCalledWith('tenantId', 'user-tenant')
    expect(mockNext).toHaveBeenCalled()
  })

  it('debe usar DEFAULT_TENANT_ID si no hay usuario', async () => {
    const c = createMockContext(null, {}, { DEFAULT_TENANT_ID: 'default-tenant' })

    await tenantMiddleware(c, mockNext)

    expect(c.set).toHaveBeenCalledWith('tenantId', 'default-tenant')
    expect(mockNext).toHaveBeenCalled()
  })

  it('debe rechazar si el header x-tenant-id no coincide con el usuario', async () => {
    const user = { tenantId: 'user-tenant' }
    const c = createMockContext(user, { 'x-tenant-id': 'different-tenant' }, {})

    await expect(tenantMiddleware(c, mockNext)).rejects.toThrow(AppError)
    await expect(tenantMiddleware(c, mockNext)).rejects.toThrow('no coincide con la sesion')
  })

  it('debe permitir si el header x-tenant-id coincide con el usuario', async () => {
    const user = { tenantId: 'user-tenant' }
    const c = createMockContext(user, { 'x-tenant-id': 'user-tenant' }, {})

    await tenantMiddleware(c, mockNext)

    expect(c.set).toHaveBeenCalledWith('tenantId', 'user-tenant')
    expect(mockNext).toHaveBeenCalled()
  })
})
