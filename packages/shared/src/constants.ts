export const APP_NAME = 'Ofir School'

export const DEFAULT_PAGE_SIZE = 10

export const PERMISSIONS = {
  STUDENTS_READ: 'students.read',
  STUDENTS_WRITE: 'students.write',
  ACADEMIC_READ: 'academic.read',
  ACADEMIC_WRITE: 'academic.write',
  ADMISSION_DOCUMENTS_DOWNLOAD: 'admissions.documents.download',
  CONSENTS_READ: 'consents.read',
  CONSENTS_WRITE: 'consents.write',
  SIEE_READ: 'siee.read',
  SIEE_WRITE: 'siee.write',
  GRADEBOOK_READ: 'gradebook.read',
  GRADEBOOK_WRITE: 'gradebook.write',
  REPORTS_READ: 'reports.read',
  DASHBOARD_READ: 'dashboard.read',
  USERS_MANAGE: 'users.manage',
  TENANTS_MANAGE: 'tenants.manage',
} as const

export const ROLE_CODES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  COORDINATOR: 'coordinator',
  TEACHER: 'teacher',
  CASHIER: 'cashier',
  STUDENT: 'student',
  GUARDIAN: 'guardian',
} as const

export const NATIONAL_PERFORMANCE_LEVELS = {
  SUPERIOR: 'SUPERIOR',
  HIGH: 'HIGH',
  BASIC: 'BASIC',
  LOW: 'LOW',
} as const

export const NATIONAL_PERFORMANCE_LABELS: Record<string, string> = {
  SUPERIOR: 'Superior',
  HIGH: 'Alto',
  BASIC: 'Básico',
  LOW: 'Bajo',
}

export const GRADE_LEVEL_NAMES = {
  PRESCHOOL: 'preschool',
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  MIDDLE: 'middle',
} as const

export const GRADE_LEVEL_LABELS: Record<string, string> = {
  preschool: 'Preescolar',
  primary: 'Básica Primaria',
  secondary: 'Básica Secundaria',
  middle: 'Media',
}

export const SCALE_TYPES = {
  NUMERIC: 'numeric',
  QUALITATIVE: 'qualitative',
  MIXED: 'mixed',
} as const
