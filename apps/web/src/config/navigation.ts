export type NavItem = {
  id: string
  label: string
  to: string
  shortLabel: string
  badge?: number
}

export type NavSection = {
  id: string
  title: string
  description?: string
  items: NavItem[]
}

export const primaryNavigationSections: NavSection[] = [
  {
    id: 'home',
    title: 'Inicio',
    description: 'Puntos de entrada rapidos para ubicarse en la operacion diaria.',
    items: [
      { id: 'home', label: 'Inicio', to: '/', shortLabel: 'IN' },
      { id: 'students', label: 'Estudiantes', to: '/students', shortLabel: 'ES' },
    ],
  },
  {
    id: 'admissions-and-enrollment',
    title: 'Admision y matricula',
    description: 'Todo el flujo desde aspirantes hasta continuidad y cierre anual.',
    items: [
      { id: 'admissions', label: 'Inscripciones', to: '/admissions', shortLabel: 'IS', badge: 5 },
      { id: 'enrollments', label: 'Matriculas y cierre anual', to: '/enrollments', shortLabel: 'MA' },
      { id: 'forms', label: 'Formulario publico', to: '/enrollment-forms', shortLabel: 'FO' },
    ],
  },
  {
    id: 'academic-operations',
    title: 'Operacion academica',
    description: 'Trabajo diario de docentes, coordinacion y seguimiento academico.',
    items: [
      { id: 'attendance', label: 'Asistencia', to: '/attendance', shortLabel: 'AS' },
      { id: 'evaluation-activities', label: 'Actividades evaluativas', to: '/evaluation-activities', shortLabel: 'AE' },
      { id: 'grades-book', label: 'Notas finales', to: '/grades', shortLabel: 'NO' },
      { id: 'academic-observations', label: 'Observaciones SIEE', to: '/academic-observations', shortLabel: 'OB' },
      { id: 'support-strategies', label: 'Planes de apoyo', to: '/support-strategies', shortLabel: 'PA' },
      { id: 'report-cards', label: 'Boletines', to: '/report-cards', shortLabel: 'BO' },
    ],
  },
  {
    id: 'closures',
    title: 'Cierres y cortes',
    description: 'Control del calendario academico y preparacion de salidas institucionales.',
    items: [
      { id: 'periods', label: 'Periodos', to: '/academic-periods', shortLabel: 'PE' },
      { id: 'years', label: 'Anos lectivos', to: '/academic-years', shortLabel: 'AN' },
      { id: 'report-cards-closure', label: 'Boletines por corte', to: '/report-cards', shortLabel: 'BC' },
    ],
  },
  {
    id: 'configuration',
    title: 'Configuracion',
    description: 'Estructura academica, SIEE y alistamiento institucional.',
    items: [
      { id: 'grades', label: 'Grados', to: '/academic-grades', shortLabel: 'GR' },
      { id: 'academic-levels', label: 'Niveles educativos', to: '/academic-levels', shortLabel: 'NE' },
      { id: 'courses', label: 'Cursos', to: '/courses', shortLabel: 'CU' },
      { id: 'schedules', label: 'Horarios', to: '/schedules', shortLabel: 'HO' },
      { id: 'areas', label: 'Areas academicas', to: '/academic-areas', shortLabel: 'AR' },
      { id: 'subjects', label: 'Materias', to: '/subjects', shortLabel: 'MT' },
      { id: 'scales', label: 'Escalas SIEE', to: '/grading-scale', shortLabel: 'SC' },
      { id: 'competencies', label: 'Competencias SIEE', to: '/competencies', shortLabel: 'CO' },
      { id: 'grade-subjects', label: 'Materias por grado', to: '/grade-subjects', shortLabel: 'MG' },
      { id: 'academic-plan', label: 'Plan academico', to: '/academic-plan', shortLabel: 'PL' },
    ],
  },
  {
    id: 'institutional',
    title: 'Institucional',
    description: 'Docentes, usuarios y modulos transversales del colegio.',
    items: [
      { id: 'teachers', label: 'Docentes', to: '/teachers', shortLabel: 'DO' },
      { id: 'teacher-assignments', label: 'Carga docente', to: '/teacher-assignments', shortLabel: 'CD' },
      { id: 'teacher-responsibilities', label: 'Directores y coordinacion', to: '/teacher-responsibilities', shortLabel: 'DG' },
      { id: 'guardians', label: 'Convivencia', to: '/guardians', shortLabel: 'CV' },
      { id: 'users', label: 'Usuarios', to: '/users', shortLabel: 'US' },
      { id: 'announcements', label: 'Comunicaciones', to: '/announcements', shortLabel: 'CM', badge: 3 },
      { id: 'portfolio', label: 'Financiero', to: '/portfolio', shortLabel: 'FI' },
      { id: 'reports', label: 'Reportes', to: '/reports', shortLabel: 'RP' },
    ],
  },
]

export const mobileNavigation: NavItem[] = [
  { id: 'mobile-home', label: 'Inicio', to: '/', shortLabel: 'IN' },
  { id: 'mobile-admissions', label: 'Inscripcion', to: '/admissions', shortLabel: 'IS' },
  { id: 'mobile-enrollments', label: 'Matricula', to: '/enrollments', shortLabel: 'MA' },
  { id: 'mobile-periods', label: 'Cierres', to: '/academic-periods', shortLabel: 'CI' },
  { id: 'mobile-report-cards', label: 'Boletines', to: '/report-cards', shortLabel: 'BO' },
]
