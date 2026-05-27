import { and, asc, count, eq, ilike, inArray, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import bcrypt from 'bcryptjs'
import { roles, teachers, userRoles, users } from '@ofir/db'
import { PERMISSIONS, paginationSchema, userManagementCreateSchema, userManagementUpdateSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const userRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

userRoutes.use('*', tenantMiddleware, authMiddleware)

const ensureEmailAvailable = async ({
  db,
  tenantId,
  email,
  excludeUserId,
}: {
  db: AppContextVariables['db']
  tenantId: string
  email: string
  excludeUserId?: string
}) => {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.tenantId, tenantId),
      eq(users.email, email),
      eq(users.isDeleted, false),
      excludeUserId ? ne(users.id, excludeUserId) : undefined,
    ))
    .limit(1)

  if (existing) throw new AppError('Ya existe un usuario con ese correo en este tenant.', 409)
}

const ensureRoleCodesExist = async ({
  db,
  tenantId,
  roleCodes,
}: {
  db: AppContextVariables['db']
  tenantId: string
  roleCodes: string[]
}) => {
  if (!roleCodes.length) return []

  const availableRoles = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(and(eq(roles.tenantId, tenantId), eq(roles.isDeleted, false), inArray(roles.code, roleCodes)))

  if (availableRoles.length !== [...new Set(roleCodes)].length) {
    throw new AppError('Uno o más roles seleccionados no existen en este tenant.', 404)
  }

  return availableRoles
}

const syncUserRoles = async ({
  db,
  tenantId,
  actorUserId,
  userId,
  roleIds,
}: {
  db: AppContextVariables['db']
  tenantId: string
  actorUserId: string
  userId: string
  roleIds: string[]
}) => {
  const existingAssignments = await db
    .select({ id: userRoles.id, roleId: userRoles.roleId })
    .from(userRoles)
    .where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.userId, userId), eq(userRoles.isDeleted, false)))

  const currentRoleIds = new Set(existingAssignments.map((item) => item.roleId))
  const nextRoleIds = new Set(roleIds)

  for (const assignment of existingAssignments) {
    if (!nextRoleIds.has(assignment.roleId)) {
      await db.update(userRoles).set({
        isDeleted: true,
        updatedAt: new Date(),
        updatedBy: actorUserId,
      }).where(eq(userRoles.id, assignment.id))
    }
  }

  for (const roleId of roleIds) {
    if (!currentRoleIds.has(roleId)) {
      await db.insert(userRoles).values({
        tenantId,
        userId,
        roleId,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
    }
  }
}

userRoutes.get('/roles', requirePermission(PERMISSIONS.USERS_MANAGE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const items = await db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
    })
    .from(roles)
    .where(and(eq(roles.tenantId, tenantId), eq(roles.isDeleted, false)))
    .orderBy(asc(roles.name))

  return c.json(ok('Roles cargados', { items }))
})

