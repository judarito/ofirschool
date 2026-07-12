import type { DraftDocument, DraftField, DraftSection, DraftSelectOption } from '../../lib/publicFormDraft'

export type BuilderStep = 'setup' | 'structure' | 'documents' | 'preview'

export type FormConfig = {
  name: string
  year: string
  tenantSlug: string
  startsOn: string
  endsOn: string
  autosave: boolean
  progressBar: boolean
}

export type FormVersionStatus = 'draft' | 'published'

export type LocalListRow = {
  id: string
} & Record<string, unknown>

type SectionPreset = {
  key: string
  title: string
  description: string
  fields: Array<Omit<DraftField, 'id'>>
}

type DocumentPreset = Omit<DraftDocument, 'id'> & {
  key: string
  helper: string
}

export const sectionPresets: SectionPreset[] = [
  {
    key: 'health',
    title: 'Salud',
    description: 'EPS, alergias y datos médicos importantes.',
    fields: [
      { label: 'EPS', type: 'text', required: true, options: [] },
      { label: 'Alergias conocidas', type: 'textarea', required: false, options: [] },
      {
        label: 'Tipo de sangre',
        type: 'select',
        required: true,
        options: [
          { label: 'O+', value: 'o-positive' },
          { label: 'A+', value: 'a-positive' },
          { label: 'B+', value: 'b-positive' },
        ],
      },
    ],
  },
  {
    key: 'guardians',
    title: 'Contactos de emergencia',
    description: 'Personas que pueden recoger al estudiante o ser contactadas.',
    fields: [
      { label: 'Persona autorizada para recoger', type: 'text', required: false, options: [] },
      { label: 'Teléfono de emergencia', type: 'phone', required: true, options: [] },
      { label: 'Parentesco del autorizado', type: 'text', required: false, options: [] },
    ],
  },
  {
    key: 'transport',
    title: 'Transporte',
    description: 'Cómo llega y se va el estudiante del colegio.',
    fields: [
      { label: 'Usa ruta escolar', type: 'checkbox', required: false, options: [] },
      { label: 'Dirección de recogida', type: 'text', required: false, options: [] },
      { label: 'Quién lo recoge', type: 'text', required: false, options: [] },
    ],
  },
  {
    key: 'coexistence',
    title: 'Observaciones especiales',
    description: 'Información importante sobre el estudiante que el colegio debe conocer.',
    fields: [
      { label: 'Necesita acompañamiento especial', type: 'checkbox', required: false, options: [] },
      { label: 'Observaciones para el colegio', type: 'textarea', required: false, options: [] },
    ],
  },
]

export const documentPresets: DocumentPreset[] = [
  { key: 'student-document', name: 'Cédula o tarjeta de identidad del estudiante', required: true, maxSizeMb: 10, helper: 'Documento de identificación del estudiante.' },
  { key: 'guardian-document', name: 'Cédula del acudiente', required: true, maxSizeMb: 10, helper: 'Documento de identificación del padre o acudiente.' },
  { key: 'eps-certificate', name: 'Certificado de EPS', required: false, maxSizeMb: 10, helper: 'Certificado afiliación a salud.' },
  { key: 'vaccination-card', name: 'Carné de vacunación', required: false, maxSizeMb: 10, helper: 'Frecuente en grados iniciales.' },
]

export const initialSections: DraftSection[] = [
  {
    id: 'health',
    title: 'Informacion de salud',
    description: 'Datos medicos importantes para la institucion.',
    fields: [
      { id: 'eps', label: 'EPS', type: 'text', required: true, options: [] },
      { id: 'allergies', label: 'Alergias conocidas', type: 'textarea', required: false, options: [] },
      {
        id: 'blood-type',
        label: 'Grupo sanguineo',
        type: 'select',
        required: true,
        options: [
          { label: 'O+', value: 'o-positive' },
          { label: 'A+', value: 'a-positive' },
          { label: 'B+', value: 'b-positive' },
        ],
      },
    ],
  },
  {
    id: 'transport',
    title: 'Transporte',
    description: 'Informacion sobre movilidad del estudiante.',
    fields: [
      { id: 'route', label: 'Usa ruta escolar', type: 'checkbox', required: false, options: [] },
      { id: 'address', label: 'Direccion de recogida', type: 'text', required: false, options: [] },
    ],
  },
]

export const initialDocuments: DraftDocument[] = [
  { id: 'student-document', name: 'Documento de identidad del estudiante', required: true, maxSizeMb: 10 },
  { id: 'guardian-document', name: 'Documento de identidad del acudiente', required: true, maxSizeMb: 10 },
  { id: 'eps-certificate', name: 'Certificado EPS', required: false, maxSizeMb: 10 },
]

