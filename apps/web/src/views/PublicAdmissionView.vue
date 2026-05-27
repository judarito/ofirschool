<template>
  <main class="public-admission-page">
    <section class="public-admission-shell">
      <header class="public-admission-hero">
        <div>
          <span class="brand-mark">OF</span>
          <strong>{{ tenantName }}</strong>
        </div>
        <StatusBadge :status="processStatusLabel" />
      </header>

      <section class="public-admission-card">
        <div v-if="loading" class="empty-state">
          <strong>Cargando formulario...</strong>
          <p>Estamos validando el colegio, el año lectivo y la ventana publica.</p>
        </div>

        <div v-else-if="error" class="empty-state">
          <strong>No pudimos cargar este proceso</strong>
          <p>{{ error }}</p>
        </div>

        <template v-else>
          <div class="public-admission-title">
            <div>
              <span class="window-strip__label">{{ academicYearName }}</span>
              <h1>{{ processName }}</h1>
              <p>{{ processDescription }}</p>
            </div>
            <div class="date-chip-list">
              <span class="date-chip date-chip--start">Abre {{ processStartsOn }}</span>
              <span class="date-chip date-chip--end">Cierra {{ processEndsOn }}</span>
            </div>
          </div>

          <div v-if="!isOpen" class="empty-state">
            <strong>El formulario no esta abierto</strong>
            <p>El colegio publico este proceso, pero la fecha actual esta fuera de la ventana permitida.</p>
          </div>

          <form v-else class="public-form" @submit.prevent="submitPublicForm">
            <section class="public-form__section">
              <h2>Datos basicos del estudiante</h2>
              <div class="form-grid">
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Nombres</span>
                    <strong>*</strong>
                  </span>
                  <input v-model="fixedForm.firstName" required />
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Segundo nombre</span>
                  </span>
                  <input v-model="fixedForm.middleName" />
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Apellidos</span>
                    <strong>*</strong>
                  </span>
                  <input v-model="fixedForm.lastName" required />
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Tipo de documento</span>
                    <strong>*</strong>
                  </span>
                  <select v-model="fixedForm.documentType" required>
                    <option value="TI">TI</option>
                    <option value="RC">RC</option>
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="PP">Pasaporte</option>
                  </select>
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Numero de documento</span>
                    <strong>*</strong>
                  </span>
                  <input v-model="fixedForm.documentNumber" required />
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Fecha de nacimiento</span>
                    <strong>*</strong>
                  </span>
                  <input v-model="fixedForm.birthDate" type="date" required />
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Genero</span>
                    <strong>*</strong>
                  </span>
                  <select v-model="fixedForm.gender" required>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                    <option value="no_informa">Prefiere no informar</option>
                  </select>
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Grupo sanguineo</span>
                  </span>
                  <select v-model="fixedForm.bloodType">
                    <option value="">Sin especificar</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </label>
              </div>
            </section>

            <section class="public-form__section">
              <h2>Datos del acudiente</h2>
              <div class="form-grid">
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Nombres</span>
                    <strong>*</strong>
                  </span>
                  <input v-model="fixedForm.guardianFirstName" required />
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Apellidos</span>
                    <strong>*</strong>
                  </span>
                  <input v-model="fixedForm.guardianLastName" required />
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Tipo de documento</span>
                    <strong>*</strong>
                  </span>
                  <select v-model="fixedForm.guardianDocumentType" required>
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="PP">Pasaporte</option>
                  </select>
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Numero de documento</span>
                    <strong>*</strong>
                  </span>
                  <input v-model="fixedForm.guardianDocumentNumber" required />
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Telefono</span>
                    <strong>*</strong>
                  </span>
                  <input v-model="fixedForm.guardianPhone" type="tel" required />
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Correo electronico</span>
                    <strong>*</strong>
                  </span>
                  <input v-model="fixedForm.guardianEmail" type="email" required />
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Parentesco</span>
                    <strong>*</strong>
                  </span>
                  <select v-model="fixedForm.guardianRelationship" required>
                    <option value="madre">Madre</option>
                    <option value="padre">Padre</option>
                    <option value="abuelo">Abuelo(a)</option>
                    <option value="tio">Tio(a)</option>
                    <option value="otro">Otro</option>
                  </select>
                </label>
              </div>
            </section>

            <section class="public-form__section">
              <h2>Solicitud academica</h2>
              <div class="form-grid">
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Grado al que aspira</span>
                    <strong>*</strong>
                  </span>
                  <select v-model="admissionForm.requestedGradeId" required>
                    <option value="">Seleccione...</option>
                    <option v-for="grade in grades" :key="grade.id" :value="grade.id">
                      {{ grade.name }}
                    </option>
                  </select>
                </label>
                <label class="public-field">
                  <span class="public-field__label">
                    <span>Curso sugerido</span>
                  </span>
                  <select v-model="admissionForm.requestedGroupId">
                    <option value="">Asignar despues</option>
                    <option v-for="group in availableGroups" :key="group.id" :value="group.id">
                      {{ group.name }}
                    </option>
                  </select>
                </label>
              </div>
            </section>

            <section v-for="section in sections" :key="section.code" class="public-form__section">
              <h2>{{ section.title }}</h2>
              <p v-if="section.description">{{ section.description }}</p>
              <div class="form-grid">
                <label
                  v-for="field in section.fields"
                  :key="field.code"
                  class="public-field"
                  :class="{ 'public-field--checkbox': field.fieldType === 'checkbox' }"
                >
                  <span class="public-field__label">
                    <span>{{ field.label }}</span>
                    <strong v-if="field.isRequired">*</strong>
                  </span>
                  <select v-if="field.fieldType === 'select'" v-model="dynamicTextValues[field.code]" :required="field.isRequired">
                    <option value="">Seleccione...</option>
                    <option v-for="option in normalizeOptions(field.options)" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <select
                    v-else-if="field.fieldType === 'multiselect'"
                    v-model="dynamicArrayValues[field.code]"
                    multiple
                    :required="field.isRequired"
                  >
                    <option v-for="option in normalizeOptions(field.options)" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <textarea v-else-if="field.fieldType === 'textarea'" v-model="dynamicTextValues[field.code]" :required="field.isRequired" />
                  <input v-else-if="field.fieldType === 'checkbox'" v-model="dynamicBooleanValues[field.code]" type="checkbox" />
                  <div v-else-if="field.fieldType === 'radio'" class="choice-row">
                    <label
                      v-for="option in normalizeOptions(field.options)"
                      :key="option.value"
                      class="choice-pill"
                    >
                      <input v-model="dynamicTextValues[field.code]" type="radio" :value="option.value" />
                      <span>{{ option.label }}</span>
                    </label>
                  </div>
                  <input v-else v-model="dynamicTextValues[field.code]" :type="inputType(field.fieldType)" :required="field.isRequired" />
                </label>
              </div>
            </section>

            <section v-if="documents.length" class="public-form__section">
              <h2>Documentos requeridos</h2>
              <div class="upload-list">
                <div v-for="document in documents" :key="document.code" class="upload-card">
                  <div class="upload-card__meta">
                    <span class="document-row__icon">DOC</span>
                    <div>
                      <strong>{{ document.name }}</strong>
                      <small>
                        {{ document.isRequired ? 'Obligatorio' : 'Opcional' }}
                        <template v-if="document.maxFileSizeMb"> · Max {{ document.maxFileSizeMb }} MB</template>
                      </small>
                    </div>
                  </div>
                  <label class="upload-card__picker">
                    <span>Seleccionar archivo</span>
                    <input
                      type="file"
                      :accept="documentAccept(document)"
                      @change="handleDocumentChange(document, $event)"
                    />
                  </label>
                  <p v-if="selectedDocuments[document.code]?.fileName" class="upload-status">
                    {{ selectedDocuments[document.code]?.fileName }}
                  </p>
                  <p v-if="selectedDocuments[document.code]?.error" class="upload-status upload-status--error">
                    {{ selectedDocuments[document.code]?.error }}
                  </p>
                  <p v-else-if="document.acceptedMimeTypes?.length" class="upload-status">
                    Formatos: {{ document.acceptedMimeTypes.join(', ') }}
                  </p>
                </div>
              </div>
            </section>

            <div class="preview-footer">
              <p class="form-note">Al enviar se creara una solicitud de inscripcion asociada al colegio de este link.</p>
              <button class="button button--brand" type="submit" :disabled="submitting">
                {{ submitting ? 'Enviando...' : 'Enviar inscripcion' }}
              </button>
            </div>
            <p v-if="submissionMessage" class="public-submit-message" :class="{ 'public-submit-message--error': submissionError }">
              {{ submissionMessage }}
            </p>
          </form>
        </template>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import StatusBadge from '../components/StatusBadge.vue'
