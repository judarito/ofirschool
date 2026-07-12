import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { guardians, studentGuardians, students } from '@ofir/db'
import { PERMISSIONS, studentGuardianLinkSchema } from '@ofir/shared'
import { AppError } from '../lib/errors'
import { created, ok } from '../lib/http'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permissions'
import { tenantMiddleware } from '../middleware/tenant'
import { writeAuditLog } from '../repositories/audit.repository'
import type { AppContextVariables, Bindings } from '../types'

export const studentGuardianRoutes = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

studentGuardianRoutes.use('*', authMiddleware, tenantMiddleware)

const serializeLink = (link: typeof studentGuardians.$inferSelect) => ({
  id: link.id,
  studentId: link.studentId,
  guardianId: link.guardianId,
  isPrimary: link.isPrimary,
  relationshipType: link.relationshipType,
  relationshipLabel: link.relationshipLabel ?? null,
  isLegalRepresentative: link.isLegalRepresentative,
  isFinancialResponsible: link.isFinancialResponsible,
  isEmergencyContact: link.isEmergencyContact,
  isPickupAuthorized: link.isPickupAuthorized,
  createdAt: link.createdAt.toISOString(),
  updatedAt: link.updatedAt.toISOString(),
})

studentGuardianRoutes.get(
  '/students/:studentId/guardians',
  requirePermission(PERMISSIONS.STUDENTS_READ),
  async (c) => {
    const db = c.get('db')
    const tenantId = c.get('tenantId')
    const studentId = c.req.param('studentId')

    const [student] = await db
      .select({ id: students.id })
      .from(students)
      .where(
        and(
          eq(students.id, studentId),
          eq(students.tenantId, tenantId),
          eq(students.isDeleted, false),
        ),
      )
      .limit(1)
    if (!student) throw new AppError('Estudiante no encontrado', 404)

    const rows = await db
      .select({ link: studentGuardians, guardian: guardians })
      .from(studentGuardians)
      .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
      .where(
        and(
          eq(studentGuardians.tenantId, tenantId),
          eq(studentGuardians.studentId, studentId),
          eq(studentGuardians.isDeleted, false),
        ),
      )
      .orderBy(desc(studentGuardians.isPrimary), asc(guardians.firstName))

    return c.json(ok('Acudientes del estudiante cargados', {
      items: rows.map(({ link, guardian }) => ({
        ...serializeLink(link),
        guardian: {
          id: guardian.id,
          firstName: guardian.firstName,
          lastName: guardian.lastName,
          fullName: guardian.fullName,
          documentType: guardian.documentType,
          documentNumber: guardian.documentNumber,
          email: guardian.email,
          phone: guardian.phone,
          address: guardian.address,
          city: guardian.city,
          department: guardian.department,
          occupation: guardian.occupation,
        },
      })),
    }))
  },
)

