export const workspaceModes = [
  { value: 'individual' as const, label: 'Boletin individual', helper: 'Para generar un estudiante puntual.' },
  { value: 'course' as const, label: 'Boletines del curso', helper: 'Para recorrer el grupo sin rearmar filtros.' },
  { value: 'ready' as const, label: 'Listos para imprimir', helper: 'Para trabajar solo la cola del corte actual.' },
]

export const formatScore = (value: number, decimalPlaces = 2) => value.toFixed(decimalPlaces)

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

export const translateObservationType = (value: string) => {
  if (value === 'strength') return 'Fortaleza'
  if (value === 'difficulty') return 'Dificultad'
  if (value === 'recommendation') return 'Recomendacion'
  if (value === 'recovery_plan') return 'Plan de recuperacion'
  return 'General'
}

export const translateSupportStatus = (value: string) => {
  if (value === 'approved') return 'Recuperado'
  if (value === 'rejected') return 'No recuperado'
  return 'Pendiente'
}

export const translatePeriodStatus = (value: string) => {
  if (value === 'closed') return 'cerrado'
  if (value === 'published') return 'publicado'
  return 'abierto'
}

export const translatePromotionStatus = (value?: string | null) => {
  if (value === 'promoted') return 'Promovido'
  if (value === 'conditional') return 'Condicional'
  if (value === 'not_promoted') return 'No promovido'
  return 'Pendiente'
}
