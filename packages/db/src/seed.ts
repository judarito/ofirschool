import bcrypt from 'bcryptjs'
import { eq, and } from 'drizzle-orm'
import { createDb } from './client'
import { getEnv } from './env'
import {
  academicPeriods,
  academicYears,
  achievementIndicators,
  academicObservations,
  academicYearJourneys,
  academicYearJourneySlots,
  activityScores,
  attendanceRecords,
  competencies,
  formFields,
  formSections,
  formTemplateVersions,
  formTemplates,
  courseSubjects,
  enrollments,
  evaluationActivities,
  gradeRecords,
  gradeSubjects,
  grades,
  groupJourneyOptions,
  groupTimetableEntries,
  groups,
  permissions,
  performanceRanges,
  requiredDocuments,
  rolePermissions,
  roles,
  studentGuardians,
  students,
  subjects,
  supportStrategies,
  teacherResponsibilities,
  teachers,
  tenants,
  learningAchievements,
  userRoles,
  users,
  academicAreas,
  gradingScales,
  guardians,
  consentDocuments,
  navigationItems,
  navigationSections,
  roleNavigationItems,
} from './schema'

const PERMISSIONS = {
  DASHBOARD_READ: 'dashboard.read',
  STUDENTS_READ: 'students.read',
  STUDENTS_WRITE: 'students.write',
  ACADEMIC_READ: 'academic.read',
  ACADEMIC_WRITE: 'academic.write',
  SIEE_READ: 'siee.read',
  SIEE_WRITE: 'siee.write',
  GRADEBOOK_READ: 'gradebook.read',
  GRADEBOOK_WRITE: 'gradebook.write',
  REPORTS_READ: 'reports.read',
  USERS_MANAGE: 'users.manage',
  TENANTS_MANAGE: 'tenants.manage',
} as const

const ROLE_CODES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  COORDINATOR: 'coordinator',
  TEACHER: 'teacher',
  CASHIER: 'cashier',
} as const

type RoleCode = typeof ROLE_CODES[keyof typeof ROLE_CODES]
type NavigationSeedItem = {
  code: string
  sectionCode: string
  label: string
  to: string
  shortLabel: string
  sortOrder: number
  mobileVisible?: boolean
  requiredPermission?: string
  roles: RoleCode[]
}

const NAVIGATION_SECTIONS = [
  { code: 'home', title: 'Inicio', sortOrder: 1 },
  { code: 'admissions-and-enrollment', title: 'Admisión y matrícula', sortOrder: 2 },
  { code: 'academic-operations', title: 'Operación académica', sortOrder: 3 },
  { code: 'closures', title: 'Cierres', sortOrder: 4 },
  { code: 'coexistence-inclusion', title: 'Convivencia e inclusión', sortOrder: 5 },
  { code: 'configuration', title: 'Configuración', sortOrder: 6 },
  { code: 'institutional', title: 'Institucional', sortOrder: 7 },
] as const

const NAVIGATION_ITEMS: NavigationSeedItem[] = [
  { code: 'home', sectionCode: 'home', label: 'Inicio', to: '/', shortLabel: 'IN', sortOrder: 1, mobileVisible: true, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER, ROLE_CODES.CASHIER] },
  { code: 'students', sectionCode: 'home', label: 'Estudiantes', to: '/students', shortLabel: 'ES', sortOrder: 2, requiredPermission: PERMISSIONS.STUDENTS_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER] },
  { code: 'admissions', sectionCode: 'admissions-and-enrollment', label: 'Inscripciones', to: '/admissions', shortLabel: 'IS', sortOrder: 1, mobileVisible: true, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'enrollments', sectionCode: 'admissions-and-enrollment', label: 'Matrículas y cierre anual', to: '/enrollments', shortLabel: 'MA', sortOrder: 2, mobileVisible: true, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'forms', sectionCode: 'admissions-and-enrollment', label: 'Formulario público', to: '/enrollment-forms', shortLabel: 'FO', sortOrder: 3, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'attendance', sectionCode: 'academic-operations', label: 'Asistencia', to: '/attendance', shortLabel: 'AS', sortOrder: 1, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER] },
  { code: 'evaluation-activities', sectionCode: 'academic-operations', label: 'Actividades evaluativas', to: '/evaluation-activities', shortLabel: 'AE', sortOrder: 2, requiredPermission: PERMISSIONS.GRADEBOOK_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER] },
  { code: 'grades-book', sectionCode: 'academic-operations', label: 'Notas finales', to: '/grades', shortLabel: 'NO', sortOrder: 3, requiredPermission: PERMISSIONS.GRADEBOOK_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER] },
  { code: 'academic-observations', sectionCode: 'academic-operations', label: 'Observaciones SIEE', to: '/academic-observations', shortLabel: 'OB', sortOrder: 4, requiredPermission: PERMISSIONS.SIEE_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER] },
  { code: 'support-strategies', sectionCode: 'academic-operations', label: 'Planes de apoyo', to: '/support-strategies', shortLabel: 'PA', sortOrder: 5, requiredPermission: PERMISSIONS.SIEE_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER] },
  { code: 'committees', sectionCode: 'academic-operations', label: 'Comités académicos', to: '/committees', shortLabel: 'CM', sortOrder: 6, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'report-cards', sectionCode: 'academic-operations', label: 'Boletines', to: '/report-cards', shortLabel: 'BO', sortOrder: 7, mobileVisible: true, requiredPermission: PERMISSIONS.GRADEBOOK_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER] },
  { code: 'periods', sectionCode: 'closures', label: 'Periodos', to: '/academic-periods', shortLabel: 'PE', sortOrder: 1, mobileVisible: true, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'years', sectionCode: 'closures', label: 'Años lectivos', to: '/academic-years', shortLabel: 'AN', sortOrder: 2, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'coexistence', sectionCode: 'coexistence-inclusion', label: 'Convivencia escolar', to: '/coexistence', shortLabel: 'CV', sortOrder: 1, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'piar', sectionCode: 'coexistence-inclusion', label: 'PIAR / Inclusión', to: '/piar', shortLabel: 'PI', sortOrder: 2, requiredPermission: PERMISSIONS.SIEE_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'grades', sectionCode: 'configuration', label: 'Grados', to: '/academic-grades', shortLabel: 'GR', sortOrder: 1, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'academic-levels', sectionCode: 'configuration', label: 'Niveles educativos', to: '/academic-levels', shortLabel: 'NE', sortOrder: 2, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'courses', sectionCode: 'configuration', label: 'Cursos', to: '/courses', shortLabel: 'CU', sortOrder: 3, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'schedules', sectionCode: 'configuration', label: 'Horarios', to: '/schedules', shortLabel: 'HO', sortOrder: 4, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER] },
  { code: 'areas', sectionCode: 'configuration', label: 'Áreas académicas', to: '/academic-areas', shortLabel: 'AR', sortOrder: 5, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'subjects', sectionCode: 'configuration', label: 'Materias', to: '/subjects', shortLabel: 'MT', sortOrder: 6, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'scales', sectionCode: 'configuration', label: 'Escalas SIEE', to: '/grading-scale', shortLabel: 'SC', sortOrder: 7, requiredPermission: PERMISSIONS.SIEE_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'competencies', sectionCode: 'configuration', label: 'Competencias SIEE', to: '/competencies', shortLabel: 'CO', sortOrder: 8, requiredPermission: PERMISSIONS.SIEE_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'grade-subjects', sectionCode: 'configuration', label: 'Materias por grado', to: '/grade-subjects', shortLabel: 'MG', sortOrder: 9, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'academic-plan', sectionCode: 'configuration', label: 'Plan académico', to: '/academic-plan', shortLabel: 'PL', sortOrder: 10, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER] },
  { code: 'teachers', sectionCode: 'institutional', label: 'Docentes', to: '/teachers', shortLabel: 'DO', sortOrder: 1, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'teacher-assignments', sectionCode: 'institutional', label: 'Carga docente', to: '/teacher-assignments', shortLabel: 'CD', sortOrder: 2, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'teacher-responsibilities', sectionCode: 'institutional', label: 'Directores y coordinación', to: '/teacher-responsibilities', shortLabel: 'DG', sortOrder: 3, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'users', sectionCode: 'institutional', label: 'Usuarios', to: '/users', shortLabel: 'US', sortOrder: 4, requiredPermission: PERMISSIONS.USERS_MANAGE, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN] },
  { code: 'navigation-admin', sectionCode: 'institutional', label: 'Menú y navegación', to: '/navigation-admin', shortLabel: 'MN', sortOrder: 5, requiredPermission: PERMISSIONS.USERS_MANAGE, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN] },
  { code: 'branches', sectionCode: 'institutional', label: 'Sedes', to: '/branches', shortLabel: 'SD', sortOrder: 6, requiredPermission: PERMISSIONS.ACADEMIC_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR] },
  { code: 'announcements', sectionCode: 'institutional', label: 'Comunicaciones', to: '/announcements', shortLabel: 'CM', sortOrder: 7, requiredPermission: PERMISSIONS.DASHBOARD_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.TEACHER, ROLE_CODES.CASHIER] },
  { code: 'portfolio', sectionCode: 'institutional', label: 'Financiero', to: '/portfolio', shortLabel: 'FI', sortOrder: 8, requiredPermission: PERMISSIONS.REPORTS_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.CASHIER] },
  { code: 'reports', sectionCode: 'institutional', label: 'Reportes', to: '/reports', shortLabel: 'RP', sortOrder: 9, requiredPermission: PERMISSIONS.REPORTS_READ, roles: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.COORDINATOR, ROLE_CODES.CASHIER] },
] as const

