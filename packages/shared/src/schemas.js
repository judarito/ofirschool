import { z } from 'zod';
export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
    tenantId: z.uuid().optional(),
});
export const studentSchema = z.object({
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(2).max(80),
    documentType: z.string().min(2).max(20),
    documentNumber: z.string().min(5).max(30),
    birthDate: z.string().date().optional().or(z.literal('')).or(z.null()),
    status: z.enum(['active', 'inactive']).default('active'),
});
export const studentFiltersSchema = z.object({
    query: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(10),
});
