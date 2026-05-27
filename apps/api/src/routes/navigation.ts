import { and, asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { navigationItems, navigationSections, roleNavigationItems, roles, userRoles } from '@ofir/db'
import { PERMISSIONS } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const navigationRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

navigationRoutes.use('*', tenantMiddleware, authMiddleware)

const navigationSectionSchema = z.object({
  code: z.string().min(2).max(60),
  title: z.string().min(2).max(120),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
})

const navigationItemSchema = z.object({
  sectionId: z.uuid(),
  code: z.string().min(2).max(80),
  label: z.string().min(2).max(120),
  to: z.string().min(1).max(180),
  shortLabel: z.string().min(1).max(10),
  badge: z.coerce.number().int().min(0).max(999).optional().or(z.null()),
  sortOrder: z.coerce.number().int().min(0).default(0),
  requiredPermission: z.string().max(80).optional().or(z.literal('')).or(z.null()),
  mobileVisible: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  roleCodes: z.array(z.string().min(1).max(60)).default([]),
})

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
    .select({ id: roles.id, code: roles.code, name: roles.name, description: roles.description })
    .from(roles)
    .where(and(eq(roles.tenantId, tenantId), eq(roles.isDeleted, false), inArray(roles.code, roleCodes)))

  if (availableRoles.length !== [...new Set(roleCodes)].length) {
    throw new AppError('Uno o más roles seleccionados no existen en este tenant.', 404)
  }

  return availableRoles
}