const databaseUrl = getEnv('DATABASE_URL')

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required')
}

const tenantId = getEnv('DEFAULT_TENANT_ID') ?? '11111111-1111-1111-1111-111111111111'
const adminEmail = getEnv('SUPERADMIN_EMAIL') ?? 'admin@demo.ofirschool.com'
const adminPassword = getEnv('SUPERADMIN_PASSWORD') ?? 'ChangeMe123*'

const db = createDb(databaseUrl)

const GROUP_SUFFIXES = ['A', 'B', 'C'] as const
const PERIOD_DEFINITIONS = [
  { name: 'Primer Periodo', code: 'P1', startsOn: '2026-01-20', endsOn: '2026-03-31', weight: 25, status: 'published' },
  { name: 'Segundo Periodo', code: 'P2', startsOn: '2026-04-01', endsOn: '2026-06-13', weight: 25, status: 'open' },
  { name: 'Tercer Periodo', code: 'P3', startsOn: '2026-07-06', endsOn: '2026-09-11', weight: 25, status: 'open' },
  { name: 'Cuarto Periodo', code: 'P4', startsOn: '2026-09-14', endsOn: '2026-11-30', weight: 25, status: 'open' },
] as const

const AREA_DEFINITIONS = [
  { name: 'Matemáticas', code: 'MAT', color: '#3b82f6', orderNumber: 1 },
  { name: 'Humanidades, Lengua Castellana e Idiomas Extranjeros', code: 'HUM', color: '#ef4444', orderNumber: 2 },
  { name: 'Ciencias Naturales y Educación Ambiental', code: 'NAT', color: '#10b981', orderNumber: 3 },
  { name: 'Ciencias Sociales, Historia, Geografía y Constitución', code: 'SOC', color: '#f59e0b', orderNumber: 4 },
  { name: 'Tecnología e Informática', code: 'TEC', color: '#8b5cf6', orderNumber: 5 },
  { name: 'Educación Artística y Cultural', code: 'ART', color: '#ec4899', orderNumber: 6 },
  { name: 'Educación Física, Recreación y Deportes', code: 'EFI', color: '#14b8a6', orderNumber: 7 },
  { name: 'Educación Religiosa', code: 'REL', color: '#6366f1', orderNumber: 8 },
  { name: 'Ética y Valores Humanos', code: 'ETI', color: '#f97316', orderNumber: 9 },
  { name: 'Filosofía y Ciencias Políticas', code: 'FIL', color: '#64748b', orderNumber: 10 },
] as const

const levelLabelMap: Record<string, string> = {
  preschool: 'Preescolar',
  primary: 'Primaria',
  secondary: 'Secundaria',
  middle: 'Media',
}

const gradeDefinitions = [
  { name: 'Prejardín', level: -2, levelName: 'preschool', orderNumber: 1 },
  { name: 'Jardín', level: -1, levelName: 'preschool', orderNumber: 2 },
  { name: 'Transición', level: 0, levelName: 'preschool', orderNumber: 3 },
  { name: 'Primero', level: 1, levelName: 'primary', orderNumber: 4 },
  { name: 'Segundo', level: 2, levelName: 'primary', orderNumber: 5 },
  { name: 'Tercero', level: 3, levelName: 'primary', orderNumber: 6 },
  { name: 'Cuarto', level: 4, levelName: 'primary', orderNumber: 7 },
  { name: 'Quinto', level: 5, levelName: 'primary', orderNumber: 8 },
  { name: 'Sexto', level: 6, levelName: 'secondary', orderNumber: 9 },
  { name: 'Séptimo', level: 7, levelName: 'secondary', orderNumber: 10 },
  { name: 'Octavo', level: 8, levelName: 'secondary', orderNumber: 11 },
  { name: 'Noveno', level: 9, levelName: 'secondary', orderNumber: 12 },
  { name: 'Décimo', level: 10, levelName: 'middle', orderNumber: 13 },
  { name: 'Undécimo', level: 11, levelName: 'middle', orderNumber: 14 },
] as const

const studentFirstNames = ['Sofía', 'Mateo', 'Valentina', 'Santiago', 'Luciana', 'Samuel', 'Isabella', 'Nicolás', 'Mariana', 'Juan José', 'Sara', 'Gabriel']
const studentLastNames = ['García', 'Rodríguez', 'Martínez', 'López', 'Gómez', 'Pérez', 'Moreno', 'Ramírez', 'Torres', 'Díaz']
const guardianLastNames = ['Gómez', 'Rojas', 'Herrera', 'Castro', 'Mendoza', 'Vargas']
const teacherNamePool = [
  ['Adriana', 'Quintero'],
  ['Beatriz', 'Luna'],
  ['Camilo', 'Suárez'],
  ['Diana', 'Castaño'],
  ['Eduardo', 'Rincón'],
  ['Fabiana', 'Leal'],
  ['Germán', 'Arias'],
  ['Helena', 'Mora'],
  ['Iván', 'Serrano'],
  ['Juliana', 'Peña'],
  ['Karen', 'Muñoz'],
  ['Leonardo', 'Téllez'],
  ['Mónica', 'Barrera'],
  ['Natalia', 'Correa'],
  ['Óscar', 'Salazar'],
  ['Paola', 'Beltrán'],
  ['Ricardo', 'Camacho'],
  ['Sandra', 'Acevedo'],
  ['Tatiana', 'Navarro'],
  ['William', 'Forero'],
  ['Yolanda', 'Patiño'],
  ['Zulma', 'Parra'],
]

type SubjectSeed = {
  code: string
  name: string
  areaCode: string
  levels: Array<'preschool' | 'primary' | 'secondary' | 'middle'>
  weeklyHoursByLevel: Partial<Record<'preschool' | 'primary' | 'secondary' | 'middle', number>>
  specialty: string
}

const subjectDefinitions: SubjectSeed[] = [
  { code: 'DIM-COM', name: 'Dimensión Comunicativa', areaCode: 'HUM', levels: ['preschool'], weeklyHoursByLevel: { preschool: 5 }, specialty: 'Preescolar' },
  { code: 'DIM-COG', name: 'Dimensión Cognitiva', areaCode: 'MAT', levels: ['preschool'], weeklyHoursByLevel: { preschool: 5 }, specialty: 'Preescolar' },
  { code: 'DIM-COR', name: 'Dimensión Corporal', areaCode: 'EFI', levels: ['preschool'], weeklyHoursByLevel: { preschool: 3 }, specialty: 'Preescolar' },
  { code: 'DIM-ART', name: 'Dimensión Artística', areaCode: 'ART', levels: ['preschool'], weeklyHoursByLevel: { preschool: 2 }, specialty: 'Artística' },
  { code: 'DIM-SOC', name: 'Dimensión Socioafectiva', areaCode: 'SOC', levels: ['preschool'], weeklyHoursByLevel: { preschool: 3 }, specialty: 'Preescolar' },
  { code: 'ING', name: 'Inglés', areaCode: 'HUM', levels: ['preschool', 'primary', 'secondary', 'middle'], weeklyHoursByLevel: { preschool: 2, primary: 3, secondary: 3, middle: 3 }, specialty: 'Inglés' },
  { code: 'MAT', name: 'Matemáticas', areaCode: 'MAT', levels: ['primary', 'secondary', 'middle'], weeklyHoursByLevel: { primary: 5, secondary: 5, middle: 5 }, specialty: 'Matemáticas' },
  { code: 'EST', name: 'Estadística', areaCode: 'MAT', levels: ['secondary', 'middle'], weeklyHoursByLevel: { secondary: 1, middle: 1 }, specialty: 'Matemáticas' },
  { code: 'GEO', name: 'Geometría', areaCode: 'MAT', levels: ['secondary', 'middle'], weeklyHoursByLevel: { secondary: 2, middle: 2 }, specialty: 'Matemáticas' },
  { code: 'LEN', name: 'Lengua Castellana', areaCode: 'HUM', levels: ['primary', 'secondary', 'middle'], weeklyHoursByLevel: { primary: 5, secondary: 4, middle: 4 }, specialty: 'Lengua Castellana' },
  { code: 'NAT', name: 'Ciencias Naturales', areaCode: 'NAT', levels: ['primary'], weeklyHoursByLevel: { primary: 4 }, specialty: 'Ciencias Naturales' },
  { code: 'BIO', name: 'Biología', areaCode: 'NAT', levels: ['secondary', 'middle'], weeklyHoursByLevel: { secondary: 3, middle: 2 }, specialty: 'Biología' },
  { code: 'QUI', name: 'Química', areaCode: 'NAT', levels: ['secondary', 'middle'], weeklyHoursByLevel: { secondary: 2, middle: 3 }, specialty: 'Química' },
  { code: 'FIS', name: 'Física', areaCode: 'NAT', levels: ['secondary', 'middle'], weeklyHoursByLevel: { secondary: 2, middle: 3 }, specialty: 'Física' },
  { code: 'SOC', name: 'Ciencias Sociales', areaCode: 'SOC', levels: ['primary', 'secondary', 'middle'], weeklyHoursByLevel: { primary: 4, secondary: 4, middle: 3 }, specialty: 'Ciencias Sociales' },
  { code: 'TEC', name: 'Tecnología e Informática', areaCode: 'TEC', levels: ['preschool', 'primary', 'secondary', 'middle'], weeklyHoursByLevel: { preschool: 1, primary: 2, secondary: 2, middle: 2 }, specialty: 'Tecnología e Informática' },
  { code: 'ART', name: 'Educación Artística', areaCode: 'ART', levels: ['primary', 'secondary', 'middle'], weeklyHoursByLevel: { primary: 2, secondary: 2, middle: 1 }, specialty: 'Artística' },
  { code: 'EFI', name: 'Educación Física', areaCode: 'EFI', levels: ['primary', 'secondary', 'middle'], weeklyHoursByLevel: { primary: 2, secondary: 2, middle: 2 }, specialty: 'Educación Física' },
  { code: 'REL', name: 'Educación Religiosa', areaCode: 'REL', levels: ['primary', 'secondary', 'middle'], weeklyHoursByLevel: { primary: 1, secondary: 1, middle: 1 }, specialty: 'Educación Religiosa' },
  { code: 'ETI', name: 'Ética y Valores', areaCode: 'ETI', levels: ['primary', 'secondary', 'middle'], weeklyHoursByLevel: { primary: 1, secondary: 1, middle: 1 }, specialty: 'Ética y Valores' },
  { code: 'FIL', name: 'Filosofía', areaCode: 'FIL', levels: ['middle'], weeklyHoursByLevel: { middle: 2 }, specialty: 'Filosofía' },
  { code: 'POL', name: 'Ciencias Políticas y Económicas', areaCode: 'FIL', levels: ['middle'], weeklyHoursByLevel: { middle: 2 }, specialty: 'Ciencias Políticas' },
]