import { api } from '../lib/api'

type PublicField = {
  code: string
  label: string
  fieldType: string
  isRequired: boolean
  options?: unknown
}

type PublicSection = {
  code: string
  title: string
  description?: string | null
  fields: PublicField[]
}

type PublicDocument = {
  code: string
  name: string
  isRequired: boolean
  acceptedMimeTypes?: string[]
  maxFileSizeMb?: number
}

type PublicGrade = {
  id: string
  name: string
  level: number
}

type PublicGroup = {
  id: string
  gradeId: string
  name: string
}

type SelectedDocumentState = {
  file?: File
  fileName?: string
  error?: string
}

const route = useRoute()
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const submissionMessage = ref('')
const submissionError = ref(false)
const submissionToken = ref(crypto.randomUUID())
const payload = ref<Record<string, unknown> | null>(null)
const selectedDocuments = reactive<Record<string, SelectedDocumentState>>({})
const dynamicTextValues = reactive<Record<string, string>>({})
const dynamicBooleanValues = reactive<Record<string, boolean>>({})
const dynamicArrayValues = reactive<Record<string, string[]>>({})
const fixedForm = reactive({
  firstName: '',
  middleName: '',
  lastName: '',
  documentType: 'TI',
  documentNumber: '',
  birthDate: '',
  gender: 'masculino',
  bloodType: '',
  guardianFirstName: '',
  guardianLastName: '',
  guardianDocumentType: 'CC',
  guardianDocumentNumber: '',
  guardianPhone: '',
  guardianEmail: '',
  guardianRelationship: 'madre',
})
const admissionForm = reactive({
  requestedGradeId: '',
  requestedGroupId: '',
  source: 'new_student',
})

