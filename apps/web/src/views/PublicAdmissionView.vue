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
          <p>Estamos validando el colegio, el año lectivo y la ventana pública.</p>
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
            <strong>El formulario no está abierto</strong>
            <p>El colegio publicó este proceso, pero la fecha actual está fuera de la ventana permitida.</p>
          </div>

          <template v-else>
            <!-- Progress bar -->
            <div class="wizard-progress">
              <div class="wizard-progress__bar">
                <div class="wizard-progress__fill" :style="{ width: `${((currentStep) / totalSteps) * 100}%` }"></div>
              </div>
              <p class="wizard-progress__text">Paso {{ currentStep }} de {{ totalSteps }}</p>
            </div>

            <!-- Step indicators -->
            <div class="wizard-steps">
              <button
                v-for="(step, index) in wizardSteps"
                :key="index"
                type="button"
                class="wizard-step"
                :class="{
                  'wizard-step--active': currentStep === index + 1,
                  'wizard-step--completed': currentStep > index + 1
                }"
                @click="goToStep(index + 1)"
              >
                <span class="wizard-step__number">{{ currentStep > index + 1 ? '✓' : index + 1 }}</span>
                <span class="wizard-step__label">{{ step.title }}</span>
              </button>
            </div>

            <form class="public-form" @submit.prevent="handleSubmit">
              <!-- Step 1: Student Info -->
              <section v-if="currentStep === 1" class="public-form__section wizard-section">
                <div class="wizard-section__header">
                  <h2>¿Quién es el estudiante?</h2>
                  <p>Ingresa los datos básicos del niño, niña o joven que va a ingresar al colegio.</p>
                </div>

                <div class="form-grid">
                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Nombre del estudiante</span>
                      <strong>*</strong>
                    </span>
                    <input v-model="fixedForm.firstName" required placeholder="Ej: Juan José" />
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Segundo nombre</span>
                    </span>
                    <input v-model="fixedForm.middleName" placeholder="Opcional" />
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Apellidos</span>
                      <strong>*</strong>
                    </span>
                    <input v-model="fixedForm.lastName" required placeholder="Ej: Morales Pérez" />
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Tipo de documento</span>
                      <strong>*</strong>
                    </span>
                    <select v-model="fixedForm.documentType" required>
                      <option value="TI">Tarjeta de Identidad</option>
                      <option value="RC">Registro Civil</option>
                      <option value="CC">Cédula de Ciudadanía</option>
                      <option value="CE">Cédula de Extranjería</option>
                      <option value="PP">Pasaporte</option>
                    </select>
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Número de documento</span>
                      <strong>*</strong>
                    </span>
                    <input v-model="fixedForm.documentNumber" required placeholder="Sin puntos ni guiones" />
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
                      <span>Sexo</span>
                      <strong>*</strong>
                    </span>
                    <select v-model="fixedForm.gender" required>
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                    </select>
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Tipo de sangre</span>
                    </span>
                    <select v-model="fixedForm.bloodType">
                      <option value="">No sé / Prefiero no decir</option>
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

              <!-- Step 2: Guardian Info -->
              <section v-if="currentStep === 2" class="public-form__section wizard-section">
                <div class="wizard-section__header">
                  <h2>¿Quién es el acudiente?</h2>
                  <p>La persona que recibe los reportes y se comunica con el colegio.</p>
                </div>

                <div class="form-grid">
                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Nombre del acudiente</span>
                      <strong>*</strong>
                    </span>
                    <input v-model="fixedForm.guardianFirstName" required placeholder="Ej: María" />
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Apellidos del acudiente</span>
                      <strong>*</strong>
                    </span>
                    <input v-model="fixedForm.guardianLastName" required placeholder="Ej: López de Morales" />
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Tipo de documento</span>
                      <strong>*</strong>
                    </span>
                    <select v-model="fixedForm.guardianDocumentType" required>
                      <option value="CC">Cédula de Ciudadanía</option>
                      <option value="CE">Cédula de Extranjería</option>
                      <option value="PP">Pasaporte</option>
                    </select>
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Número de documento</span>
                      <strong>*</strong>
                    </span>
                    <input v-model="fixedForm.guardianDocumentNumber" required placeholder="Sin puntos ni guiones" />
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Teléfono</span>
                      <strong>*</strong>
                    </span>
                    <input v-model="fixedForm.guardianPhone" type="tel" required placeholder="Ej: 300 123 4567" />
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Correo electrónico</span>
                      <strong>*</strong>
                    </span>
                    <input v-model="fixedForm.guardianEmail" type="email" required placeholder="Ej: maria@correo.com" />
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Parentesco con el estudiante</span>
                      <strong>*</strong>
                    </span>
                    <select v-model="fixedForm.guardianRelationship" required>
                      <option value="madre">Madre</option>
                      <option value="padre">Padre</option>
                      <option value="abuelo">Abuelo(a)</option>
                      <option value="tio">Tío(a)</option>
                      <option value="otro">Otro familiar</option>
                    </select>
                  </label>
                </div>
              </section>

              <!-- Step 3: Academic Request -->
              <section v-if="currentStep === 3" class="public-form__section wizard-section">
                <div class="wizard-section__header">
                  <h2>¿A qué grado aspira?</h2>
                  <p>Selecciona el grado al que quiere ingresar el estudiante.</p>
                </div>

                <div class="form-grid">
                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Grado deseado</span>
                      <strong>*</strong>
                    </span>
                    <select v-model="admissionForm.requestedGradeId" required>
                      <option value="">Elige un grado...</option>
                      <option v-for="grade in grades" :key="grade.id" :value="grade.id">
                        {{ grade.name }}
                      </option>
                    </select>
                  </label>

                  <label class="public-field">
                    <span class="public-field__label">
                      <span>Curso preferido</span>
                    </span>
                    <select v-model="admissionForm.requestedGroupId">
                      <option value="">El colegio asigna después</option>
                      <option v-for="group in availableGroups" :key="group.id" :value="group.id">
                        {{ group.name }}
                      </option>
                    </select>
                    <span class="public-field__hint">Si no estás seguro, déjalo en blanco.</span>
                  </label>
                </div>
              </section>

              <!-- Step 4: Additional Info (dynamic sections) -->
              <section v-if="currentStep === 4" class="public-form__section wizard-section">
                <div class="wizard-section__header">
                  <h2>Información adicional</h2>
                  <p>El colegio necesita algunos datos extra. Completa lo que puedas.</p>
                </div>

                <div v-if="sections.length === 0" class="wizard-empty">
                  <p>No hay preguntas adicionales por responder. Puedes continuar al siguiente paso.</p>
                </div>

                <template v-for="section in sections" :key="section.code">
                  <div class="wizard-subsection">
                    <h3>{{ section.title }}</h3>
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
                          <option value="">Elige una opción...</option>
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
                        <textarea v-else-if="field.fieldType === 'textarea'" v-model="dynamicTextValues[field.code]" :required="field.isRequired" placeholder="Escribe aquí..." />
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
                        <input v-else v-model="dynamicTextValues[field.code]" :type="inputType(field.fieldType)" :required="field.isRequired" :placeholder="fieldPlaceholder(field.fieldType)" />
                      </label>
                    </div>
                  </div>
                </template>
              </section>

              <!-- Step 5: Documents -->
              <section v-if="currentStep === 5" class="public-form__section wizard-section">
                <div class="wizard-section__header">
                  <h2>Documentos</h2>
                  <p>Sube los documentos que el colegio solicita. Los obligatorios están marcados con un asterisco (*).</p>
                </div>

                <div v-if="documents.length === 0" class="wizard-empty">
                  <p>Este proceso no requiere documentos adicionales.</p>
                </div>

                <div v-else class="upload-list">
                  <div v-for="document in documents" :key="document.code" class="upload-card">
                    <div class="upload-card__meta">
                      <span class="document-row__icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                      </span>
                      <div>
                        <strong>{{ document.name }}</strong>
                        <small>
                          {{ document.isRequired ? 'Obligatorio' : 'Opcional' }}
                          <template v-if="document.maxFileSizeMb"> · Máximo {{ document.maxFileSizeMb }} MB</template>
                        </small>
                      </div>
                      <StatusBadge :status="document.isRequired ? 'obligatorio' : 'opcional'" />
                    </div>

                    <label class="upload-card__picker" :class="{ 'upload-card__picker--done': selectedDocuments[document.code]?.fileName }">
                      <svg v-if="!selectedDocuments[document.code]?.fileName" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      <span>{{ selectedDocuments[document.code]?.fileName || 'Seleccionar archivo' }}</span>
                      <input
                        type="file"
                        :accept="documentAccept(document)"
                        @change="handleDocumentChange(document, $event)"
                      />
                    </label>

                    <p v-if="selectedDocuments[document.code]?.error" class="upload-status upload-status--error">
                      {{ selectedDocuments[document.code]?.error }}
                    </p>
                  </div>
                </div>
              </section>

              <!-- Step 6: Review -->
              <section v-if="currentStep === 6" class="public-form__section wizard-section">
                <div class="wizard-section__header">
                  <h2>Revisa antes de enviar</h2>
                  <p>Verifica que toda la información sea correcta. Puedes volver a cualquier paso para corregir.</p>
                </div>

                <div class="review-summary">
                  <div class="review-group">
                    <div class="review-group__header">
                      <h3>Estudiante</h3>
                      <button type="button" class="review-edit" @click="goToStep(1)">Editar</button>
                    </div>
                    <div class="review-fields">
                      <div class="review-field">
                        <span>Nombre completo</span>
                        <strong>{{ fixedForm.firstName }} {{ fixedForm.middleName }} {{ fixedForm.lastName }}</strong>
                      </div>
                      <div class="review-field">
                        <span>Documento</span>
                        <strong>{{ documentTypeLabel(fixedForm.documentType) }} {{ fixedForm.documentNumber }}</strong>
                      </div>
                      <div class="review-field">
                        <span>Fecha de nacimiento</span>
                        <strong>{{ fixedForm.birthDate || 'No especificada' }}</strong>
                      </div>
                      <div class="review-field">
                        <span>Sexo</span>
                        <strong>{{ genderLabel(fixedForm.gender) }}</strong>
                      </div>
                    </div>
                  </div>

                  <div class="review-group">
                    <div class="review-group__header">
                      <h3>Acudiente</h3>
                      <button type="button" class="review-edit" @click="goToStep(2)">Editar</button>
                    </div>
                    <div class="review-fields">
                      <div class="review-field">
                        <span>Nombre</span>
                        <strong>{{ fixedForm.guardianFirstName }} {{ fixedForm.guardianLastName }}</strong>
                      </div>
                      <div class="review-field">
                        <span>Contacto</span>
                        <strong>{{ fixedForm.guardianPhone }} · {{ fixedForm.guardianEmail }}</strong>
                      </div>
                      <div class="review-field">
                        <span>Parentesco</span>
                        <strong>{{ relationshipLabel(fixedForm.guardianRelationship) }}</strong>
                      </div>
                    </div>
                  </div>

                  <div class="review-group">
                    <div class="review-group__header">
                      <h3>Solicitud académica</h3>
                      <button type="button" class="review-edit" @click="goToStep(3)">Editar</button>
                    </div>
                    <div class="review-fields">
                      <div class="review-field">
                        <span>Grado</span>
                        <strong>{{ gradeName }}</strong>
                      </div>
                      <div class="review-field">
                        <span>Curso</span>
                        <strong>{{ groupName || 'Por asignar' }}</strong>
                      </div>
                    </div>
                  </div>

                  <div v-if="documents.length" class="review-group">
                    <div class="review-group__header">
                      <h3>Documentos</h3>
                      <button type="button" class="review-edit" @click="goToStep(5)">Editar</button>
                    </div>
                    <div class="review-fields">
                      <div v-for="document in documents" :key="document.code" class="review-field">
                        <span>{{ document.name }}</span>
                        <strong :class="{ 'review-field--missing': document.isRequired && !selectedDocuments[document.code]?.fileName }">
                          {{ selectedDocuments[document.code]?.fileName || 'No cargado' }}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Navigation buttons -->
              <div class="wizard-nav">
                <button
                  v-if="currentStep > 1"
                  class="button button--ghost"
                  type="button"
                  @click="prevStep"
                >
                  ← Volver
                </button>
                <div v-else></div>

                <button
                  v-if="currentStep < totalSteps"
                  class="button button--brand"
                  type="button"
                  @click="nextStep"
                >
                  Continuar →
                </button>
                <button
                  v-else
                  class="button button--brand wizard-submit"
                  type="submit"
                  :disabled="submitting"
                >
                  {{ submitting ? 'Enviando...' : 'Enviar inscripción' }}
                </button>
              </div>

              <p v-if="submissionMessage" class="public-submit-message" :class="{ 'public-submit-message--error': submissionError }">
                {{ submissionMessage }}
              </p>
            </form>
          </template>
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
const currentStep = ref(1)
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

