export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    meta?: Record<string, unknown>;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}
export interface SessionUser {
    id: string;
    tenantId: string;
    email: string;
    fullName: string;
    roleCodes: string[];
    permissions: string[];
}
export interface StudentDto {
    id: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    birthDate: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}
