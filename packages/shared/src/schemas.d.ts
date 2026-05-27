import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    email: z.ZodEmail;
    password: z.ZodString;
    tenantId: z.ZodOptional<z.ZodUUID>;
}, z.core.$strip>;
export declare const studentSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    documentType: z.ZodString;
    documentNumber: z.ZodString;
    birthDate: z.ZodUnion<[z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>, z.ZodNull]>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>;
}, z.core.$strip>;
export declare const studentFiltersSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type LoginInput = z.infer<typeof loginSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type StudentFiltersInput = z.infer<typeof studentFiltersSchema>;
