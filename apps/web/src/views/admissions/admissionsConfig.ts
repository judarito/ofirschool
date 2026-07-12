export const listColumns = [
  { key: 'studentName', label: 'Estudiante' },
  { key: 'guardianName', label: 'Acudiente' },
  { key: 'requestedGradeName', label: 'Grado' },
  { key: 'requestedGroupName', label: 'Curso' },
  { key: 'status', label: 'Estado' },
  { key: 'submittedAt', label: 'Fecha' },
]

export const statusLabel = (status: string) => {
  if (status === 'submitted') return 'nuevo'
  if (status === 'reviewing') return 'revision'
  if (status === 'accepted' || status === 'converted') return 'aprobado'
  if (status === 'rejected') return 'rechazado'
  return status
}

export const primaryRowAction = (status: string) => {
  if (status === 'submitted') return { action: 'reviewing', label: 'Tomar en revisión' }
  if (status === 'reviewing' || status === 'rejected') return { action: 'accepted', label: 'Aprobar' }
  if (status === 'accepted') return { action: 'convert', label: 'Matricular' }
  return { action: 'detail', label: 'Ver detalle' }
}

export const formatDate = (value: string) => new Date(value).toLocaleDateString('es-CO')

export const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

export const formatFileSize = (value: number | null) => {
  if (!value || value <= 0) return 'Tamaño no informado'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

type AdmissionMetrics = {
  total: number
  submitted: number
  reviewing: number
  approved: number
  converted: number
}

export const buildQueueTabs = (metrics: AdmissionMetrics, rejectedCount: number) => [
  { value: '', label: 'Todas', count: metrics.total },
  { value: 'submitted', label: 'Nuevas', count: metrics.submitted },
  { value: 'reviewing', label: 'En revisión', count: metrics.reviewing },
  { value: 'accepted', label: 'Aprobadas', count: metrics.approved - metrics.converted },
  { value: 'converted', label: 'Convertidas', count: metrics.converted },
  { value: 'rejected', label: 'Rechazadas', count: rejectedCount },
]

export const buildPrimaryTask = (metrics: AdmissionMetrics) => {
  if (metrics.reviewing > 0) {
    return {
      title: 'Solicitudes en revisión',
      value: `${metrics.reviewing} por decidir`,
      helper: 'El siguiente paso es aprobar o rechazar las solicitudes que ya fueron validadas.',
      description: 'La bandeja ya tiene solicitudes activas que esperan decisión académica o administrativa.',
      actionLabel: 'Ir a revisión',
      status: 'revision',
    }
  }
  if (metrics.submitted > 0) {
    return {
      title: 'Solicitudes nuevas',
      value: `${metrics.submitted} recién enviadas`,
      helper: 'Conviene moverlas primero a revisión para que el equipo no pierda trazabilidad.',
      description: 'Todavía hay aspirantes nuevos sin tomar en cola formal de revisión.',
      actionLabel: 'Tomar solicitudes nuevas',
      status: 'nuevo',
    }
  }
  if (metrics.approved - metrics.converted > 0) {
    return {
      title: 'Conversión pendiente',
      value: `${metrics.approved - metrics.converted} por matricular`,
      helper: 'Ya fueron aprobadas; falta convertirlas en matrícula anual.',
      description: 'El cuello de botella ya no está en revisar sino en cerrar la matrícula de quienes fueron aceptados.',
      actionLabel: 'Ver aprobadas',
      status: 'aprobado',
    }
  }
  return {
    title: 'Proceso controlado',
    value: 'Sin urgencias visibles',
    helper: 'Puedes revisar el proceso público o registrar manualmente nuevos aspirantes.',
    description: 'La bandeja no tiene pendientes críticos en este momento.',
    actionLabel: 'Ver todas',
    status: 'aprobado',
  }
}

export const statusModalTitle = (status: 'reviewing' | 'accepted' | 'rejected') => {
  if (status === 'accepted') return 'Aprobar solicitud'
  if (status === 'rejected') return 'Rechazar solicitud'
  return 'Pasar a revisión'
}
