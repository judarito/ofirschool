import type { AcademicYearJourneyDto } from '@ofir/shared'

export type TabId = 'journeys' | 'slots' | 'groups' | 'generate'
export type Row = { id: string } & Record<string, unknown>

export const defaultJourneyForm = () => ({
  academicYearId: '',
  branchId: '',
  targetLevelName: '',
  targetGradeId: '',
  name: '',
  code: '',
  startsAt: '06:30',
  endsAt: '12:30',
  isActive: true,
})

export const defaultSlotForm = () => ({
  journeyId: '',
  dayOfWeek: 'monday',
  slotOrder: 1,
  startsAt: '06:30',
  endsAt: '07:20',
  slotType: 'class',
  label: '',
})

export const defaultGroupOptionForm = () => ({
  academicYearId: '',
  groupId: '',
  journeyId: '',
  priority: 0,
  isPreferred: false,
})

export const defaultGenerationForm = () => ({
  academicYearId: '',
  groupId: '',
  overwriteExisting: true,
})

export const defaultEntryForm = () => ({
  journeyId: '',
  journeySlotId: '',
  notes: '',
})

export const toPaginatedRows = <T extends Row>(items: T[], page: number, pageSize: number) => {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  }
}

export const weekdays = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
]

export const tabs = [
  { id: 'journeys' as TabId, label: '1. Jornadas', helper: 'Mañana, tarde, única y similares.' },
  { id: 'slots' as TabId, label: '2. Franjas', helper: 'Bloques por día dentro de cada jornada.' },
  { id: 'groups' as TabId, label: '3. Cursos', helper: 'Jornadas posibles por curso.' },
  { id: 'generate' as TabId, label: '4. Generar', helper: 'Borrador y conflictos del horario.' },
]

export const journeyColumns = [
  { key: 'academicYearName', label: 'Año lectivo' },
  { key: 'name', label: 'Jornada' },
  { key: 'scopeLabel', label: 'Aplica a' },
  { key: 'code', label: 'Código' },
  { key: 'window', label: 'Horario base' },
  { key: 'isActive', label: 'Estado' },
]

export const slotColumns = [
  { key: 'journeyName', label: 'Jornada' },
  { key: 'dayLabel', label: 'Día' },
  { key: 'slotOrder', label: 'Bloque' },
  { key: 'window', label: 'Hora' },
  { key: 'slotType', label: 'Tipo' },
]

export const groupOptionColumns = [
  { key: 'groupLabel', label: 'Curso' },
  { key: 'journeyLabel', label: 'Jornada' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'isPreferred', label: 'Preferida' },
]

export const timetableColumns = [
  { key: 'groupLabel', label: 'Curso' },
  { key: 'dayLabel', label: 'Día' },
  { key: 'slotOrder', label: 'Bloque' },
  { key: 'window', label: 'Hora' },
  { key: 'subjectName', label: 'Materia' },
  { key: 'teacherName', label: 'Docente' },
  { key: 'status', label: 'Estado' },
]

export const normalizeText = (value: unknown) => String(value ?? '').toLowerCase()

export const translateLevelName = (levelName: string | null | undefined) => {
  switch (levelName) {
    case 'preschool':
      return 'Preescolar'
    case 'primary':
      return 'Primaria'
    case 'secondary':
      return 'Secundaria'
    case 'middle':
      return 'Media / bachillerato'
    default:
      return ''
  }
}

export const journeyScopeLabel = (journey: Pick<AcademicYearJourneyDto, 'targetGradeName' | 'targetLevelName'>) =>
  journey.targetGradeName || translateLevelName(journey.targetLevelName) || 'Todo el colegio'

export const journeyScopeType = (journey: Pick<AcademicYearJourneyDto, 'targetGradeName' | 'targetLevelName'>) =>
  journey.targetGradeName ? 'grade' : journey.targetLevelName ? 'level' : 'global'

export const journeyScopeBadge = (journey: Pick<AcademicYearJourneyDto, 'targetGradeName' | 'targetLevelName'>) =>
  journey.targetGradeName ? 'Grado' : journey.targetLevelName ? 'Nivel' : 'Global'