studentGuardianRoutes.post(
  '/students/:studentId/guardians',
  requirePermission(PERMISSIONS.STUDENTS_WRITE),
  zValidator('json', studentGuardianLinkSchema),
  async (c) => {
    const db = c.get('db')
    const tenantId = c.get('tenantId')
    const user = c.get('user')
    const studentId = c.req.param('studentId')
    const payload = c.req.valid('json')

    const [student] = await db
      .select({ id: students.id })
      .from(students)
      .where(
        and(
          eq(students.id, studentId),
          eq(students.tenantId, tenantId),
          eq(students.isDeleted, false),
        ),
      )
      .limit(1)
    if (!student) throw new AppError('Estudiante no encontrado', 404)

    const [guardian] = await db
      .select({ id: guardians.id })
      .from(guardians)
      .where(
        and(
          eq(guardians.id, payload.guardianId),
          eq(guardians.tenantId, tenantId),
          eq(guardians.isDeleted, false),
        ),
      )
      .limit(1)
    if (!guardian) throw new AppError('Acudiente no encontrado', 404)

    const [existing] = await db
      .select({ id: studentGuardians.id })
      .from(studentGuardians)
      .where(
        and(
          eq(studentGuardians.tenantId, tenantId),
          eq(studentGuardians.studentId, studentId),
          eq(studentGuardians.guardianId, payload.guardianId),
          eq(studentGuardians.isDeleted, false),
        ),
      )
      .limit(1)

    if (existing) throw new AppError('El acudiente ya está vinculado al estudiante', 409)

    if (payload.isPrimary || payload.isLegalRepresentative || payload.isFinancialResponsible) {
      await db
        .update(studentGuardians)
        .set({
          isPrimary: payload.isPrimary ? false : undefined,
          isLegalRepresentative: payload.isLegalRepresentative ? false : undefined,
          isFinancialResponsible: payload.isFinancialResponsible ? false : undefined,
          updatedAt: new Date(),
          updatedBy: user.id,
        })
        .where(
          and(
            eq(studentGuardians.tenantId, tenantId),
            eq(studentGuardians.studentId, studentId),
            eq(studentGuardians.isDeleted, false),
          ),
        )
    }

    const [createdLink] = await db
      .insert(studentGuardians)
      .values({
        tenantId,
        studentId,
        guardianId: payload.guardianId,
        isPrimary: payload.isPrimary,
        relationshipType: payload.relationshipType,
        relationshipLabel: payload.relationshipLabel || payload.relationship,
        isLegalRepresentative: payload.isLegalRepresentative,
        isFinancialResponsible: payload.isFinancialResponsible,
        isEmergencyContact: payload.isEmergencyContact,
        isPickupAuthorized: payload.isPickupAuthorized,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning()

    if (!createdLink) throw new AppError('No fue posible vincular al acudiente', 500)

    await writeAuditLog(db, {
      tenantId,
      actorUserId: user.id,
      entity: 'student_guardians',
      entityId: createdLink.id,
      action: 'link',
      changes: payload as Record<string, unknown>,
      ipAddress: c.req.header('cf-connecting-ip'),
    })

    return c.json(created('Acudiente vinculado', { id: createdLink.id }), 201)
  },
)

studentGuardianRoutes.delete(
  '/students/:studentId/guardians/:linkId',
  requirePermission(PERMISSIONS.STUDENTS_WRITE),
  async (c) => {
    const db = c.get('db')
    const tenantId = c.get('tenantId')
    const user = c.get('user')
    const studentId = c.req.param('studentId')
    const linkId = c.req.param('linkId')

    const [existing] = await db
      .select()
      .from(studentGuardians)
      .where(
        and(
          eq(studentGuardians.id, linkId),
          eq(studentGuardians.tenantId, tenantId),
          eq(studentGuardians.studentId, studentId),
          eq(studentGuardians.isDeleted, false),
        ),
      )
      .limit(1)
    if (!existing) throw new AppError('Vínculo no encontrado', 404)

    await db
      .update(studentGuardians)
      .set({ isDeleted: true, updatedAt: new Date(), updatedBy: user.id })
      .where(eq(studentGuardians.id, linkId))

    await writeAuditLog(db, {
      tenantId,
      actorUserId: user.id,
      entity: 'student_guardians',
      entityId: linkId,
      action: 'unlink',
      changes: { from: existing },
      ipAddress: c.req.header('cf-connecting-ip'),
    })

    return c.json(ok('Acudiente desvinculado', { id: linkId }))
  },
)

export const findOrCreateGuardianByDocument = async ({
  db,
  tenantId,
  user,
  payload,
}: {
  db: AppContextVariables['db']
  tenantId: string
  user: { id: string }
  payload: {
    firstName: string
    lastName: string
    documentType: string
    documentNumber: string
    phone?: string | null
    email?: string | null
    relationship: string
    address?: string | null
    city?: string | null
    department?: string | null
    occupation?: string | null
  }
}) => {
  const [existing] = await db
    .select({ id: guardians.id })
    .from(guardians)
    .where(
      and(
        eq(guardians.tenantId, tenantId),
        eq(guardians.documentType, payload.documentType),
        eq(guardians.documentNumber, payload.documentNumber),
        eq(guardians.isDeleted, false),
      ),
    )
    .limit(1)

  if (existing) {
    await db
      .update(guardians)
      .set({
        fullName: `${payload.firstName} ${payload.lastName}`,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        address: payload.address ?? null,
        city: payload.city ?? null,
        department: payload.department ?? null,
        occupation: payload.occupation ?? null,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(guardians.id, existing.id))
    return existing.id
  }

  const [created] = await db
    .insert(guardians)
    .values({
      tenantId,
      fullName: `${payload.firstName} ${payload.lastName}`,
      firstName: payload.firstName,
      lastName: payload.lastName,
      documentType: payload.documentType,
      documentNumber: payload.documentNumber,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      relationship: payload.relationship,
      address: payload.address ?? null,
      city: payload.city ?? null,
      department: payload.department ?? null,
      occupation: payload.occupation ?? null,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning({ id: guardians.id })

  return created?.id ?? null
}

export const listStudentsWithFinancialResponsible = async ({
  db,
  tenantId,
  studentIds,
}: {
  db: AppContextVariables['db']
  tenantId: string
  studentIds: string[]
}) => {
  if (!studentIds.length) return []
  const rows = await db
    .select({
      link: studentGuardians,
      guardian: guardians,
      studentId: studentGuardians.studentId,
    })
    .from(studentGuardians)
    .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
    .where(
      and(
        eq(studentGuardians.tenantId, tenantId),
        inArray(studentGuardians.studentId, studentIds),
        eq(studentGuardians.isFinancialResponsible, true),
        eq(studentGuardians.isDeleted, false),
        eq(guardians.isDeleted, false),
      ),
    )

  return rows.map(({ link, guardian, studentId }) => ({
    studentId,
    link: serializeLink(link),
    guardian: {
      id: guardian.id,
      fullName: guardian.fullName,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      documentType: guardian.documentType,
      documentNumber: guardian.documentNumber,
      email: guardian.email,
      phone: guardian.phone,
      address: guardian.address,
      city: guardian.city,
      department: guardian.department,
      occupation: guardian.occupation,
    },
  }))
}
