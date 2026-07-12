import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { admissionApplications, enrollments, formTemplates, groups, schoolBranches, students, users } from '@ofir/db'
import { PERMISSIONS } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const branchRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

branchRoutes.use('*', authMiddleware, tenantMiddleware)

const branchSchema = z.object({
  name: z.string().min(2).max(160),
  code: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  address: z.string().max(255).optional().or(z.literal('')).or(z.null()),
  city: z.string().max(120).optional().or(z.literal('')).or(z.null()),
  phone: z.string().max(30).optional().or(z.literal('')).or(z.null()),
  isActive: z.coerce.boolean().default(true),
})

// GET /api/branches — list all branches for the tenant
branchRoutes.get('/', async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const rows = await db
    .select()
    .from(schoolBranches)
    .where(and(eq(schoolBranches.tenantId, tenantId), eq(schoolBranches.isDeleted, false)))
    .orderBy(asc(schoolBranches.name))

  const branches = rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    code: row.code,
    address: row.address,
    city: row.city,
    phone: row.phone,
    isActive: true, // schoolBranches doesn't have isActive yet — treat all as active
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))

  return c.json(ok('Sedes cargadas', { branches }))
})

// GET /api/branches/options — lightweight list for selectors
branchRoutes.get('/options', async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')

  const rows = await db
    .select({ id: schoolBranches.id, name: schoolBranches.name, code: schoolBranches.code })
    .from(schoolBranches)
    .where(and(eq(schoolBranches.tenantId, tenantId), eq(schoolBranches.isDeleted, false)))
    .orderBy(asc(schoolBranches.name))

  return c.json(ok('Opciones de sedes cargadas', { options: rows }))
})

// GET /api/branches/:id — single branch detail
branchRoutes.get('/:id', async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const id = c.req.param('id')

  const [row] = await db
    .select()
    .from(schoolBranches)
    .where(and(eq(schoolBranches.id, id), eq(schoolBranches.tenantId, tenantId), eq(schoolBranches.isDeleted, false)))

  if (!row) throw new AppError('Sede no encontrada', 404)

  return c.json(ok('Sede cargada', {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    code: row.code,
    address: row.address,
    city: row.city,
    phone: row.phone,
    isActive: true,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
})

// POST /api/branches — create branch
branchRoutes.post('/', requirePermission(PERMISSIONS.USERS_MANAGE), zValidator('json', branchSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const payload = c.req.valid('json')

  const [item] = await db.insert(schoolBranches).values({
    tenantId,
    name: payload.name,
    code: payload.code || null,
    address: payload.address || null,
    city: payload.city || null,
    phone: payload.phone || null,
    createdBy: actor.id,
    updatedBy: actor.id,
  }).returning()

  if (!item) throw new AppError('No fue posible crear la sede', 500)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: actor.id,
    entity: 'school_branches',
    entityId: item.id,
    action: 'create',
    changes: payload,
  })

  return c.json(created('Sede creada', { id: item.id }), 201)
})

// PUT /api/branches/:id — update branch
branchRoutes.put('/:id', requirePermission(PERMISSIONS.USERS_MANAGE), zValidator('json', branchSchema), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const id = c.req.param('id')
  const payload = c.req.valid('json')

  const [item] = await db.update(schoolBranches).set({
    name: payload.name,
    code: payload.code || null,
    address: payload.address || null,
    city: payload.city || null,
    phone: payload.phone || null,
    updatedAt: new Date(),
    updatedBy: actor.id,
  }).where(
    and(eq(schoolBranches.id, id), eq(schoolBranches.tenantId, tenantId), eq(schoolBranches.isDeleted, false)),
  ).returning()

  if (!item) throw new AppError('Sede no encontrada', 404)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: actor.id,
    entity: 'school_branches',
    entityId: id,
    action: 'update',
    changes: payload,
  })

  return c.json(ok('Sede actualizada', { id }))
})

// DELETE /api/branches/:id — soft-delete (only if no active groups attached)
branchRoutes.delete('/:id', requirePermission(PERMISSIONS.USERS_MANAGE), async (c) => {
  const db = c.get('db')
  const tenantId = c.get('tenantId')
  const actor = c.get('user')
  const id = c.req.param('id')

  // Guard: groups still using this branch
  const [activeGroup] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.tenantId, tenantId), eq(groups.branchId, id), eq(groups.isDeleted, false)))

  if (activeGroup) {
    throw new AppError('No puedes eliminar esta sede porque tiene cursos activos asignados.', 409)
  }

  // Guard: pending admissions using this branch
  const [activeAdmission] = await db
    .select({ id: admissionApplications.id })
    .from(admissionApplications)
    .where(and(eq(admissionApplications.tenantId, tenantId), eq(admissionApplications.branchId, id), eq(admissionApplications.isDeleted, false)))

  if (activeAdmission) {
    throw new AppError('No puedes eliminar esta sede porque tiene inscripciones activas.', 409)
  }

  const [item] = await db.update(schoolBranches).set({
    isDeleted: true,
    updatedAt: new Date(),
    updatedBy: actor.id,
  }).where(
    and(eq(schoolBranches.id, id), eq(schoolBranches.tenantId, tenantId), eq(schoolBranches.isDeleted, false)),
  ).returning()

  if (!item) throw new AppError('Sede no encontrada', 404)

  await writeAuditLog(db, {
    tenantId,
    actorUserId: actor.id,
    entity: 'school_branches',
    entityId: id,
    action: 'delete',
  })

  return c.json(ok('Sede eliminada', { id }))
})