const wizardSteps = [
  { title: 'Estudiante' },
  { title: 'Acudiente' },
  { title: 'Grado' },
  { title: 'Información extra' },
  { title: 'Documentos' },
  { title: 'Revisar' },
]

const totalSteps = computed(() => wizardSteps.length)

const tenant = computed(() => (payload.value?.tenant ?? {}) as Record<string, unknown>)
const academicYear = computed(() => (payload.value?.academicYear ?? {}) as Record<string, unknown>)
const process = computed(() => (payload.value?.process ?? {}) as Record<string, unknown>)
const form = computed(() => (payload.value?.form ?? {}) as Record<string, unknown>)
const catalogs = computed(() => (payload.value?.catalogs ?? {}) as Record<string, unknown>)
const tenantName = computed(() => String(tenant.value.name ?? 'OfirSchool'))
const academicYearName = computed(() => String(academicYear.value.name ?? `Año lectivo ${route.params.year}`))
const processName = computed(() => String(process.value.name ?? 'Formulario de inscripción'))
const processDescription = computed(() => String(process.value.description ?? 'Completa la información solicitada por el colegio.'))
const processStartsOn = computed(() => String(process.value.startsOn ?? '--'))
const processEndsOn = computed(() => String(process.value.endsOn ?? '--'))
const isOpen = computed(() => Boolean(process.value.isOpen))
const processStatusLabel = computed(() => String(process.value.status ?? 'público'))
const sections = computed(() => ((form.value.sections as PublicSection[] | undefined) ?? []))
const documents = computed(() => ((form.value.requiredDocuments as PublicDocument[] | undefined) ?? []))
const grades = computed(() => ((catalogs.value.grades as PublicGrade[] | undefined) ?? []))
const groups = computed(() => ((catalogs.value.groups as PublicGroup[] | undefined) ?? []))
const availableGroups = computed(() =>
  admissionForm.requestedGradeId
    ? groups.value.filter((group) => group.gradeId === admissionForm.requestedGradeId)
    : groups.value,
)

