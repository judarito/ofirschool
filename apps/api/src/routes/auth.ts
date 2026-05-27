import { eq, and } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import bcrypt from 'bcryptjs'
import { permissions, rolePermissions, roles, userRoles, users } from '@ofir/db'
import { loginSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { signAccessToken } from '../lib/jwt'
import { ok } from '../lib/http'
import type { AppContextVariables, Bindings } from '../types'

export const authRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const db = c.get('db')
  const payload = c.req.valid('json')
  const tenantId = payload.tenantId ?? c.env.DEFAULT_TENANT_ID

  if (!tenantId) {
    throw new AppError('Tenant invalido', 400)
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.email, payload.email), eq(users.tenantId, tenantId), eq(users.isDeleted, false)),
  })

  if (!user) {
    throw new AppError('Credenciales invalidas', 401)
  }

  const isValidPassword = await bcrypt.compare(payload.password, user.passwordHash)

  if (!isValidPassword) {
    throw new AppError('Credenciales invalidas', 401)
  }

  const roleRows = await db
    .select({
      code: roles.code,
      name: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.tenantId, tenantId), eq(userRoles.isDeleted, false)))

  const permissionRows = await db
    .select({
      code: permissions.code,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.tenantId, tenantId), eq(permissions.isDeleted, false)))

  const sessionUser = {
    id: user.id,
    tenantId,
    email: user.email,
    fullName: user.fullName,
    roleCodes: roleRows.map((item) => item.code),
    permissions: [...new Set(permissionRows.map((item) => item.code))],
  }

  const token = await signAccessToken(sessionUser, c.env.JWT_SECRET)

  return c.json(
    ok('Sesion iniciada', {
      token,
      user: sessionUser,
    }),
  )
})
