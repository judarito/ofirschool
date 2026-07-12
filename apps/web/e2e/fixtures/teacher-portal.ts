import type { Page, Route } from '@playwright/test'

const tenantId = '11111111-1111-1111-1111-111111111111'
const now = '2026-01-01T00:00:00.000Z'

const ok = (message: string, data: unknown) => ({
  success: true,
  message,
  data,
})

const json = async (route: Route, body: unknown) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

const paginated = <T>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 100,
})

const academicYear = {
  id: 'year-2026',
  tenantId,
  name: '2026',
  year: 2026,
  startsOn: '2026-01-15',
  endsOn: '2026-11-30',
  status: 'activo',
  createdAt: now,
  updatedAt: now,
}

const period = {
  id: 'period-1',
  tenantId,
  academicYearId: academicYear.id,
  academicYearName: academicYear.name,
  name: 'Primer periodo',
  code: 'P1',
  startsOn: '2026-01-15',
  endsOn: '2026-03-31',
  weight: 25,
  status: 'open',
  createdAt: now,
  updatedAt: now,
}

const courses = [
  {
    id: 'group-8a',
    tenantId,
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    gradeId: 'grade-8',
    gradeName: '8°',
    branchId: null,
    branchName: null,
    name: '8A',
    capacity: 35,
    status: 'active',
    inheritedStartsOn: null,
    inheritedEndsOn: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'group-9b',
    tenantId,
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    gradeId: 'grade-9',
    gradeName: '9°',
    branchId: null,
    branchName: null,
    name: '9B',
    capacity: 35,
    status: 'active',
    inheritedStartsOn: null,
    inheritedEndsOn: null,
    createdAt: now,
    updatedAt: now,
  },
]

const gradeSubjects = [
  {
    id: 'grade-subject-math-8',
    tenantId,
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    gradeId: 'grade-8',
    gradeName: '8°',
    subjectId: 'subject-math',
    subjectName: 'Matemáticas',
    weeklyHours: 5,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'grade-subject-chemistry-8',
    tenantId,
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    gradeId: 'grade-8',
    gradeName: '8°',
    subjectId: 'subject-chemistry',
    subjectName: 'Química',
    weeklyHours: 3,
    createdAt: now,
    updatedAt: now,
  },
]

const courseSubjects = [
  {
    id: 'course-subject-math-8a',
    tenantId,
    academicYearId: academicYear.id,
    academicYearName: academicYear.name,
    groupId: 'group-8a',
    groupName: '8A',
    gradeName: '8°',
    subjectId: 'subject-math',
    subjectName: 'Matemáticas',
    weeklyHours: 5,
    teacherId: 'teacher-1',
    teacherName: 'Docente Demo',
    createdAt: now,
    updatedAt: now,
  },
]

const navigation = {
  sections: [
    {
      id: 'section-home',
      code: 'home',
      title: 'Inicio',
      items: [
        { id: 'nav-home', code: 'home', label: 'Inicio', to: '/', shortLabel: 'IN', badge: null, mobileVisible: true },
        { id: 'nav-students', code: 'students', label: 'Estudiantes', to: '/students', shortLabel: 'ES', badge: null, mobileVisible: false },
      ],
    },
    {
      id: 'section-academic',
      code: 'academic-operations',
      title: 'Operación académica',
      items: [
        { id: 'nav-attendance', code: 'attendance', label: 'Asistencia', to: '/attendance', shortLabel: 'AS', badge: null, mobileVisible: true },
        { id: 'nav-activities', code: 'evaluation-activities', label: 'Actividades evaluativas', to: '/evaluation-activities', shortLabel: 'AE', badge: null, mobileVisible: false },
        { id: 'nav-grades', code: 'grades-book', label: 'Notas finales', to: '/grades', shortLabel: 'NO', badge: null, mobileVisible: true },
        { id: 'nav-observations', code: 'academic-observations', label: 'Observaciones SIEE', to: '/academic-observations', shortLabel: 'OB', badge: null, mobileVisible: false },
        { id: 'nav-support', code: 'support-strategies', label: 'Planes de apoyo', to: '/support-strategies', shortLabel: 'PA', badge: null, mobileVisible: false },
        { id: 'nav-report-cards', code: 'report-cards', label: 'Boletines', to: '/report-cards', shortLabel: 'BO', badge: null, mobileVisible: true },
      ],
    },
  ],
  mobileItems: [
    { id: 'mobile-home', code: 'home', label: 'Inicio', to: '/', shortLabel: 'IN', badge: null, mobileVisible: true },
    { id: 'mobile-attendance', code: 'attendance', label: 'Asistencia', to: '/attendance', shortLabel: 'AS', badge: null, mobileVisible: true },
    { id: 'mobile-grades', code: 'grades-book', label: 'Notas', to: '/grades', shortLabel: 'NO', badge: null, mobileVisible: true },
  ],
}

const teacherUser = {
  id: 'user-teacher-1',
  tenantId,
  email: 'docente.demo@ofirschool.test',
  fullName: 'Docente Demo',
  branchId: null,
  roleCodes: ['teacher'],
  permissions: ['dashboard.read', 'students.read', 'academic.read', 'siee.read', 'gradebook.read', 'gradebook.write'],
}

export async function installTeacherPortalMocks(page: Page) {
  await page.addInitScript(({ user, currentTenantId }) => {
    localStorage.setItem('token', 'e2e-teacher-token')
    localStorage.setItem('tenantId', currentTenantId)
    localStorage.setItem('userName', user.fullName)
    localStorage.setItem('sessionUser', JSON.stringify(user))
  }, { user: teacherUser, currentTenantId: tenantId })

  await page.route('**/api/navigation', (route) => json(route, ok('Navegación cargada', navigation)))
  await page.route('**/api/academic/years**', (route) => json(route, ok('Años lectivos cargados', paginated([academicYear]))))
  await page.route('**/api/academic/periods**', (route) => json(route, ok('Periodos cargados', paginated([period]))))
  await page.route('**/api/academic/courses**', (route) => json(route, ok('Cursos cargados', paginated(courses))))
  await page.route('**/api/academic/grade-subjects**', (route) => json(route, ok('Materias por grado cargadas', paginated(gradeSubjects))))
  await page.route('**/api/academic/course-subjects**', (route) => json(route, ok('Materias por grupo cargadas', { items: courseSubjects })))
  await page.route('**/api/academic/achievements**', (route) => json(route, ok('Logros cargados', paginated([
    {
      id: 'achievement-1',
      tenantId,
      academicYearId: academicYear.id,
      academicPeriodId: period.id,
      gradeId: 'grade-8',
      subjectId: 'subject-math',
      code: 'MAT-P1-01',
      title: 'Resuelve problemas con números racionales',
      description: null,
      weight: 100,
      createdAt: now,
      updatedAt: now,
    },
  ]))))
  await page.route('**/api/academic/evaluation-activities**', (route) => json(route, ok('Actividades cargadas', {
    items: [
      {
        id: 'activity-1',
        tenantId,
        academicYearId: academicYear.id,
        academicPeriodId: period.id,
        groupId: 'group-8a',
        subjectId: 'subject-math',
        achievementId: 'achievement-1',
        achievementCode: 'MAT-P1-01',
        achievementTitle: 'Resuelve problemas con números racionales',
        name: 'Taller de fracciones',
        description: 'Actividad de práctica',
        activityType: 'workshop',
        weightPercentage: 20,
        maxScore: 5,
        dueDate: '2026-02-20',
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  })))
}