const syncNavigationItemRoles = async ({
  db,
  tenantId,
  actorUserId,
  navigationItemId,
  roleIds,
}: {
  db: AppContextVariables['db']
  tenantId: string
  actorUserId: string
  navigationItemId: string
  roleIds: string[]
}) => {
  const existingAssignments = await db
    .select({ id: roleNavigationItems.id, roleId: roleNavigationItems.roleId })
    .from(roleNavigationItems)
    .where(and(eq(roleNavigationItems.tenantId, tenantId), eq(roleNavigationItems.navigationItemId, navigationItemId), eq(roleNavigationItems.isDeleted, false)))

  const currentRoleIds = new Set(existingAssignments.map((item) => item.roleId))
  const nextRoleIds = new Set(roleIds)

  for (const assignment of existingAssignments) {
    if (!nextRoleIds.has(assignment.roleId)) {
      await db.update(roleNavigationItems).set({
        isDeleted: true,
        updatedAt: new Date(),
        updatedBy: actorUserId,
      }).where(eq(roleNavigationItems.id, assignment.id))
    }
  }

  for (const roleId of roleIds) {
    if (!currentRoleIds.has(roleId)) {
      await db.insert(roleNavigationItems).values({
        tenantId,
        roleId,
        navigationItemId,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
    }
  }
}

navigationRoutes.get('/', async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const user = c.get('user')

  const isSuperAdmin = user.roleCodes.includes('super_admin')

  const roleIds = isSuperAdmin
    ? []
    : (
        await db
          .select({ roleId: userRoles.roleId })
          .from(userRoles)
          .where(and(eq(userRoles.tenantId, tenantId), eq(userRoles.userId, user.id), eq(userRoles.isDeleted, false)))
      ).map((item) => item.roleId)

  const assignedItemIds = isSuperAdmin
    ? null
    : roleIds.length
      ? [
        ...new Set(
          (
            await db
              .select({ navigationItemId: roleNavigationItems.navigationItemId })
              .from(roleNavigationItems)
              .where(and(eq(roleNavigationItems.tenantId, tenantId), eq(roleNavigationItems.isDeleted, false), inArray(roleNavigationItems.roleId, roleIds)))
          ).map((item) => item.navigationItemId),
        ),
      ]
      : []

  const sectionRows = await db
    .select()
    .from(navigationSections)
    .where(and(eq(navigationSections.tenantId, tenantId), eq(navigationSections.isDeleted, false), eq(navigationSections.isActive, true)))
    .orderBy(asc(navigationSections.sortOrder), asc(navigationSections.title))

  const allItemRows = await db
    .select()
    .from(navigationItems)
    .where(and(eq(navigationItems.tenantId, tenantId), eq(navigationItems.isDeleted, false), eq(navigationItems.isActive, true)))
    .orderBy(asc(navigationItems.sortOrder), asc(navigationItems.label))

  const visibleItems = allItemRows.filter((item) => {
    if (!isSuperAdmin && assignedItemIds && !assignedItemIds.includes(item.id)) {
      return false
    }
    if (item.requiredPermission && !user.permissions.includes(item.requiredPermission) && !isSuperAdmin) {
      return false
    }
    return true
  })

  const sections = sectionRows
    .map((section) => ({
      id: section.id,
      code: section.code,
      title: section.title,
      items: visibleItems
        .filter((item) => item.sectionId === section.id)
        .map((item) => ({
          id: item.id,
          code: item.code,
          label: item.label,
          to: item.to,
          shortLabel: item.shortLabel,
          badge: item.badge,
          mobileVisible: item.mobileVisible,
        })),
    }))
    .filter((section) => section.items.length > 0)

  const mobileItems = visibleItems
    .filter((item) => item.mobileVisible)
    .map((item) => ({
      id: item.id,
      code: item.code,
      label: item.label,
      to: item.to,
      shortLabel: item.shortLabel,
      badge: item.badge,
      mobileVisible: item.mobileVisible,
    }))

  return c.json(ok('Navegación cargada', { sections, mobileItems }))
})

navigationRoutes.get('/admin', requirePermission(PERMISSIONS.USERS_MANAGE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const sectionRows = await db
    .select()
    .from(navigationSections)
    .where(and(eq(navigationSections.tenantId, tenantId), eq(navigationSections.isDeleted, false)))
    .orderBy(asc(navigationSections.sortOrder), asc(navigationSections.title))

  const itemRows = await db
    .select()
    .from(navigationItems)
    .where(and(eq(navigationItems.tenantId, tenantId), eq(navigationItems.isDeleted, false)))
    .orderBy(asc(navigationItems.sortOrder), asc(navigationItems.label))

  const roleRows = await db
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
    })
    .from(roles)
    .where(and(eq(roles.tenantId, tenantId), eq(roles.isDeleted, false)))
    .orderBy(asc(roles.name))

  const itemIds = itemRows.map((item) => item.id)
  const assignmentRows = itemIds.length
    ? await db
        .select({
          navigationItemId: roleNavigationItems.navigationItemId,
          roleCode: roles.code,
        })
        .from(roleNavigationItems)
        .innerJoin(roles, eq(roles.id, roleNavigationItems.roleId))
        .where(and(eq(roleNavigationItems.tenantId, tenantId), eq(roleNavigationItems.isDeleted, false), inArray(roleNavigationItems.navigationItemId, itemIds)))
    : []

  const roleCodesByItem = assignmentRows.reduce<Record<string, string[]>>((acc, row) => {
    const bucket = acc[row.navigationItemId] ?? (acc[row.navigationItemId] = [])
    if (row.roleCode) bucket.push(row.roleCode)
    return acc
  }, {})

  const sections = sectionRows.map((section) => ({
    id: section.id,
    code: section.code,
    title: section.title,
    sortOrder: section.sortOrder,
    isActive: section.isActive,
    items: itemRows
      .filter((item) => item.sectionId === section.id)
      .map((item) => ({
        id: item.id,
        sectionId: item.sectionId,
        code: item.code,
        label: item.label,
        to: item.to,
        shortLabel: item.shortLabel,
        badge: item.badge,
        sortOrder: item.sortOrder,
        requiredPermission: item.requiredPermission,
        mobileVisible: item.mobileVisible,
        isActive: item.isActive,
        roleCodes: [...new Set(roleCodesByItem[item.id] ?? [])],
      })),
  }))

  return c.json(ok('Administración de menú cargada', { sections, roles: roleRows }))
})

