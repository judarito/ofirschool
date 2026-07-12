export const columns = [
  { key: 'studentName', label: 'Estudiante' },
  { key: 'academicYearName', label: 'Año lectivo' },
  { key: 'gradeName', label: 'Grado' },
  { key: 'groupName', label: 'Curso' },
  { key: 'enrollmentType', label: 'Origen' },
  { key: 'enrollmentDate', label: 'Fecha matrícula' },
  { key: 'enrollmentStatus', label: 'Estado' },
]

export const originLabel = (value: string) => {
  if (value === 'new') return 'Inscripción aceptada'
  if (value === 'renewal') return 'Renovación'
  if (value === 'promotion') return 'Promoción'
  if (value === 'auto_promotion') return 'Promoción automática'
  if (value === 'transfer') return 'Traslado'
  return value
}

export const statusLabel = (value: string) => {
  if (value === 'active') return 'activa'
  if (value === 'pending') return 'pendiente'
  if (value === 'draft') return 'revision'
  if (value === 'cancelled') return 'cancelada'
  return value
}

export const formatDate = (value: string) => new Date(value).toLocaleDateString('es-CO')

export const formatNumeric = (value: number) => value.toFixed(2)

export const promotionDecisionLabel = (value: string) => {
  if (value === 'promoted') return 'promovido'
  if (value === 'conditional') return 'condicional'
  if (value === 'not_promoted') return 'no_promovido'
  return 'pendiente'
}