const tenant = computed(() => (payload.value?.tenant ?? {}) as Record<string, unknown>)
const academicYear = computed(() => (payload.value?.academicYear ?? {}) as Record<string, unknown>)
const process = computed(() => (payload.value?.process ?? {}) as Record<string, unknown>)
const form = computed(() => (payload.value?.form ?? {}) as Record<string, unknown>)
const catalogs = computed(() => (payload.value?.catalogs ?? {}) as Record<string, unknown>)
const tenantName = computed(() => String(tenant.value.name ?? 'OfirSchool'))
const academicYearName = computed(() => String(academicYear.value.name ?? `Año lectivo ${route.params.year}`))
const processName = computed(() => String(process.value.name ?? 'Formulario de inscripcion'))
const processDescription = computed(() => String(process.value.description ?? 'Completa la informacion solicitada por el colegio.'))
const processStartsOn = computed(() => String(process.value.startsOn ?? '--'))
const processEndsOn = computed(() => String(process.value.endsOn ?? '--'))
const isOpen = computed(() => Boolean(process.value.isOpen))
const processStatusLabel = computed(() => String(process.value.status ?? 'publico'))
const sections = computed(() => ((form.value.sections as PublicSection[] | undefined) ?? []))
const documents = computed(() => ((form.value.requiredDocuments as PublicDocument[] | undefined) ?? []))
const grades = computed(() => ((catalogs.value.grades as PublicGrade[] | undefined) ?? []))
const groups = computed(() => ((catalogs.value.groups as PublicGroup[] | undefined) ?? []))
const availableGroups = computed(() =>
  admissionForm.requestedGradeId
    ? groups.value.filter((group) => group.gradeId === admissionForm.requestedGradeId)
    : groups.value,
)

watch(
  () => admissionForm.requestedGradeId,
  () => {
    if (!availableGroups.value.find((group) => group.id === admissionForm.requestedGroupId)) {
      admissionForm.requestedGroupId = ''
    }
  },
)

const normalizeOptions = (options: unknown) => {
  if (!Array.isArray(options)) return []
  return options.map((option) => {
    if (typeof option === 'string') return { label: option, value: option }
    const item = option as Record<string, unknown>
    return { label: String(item.label ?? item.value ?? ''), value: String(item.value ?? item.label ?? '') }
  })
}

const inputType = (fieldType: string) => {
  if (fieldType === 'email') return 'email'
  if (fieldType === 'date') return 'date'
  if (fieldType === 'number' || fieldType === 'decimal') return 'number'
  if (fieldType === 'file') return 'file'
  return 'text'
}

const documentAccept = (document: PublicDocument) => document.acceptedMimeTypes?.join(',') ?? ''