userRoutes.get('/', requirePermission(PERMISSIONS.USERS_MANAGE), zValidator('query', paginationSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const filters = c.req.valid('query')
  const offset = (filters.page - 1) * filters.pageSize
  const searchFilter = filters.query ? ilike(users.fullName, `%${filters.query}%`) : undefined
  const whereClause = and(eq(users.tenantId, tenantId), eq(users.isDeleted, false), searchFilter)

  const userItems = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      fullName: users.fullName,
      email: users.email,
      status: users.status,
      linkedTeacherId: teachers.id,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .leftJoin(teachers, and(eq(teachers.userId, users.id), eq(teachers.tenantId, tenantId), eq(teachers.isDeleted, false)))
    .where(whereClause)
    .orderBy(asc(users.fullName))
    .limit(filters.pageSize)
    .offset(offset)

  const [totalRow] = await db.select({ total: count() }).from(users).where(whereClause)

  const userIds = userItems.map((item) => item.id)
  const roleRows = userIds.length
    ? await db
        .select({
          userId: userRoles.userId,
          roleCode: roles.code,
          roleName: roles.name,
        })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.isDeleted, false), eq(roles.isDeleted, false), inArray(userRoles.userId, userIds)))
    : []

  const rolesByUser = roleRows.reduce<Record<string, { codes: string[]; names: string[] }>>((acc, row) => {
    const bucket = acc[row.userId] ?? (acc[row.userId] = { codes: [], names: [] })
    if (row.roleCode) bucket.codes.push(row.roleCode)
    if (row.roleName) bucket.names.push(row.roleName)
    return acc
  }, {})

  return c.json(ok('Usuarios cargados', {
    items: userItems.map((item) => ({
      ...item,
      roleCodes: [...new Set(rolesByUser[item.id]?.codes ?? [])],
      roleNames: [...new Set(rolesByUser[item.id]?.names ?? [])],
      linkedTeacherId: item.linkedTeacherId ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    total: totalRow?.total ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }))
})

userRoutes.post('/', requirePermission(PERMISSIONS.USERS_MANAGE), zValidator('json', userManagementCreateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const payload = c.req.valid('json')

  await ensureEmailAvailable({ db, tenantId, email: payload.email })
  const availableRoles = await ensureRoleCodesExist({ db, tenantId, roleCodes: payload.roleCodes })
  const passwordHash = await bcrypt.hash(payload.password, 10)

  const [item] = await db.insert(users).values({
    tenantId,
    fullName: payload.fullName,
    email: payload.email,
    passwordHash,
    status: payload.status,
    createdBy: actor.id,
    updatedBy: actor.id,
  }).returning()

  if (!item) throw new AppError('No fue posible crear el usuario.', 500)

  await syncUserRoles({
    db,
    tenantId,
    actorUserId: actor.id,
    userId: item.id,
    roleIds: availableRoles.map((role) => role.id),
  })

  await writeAuditLog(db, { tenantId, actorUserId: actor.id, entity: 'users', entityId: item.id, action: 'create', changes: { ...payload, password: '[hidden]' } })
  return c.json(created('Usuario creado', { id: item.id }), 201)
})

userRoutes.put('/:id', requirePermission(PERMISSIONS.USERS_MANAGE), zValidator('json', userManagementUpdateSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  await ensureEmailAvailable({ db, tenantId, email: payload.email, excludeUserId: id })
  const availableRoles = await ensureRoleCodesExist({ db, tenantId, roleCodes: payload.roleCodes })

  const updatePayload: Record<string, unknown> = {
    fullName: payload.fullName,
    email: payload.email,
    status: payload.status,
    updatedAt: new Date(),
    updatedBy: actor.id,
  }

  if (payload.password) {
    updatePayload.passwordHash = await bcrypt.hash(payload.password, 10)
  }

  const [item] = await db.update(users).set(updatePayload).where(and(eq(users.id, id), eq(users.tenantId, tenantId), eq(users.isDeleted, false))).returning()
  if (!item) throw new AppError('Usuario no encontrado.', 404)

  await syncUserRoles({
    db,
    tenantId,
    actorUserId: actor.id,
    userId: id,
    roleIds: availableRoles.map((role) => role.id),
  })

  await writeAuditLog(db, { tenantId, actorUserId: actor.id, entity: 'users', entityId: id, action: 'update', changes: { ...payload, password: payload.password ? '[hidden]' : null } })
  return c.json(ok('Usuario actualizado', { id }))
})

userRoutes.delete('/:id', requirePermission(PERMISSIONS.USERS_MANAGE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const id = c.req.param('id')

  if (actor.id === id) throw new AppError('No puedes eliminar tu propio usuario.', 409)

  const [linkedTeacher] = await db
    .select({ id: teachers.id })
    .from(teachers)
    .where(and(eq(teachers.tenantId, tenantId), eq(teachers.userId, id), eq(teachers.isDeleted, false)))
    .limit(1)

  if (linkedTeacher) throw new AppError('No puedes eliminar un usuario que está vinculado a un docente activo.', 409)

  const [item] = await db.update(users).set({
    isDeleted: true,
    updatedAt: new Date(),
    updatedBy: actor.id,
  }).where(and(eq(users.id, id), eq(users.tenantId, tenantId), eq(users.isDeleted, false))).returning()

  if (!item) throw new AppError('Usuario no encontrado.', 404)

  await db.update(userRoles).set({
    isDeleted: true,
    updatedAt: new Date(),
    updatedBy: actor.id,
  }).where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.userId, id), eq(userRoles.isDeleted, false)))

  await writeAuditLog(db, { tenantId, actorUserId: actor.id, entity: 'users', entityId: id, action: 'delete' })
  return c.json(ok('Usuario eliminado', { id }))
})