export const builderSteps = [
  { value: 'setup' as const, label: 'Información básica', shortLabel: 'Nombre y fechas' },
  { value: 'structure' as const, label: 'Preguntas', shortLabel: 'Secciones y campos' },
  { value: 'documents' as const, label: 'Documentos', shortLabel: 'Archivos solicitados' },
  { value: 'preview' as const, label: 'Vista previa', shortLabel: 'Revisión final' },
]

export const sectionColumns = [
  { key: 'title', label: 'Sección' },
  { key: 'fieldsCount', label: 'Preguntas' },
  { key: 'requiredCount', label: 'Obligatorias' },
  { key: 'state', label: 'Estado' },
]

export const fieldColumns = [
  { key: 'label', label: 'Pregunta' },
  { key: 'typeLabel', label: 'Tipo' },
  { key: 'requiredLabel', label: 'Uso' },
]

export const documentColumns = [
  { key: 'name', label: 'Documento' },
  { key: 'requiredLabel', label: 'Uso' },
  { key: 'maxSizeLabel', label: 'Tamaño' },
]

export const parseSelectOptions = (optionsText: string): DraftSelectOption[] =>
  optionsText
    .split('\n')
    .map((option) => option.trim())
    .filter(Boolean)
    .map((option) => ({
      label: option,
      value: option
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    }))

export const inputType = (fieldType: string) => {
  if (fieldType === 'email') return 'email'
  if (fieldType === 'date') return 'date'
  if (fieldType === 'number') return 'number'
  if (fieldType === 'phone') return 'tel'
  if (fieldType === 'file') return 'file'
  return 'text'
}

export const fieldTypeIcon = (fieldType: string) => {
  const icons: Record<string, string> = {
    text: 'Aa',
    textarea: 'Tx',
    number: '#',
    date: 'Fe',
    select: 'Se',
    checkbox: 'Si',
    email: '@',
    phone: 'Tel',
    file: 'Doc',
  }

  return icons[fieldType] ?? 'Ca'
}

export const fieldTypeLabel = (fieldType: string) => {
  const labels: Record<string, string> = {
    text: 'Texto corto',
    textarea: 'Texto largo',
    number: 'Numero',
    date: 'Fecha',
    select: 'Seleccion',
    checkbox: 'Si / No',
    email: 'Correo',
    phone: 'Telefono',
    file: 'Archivo',
  }
  return labels[fieldType] ?? fieldType
}

export const paginateRows = (rows: LocalListRow[], params: { page: number; pageSize: number; query: string }) => {
  const normalizedQuery = params.query.trim().toLowerCase()
  const filteredRows = normalizedQuery
    ? rows.filter((row) =>
        Object.values(row).some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      )
    : rows
  const total = filteredRows.length
  const start = (params.page - 1) * params.pageSize

  return {
    items: filteredRows.slice(start, start + params.pageSize),
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

export const mapEditorResponse = (
  data: Record<string, unknown>,
  fallbackConfig: FormConfig,
): {
  config: FormConfig
  sections: DraftSection[]
  documents: DraftDocument[]
  versionStatus: FormVersionStatus
} => {
  const config = (data.formConfig ?? {}) as Record<string, unknown>
  const sections = ((data.sections ?? []) as Array<Record<string, unknown>>).map((section) => ({
    id: String(section.id ?? crypto.randomUUID()),
    title: String(section.title ?? 'Seccion'),
    description: String(section.description ?? ''),
    fields: (((section.fields ?? []) as Array<Record<string, unknown>>).map((field) => ({
      id: String(field.id ?? crypto.randomUUID()),
      label: String(field.label ?? 'Campo'),
      type: String(field.type ?? 'text'),
      required: Boolean(field.required),
      options: Array.isArray(field.options)
        ? field.options.map((option) => {
            if (typeof option === 'string') return { label: option, value: option }
            const item = option as Record<string, unknown>
            return {
              label: String(item.label ?? item.value ?? ''),
              value: String(item.value ?? item.label ?? ''),
            }
          })
        : [],
    }))),
  }))
  const documents = ((data.documents ?? []) as Array<Record<string, unknown>>).map((document) => ({
    id: String(document.id ?? crypto.randomUUID()),
    name: String(document.name ?? 'Documento'),
    required: Boolean(document.required),
    maxSizeMb: Number(document.maxSizeMb ?? 10),
  }))

  return {
    config: {
      name: String(config.name ?? fallbackConfig.name),
      year: String(config.year ?? fallbackConfig.year),
      tenantSlug: String(config.tenantSlug ?? fallbackConfig.tenantSlug),
      startsOn: String(config.startsOn ?? fallbackConfig.startsOn),
      endsOn: String(config.endsOn ?? fallbackConfig.endsOn),
      autosave: Boolean(config.autosave ?? fallbackConfig.autosave),
      progressBar: Boolean(config.progressBar ?? fallbackConfig.progressBar),
    },
    sections,
    documents,
    versionStatus: String(data.versionStatus ?? 'draft') === 'published' ? 'published' : 'draft',
  }
}