export const journeyOptionLabel = (journey: Pick<AcademicYearJourneyDto, 'name' | 'code' | 'targetGradeName' | 'targetLevelName'>) =>
  `${journey.name} · ${journey.code} · ${journeyScopeLabel(journey)}`

export const slotTypeBadge = (slotType: string) => {
  if (slotType === 'class') return 'meta-badge--success'
  if (slotType === 'break' || slotType === 'lunch') return 'meta-badge--warning'
  return 'meta-badge--info'
}

export const scopeBadgeClass = (scopeType: string) => {
  switch (scopeType) {
    case 'grade':
      return 'meta-badge--warning'
    case 'level':
      return 'meta-badge--info'
    default:
      return 'meta-badge--success'
  }
}

export const slotDayLabel = (dayOfWeek: string) => weekdays.find((day) => day.value === dayOfWeek)?.label ?? dayOfWeek

export const translateSlotType = (slotType: string) => {
  switch (slotType) {
    case 'class':
      return 'Clase'
    case 'break':
      return 'Descanso'
    case 'homeroom':
      return 'Dir. grupo'
    case 'lunch':
      return 'Almuerzo'
    case 'institutional':
      return 'Institucional'
    default:
      return slotType
  }
}

type ScheduleSummary = {
  slots: number
  configuredGroups: number
}

export const buildPrimaryGuide = ({
  hasJourneys,
  hasSlots,
  scheduleSummary,
  coursesForYearCount,
  selectedJourneyLabel,
}: {
  hasJourneys: boolean
  hasSlots: boolean
  scheduleSummary: ScheduleSummary
  coursesForYearCount: number
  selectedJourneyLabel: string
}) => {
  if (!hasJourneys) {
    return {
      status: 'Base vacía',
      description: 'Antes de pensar en generación, primero debemos crear al menos una jornada para el año lectivo.',
      actionLabel: 'Crear primera jornada',
      secondaryTab: 'journeys' as TabId,
      secondaryLabel: 'jornadas',
      items: [
        { label: 'Jornadas configuradas', value: '0', helper: 'Sin jornada no existe una plantilla horaria sobre la cual repartir materias.' },
      ],
    }
  }

  if (!hasSlots) {
    return {
      status: 'Faltan franjas',
      description: 'Ya hay jornadas, pero aún no hay bloques reales para que el generador reparta la intensidad horaria.',
      actionLabel: 'Crear franjas',
      secondaryTab: 'slots' as TabId,
      secondaryLabel: 'franjas',
      items: [
        { label: 'Jornada seleccionada', value: selectedJourneyLabel, helper: 'Elige una jornada y define bloques tipo clase, descanso o institucionales.' },
      ],
    }
  }

  if (scheduleSummary.configuredGroups < coursesForYearCount) {
    return {
      status: 'Faltan cursos',
      description: 'La base temporal está lista, pero todavía faltan cursos por asociar a una o más jornadas candidatas.',
      actionLabel: 'Asignar jornadas a cursos',
      secondaryTab: 'groups' as TabId,
      secondaryLabel: 'cursos',
      items: [
        { label: 'Cursos con opción', value: String(scheduleSummary.configuredGroups), helper: `Hay ${coursesForYearCount} cursos en el año seleccionado.` },
      ],
    }
  }

  return {
    status: 'Listo para generar',
    description: 'La base mínima ya existe. El siguiente paso es generar el borrador y revisar conflictos de docentes o bloques.',
    actionLabel: 'Generar borrador',
    secondaryTab: 'generate' as TabId,
    secondaryLabel: 'revisión',
    items: [
      { label: 'Bloques listos', value: String(scheduleSummary.slots), helper: 'Se usarán solo las franjas de tipo clase para construir el horario.' },
      { label: 'Cursos configurados', value: String(scheduleSummary.configuredGroups), helper: 'Cada curso tomará su jornada preferida o la de menor prioridad disponible.' },
    ],
  }
}