const competencyByAreaCode: Record<string, string> = {
  MAT: 'Resuelve situaciones problema usando razonamiento lógico, numérico y espacial en contextos cotidianos y escolares.',
  HUM: 'Comprende, produce y comunica ideas de manera oral y escrita con sentido crítico y progresiva autonomía.',
  NAT: 'Explica fenómenos del entorno a partir de la observación, la experimentación y el pensamiento científico escolar.',
  SOC: 'Analiza su contexto social e histórico y participa de manera responsable en la construcción de ciudadanía.',
  TEC: 'Usa herramientas tecnológicas y procesos de pensamiento computacional para resolver tareas y crear soluciones sencillas.',
  ART: 'Expresa ideas, emociones y experiencias mediante lenguajes artísticos y aprecia manifestaciones culturales.',
  EFI: 'Fortalece hábitos de vida saludable, trabajo en equipo y motricidad a través del movimiento.',
  REL: 'Reflexiona sobre valores, sentido de vida y convivencia respetando la diversidad de creencias.',
  ETI: 'Actúa con responsabilidad, respeto y autonomía en la convivencia diaria.',
  FIL: 'Argumenta ideas y toma postura frente a situaciones de su realidad con pensamiento crítico.',
}

const expectedPerformanceByLevel: Record<string, string> = {
  preschool: 'BASIC',
  primary: 'HIGH',
  secondary: 'HIGH',
  middle: 'SUPERIOR',
}

const safeEmail = (name: string) =>
  `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '')}@demo.ofirschool.com`

const scoreFor = (a: number, b: number, c: number, min = 2.8, max = 4.9) => {
  const seed = ((a + 3) * 17 + (b + 5) * 13 + (c + 7) * 11) % 100
  const value = min + ((max - min) * seed) / 100
  return value.toFixed(1)
}