const hasTextValue = (value: unknown) => {
  if (value === null || value === undefined) return false
  return String(value).trim().length > 0
}

const handleDocumentChange = (document: PublicDocument, event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    selectedDocuments[document.code] = {}
    return
  }

  if (document.acceptedMimeTypes?.length && !document.acceptedMimeTypes.includes(file.type)) {
    selectedDocuments[document.code] = {
      error: `Formato no permitido para ${document.name}.`,
    }
    input.value = ''
    return
  }

  const maxSizeBytes = (document.maxFileSizeMb ?? 10) * 1024 * 1024
  if (file.size > maxSizeBytes) {
    selectedDocuments[document.code] = {
      error: `${document.name} supera ${document.maxFileSizeMb ?? 10} MB.`,
    }
    input.value = ''
    return
  }

  selectedDocuments[document.code] = {
    file,
    fileName: file.name,
  }
}

const submitPublicForm = async () => {
  submissionMessage.value = ''
  submissionError.value = false

  const missingRequired = documents.value
    .filter((document) => document.isRequired)
    .filter((document) => !selectedDocuments[document.code]?.file)

  if (missingRequired.length) {
    submissionError.value = true
    submissionMessage.value = `Faltan documentos obligatorios: ${missingRequired.map((document) => document.name).join(', ')}.`
    return
  }

  submitting.value = true

  try {
    const dynamicAnswers = {
      ...Object.fromEntries(
        Object.entries(dynamicTextValues).filter(([, value]) => hasTextValue(value)),
      ),
      ...Object.fromEntries(
        Object.entries(dynamicBooleanValues).filter(([, value]) => value === true || value === false),
      ),
      ...Object.fromEntries(
        Object.entries(dynamicArrayValues).filter(([, value]) => value.length > 0),
      ),
    }

    const documentEntries = Object.entries(selectedDocuments)
      .filter(([, state]) => state.file)
      .map(([documentCode, state]) => ({
        documentCode,
        fileName: state.file?.name ?? state.fileName ?? '',
        mimeType: state.file?.type ?? null,
        fileSizeBytes: state.file?.size ?? null,
      }))

    const body = new FormData()
    body.set('submissionToken', submissionToken.value)
    body.set('formTemplateId', String(form.value.templateId ?? ''))
    body.set('formTemplateVersionId', String(form.value.versionId ?? ''))
    body.set(
      'student',
      JSON.stringify({
        firstName: fixedForm.firstName,
        middleName: fixedForm.middleName,
        lastName: fixedForm.lastName,
        documentType: fixedForm.documentType,
        documentNumber: fixedForm.documentNumber,
        birthDate: fixedForm.birthDate,
        gender: fixedForm.gender,
        bloodType: fixedForm.bloodType,
      }),
    )
    body.set(
      'guardian',
      JSON.stringify({
        firstName: fixedForm.guardianFirstName,
        lastName: fixedForm.guardianLastName,
        documentType: fixedForm.guardianDocumentType,
        documentNumber: fixedForm.guardianDocumentNumber,
        phone: fixedForm.guardianPhone,
        email: fixedForm.guardianEmail,
        relationship: fixedForm.guardianRelationship,
      }),
    )
    body.set(
      'admission',
      JSON.stringify({
        requestedGradeId: admissionForm.requestedGradeId,
        requestedGroupId: admissionForm.requestedGroupId || null,
        source: admissionForm.source,
      }),
    )
    body.set('answers', JSON.stringify(dynamicAnswers))
    body.set('documents', JSON.stringify(documentEntries))

    Object.entries(selectedDocuments).forEach(([documentCode, state]) => {
      if (state.file) {
        body.append(`document:${documentCode}`, state.file, state.file.name)
      }
    })

    const response = await api.submitPublicAdmissionWithFiles(
      String(route.params.tenantSlug),
      String(route.params.year),
      body,
    )

    submissionMessage.value =
      response.message + ' La solicitud ya quedó registrada y los documentos fueron cargados correctamente.'
    submissionToken.value = crypto.randomUUID()
  } catch (caught) {
    submissionError.value = true
    submissionMessage.value = caught instanceof Error ? caught.message : 'No pudimos enviar la inscripcion.'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    const response = await api.getPublicAdmissionProcess(String(route.params.tenantSlug), String(route.params.year))
    payload.value = response.data
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Error inesperado.'
  } finally {
    loading.value = false
  }
})
</script>
