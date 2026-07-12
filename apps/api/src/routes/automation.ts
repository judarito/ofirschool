import { and, asc, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { autoAlerts, notificationTriggers } from '@ofir/db'
import { PERMISSIONS, autoAlertSchema, notificationTriggerSchema, paginationSchema } from '@ofir/shared'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import type { AppContextVariables, Bindings } from '../types'

export const automationRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

automationRoutes.use('*', authMiddleware, tenantMiddleware)

automationRoutes.get('/triggers', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId')
  const items = await db.select().from(notificationTriggers)
    .where(and(eq(notificationTriggers.tenantId, tenantId), eq(notificationTriggers.isDeleted, false)))
    .orderBy(asc(notificationTriggers.eventType), asc(notificationTriggers.name))
  return c.json(ok('Disparadores cargados', { items }))
})

automationRoutes.post('/triggers', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', notificationTriggerSchema), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const user = c.get('user')
  const payload = c.req.valid('json')
  const [t] = await db.insert(notificationTriggers).values({
    tenantId, code: payload.code, name: payload.name, eventType: payload.eventType,
    templateCode: payload.templateCode || null, channel: payload.channel,
    recipients: payload.recipients, isAutomatic: payload.isAutomatic,
    isActive: payload.isActive, conditions: payload.conditions,
    delayMinutes: payload.delayMinutes, createdBy: user.id, updatedBy: user.id,
  }).returning()
  if (!t) throw new Error('No fue posible crear el disparador')
  return c.json(created('Disparador creado', { id: t.id }), 201)
})

automationRoutes.put('/triggers/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', notificationTriggerSchema), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const user = c.get('user')
  const id = c.req.param('id'); const payload = c.req.valid('json')
  await db.update(notificationTriggers).set({
    name: payload.name, eventType: payload.eventType, templateCode: payload.templateCode || null,
    channel: payload.channel, recipients: payload.recipients, isAutomatic: payload.isAutomatic,
    isActive: payload.isActive, conditions: payload.conditions, delayMinutes: payload.delayMinutes,
    updatedAt: new Date(), updatedBy: user.id,
  }).where(and(eq(notificationTriggers.id, id), eq(notificationTriggers.tenantId, tenantId)))
  return c.json(ok('Disparador actualizado', { id }))
})

automationRoutes.delete('/triggers/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const user = c.get('user')
  const id = c.req.param('id')
  await db.update(notificationTriggers).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id })
    .where(and(eq(notificationTriggers.id, id), eq(notificationTriggers.tenantId, tenantId)))
  return c.json(ok('Disparador eliminado', { id }))
})

automationRoutes.get('/alerts', requirePermission(PERMISSIONS.ACADEMIC_READ), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId')
  const items = await db.select().from(autoAlerts)
    .where(and(eq(autoAlerts.tenantId, tenantId), eq(autoAlerts.isDeleted, false)))
    .orderBy(asc(autoAlerts.alertType))
  return c.json(ok('Alertas cargadas', { items }))
})

automationRoutes.post('/alerts', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', autoAlertSchema), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const user = c.get('user')
  const payload = c.req.valid('json')
  const [a] = await db.insert(autoAlerts).values({
    tenantId, academicYearId: payload.academicYearId || null,
    alertType: payload.alertType, name: payload.name, entityType: payload.entityType,
    dueDaysBefore: payload.dueDaysBefore, isActive: payload.isActive,
    createdBy: user.id, updatedBy: user.id,
  }).returning()
  if (!a) throw new Error('No fue posible crear la alerta')
  return c.json(created('Alerta creada', { id: a.id }), 201)
})

automationRoutes.put('/alerts/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), zValidator('json', autoAlertSchema), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const user = c.get('user')
  const id = c.req.param('id'); const payload = c.req.valid('json')
  await db.update(autoAlerts).set({
    academicYearId: payload.academicYearId || null, alertType: payload.alertType,
    name: payload.name, entityType: payload.entityType, dueDaysBefore: payload.dueDaysBefore,
    isActive: payload.isActive, updatedAt: new Date(), updatedBy: user.id,
  }).where(and(eq(autoAlerts.id, id), eq(autoAlerts.tenantId, tenantId)))
  return c.json(ok('Alerta actualizada', { id }))
})

automationRoutes.delete('/alerts/:id', requirePermission(PERMISSIONS.ACADEMIC_WRITE), async (c) => {
  const db = c.get('db'); const tenantId = c.get('tenantId'); const user = c.get('user')
  const id = c.req.param('id')
  await db.update(autoAlerts).set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id })
    .where(and(eq(autoAlerts.id, id), eq(autoAlerts.tenantId, tenantId)))
  return c.json(ok('Alerta eliminada', { id }))
})