const gradeName = computed(() => {
  const grade = grades.value.find((g) => g.id === admissionForm.requestedGradeId)
  return grade?.name || 'No seleccionado'
})

const groupName = computed(() => {
  const group = availableGroups.value.find((g) => g.id === admissionForm.requestedGroupId)
  return group?.name || ''
})

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

const fieldPlaceholder = (fieldType: string) => {
  const placeholders: Record<string, string> = {
    text: 'Escribe aquí...',
    email: 'Ej: correo@ejemplo.com',
    phone: 'Ej: 300 123 4567',
    number: 'Escribe un número',
    date: 'Selecciona una fecha',
  }
  return placeholders[fieldType] || ''
}

const documentTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    TI: 'Tarjeta de Identidad',
    RC: 'Registro Civil',
    CC: 'Cédula',
    CE: 'Cédula de Extranjería',
    PP: 'Pasaporte',
  }
  return labels[type] || type
}

const genderLabel = (gender: string) => {
  const labels: Record<string, string> = {
    masculino: 'Masculino',
    femenino: 'Femenino',
  }
  return labels[gender] || gender
}

const relationshipLabel = (rel: string) => {
  const labels: Record<string, string> = {
    madre: 'Madre',
    padre: 'Padre',
    abuelo: 'Abuelo(a)',
    tio: 'Tío(a)',
    otro: 'Otro familiar',
  }
  return labels[rel] || rel
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

const goToStep = (step: number) => {
  if (step >= 1 && step <= totalSteps.value) {
    currentStep.value = step
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const nextStep = () => {
  if (currentStep.value < totalSteps.value) {
    currentStep.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const handleSubmit = () => {
  if (currentStep.value === totalSteps.value) {
    submitPublicForm()
  } else {
    nextStep()
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
    currentStep.value = 5
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
    submissionMessage.value = caught instanceof Error ? caught.message : 'No pudimos enviar la inscripción.'
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

<style src="./public-admission/PublicAdmissionView.css" scoped></style>