async function seed() {
  const passwordHash = await bcrypt.hash(adminPassword, 10)
  const existingTenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  if (!existingTenant.length) {
    await db.insert(tenants).values({
      id: tenantId,
      tenantId,
      name: 'Colegio Demo Ofir',
      slug: 'colegio-demo-ofir',
      nit: '900123456-7',
    })
  }

  const permissionCatalog = [
    { name: 'Ver dashboard', code: PERMISSIONS.DASHBOARD_READ, module: 'dashboard' },
    { name: 'Ver estudiantes', code: PERMISSIONS.STUDENTS_READ, module: 'students' },
    { name: 'Gestionar estudiantes', code: PERMISSIONS.STUDENTS_WRITE, module: 'students' },
    { name: 'Ver configuracion academica', code: PERMISSIONS.ACADEMIC_READ, module: 'academic' },
    { name: 'Gestionar configuracion academica', code: PERMISSIONS.ACADEMIC_WRITE, module: 'academic' },
    { name: 'Ver SIEE', code: PERMISSIONS.SIEE_READ, module: 'siee' },
    { name: 'Gestionar SIEE', code: PERMISSIONS.SIEE_WRITE, module: 'siee' },
    { name: 'Ver libro de notas', code: PERMISSIONS.GRADEBOOK_READ, module: 'gradebook' },
    { name: 'Gestionar libro de notas', code: PERMISSIONS.GRADEBOOK_WRITE, module: 'gradebook' },
    { name: 'Ver reportes', code: PERMISSIONS.REPORTS_READ, module: 'reports' },
    { name: 'Gestionar usuarios', code: PERMISSIONS.USERS_MANAGE, module: 'users' },
    { name: 'Gestionar tenants', code: PERMISSIONS.TENANTS_MANAGE, module: 'tenants' },
  ]

  const existingPermissions = await db.select().from(permissions).where(eq(permissions.tenantId, tenantId))
  for (const permission of permissionCatalog) {
    if (!existingPermissions.find((item) => item.code === permission.code)) {
      await db.insert(permissions).values({
        tenantId,
        ...permission,
      })
    }
  }

  const roleCatalog = [
    { name: 'Super Administrador', code: ROLE_CODES.SUPER_ADMIN, description: 'Acceso total al tenant' },
    { name: 'Administrador', code: ROLE_CODES.ADMIN, description: 'Administración general del colegio' },
    { name: 'Coordinador', code: ROLE_CODES.COORDINATOR, description: 'Coordinación académica y seguimiento' },
    { name: 'Docente', code: ROLE_CODES.TEACHER, description: 'Operación docente y evaluación' },
    { name: 'Cajero', code: ROLE_CODES.CASHIER, description: 'Gestión financiera y cartera' },
  ]

  const existingRoles = await db.select().from(roles).where(eq(roles.tenantId, tenantId))
  for (const role of roleCatalog) {
    if (!existingRoles.find((item) => item.code === role.code)) {
      await db.insert(roles).values({
        tenantId,
        ...role,
      })
    }
  }

  const existingUsers = await db.select().from(users).where(eq(users.tenantId, tenantId))
  if (!existingUsers.find((item) => item.email === adminEmail)) {
    await db.insert(users).values({
      tenantId,
      fullName: 'Super Admin Demo',
      email: adminEmail,
      passwordHash,
      status: 'active',
    })
  }

  const permissionsResult = await db
    .select()
    .from(permissions)
    .where(eq(permissions.tenantId, tenantId))

  const rolesResult = await db.select().from(roles).where(eq(roles.tenantId, tenantId))
  const usersResult = await db.select().from(users).where(eq(users.tenantId, tenantId))

  const savedRole = rolesResult.find((item) => item.code === ROLE_CODES.SUPER_ADMIN)
  const savedUser = usersResult.find((item) => item.email === adminEmail)

  if (savedRole && savedUser) {
    const existingUserRoles = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, savedUser.id), eq(userRoles.roleId, savedRole.id)))

    if (!existingUserRoles.length) {
      await db.insert(userRoles).values({
        tenantId,
        userId: savedUser.id,
        roleId: savedRole.id,
      })
    }

    const existingRolePermissions = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, savedRole.id))

    for (const permission of permissionsResult) {
      if (!existingRolePermissions.find((item) => item.permissionId === permission.id)) {
        await db.insert(rolePermissions).values({
          tenantId,
          roleId: savedRole.id,
          permissionId: permission.id,
        })
      }
    }
  }

  const permissionByCode = Object.fromEntries(permissionsResult.map((permission) => [permission.code, permission.id]))
  const roleByCode = Object.fromEntries(rolesResult.map((role) => [role.code, role.id]))
  const rolePermissionMatrix: Record<string, string[]> = {
    [ROLE_CODES.ADMIN]: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.STUDENTS_READ,
      PERMISSIONS.STUDENTS_WRITE,
      PERMISSIONS.ACADEMIC_READ,
      PERMISSIONS.ACADEMIC_WRITE,
      PERMISSIONS.SIEE_READ,
      PERMISSIONS.SIEE_WRITE,
      PERMISSIONS.GRADEBOOK_READ,
      PERMISSIONS.GRADEBOOK_WRITE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.USERS_MANAGE,
    ],
    [ROLE_CODES.COORDINATOR]: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.STUDENTS_READ,
      PERMISSIONS.ACADEMIC_READ,
      PERMISSIONS.ACADEMIC_WRITE,
      PERMISSIONS.SIEE_READ,
      PERMISSIONS.SIEE_WRITE,
      PERMISSIONS.GRADEBOOK_READ,
      PERMISSIONS.GRADEBOOK_WRITE,
      PERMISSIONS.REPORTS_READ,
    ],
    [ROLE_CODES.TEACHER]: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.STUDENTS_READ,
      PERMISSIONS.ACADEMIC_READ,
      PERMISSIONS.SIEE_READ,
      PERMISSIONS.GRADEBOOK_READ,
      PERMISSIONS.GRADEBOOK_WRITE,
    ],
    [ROLE_CODES.CASHIER]: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.REPORTS_READ,
    ],
  }

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMatrix)) {
    const roleId = roleByCode[roleCode]
    if (!roleId) continue

    const existingAssignments = await db
      .select()
      .from(rolePermissions)
      .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.roleId, roleId), eq(rolePermissions.isDeleted, false)))

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionByCode[permissionCode]
      if (!permissionId) continue
      if (!existingAssignments.find((item) => item.permissionId === permissionId)) {
        await db.insert(rolePermissions).values({
          tenantId,
          roleId,
          permissionId,
        })
      }
    }
  }

  const existingNavigationSections = await db.select().from(navigationSections).where(eq(navigationSections.tenantId, tenantId))
  const expectedNavigationSectionCodes = new Set<string>(NAVIGATION_SECTIONS.map((section) => section.code))
  for (const section of NAVIGATION_SECTIONS) {
    const existing = existingNavigationSections.find((item) => item.code === section.code)
    if (!existing) {
      await db.insert(navigationSections).values({
        tenantId,
        ...section,
      })
    } else if (existing.title !== section.title || existing.sortOrder !== section.sortOrder || !existing.isActive || existing.isDeleted) {
      await db.update(navigationSections).set({
        title: section.title,
        sortOrder: section.sortOrder,
        isActive: true,
        isDeleted: false,
        updatedAt: new Date(),
      }).where(and(eq(navigationSections.tenantId, tenantId), eq(navigationSections.code, section.code)))
    }
  }

  for (const section of existingNavigationSections) {
    if (!expectedNavigationSectionCodes.has(section.code) && section.isActive && !section.isDeleted) {
      await db.update(navigationSections).set({
        isActive: false,
        updatedAt: new Date(),
      }).where(eq(navigationSections.id, section.id))
    }
  }

  const savedNavigationSections = await db.select().from(navigationSections).where(and(eq(navigationSections.tenantId, tenantId), eq(navigationSections.isDeleted, false)))
  const navigationSectionByCode = Object.fromEntries(savedNavigationSections.map((section) => [section.code, section.id]))
  const existingNavigationItems = await db.select().from(navigationItems).where(eq(navigationItems.tenantId, tenantId))
  const expectedNavigationItemCodes = new Set<string>(NAVIGATION_ITEMS.map((item) => item.code))

  for (const item of NAVIGATION_ITEMS) {
    const sectionId = navigationSectionByCode[item.sectionCode]
    if (!sectionId) continue
    const existing = existingNavigationItems.find((saved) => saved.code === item.code)
    if (!existing) {
      await db.insert(navigationItems).values({
        tenantId,
        sectionId,
        code: item.code,
        label: item.label,
        to: item.to,
        shortLabel: item.shortLabel,
        badge: null,
        sortOrder: item.sortOrder,
        requiredPermission: item.requiredPermission ?? null,
        mobileVisible: item.mobileVisible ?? false,
        isActive: true,
      })
    } else if (
      existing.sectionId !== sectionId ||
      existing.label !== item.label ||
      existing.to !== item.to ||
      existing.shortLabel !== item.shortLabel ||
      existing.sortOrder !== item.sortOrder ||
      existing.requiredPermission !== (item.requiredPermission ?? null) ||
      existing.mobileVisible !== (item.mobileVisible ?? false) ||
      !existing.isActive ||
      existing.isDeleted
    ) {
      await db.update(navigationItems).set({
        sectionId,
        label: item.label,
        to: item.to,
        shortLabel: item.shortLabel,
        sortOrder: item.sortOrder,
        requiredPermission: item.requiredPermission ?? null,
        mobileVisible: item.mobileVisible ?? false,
        isActive: true,
        isDeleted: false,
        updatedAt: new Date(),
      }).where(and(eq(navigationItems.tenantId, tenantId), eq(navigationItems.code, item.code)))
    }
  }

  for (const item of existingNavigationItems) {
    if (!expectedNavigationItemCodes.has(item.code) && item.isActive && !item.isDeleted) {
      await db.update(navigationItems).set({
        isActive: false,
        updatedAt: new Date(),
      }).where(eq(navigationItems.id, item.id))
    }
  }

  const savedNavigationItems = await db.select().from(navigationItems).where(eq(navigationItems.tenantId, tenantId))
  const navigationItemByCode = Object.fromEntries(savedNavigationItems.map((item) => [item.code, item.id]))

  for (const [roleCode, roleId] of Object.entries(roleByCode)) {
    if (!roleId) continue
    const allowedItems = NAVIGATION_ITEMS.filter((item) => item.roles.includes(roleCode as RoleCode))
    const existingAssignments = await db
      .select()
      .from(roleNavigationItems)
      .where(and(eq(roleNavigationItems.tenantId, tenantId), eq(roleNavigationItems.roleId, roleId), eq(roleNavigationItems.isDeleted, false)))

    for (const item of allowedItems) {
      const navigationItemId = navigationItemByCode[item.code]
      if (!navigationItemId) continue
      if (!existingAssignments.find((assignment) => assignment.navigationItemId === navigationItemId)) {
        await db.insert(roleNavigationItems).values({
          tenantId,
          roleId,
          navigationItemId,
        })
      }
    }
  }

  const existingGrades = await db.select().from(grades).where(eq(grades.tenantId, tenantId))
  for (const grade of gradeDefinitions) {
    const existing = existingGrades.find((item) => item.level === grade.level)
    if (!existing) {
      await db.insert(grades).values({
        tenantId,
        ...grade,
      })
    } else if (!existing.levelName || !existing.orderNumber) {
      await db.update(grades).set({
        levelName: grade.levelName,
        orderNumber: grade.orderNumber,
      }).where(eq(grades.id, existing.id))
    }
  }

  // Seed Academic Areas
  const existingAreas = await db.select().from(academicAreas).where(eq(academicAreas.tenantId, tenantId))
  for (const area of AREA_DEFINITIONS) {
    if (!existingAreas.find((item) => item.code === area.code)) {
      await db.insert(academicAreas).values({
        tenantId,
        ...area,
        isActive: true,
      })
    }
  }

  const seededAreas = await db.select().from(academicAreas).where(eq(academicAreas.tenantId, tenantId))

  // Seed Grading Scales
  const existingScales = await db.select().from(gradingScales).where(eq(gradingScales.tenantId, tenantId))
  let activeScale = existingScales.find((item) => item.isActive)
  
  if (!activeScale) {
    const [createdScale] = await db.insert(gradingScales).values({
      tenantId,
      name: 'Escala Institucional Estándar (1.0 - 5.0)',
      minValue: '1.00',
      maxValue: '5.00',
      passingValue: '3.00',
      decimalPlaces: 1,
      scaleType: 'numeric',
      isActive: true,
    }).returning()
    activeScale = createdScale
  }
  
  // Seed Performance Ranges
  if (activeScale) {
    const existingRanges = await db.select().from(performanceRanges).where(and(eq(performanceRanges.tenantId, tenantId), eq(performanceRanges.gradingScaleId, activeScale.id)))
    const rangeDefinitions = [
      { nationalLevel: 'SUPERIOR', institutionalLabel: 'Superior', minScore: '4.60', maxScore: '5.00', isPassing: true, color: '#7c3aed', description: 'Desempeño excepcional en el área.' },
      { nationalLevel: 'HIGH', institutionalLabel: 'Alto', minScore: '4.00', maxScore: '4.50', isPassing: true, color: '#16a34a', description: 'Desempeño satisfactorio en el área.' },
      { nationalLevel: 'BASIC', institutionalLabel: 'Básico', minScore: '3.00', maxScore: '3.90', isPassing: true, color: '#d97706', description: 'Logra los objetivos mínimos propuestos.' },
      { nationalLevel: 'LOW', institutionalLabel: 'Bajo', minScore: '1.00', maxScore: '2.90', isPassing: false, color: '#dc2626', description: 'No supera los desempeños mínimos del área.' },
    ]
    
    for (const range of rangeDefinitions) {
      if (!existingRanges.find((item) => item.nationalLevel === range.nationalLevel)) {
        await db.insert(performanceRanges).values({
          tenantId,
          gradingScaleId: activeScale.id,
          ...range,
        })
      }
    }
  }

  // Seed Subjects
  const mathArea = seededAreas.find((item) => item.code === 'MAT')
  const humArea = seededAreas.find((item) => item.code === 'HUM')
  const natArea = seededAreas.find((item) => item.code === 'NAT')
  const socArea = seededAreas.find((item) => item.code === 'SOC')
  const tecArea = seededAreas.find((item) => item.code === 'TEC')
  const artArea = seededAreas.find((item) => item.code === 'ART')
  const efiArea = seededAreas.find((item) => item.code === 'EFI')
  const relArea = seededAreas.find((item) => item.code === 'REL')
  const etiArea = seededAreas.find((item) => item.code === 'ETI')
  const filArea = seededAreas.find((item) => item.code === 'FIL')
  const areaIdByCode: Record<string, string | undefined> = {
    MAT: mathArea?.id,
    HUM: humArea?.id,
    NAT: natArea?.id,
    SOC: socArea?.id,
    TEC: tecArea?.id,
    ART: artArea?.id,
    EFI: efiArea?.id,
    REL: relArea?.id,
    ETI: etiArea?.id,
    FIL: filArea?.id,
  }
  
  const existingSubjects = await db.select().from(subjects).where(eq(subjects.tenantId, tenantId))
  for (const sub of subjectDefinitions) {
    if (!existingSubjects.find((item) => item.code === sub.code)) {
      await db.insert(subjects).values({
        tenantId,
        name: sub.name,
        code: sub.code,
        academicAreaId: areaIdByCode[sub.areaCode],
        area: areaIdByCode[sub.areaCode] ? seededAreas.find((a) => a.id === areaIdByCode[sub.areaCode])?.name : null,
      })
    }
  }

  const years = await db.select().from(academicYears).where(eq(academicYears.tenantId, tenantId))
  if (!years.find((item) => item.year === 2026)) {
    await db.insert(academicYears).values({
      tenantId,
      name: 'Año lectivo 2026',
      year: 2026,
      startsOn: '2026-01-20',
      endsOn: '2026-11-30',
      isActive: true,
    })
  }

  const refreshedYears = await db.select().from(academicYears).where(eq(academicYears.tenantId, tenantId))
  const currentYear = refreshedYears.find((item) => item.year === 2026)

  if (currentYear) {
    const refreshedGrades = await db.select().from(grades).where(eq(grades.tenantId, tenantId))
    const existingGroups = await db.select().from(groups).where(eq(groups.tenantId, tenantId))

    for (const grade of refreshedGrades.sort((left, right) => (left.orderNumber ?? 0) - (right.orderNumber ?? 0))) {
      for (const groupName of GROUP_SUFFIXES) {
        if (!existingGroups.find((item) => item.gradeId === grade.id && item.academicYearId === currentYear.id && item.name === groupName)) {
          await db.insert(groups).values({
            tenantId,
            academicYearId: currentYear.id,
            gradeId: grade.id,
            name: groupName,
            capacity: 35,
          })
        }
      }
    }

    const periods = await db
      .select()
      .from(academicPeriods)
      .where(and(eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.academicYearId, currentYear.id)))

    for (const period of PERIOD_DEFINITIONS) {
      if (!periods.find((item) => item.code === period.code)) {
        await db.insert(academicPeriods).values({
          tenantId,
          academicYearId: currentYear.id,
          name: period.name,
          code: period.code,
          startsOn: period.startsOn,
          endsOn: period.endsOn,
          weight: period.weight,
          status: period.status,
        })
      }
    }

    const existingTemplates = await db
      .select()
      .from(formTemplates)
      .where(and(eq(formTemplates.tenantId, tenantId), eq(formTemplates.academicYearId, currentYear.id)))

    let enrollmentTemplate = existingTemplates.find((item) => item.code === 'enrollment-2026')

    if (!enrollmentTemplate) {
      const [createdTemplate] = await db
        .insert(formTemplates)
        .values({
          tenantId,
          academicYearId: currentYear.id,
          code: 'enrollment-2026',
          name: 'Formulario de inscripción y matrícula 2026',
          description: 'Formulario híbrido demo para inscripción escolar.',
          module: 'enrollment',
          entityType: 'enrollment',
          startsOn: '2025-10-01',
          endsOn: '2026-02-15',
          status: 'active',
          settings: {
            autosave: true,
            progressBar: true,
            allowGuardianDraft: true,
          },
        })
        .returning()

      enrollmentTemplate = createdTemplate
    }

    if (enrollmentTemplate) {
      const existingVersions = await db
        .select()
        .from(formTemplateVersions)
        .where(and(eq(formTemplateVersions.tenantId, tenantId), eq(formTemplateVersions.formTemplateId, enrollmentTemplate.id)))

      let version = existingVersions.find((item) => item.versionNumber === 1)

      if (!version) {
        const [createdVersion] = await db
          .insert(formTemplateVersions)
          .values({
            tenantId,
            formTemplateId: enrollmentTemplate.id,
            versionNumber: 1,
            status: 'published',
            publishedAt: new Date(),
            schemaSnapshot: {
              version: 1,
              sections: ['health', 'socioeconomic', 'authorizations'],
            },
            notes: 'Versión demo inicial.',
          })
          .returning()

        version = createdVersion
      }

      if (version) {
        const existingSections = await db
          .select()
          .from(formSections)
          .where(and(eq(formSections.tenantId, tenantId), eq(formSections.formTemplateVersionId, version.id)))

        const sectionDefinitions = [
          { code: 'health', title: 'Información médica', sortOrder: 1 },
          { code: 'socioeconomic', title: 'Información socioeconómica', sortOrder: 2 },
          { code: 'authorizations', title: 'Autorizaciones', sortOrder: 3 },
        ]

        for (const section of sectionDefinitions) {
          if (!existingSections.find((item) => item.code === section.code)) {
            await db.insert(formSections).values({
              tenantId,
              formTemplateVersionId: version.id,
              code: section.code,
              title: section.title,
              sortOrder: section.sortOrder,
              isCollapsible: true,
            })
          }
        }

        const sections = await db
          .select()
          .from(formSections)
          .where(and(eq(formSections.tenantId, tenantId), eq(formSections.formTemplateVersionId, version.id)))

        const byCode = (code: string) => sections.find((section) => section.code === code)
        const health = byCode('health')
        const socioeconomic = byCode('socioeconomic')
        const authorizations = byCode('authorizations')

        const existingFields = await db
          .select()
          .from(formFields)
          .where(and(eq(formFields.tenantId, tenantId), eq(formFields.formTemplateVersionId, version.id)))

        const fieldDefinitions = [
          {
            section: health,
            code: 'eps',
            label: 'EPS',
            fieldType: 'text',
            isRequired: true,
            isSearchable: true,
            isReportable: true,
            sortOrder: 1,
          },
          {
            section: health,
            code: 'allergies',
            label: 'Alergias',
            fieldType: 'textarea',
            isRequired: false,
            isSearchable: true,
            isReportable: true,
            sortOrder: 2,
          },
          {
            section: health,
            code: 'vaccines',
            label: 'Vacunas al día',
            fieldType: 'checkbox',
            isRequired: true,
            isReportable: true,
            sortOrder: 3,
          },
          {
            section: socioeconomic,
            code: 'sisben_group',
            label: 'Grupo SISBEN',
            fieldType: 'select',
            isRequired: false,
            isSearchable: true,
            isReportable: true,
            sortOrder: 1,
            options: [
              { label: 'A', value: 'A' },
              { label: 'B', value: 'B' },
              { label: 'C', value: 'C' },
              { label: 'D', value: 'D' },
              { label: 'No aplica', value: 'none' },
            ],
          },
          {
            section: socioeconomic,
            code: 'stratum',
            label: 'Estrato',
            fieldType: 'number',
            isRequired: true,
            isSearchable: true,
            isReportable: true,
            sortOrder: 2,
            validationRules: { min: 0, max: 6 },
          },
          {
            section: authorizations,
            code: 'image_authorization',
            label: 'Autorizo uso de imagen institucional',
            fieldType: 'checkbox',
            isRequired: true,
            isReportable: true,
            sortOrder: 1,
          },
        ]

        for (const field of fieldDefinitions) {
          if (field.section && !existingFields.find((item) => item.code === field.code)) {
            await db.insert(formFields).values({
              tenantId,
              formTemplateVersionId: version.id,
              formSectionId: field.section.id,
              code: field.code,
              label: field.label,
              fieldType: field.fieldType,
              sortOrder: field.sortOrder,
              isRequired: field.isRequired,
              isSearchable: field.isSearchable ?? false,
              isReportable: field.isReportable ?? false,
              options: field.options ?? [],
              validationRules: field.validationRules ?? {},
            })
          }
        }

        const existingDocuments = await db
          .select()
          .from(requiredDocuments)
          .where(and(eq(requiredDocuments.tenantId, tenantId), eq(requiredDocuments.formTemplateVersionId, version.id)))

        for (const document of [
          { code: 'student_document', name: 'Documento de identidad del estudiante', sortOrder: 1 },
          { code: 'guardian_document', name: 'Documento de identidad del acudiente', sortOrder: 2 },
          { code: 'eps_certificate', name: 'Certificado de afiliación EPS', sortOrder: 3 },
        ]) {
          if (!existingDocuments.find((item) => item.code === document.code)) {
            await db.insert(requiredDocuments).values({
              tenantId,
              formTemplateVersionId: version.id,
              code: document.code,
              name: document.name,
              sortOrder: document.sortOrder,
              isRequired: true,
              acceptedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
              maxFileSizeMb: 10,
            })
          }
        }
      }
    }

    const refreshedSubjects = await db.select().from(subjects).where(eq(subjects.tenantId, tenantId))
    const refreshedGroups = await db.select().from(groups).where(and(eq(groups.tenantId, tenantId), eq(groups.academicYearId, currentYear.id)))
    const refreshedPeriods = await db.select().from(academicPeriods).where(and(eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.academicYearId, currentYear.id)))

    const subjectByCode = Object.fromEntries(refreshedSubjects.map((subject) => [subject.code, subject]))
    const gradeByName = Object.fromEntries(refreshedGrades.map((grade) => [grade.name, grade]))

    const existingTeachers = await db.select().from(teachers).where(eq(teachers.tenantId, tenantId))
    const specialtyList = [...new Set(subjectDefinitions.map((subject) => subject.specialty))]
    const teacherDefinitions = teacherNamePool.slice(0, specialtyList.length + 10).map(([firstName, lastName], index) => ({
      fullName: `${firstName} ${lastName}`,
      email: safeEmail(`${firstName}.${lastName}`),
      phone: `300555${String(index + 1).padStart(4, '0')}`,
      specialty: specialtyList[index % specialtyList.length],
      maxWeeklyHours: 48,
    }))

    for (const teacher of teacherDefinitions) {
      if (!existingTeachers.find((item) => item.email === teacher.email)) {
        await db.insert(teachers).values({
          tenantId,
          fullName: teacher.fullName,
          email: teacher.email,
          phone: teacher.phone,
          specialty: teacher.specialty,
          maxWeeklyHours: teacher.maxWeeklyHours,
          status: 'active',
        })
      }
    }

    const refreshedTeachers = await db.select().from(teachers).where(eq(teachers.tenantId, tenantId))
    const teachersBySpecialty = refreshedTeachers.reduce<Record<string, typeof refreshedTeachers>>((acc, teacher) => {
      const key = teacher.specialty || 'General'
      const bucket = acc[key] ?? (acc[key] = [])
      bucket.push(teacher)
      return acc
    }, {})

    const existingGradeSubjects = await db.select().from(gradeSubjects).where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.academicYearId, currentYear.id)))
    for (const grade of refreshedGrades) {
      const levelName = grade.levelName as 'preschool' | 'primary' | 'secondary' | 'middle' | null
      if (!levelName) continue

      for (const subjectDefinition of subjectDefinitions) {
        if (!subjectDefinition.levels.includes(levelName)) continue
        const subject = subjectByCode[subjectDefinition.code]
        if (!subject) continue
        if (!existingGradeSubjects.find((item) => item.gradeId === grade.id && item.subjectId === subject.id)) {
          await db.insert(gradeSubjects).values({
            tenantId,
            academicYearId: currentYear.id,
            gradeId: grade.id,
            subjectId: subject.id,
            weeklyHours: subjectDefinition.weeklyHoursByLevel[levelName] ?? 1,
          })
        }
      }
    }

    const refreshedGradeSubjects = await db.select().from(gradeSubjects).where(and(eq(gradeSubjects.tenantId, tenantId), eq(gradeSubjects.academicYearId, currentYear.id)))
    const existingCourseSubjects = await db.select().from(courseSubjects).where(and(eq(courseSubjects.tenantId, tenantId), eq(courseSubjects.academicYearId, currentYear.id)))
    let assignmentCounter = 0
    for (const group of refreshedGroups) {
      const grade = refreshedGrades.find((item) => item.id === group.gradeId)
      const levelName = grade?.levelName as 'preschool' | 'primary' | 'secondary' | 'middle' | undefined
      if (!grade || !levelName) continue

      const groupGradeSubjects = refreshedGradeSubjects.filter((item) => item.gradeId === grade.id)
      for (const assignment of groupGradeSubjects) {
        if (existingCourseSubjects.find((item) => item.groupId === group.id && item.subjectId === assignment.subjectId)) continue

        const subject = refreshedSubjects.find((item) => item.id === assignment.subjectId)
        const subjectSeed = subjectDefinitions.find((item) => item.code === subject?.code)
        const specialtyPool = subjectSeed ? teachersBySpecialty[subjectSeed.specialty] ?? [] : []
        const fallbackPool = refreshedTeachers
        const teacherPool = specialtyPool.length ? specialtyPool : fallbackPool
        const teacher = teacherPool[assignmentCounter % teacherPool.length] ?? null
        assignmentCounter += 1

        await db.insert(courseSubjects).values({
          tenantId,
          academicYearId: currentYear.id,
          groupId: group.id,
          subjectId: assignment.subjectId,
          weeklyHours: assignment.weeklyHours,
          teacherId: teacher?.id ?? null,
        })
      }
    }

    const refreshedCourseSubjects = await db.select().from(courseSubjects).where(and(eq(courseSubjects.tenantId, tenantId), eq(courseSubjects.academicYearId, currentYear.id)))
    const existingResponsibilities = await db.select().from(teacherResponsibilities).where(and(eq(teacherResponsibilities.tenantId, tenantId), eq(teacherResponsibilities.academicYearId, currentYear.id)))
    for (const group of refreshedGroups) {
      if (existingResponsibilities.find((item) => item.groupId === group.id && item.responsibilityType === 'group_director')) continue
      const firstAssignment = refreshedCourseSubjects.find((item) => item.groupId === group.id && item.teacherId)
      if (!firstAssignment?.teacherId) continue
      await db.insert(teacherResponsibilities).values({
        tenantId,
        academicYearId: currentYear.id,
        teacherId: firstAssignment.teacherId,
        responsibilityType: 'group_director',
        groupId: group.id,
        title: `Director de grupo ${gradeDefinitions.find((item) => item.name === refreshedGrades.find((grade) => grade.id === group.gradeId)?.name)?.name ?? ''} ${group.name}`.trim(),
      })
    }

    const existingJourneys = await db.select().from(academicYearJourneys).where(and(eq(academicYearJourneys.tenantId, tenantId), eq(academicYearJourneys.academicYearId, currentYear.id)))
    const journeyDefinitions = [
      { code: 'PRE-MAN', name: 'Jornada mañana preescolar', targetLevelName: 'preschool', startsAt: '07:00', endsAt: '12:00' },
      { code: 'PRI-MAN', name: 'Jornada mañana primaria', targetLevelName: 'primary', startsAt: '06:30', endsAt: '12:30' },
      { code: 'SEC-MAN', name: 'Jornada mañana secundaria', targetLevelName: 'secondary', startsAt: '06:20', endsAt: '13:00' },
      { code: 'MED-MAN', name: 'Jornada mañana media', targetLevelName: 'middle', startsAt: '06:20', endsAt: '13:20' },
    ] as const

    for (const journey of journeyDefinitions) {
      if (!existingJourneys.find((item) => item.code === journey.code)) {
        await db.insert(academicYearJourneys).values({
          tenantId,
          academicYearId: currentYear.id,
          name: journey.name,
          code: journey.code,
          targetLevelName: journey.targetLevelName,
          startsAt: journey.startsAt,
          endsAt: journey.endsAt,
          isActive: true,
        })
      }
    }

    const refreshedJourneys = await db.select().from(academicYearJourneys).where(and(eq(academicYearJourneys.tenantId, tenantId), eq(academicYearJourneys.academicYearId, currentYear.id)))
    const existingSlots = await db.select().from(academicYearJourneySlots).where(eq(academicYearJourneySlots.tenantId, tenantId))
    const dayList = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
    const journeySlotTemplates: Record<string, Array<{ slotOrder: number; startsAt: string; endsAt: string; slotType: string; label: string }>> = {
      'PRE-MAN': [
        { slotOrder: 1, startsAt: '07:00', endsAt: '07:45', slotType: 'class', label: 'Bloque 1' },
        { slotOrder: 2, startsAt: '07:45', endsAt: '08:30', slotType: 'class', label: 'Bloque 2' },
        { slotOrder: 3, startsAt: '08:30', endsAt: '09:00', slotType: 'break', label: 'Descanso' },
        { slotOrder: 4, startsAt: '09:00', endsAt: '09:45', slotType: 'class', label: 'Bloque 3' },
        { slotOrder: 5, startsAt: '09:45', endsAt: '10:30', slotType: 'class', label: 'Bloque 4' },
        { slotOrder: 6, startsAt: '10:30', endsAt: '11:15', slotType: 'class', label: 'Bloque 5' },
      ],
      'PRI-MAN': [
        { slotOrder: 1, startsAt: '06:30', endsAt: '07:20', slotType: 'class', label: 'Bloque 1' },
        { slotOrder: 2, startsAt: '07:20', endsAt: '08:10', slotType: 'class', label: 'Bloque 2' },
        { slotOrder: 3, startsAt: '08:10', endsAt: '08:40', slotType: 'break', label: 'Descanso' },
        { slotOrder: 4, startsAt: '08:40', endsAt: '09:30', slotType: 'class', label: 'Bloque 3' },
        { slotOrder: 5, startsAt: '09:30', endsAt: '10:20', slotType: 'class', label: 'Bloque 4' },
        { slotOrder: 6, startsAt: '10:20', endsAt: '11:10', slotType: 'class', label: 'Bloque 5' },
        { slotOrder: 7, startsAt: '11:10', endsAt: '12:00', slotType: 'class', label: 'Bloque 6' },
      ],
      'SEC-MAN': [
        { slotOrder: 1, startsAt: '06:20', endsAt: '07:10', slotType: 'class', label: 'Bloque 1' },
        { slotOrder: 2, startsAt: '07:10', endsAt: '08:00', slotType: 'class', label: 'Bloque 2' },
        { slotOrder: 3, startsAt: '08:00', endsAt: '08:30', slotType: 'break', label: 'Descanso' },
        { slotOrder: 4, startsAt: '08:30', endsAt: '09:20', slotType: 'class', label: 'Bloque 3' },
        { slotOrder: 5, startsAt: '09:20', endsAt: '10:10', slotType: 'class', label: 'Bloque 4' },
        { slotOrder: 6, startsAt: '10:10', endsAt: '11:00', slotType: 'class', label: 'Bloque 5' },
        { slotOrder: 7, startsAt: '11:00', endsAt: '11:50', slotType: 'class', label: 'Bloque 6' },
        { slotOrder: 8, startsAt: '11:50', endsAt: '12:40', slotType: 'class', label: 'Bloque 7' },
      ],
      'MED-MAN': [
        { slotOrder: 1, startsAt: '06:20', endsAt: '07:15', slotType: 'class', label: 'Bloque 1' },
        { slotOrder: 2, startsAt: '07:15', endsAt: '08:10', slotType: 'class', label: 'Bloque 2' },
        { slotOrder: 3, startsAt: '08:10', endsAt: '08:40', slotType: 'break', label: 'Descanso' },
        { slotOrder: 4, startsAt: '08:40', endsAt: '09:35', slotType: 'class', label: 'Bloque 3' },
        { slotOrder: 5, startsAt: '09:35', endsAt: '10:30', slotType: 'class', label: 'Bloque 4' },
        { slotOrder: 6, startsAt: '10:30', endsAt: '11:25', slotType: 'class', label: 'Bloque 5' },
        { slotOrder: 7, startsAt: '11:25', endsAt: '12:20', slotType: 'class', label: 'Bloque 6' },
        { slotOrder: 8, startsAt: '12:20', endsAt: '13:15', slotType: 'class', label: 'Bloque 7' },
      ],
    }

    for (const journey of refreshedJourneys) {
      const template = journeySlotTemplates[journey.code]
      if (!template) continue
      for (const dayOfWeek of dayList) {
        for (const slot of template) {
          if (existingSlots.find((item) => item.journeyId === journey.id && item.dayOfWeek === dayOfWeek && item.slotOrder === slot.slotOrder)) continue
          await db.insert(academicYearJourneySlots).values({
            tenantId,
            journeyId: journey.id,
            dayOfWeek,
            slotOrder: slot.slotOrder,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            slotType: slot.slotType,
            label: slot.label,
          })
        }
      }
    }

    const existingGroupJourneyOptions = await db.select().from(groupJourneyOptions).where(and(eq(groupJourneyOptions.tenantId, tenantId), eq(groupJourneyOptions.academicYearId, currentYear.id)))
    const journeyByLevel = Object.fromEntries(refreshedJourneys.map((journey) => [journey.targetLevelName || 'all', journey]))
    for (const group of refreshedGroups) {
      const grade = refreshedGrades.find((item) => item.id === group.gradeId)
      const journey = grade?.levelName ? journeyByLevel[grade.levelName] : null
      if (!journey) continue
      if (!existingGroupJourneyOptions.find((item) => item.groupId === group.id && item.journeyId === journey.id)) {
        await db.insert(groupJourneyOptions).values({
          tenantId,
          academicYearId: currentYear.id,
          groupId: group.id,
          journeyId: journey.id,
          priority: 0,
          isPreferred: true,
        })
      }
    }

    const existingCompetencies = await db.select().from(competencies).where(eq(competencies.tenantId, tenantId))
    for (const grade of refreshedGrades) {
      const gradeLevelName = grade.levelName || 'primary'
      for (const subjectAssignment of refreshedGradeSubjects.filter((item) => item.gradeId === grade.id)) {
        const subject = refreshedSubjects.find((item) => item.id === subjectAssignment.subjectId)
        const subjectSeed = subjectDefinitions.find((item) => item.code === subject?.code)
        if (!subject || !subjectSeed) continue
        const area = seededAreas.find((item) => item.id === areaIdByCode[subjectSeed.areaCode])
        if (!area) continue
        const competencyName = `${subject.name}: ${competencyByAreaCode[subjectSeed.areaCode]}`
        if (!existingCompetencies.find((item) => item.gradeId === grade.id && item.subjectId === subject.id && item.name === competencyName)) {
          await db.insert(competencies).values({
            tenantId,
            academicAreaId: area.id,
            subjectId: subject.id,
            gradeId: grade.id,
            name: competencyName,
            description: `Competencia sugerida para ${subject.name} en ${grade.name}.`,
            isActive: true,
            orderNumber: 1,
          })
        }
      }
    }

    const refreshedCompetencies = await db.select().from(competencies).where(eq(competencies.tenantId, tenantId))
    const existingAchievements = await db.select().from(learningAchievements).where(and(eq(learningAchievements.tenantId, tenantId), eq(learningAchievements.academicYearId, currentYear.id)))
    const existingIndicators = await db.select().from(achievementIndicators).where(eq(achievementIndicators.tenantId, tenantId))
    for (const period of refreshedPeriods) {
      const periodIndex = PERIOD_DEFINITIONS.findIndex((item) => item.code === period.code) + 1
      for (const grade of refreshedGrades) {
        for (const subjectAssignment of refreshedGradeSubjects.filter((item) => item.gradeId === grade.id)) {
          const subject = refreshedSubjects.find((item) => item.id === subjectAssignment.subjectId)
          if (!subject) continue
          const competency = refreshedCompetencies.find((item) => item.gradeId === grade.id && item.subjectId === subject.id)
          const achievementCode = `${period.code}-${subject.code}-${grade.level}`
          let achievement = existingAchievements.find((item) =>
            item.academicPeriodId === period.id &&
            item.gradeId === grade.id &&
            item.subjectId === subject.id &&
            item.code === achievementCode,
          )

          if (!achievement) {
            const [createdAchievement] = await db.insert(learningAchievements).values({
              tenantId,
              academicYearId: currentYear.id,
              academicPeriodId: period.id,
              gradeId: grade.id,
              subjectId: subject.id,
              code: achievementCode,
              title: `Logro ${periodIndex} de ${subject.name}`,
              description: `Desarrolla desempeños esperados de ${subject.name.toLowerCase()} para ${grade.name.toLowerCase()} durante el ${period.name.toLowerCase()}, en línea con orientaciones institucionales y estándares sugeridos.`,
              weight: 100,
              competencyId: competency?.id,
              orderNumber: periodIndex,
              expectedPerformance: expectedPerformanceByLevel[grade.levelName || 'primary'] ?? 'HIGH',
            }).returning()
            if (!createdAchievement) continue
            achievement = createdAchievement
            existingAchievements.push(createdAchievement)
          }

          if (achievement && !existingIndicators.find((item) => item.achievementId === achievement.id)) {
            await db.insert(achievementIndicators).values([
              {
                tenantId,
                achievementId: achievement.id,
                description: `Reconoce y aplica aprendizajes clave de ${subject.name.toLowerCase()} en situaciones propias del ${period.name.toLowerCase()}.`,
                orderNumber: 1,
                isActive: true,
              },
              {
                tenantId,
                achievementId: achievement.id,
                description: `Comunica avances, resuelve actividades y evidencia progreso autónomo en ${subject.name.toLowerCase()}.`,
                orderNumber: 2,
                isActive: true,
              },
            ])
          }
        }
      }
    }

    const existingStudents = await db.select().from(students).where(eq(students.tenantId, tenantId))
    const existingGuardians = await db.select().from(guardians).where(eq(guardians.tenantId, tenantId))
    let studentSequence = existingStudents.length + 1
    for (const group of refreshedGroups) {
      const grade = refreshedGrades.find((item) => item.id === group.gradeId)
      if (!grade) continue
      const groupOrdinal = GROUP_SUFFIXES.findIndex((suffix) => suffix === group.name) + 1
      for (let index = 0; index < 4; index += 1) {
        const firstName = studentFirstNames[(studentSequence + index) % studentFirstNames.length] ?? `Estudiante${studentSequence + index}`
        const lastName = studentLastNames[(studentSequence + index * 2) % studentLastNames.length] ?? 'Demo'
        const documentNumber = `10${String(grade.level + 20).padStart(2, '0')}${String(groupOrdinal).padStart(2, '0')}${String(index + 1).padStart(3, '0')}`
        let student = existingStudents.find((item) => item.documentNumber === documentNumber)
        if (!student) {
          const birthYear = grade.level <= 0 ? '2020' : `201${Math.max(0, 9 - grade.level)}`
          const [createdStudent] = await db.insert(students).values({
            tenantId,
            firstName,
            middleName: null,
            lastName,
            documentType: grade.level <= 5 ? 'TI' : 'CC',
            documentNumber,
            birthDate: `${birthYear}-${String((index % 8) + 1).padStart(2, '0')}-${String(10 + index).padStart(2, '0')}`,
            gender: index % 2 === 0 ? 'F' : 'M',
            bloodType: ['O+', 'A+', 'B+', 'AB+'][index % 4] ?? null,
            status: 'active',
          }).returning()
          if (!createdStudent) continue
          student = createdStudent
          existingStudents.push(createdStudent)
        }

        const guardianFullName = `Acudiente ${firstName} ${guardianLastNames[(studentSequence + index) % guardianLastNames.length] ?? 'Demo'}`
        const guardianDocument = `52${String(grade.level + 30).padStart(2, '0')}${String(groupOrdinal).padStart(2, '0')}${String(index + 1).padStart(4, '0')}`
        let guardian = existingGuardians.find((item) => item.documentNumber === guardianDocument)
        if (!guardian) {
          const guardianNameParts = guardianFullName.split(' ')
          const [createdGuardian] = await db.insert(guardians).values({
            tenantId,
            fullName: guardianFullName,
            firstName: guardianNameParts[0] ?? 'Acudiente',
            lastName: guardianNameParts.slice(1).join(' ') || 'Demo',
            documentType: 'CC',
            documentNumber: guardianDocument,
            email: safeEmail(guardianFullName),
            phone: `310444${String(studentSequence + index).padStart(4, '0')}`,
            relationship: 'Madre/Padre',
          }).returning()
          if (!createdGuardian) continue
          guardian = createdGuardian
          existingGuardians.push(createdGuardian)
        }

        const existingLink = await db.select().from(studentGuardians).where(and(eq(studentGuardians.tenantId, tenantId), eq(studentGuardians.studentId, student.id), eq(studentGuardians.guardianId, guardian.id))).limit(1)
        if (!existingLink.length) {
          await db.insert(studentGuardians).values({
            tenantId,
            studentId: student.id,
            guardianId: guardian.id,
            isPrimary: true,
          })
        }

        const existingEnrollment = await db.select().from(enrollments).where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.studentId, student.id), eq(enrollments.academicYearId, currentYear.id), eq(enrollments.isDeleted, false))).limit(1)
        if (!existingEnrollment.length) {
          await db.insert(enrollments).values({
            tenantId,
            studentId: student.id,
            academicYearId: currentYear.id,
            gradeId: grade.id,
            groupId: group.id,
            enrollmentType: 'new',
            enrollmentStatus: 'active',
            promotionStatus: grade.level <= 0 ? 'conditional' : 'promoted',
            status: 'active',
          })
        }
      }
      studentSequence += 4
    }

    const currentEnrollments = await db.select().from(enrollments).where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.academicYearId, currentYear.id), eq(enrollments.isDeleted, false)))
    const existingActivities = await db.select().from(evaluationActivities).where(and(eq(evaluationActivities.tenantId, tenantId), eq(evaluationActivities.academicYearId, currentYear.id)))
    const existingActivityScores = await db.select().from(activityScores).where(eq(activityScores.tenantId, tenantId))
    const existingGradeRecords = await db.select().from(gradeRecords).where(and(eq(gradeRecords.tenantId, tenantId), eq(gradeRecords.academicYearId, currentYear.id)))
    const existingAttendance = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.tenantId, tenantId), eq(attendanceRecords.academicYearId, currentYear.id)))
    const existingAcademicObservations = await db.select().from(academicObservations).where(and(eq(academicObservations.tenantId, tenantId), eq(academicObservations.academicYearId, currentYear.id)))
    const existingSupportStrategies = await db.select().from(supportStrategies).where(and(eq(supportStrategies.tenantId, tenantId), eq(supportStrategies.academicYearId, currentYear.id)))

    for (const period of refreshedPeriods) {
      for (const assignment of refreshedCourseSubjects) {
        const groupStudents = currentEnrollments.filter((enrollment) => enrollment.groupId === assignment.groupId)
        if (!groupStudents.length) continue

        const subject = refreshedSubjects.find((item) => item.id === assignment.subjectId)
        const group = refreshedGroups.find((item) => item.id === assignment.groupId)
        const grade = refreshedGrades.find((item) => item.id === group?.gradeId)
        const achievement = existingAchievements.find((item) =>
          item.academicPeriodId === period.id &&
          item.gradeId === grade?.id &&
          item.subjectId === assignment.subjectId,
        )
        if (!subject || !group || !grade || !achievement) continue

        const activityName = `Actividad integradora ${period.code} - ${subject.name}`
        let activity = existingActivities.find((item) =>
          item.academicPeriodId === period.id &&
          item.groupId === group.id &&
          item.subjectId === assignment.subjectId &&
          item.name === activityName,
        )

        if (!activity) {
          const [createdActivity] = await db.insert(evaluationActivities).values({
            tenantId,
            academicYearId: currentYear.id,
            academicPeriodId: period.id,
            groupId: group.id,
            subjectId: assignment.subjectId,
            achievementId: achievement.id,
            teacherId: assignment.teacherId,
            name: activityName,
            description: `Actividad sugerida para valorar el logro del ${period.name.toLowerCase()} en ${subject.name.toLowerCase()}.`,
            activityType: 'workshop',
            weightPercentage: '100.00',
            maxScore: '5.00',
            dueDate: period.endsOn,
            isPublished: true,
          }).returning()
          if (!createdActivity) continue
          activity = createdActivity
          existingActivities.push(createdActivity)
        }

        for (const [studentIndex, enrollment] of groupStudents.entries()) {
          const periodIndex = refreshedPeriods.findIndex((item) => item.id === period.id)
          const assignmentIndex = refreshedCourseSubjects.findIndex((item) => item.id === assignment.id)
          const numericScore = scoreFor(studentIndex, periodIndex, assignmentIndex)

          if (!existingActivityScores.find((item) => item.activityId === activity.id && item.studentId === enrollment.studentId)) {
            await db.insert(activityScores).values({
              tenantId,
              activityId: activity.id,
              studentId: enrollment.studentId,
              score: numericScore,
              performanceLevel: Number(numericScore) >= 4.6 ? 'SUPERIOR' : Number(numericScore) >= 4 ? 'HIGH' : Number(numericScore) >= 3 ? 'BASIC' : 'LOW',
              observations: Number(numericScore) >= 3 ? 'Cumple con lo esperado para el periodo.' : 'Requiere refuerzo en algunos desempeños clave.',
              submittedAt: new Date(),
              gradedAt: new Date(),
            })
          }

          if (!existingGradeRecords.find((item) => item.studentId === enrollment.studentId && item.subjectId === assignment.subjectId && item.academicPeriodId === period.id)) {
            await db.insert(gradeRecords).values({
              tenantId,
              studentId: enrollment.studentId,
              subjectId: assignment.subjectId,
              academicPeriodId: period.id,
              score: numericScore,
              maxScore: '5.00',
              notes: Number(numericScore) >= 3 ? 'Desempeño dentro del rango esperado.' : 'Necesita seguimiento y plan de apoyo.',
              groupId: group.id,
              academicYearId: currentYear.id,
            })
          }

          if (!existingAttendance.find((item) => item.studentId === enrollment.studentId && item.subjectId === assignment.subjectId && item.academicPeriodId === period.id)) {
            await db.insert(attendanceRecords).values({
              tenantId,
              studentId: enrollment.studentId,
              groupId: group.id,
              subjectId: assignment.subjectId,
              attendanceDate: period.startsOn,
              status: studentIndex % 8 === 0 ? 'late' : 'present',
              notes: studentIndex % 8 === 0 ? 'Llegó tarde a la primera hora.' : null,
              academicYearId: currentYear.id,
              academicPeriodId: period.id,
              justified: false,
            })
          }

          if (Number(numericScore) < 3) {
            if (!existingAcademicObservations.find((item) => item.studentId === enrollment.studentId && item.subjectId === assignment.subjectId && item.academicPeriodId === period.id)) {
              await db.insert(academicObservations).values({
                tenantId,
                academicYearId: currentYear.id,
                academicPeriodId: period.id,
                studentId: enrollment.studentId,
                subjectId: assignment.subjectId,
                achievementId: achievement.id,
                observationType: 'warning',
                text: `Presenta dificultades en ${subject.name.toLowerCase()} y necesita acompañamiento focalizado durante ${period.name.toLowerCase()}.`,
              })
            }

            if (!existingSupportStrategies.find((item) => item.studentId === enrollment.studentId && item.subjectId === assignment.subjectId && item.academicPeriodId === period.id)) {
              await db.insert(supportStrategies).values({
                tenantId,
                academicYearId: currentYear.id,
                academicPeriodId: period.id,
                studentId: enrollment.studentId,
                subjectId: assignment.subjectId,
                achievementId: achievement.id,
                teacherId: assignment.teacherId,
                description: `Plan de apoyo sugerido para fortalecer ${subject.name.toLowerCase()} con actividades de recuperación guiadas.`,
                dueDate: period.endsOn,
                status: 'pending',
              })
            }
          }
        }
      }
    }
  }

  console.log('Seed ejecutado correctamente', {
    tenantId,
    permissions: permissionCatalog.length,
  })

  const existingConsents = await db.select().from(consentDocuments).where(eq(consentDocuments.tenantId, tenantId))
  const defaultConsentDocuments = [
    {
      code: 'privacy_notice',
      name: 'Aviso de privacidad',
      description: 'Aviso de privacidad para familias, estudiantes y colaboradores, conforme a la Ley 1581 de 2012.',
      documentType: 'privacy_notice',
      version: '2026-1',
      body: 'AVISO DE PRIVACIDAD\n\nEl colegio trata los datos personales de estudiantes, acudientes y colaboradores con la finalidad de prestar el servicio educativo, garantizar la seguridad escolar, cumplir obligaciones legales y mantener comunicación con las familias.',
    },
    {
      code: 'data_treatment_authorization',
      name: 'Autorización de tratamiento de datos personales',
      description: 'Autorización expresa para el tratamiento de datos personales de estudiantes y acudientes.',
      documentType: 'data_treatment_authorization',
      version: '2026-1',
      body: 'AUTORIZACIÓN DE TRATAMIENTO DE DATOS PERSONALES\n\nYo, en calidad de acudiente, autorizo al colegio para recolectar, almacenar, usar y suprimir mis datos personales y los del estudiante a mi cargo.',
    },
    {
      code: 'image_rights',
      name: 'Autorización de uso de imagen',
      description: 'Autorización de uso de imagen del estudiante en piezas institucionales.',
      documentType: 'image_rights',
      version: '2026-1',
      body: 'AUTORIZACIÓN DE USO DE IMAGEN\n\nAutorizo al colegio para usar la imagen del estudiante en actividades institucionales, sin uso comercial.',
    },
    {
      code: 'enrollment_contract',
      name: 'Contrato de matrícula',
      description: 'Contrato de prestación de servicios educativos para el año lectivo.',
      documentType: 'enrollment_contract',
      version: '2026-1',
      body: 'CONTRATO DE PRESTACIÓN DE SERVICIOS EDUCATIVOS\n\nEntre el colegio y los acudientes se celebra el presente contrato de matrícula para el año lectivo. El colegio presta el servicio educativo según PEI, SIEE y manual de convivencia. Los acudientes cumplen obligaciones académicas, disciplinarias y financieras.',
    },
    {
      code: 'promissory_note',
      name: 'Pagaré / Anexo financiero',
      description: 'Pagaré y compromiso financiero para el año lectivo.',
      documentType: 'promissory_note',
      version: '2026-1',
      body: 'PAGARÉ Y ANEXO FINANCIERO\n\nEl acudiente como responsable financiero se obliga a pagar matrícula, pensiones y otros cobros autorizados para el año lectivo.',
    },
  ]
  for (const consent of defaultConsentDocuments) {
    if (!existingConsents.find((item) => item.code === consent.code && item.version === consent.version)) {
      await db.insert(consentDocuments).values({
        tenantId,
        ...consent,
        isActive: true,
        effectiveFrom: '2026-01-01',
        createdBy: null,
        updatedBy: null,
      })
    }
  }
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