navigationRoutes.post('/sections', requirePermission(PERMISSIONS.USERS_MANAGE), zValidator('json', navigationSectionSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const payload = c.req.valid('json')

  const [item] = await db.insert(navigationSections).values({
    tenantId,
    code: payload.code,
    title: payload.title,
    sortOrder: payload.sortOrder,
    isActive: payload.isActive,
    createdBy: actor.id,
    updatedBy: actor.id,
  }).returning()

  if (!item) throw new AppError('No fue posible crear la sección.', 500)
  await writeAuditLog(db, { tenantId, actorUserId: actor.id, entity: 'navigation_sections', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Sección creada', { id: item.id }), 201)
})

navigationRoutes.put('/sections/:id', requirePermission(PERMISSIONS.USERS_MANAGE), zValidator('json', navigationSectionSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [item] = await db.update(navigationSections).set({
    code: payload.code,
    title: payload.title,
    sortOrder: payload.sortOrder,
    isActive: payload.isActive,
    updatedAt: new Date(),
    updatedBy: actor.id,
  }).where(and(eq(navigationSections.id, id), eq(navigationSections.tenantId, tenantId), eq(navigationSections.isDeleted, false))).returning()

  if (!item) throw new AppError('Sección no encontrada.', 404)
  await writeAuditLog(db, { tenantId, actorUserId: actor.id, entity: 'navigation_sections', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Sección actualizada', { id }))
})

navigationRoutes.delete('/sections/:id', requirePermission(PERMISSIONS.USERS_MANAGE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const id = c.req.param('id')

  const [linkedItem] = await db
    .select({ id: navigationItems.id })
    .from(navigationItems)
    .where(and(eq(navigationItems.tenantId, tenantId), eq(navigationItems.sectionId, id), eq(navigationItems.isDeleted, false)))

  if (linkedItem) throw new AppError('Primero elimina o mueve los ítems de esta sección.', 409)

  const [item] = await db.update(navigationSections).set({
    isDeleted: true,
    updatedAt: new Date(),
    updatedBy: actor.id,
  }).where(and(eq(navigationSections.id, id), eq(navigationSections.tenantId, tenantId), eq(navigationSections.isDeleted, false))).returning()

  if (!item) throw new AppError('Sección no encontrada.', 404)
  await writeAuditLog(db, { tenantId, actorUserId: actor.id, entity: 'navigation_sections', entityId: id, action: 'delete' })
  return c.json(ok('Sección eliminada', { id }))
})

navigationRoutes.post('/items', requirePermission(PERMISSIONS.USERS_MANAGE), zValidator('json', navigationItemSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const payload = c.req.valid('json')
  const availableRoles = await ensureRoleCodesExist({ db, tenantId, roleCodes: payload.roleCodes })

  const [item] = await db.insert(navigationItems).values({
    tenantId,
    sectionId: payload.sectionId,
    code: payload.code,
    label: payload.label,
    to: payload.to,
    shortLabel: payload.shortLabel,
    badge: payload.badge ?? null,
    sortOrder: payload.sortOrder,
    requiredPermission: payload.requiredPermission || null,
    mobileVisible: payload.mobileVisible,
    isActive: payload.isActive,
    createdBy: actor.id,
    updatedBy: actor.id,
  }).returning()

  if (!item) throw new AppError('No fue posible crear el ítem.', 500)

  await syncNavigationItemRoles({
    db,
    tenantId,
    actorUserId: actor.id,
    navigationItemId: item.id,
    roleIds: availableRoles.map((role) => role.id),
  })

  await writeAuditLog(db, { tenantId, actorUserId: actor.id, entity: 'navigation_items', entityId: item.id, action: 'create', changes: payload })
  return c.json(created('Ítem creado', { id: item.id }), 201)
})

navigationRoutes.put('/items/:id', requirePermission(PERMISSIONS.USERS_MANAGE), zValidator('json', navigationItemSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')
  const availableRoles = await ensureRoleCodesExist({ db, tenantId, roleCodes: payload.roleCodes })

  const [item] = await db.update(navigationItems).set({
    sectionId: payload.sectionId,
    code: payload.code,
    label: payload.label,
    to: payload.to,
    shortLabel: payload.shortLabel,
    badge: payload.badge ?? null,
    sortOrder: payload.sortOrder,
    requiredPermission: payload.requiredPermission || null,
    mobileVisible: payload.mobileVisible,
    isActive: payload.isActive,
    updatedAt: new Date(),
    updatedBy: actor.id,
  }).where(and(eq(navigationItems.id, id), eq(navigationItems.tenantId, tenantId), eq(navigationItems.isDeleted, false))).returning()

  if (!item) throw new AppError('Ítem no encontrado.', 404)

  await syncNavigationItemRoles({
    db,
    tenantId,
    actorUserId: actor.id,
    navigationItemId: id,
    roleIds: availableRoles.map((role) => role.id),
  })

  await writeAuditLog(db, { tenantId, actorUserId: actor.id, entity: 'navigation_items', entityId: id, action: 'update', changes: payload })
  return c.json(ok('Ítem actualizado', { id }))
})

navigationRoutes.delete('/items/:id', requirePermission(PERMISSIONS.USERS_MANAGE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const id = c.req.param('id')

  const [item] = await db.update(navigationItems).set({
    isDeleted: true,
    updatedAt: new Date(),
    updatedBy: actor.id,
  }).where(and(eq(navigationItems.id, id), eq(navigationItems.tenantId, tenantId), eq(navigationItems.isDeleted, false))).returning()

  if (!item) throw new AppError('Ítem no encontrado.', 404)

  await db.update(roleNavigationItems).set({
    isDeleted: true,
    updatedAt: new Date(),
    updatedBy: actor.id,
  }).where(and(eq(roleNavigationItems.tenantId, tenantId), eq(roleNavigationItems.navigationItemId, id), eq(roleNavigationItems.isDeleted, false)))

  await writeAuditLog(db, { tenantId, actorUserId: actor.id, entity: 'navigation_items', entityId: id, action: 'delete' })
  return c.json(ok('Ítem eliminado', { id }))
})
