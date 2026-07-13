<template>
  <section class="stack">
    <PageHeader
      eyebrow="Modulo academico"
      title="Estudiantes"
      subtitle="Ficha permanente del estudiante. Desde aqui se conecta con inscripciones y matriculas por ano lectivo."
    >
      <template #actions>
        <label class="page-inline-filter">
          <span>Año lectivo activo</span>
          <input :value="academicContext.activeYearName" disabled />
        </label>
      </template>
    </PageHeader>

    <section class="domain-flow-card" aria-label="Relacion estudiante inscripcion matricula">
      <div>
        <span class="domain-flow-card__step">1</span>
        <strong>Estudiante</strong>
        <p>Datos generales y documentos base que permanecen en el tiempo.</p>
      </div>
      <span class="domain-flow-card__arrow">→</span>
      <div>
        <span class="domain-flow-card__step">2</span>
        <strong>Inscripcion</strong>
        <p>Proceso de admision asociado al estudiante para un ano lectivo.</p>
      </div>
      <span class="domain-flow-card__arrow">→</span>
      <div>
        <span class="domain-flow-card__step">3</span>
        <strong>Matricula anual</strong>
        <p>Registro academico del ano: grado, grupo, asistencia, notas y cartera.</p>
      </div>
    </section>

    <ListView
      ref="listViewRef"
      title="Base de estudiantes"
      subtitle="Los datos generales se reutilizan en inscripciones y matriculas de cada ano."
      :columns="columns"
      :fetcher="fetchStudents"
      search-placeholder="Buscar por nombre o documento"
      create-label="Nuevo estudiante"
      :reload-key="reloadKey"
      @edit="openEdit"
      @delete="openDelete"
      @create="openCreate"
    >
      <template #toolbar-actions>
        <select v-model="filters.gradeId" class="toolbar-select">
          <option value="">Todos los grados</option>
          <option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
        </select>
        <select v-model="filters.groupId" class="toolbar-select">
          <option value="">Todos los cursos</option>
          <option v-for="group in filteredGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
        </select>
        <button class="button button--ghost" type="button">Importar</button>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo estudiante</button>
      </template>

      <template #cell-firstName="{ row }">
        <div class="list-view__primary-cell">
          <strong>{{ row.firstName }} {{ row.middleName || '' }}</strong>
          <small>{{ row.documentType }} {{ row.documentNumber }}</small>
        </div>
      </template>

      <template #cell-lastName="{ row }">
        <div class="list-view__primary-cell">
          <strong>{{ row.lastName }}</strong>
          <small>{{ row.academicYearName || 'Sin matrícula anual' }}</small>
        </div>
      </template>

      <template #cell-gradeName="{ value }">
        {{ value || 'Sin grado' }}
      </template>

      <template #cell-groupName="{ value }">
        {{ value || 'Sin curso' }}
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :status="String(row.status)" />
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar estudiante' : 'Nuevo estudiante'" size="full" @close="closeModal">
      <form class="form-grid student-form-grid" @submit.prevent="submitForm">
        <label>
          Nombres
          <input v-model="form.firstName" required />
        </label>
        <label>
          Segundo nombre
          <input v-model="form.middleName" />
        </label>
        <label>
          Apellidos
          <input v-model="form.lastName" required />
        </label>
        <label>
          Tipo documento
          <select v-model="form.documentType" required>
            <option v-for="option in studentDocumentTypeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          Número documento
          <input v-model="form.documentNumber" required />
        </label>
        <label>
          Fecha nacimiento
          <input v-model="form.birthDate" type="date" required />
        </label>
        <label>
          Genero
          <select v-model="form.gender">
            <option value="masculino">Masculino</option>
            <option value="femenino">Femenino</option>
            <option value="otro">Otro</option>
            <option value="no_informa">Prefiere no informar</option>
          </select>
        </label>
        <label>
          Grupo sanguineo
          <select v-model="form.bloodType">
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
        <label>
          Estado
          <select v-model="form.status">
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
        <section v-if="!editingId" class="form-grid__wide student-admission-wizard">
          <div class="card-headline">
            <div>
              <h3>Datos de inscripción del año activo</h3>
              <p>Completa la información anual de inscripción para guardar el estudiante.</p>
            </div>
          </div>
          <div class="form-grid student-admission-grid">
            <label>Año lectivo activo<input :value="academicContext.activeYearName" disabled /></label>
            <label>Tipo de ingreso<select v-model="admissionForm.source"><option value="new_student">Alumno nuevo</option><option value="transfer">Traslado</option><option value="reentry">Reingreso</option></select></label>
            <label>Grado solicitado<select v-model="admissionForm.requestedGradeId" required><option value="">Selecciona un grado</option><option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option></select></label>
            <label>Curso sugerido<select v-model="admissionForm.requestedGroupId"><option value="">Asignar después</option><option v-for="group in admissionGroupOptions" :key="group.id" :value="group.id">{{ group.name }}</option></select></label>
            <div class="form-grid__wide section-divider"><strong>Acudiente principal</strong></div>
            <label>Nombres acudiente<input v-model="admissionForm.guardian.firstName" required /></label>
            <label>Apellidos acudiente<input v-model="admissionForm.guardian.lastName" required /></label>
            <label>Tipo documento acudiente<select v-model="admissionForm.guardian.documentType" required><option v-for="option in guardianDocumentTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
            <label>Documento acudiente<input v-model="admissionForm.guardian.documentNumber" required /></label>
            <label>Teléfono<input v-model="admissionForm.guardian.phone" required /></label>
            <label>Correo<input v-model="admissionForm.guardian.email" type="email" required /></label>
            <label>Parentesco<select v-model="admissionForm.guardian.relationship" required><option value="madre">Madre</option><option value="padre">Padre</option><option value="abuelo">Abuelo/a</option><option value="tio">Tío/a</option><option value="acudiente">Acudiente</option><option value="otro">Otro</option></select></label>
            <label class="form-grid__wide">Observaciones<textarea v-model="admissionForm.notes" placeholder="Información interna para admisiones" /></label>

            <div class="form-grid__wide section-divider"><strong>Formulario dinámico</strong></div>
            <div v-if="activeAdmissionFormLoading" class="form-grid__wide detail-panel">
              <p class="detail-note">Cargando preguntas configuradas...</p>
            </div>
            <div v-else-if="activeAdmissionFormError" class="form-grid__wide detail-panel">
              <p class="detail-note">{{ activeAdmissionFormError }}</p>
            </div>
            <div v-else-if="dynamicSections.length === 0" class="form-grid__wide detail-panel">
              <p class="detail-note">No hay preguntas dinámicas publicadas para este año lectivo.</p>
            </div>
            <template v-else>
              <section v-for="section in dynamicSections" :key="section.id" class="form-grid__wide dynamic-section">
                <div class="dynamic-section__header">
                  <strong>{{ section.title }}</strong>
                  <small v-if="section.description">{{ section.description }}</small>
                </div>
                <div class="form-grid">
                  <label v-for="field in section.fields" :key="field.code" :class="{ 'field-checkbox': field.fieldType === 'checkbox' }">
                    <span>{{ field.label }}<strong v-if="field.isRequired"> *</strong></span>
                    <select v-if="field.fieldType === 'select'" v-model="dynamicTextValues[field.code]" :required="field.isRequired">
                      <option value="">Selecciona una opción</option>
                      <option v-for="option in normalizeOptions(field.options)" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                    <select v-else-if="field.fieldType === 'multiselect'" v-model="dynamicArrayValues[field.code]" multiple :required="field.isRequired">
                      <option v-for="option in normalizeOptions(field.options)" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                    <textarea v-else-if="field.fieldType === 'textarea'" v-model="dynamicTextValues[field.code]" :required="field.isRequired" :placeholder="field.placeholder || ''" />
                    <input v-else-if="field.fieldType === 'checkbox'" v-model="dynamicBooleanValues[field.code]" type="checkbox" />
                    <div v-else-if="field.fieldType === 'radio'" class="choice-row">
                      <label v-for="option in normalizeOptions(field.options)" :key="option.value" class="choice-pill">
                        <input v-model="dynamicTextValues[field.code]" type="radio" :value="option.value" />
                        <span>{{ option.label }}</span>
                      </label>
                    </div>
                    <input v-else v-model="dynamicTextValues[field.code]" :type="inputType(field.fieldType)" :required="field.isRequired" :placeholder="field.placeholder || ''" />
                    <small v-if="field.helpText">{{ field.helpText }}</small>
                  </label>
                </div>
              </section>
            </template>
          </div>
        </section>

        <section v-else class="form-grid__wide">
          <div class="card-headline">
            <div>
              <h3>Datos de inscripci&oacute;n del a&ntilde;o activo</h3>
              <p>Grado, curso, acudiente y datos de admisi&oacute;n asociados al a&ntilde;o lectivo activo.</p>
            </div>
          </div>

          <div v-if="admissionProfileLoading" class="detail-panel">
            <p class="detail-note">Cargando inscripci&oacute;n asociada...</p>
          </div>

          <div v-else-if="admissionProfileError" class="detail-panel">
            <p class="detail-note">{{ admissionProfileError }}</p>
          </div>

          <div v-else-if="activeAdmission" class="form-grid student-admission-grid">
            <label>A&ntilde;o lectivo<input :value="activeAdmission.application.academicYearName" disabled /></label>
            <label>Tipo de ingreso<select v-model="admissionForm.source"><option value="new_student">Alumno nuevo</option><option value="transfer">Traslado</option><option value="reentry">Reingreso</option></select></label>
            <label>Grado solicitado<select v-model="admissionForm.requestedGradeId" required><option value="">Selecciona un grado</option><option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option></select></label>
            <label>Curso sugerido<select v-model="admissionForm.requestedGroupId"><option value="">Asignar despu&eacute;s</option><option v-for="group in admissionGroupOptions" :key="group.id" :value="group.id">{{ group.name }}</option></select></label>
            <div class="form-grid__wide section-divider"><strong>Acudiente principal</strong></div>
            <label>Nombres acudiente<input v-model="admissionForm.guardian.firstName" required /></label>
            <label>Apellidos acudiente<input v-model="admissionForm.guardian.lastName" required /></label>
            <label>Tipo documento acudiente<select v-model="admissionForm.guardian.documentType" required><option v-for="option in guardianDocumentTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
            <label>Documento acudiente<input v-model="admissionForm.guardian.documentNumber" required /></label>
            <label>Tel&eacute;fono<input v-model="admissionForm.guardian.phone" required /></label>
            <label>Correo<input v-model="admissionForm.guardian.email" type="email" required /></label>
            <label>Parentesco<select v-model="admissionForm.guardian.relationship" required><option value="madre">Madre</option><option value="padre">Padre</option><option value="abuelo">Abuelo/a</option><option value="tio">T&iacute;o/a</option><option value="acudiente">Acudiente</option><option value="otro">Otro</option></select></label>
            <label class="form-grid__wide">Observaciones<textarea v-model="admissionForm.notes" placeholder="Informaci&oacute;n interna para admisiones" /></label>
            <template v-if="activeAdmission.sections.length">
              <div class="form-grid__wide section-divider"><strong>Respuestas del formulario</strong></div>
              <section v-for="section in activeAdmission.sections" :key="section.title" class="form-grid__wide dynamic-section dynamic-section--readonly">
                <div class="dynamic-section__header">
                  <strong>{{ section.title }}</strong>
                </div>
                <dl class="dynamic-answer-list">
                  <div v-for="field in section.fields" :key="field.fieldCode">
                    <dt>{{ field.fieldLabel }}</dt>
                    <dd>{{ field.displayValue }}</dd>
                  </div>
                </dl>
              </section>
            </template>
          </div>

          <div v-else class="detail-panel">
            <p class="detail-note">Este estudiante no tiene una inscripci&oacute;n asociada al a&ntilde;o lectivo activo. Ve al m&oacute;dulo de inscripciones para crear una.</p>
          </div>
        </section>
        <p v-if="feedback" class="action-feedback form-grid__wide">{{ feedback }}</p>
        <div v-if="!editingId" class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="saving">
            {{ saving ? 'Guardando...' : 'Guardar estudiante e inscripción' }}
          </button>
        </div>
        <div v-else class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="saving">
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </form>
    </FormModal>

    <ConfirmDialog
      :open="Boolean(studentToDelete)"
      title="Eliminar estudiante"
      description="Se hará soft delete del registro y quedará auditado."
      @cancel="studentToDelete = null"
      @confirm="confirmDelete"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AcademicGradeDto, AdmissionActiveFormDto, AdmissionFormFieldDto, AdmissionFormSectionDto, CourseDto, StudentAdmissionProfileDto, StudentDto } from '@ofir/shared'
import { api } from '../lib/api'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useAcademicContextStore } from '../stores/academic-context'

const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isModalOpen = ref(false)
const saving = ref(false)
const feedback = ref('')
const editingId = ref('')
const studentToDelete = ref<StudentDto | null>(null)
const admissionProfile = ref<StudentAdmissionProfileDto['admission'] | null>(null)
const admissionProfileLoading = ref(false)
const admissionProfileError = ref('')
const activeAdmissionForm = ref<AdmissionActiveFormDto['form'] | null>(null)
const activeAdmissionFormLoading = ref(false)
const activeAdmissionFormError = ref('')
const academicContext = useAcademicContextStore()
const gradeOptions = ref<AcademicGradeDto[]>([])
const courseOptions = ref<CourseDto[]>([])
const filters = reactive({
  gradeId: '',
  groupId: '',
})
const columns = [
  { key: 'firstName', label: 'Estudiante' },
  { key: 'lastName', label: 'Apellidos' },
  { key: 'gradeName', label: 'Grado' },
  { key: 'groupName', label: 'Curso' },
  { key: 'documentType', label: 'Tipo doc.' },
  { key: 'documentNumber', label: 'Documento' },
  { key: 'gender', label: 'Genero' },
  { key: 'bloodType', label: 'RH' },
  { key: 'status', label: 'Estado' },
]
const reloadKey = computed(() => `${academicContext.selectedYear}-${filters.gradeId}-${filters.groupId}`)
const selectedAcademicYearId = computed(() => academicContext.activeYearId)
const selectedAcademicYearNumber = computed(() => {
  const activeYearNumber = academicContext.activeYear?.year
  if (typeof activeYearNumber === 'number') return activeYearNumber

  const rawYear = academicContext.selectedYear
  const parsedYear = Number(rawYear)
  if (Number.isFinite(parsedYear)) return parsedYear

  const matchedYear = academicContext.academicYears.find((year) => year.id === rawYear)
  return matchedYear?.year
})
const filteredGroups = computed(() =>
  filters.gradeId
    ? courseOptions.value.filter((course) => course.gradeId === filters.gradeId && (!selectedAcademicYearId.value || selectedAcademicYearId.value === course.academicYearId))
    : courseOptions.value.filter((course) => !selectedAcademicYearId.value || selectedAcademicYearId.value === course.academicYearId),
)
const documentTypeOptions = [
  { value: 'RC', label: 'RC - Registro civil' },
  { value: 'TI', label: 'TI - Tarjeta de identidad' },
  { value: 'CC', label: 'CC - Cédula de ciudadanía' },
  { value: 'CE', label: 'CE - Cédula de extranjería' },
  { value: 'PEP', label: 'PEP - Permiso especial de permanencia' },
  { value: 'PPT', label: 'PPT - Permiso por protección temporal' },
  { value: 'PAS', label: 'PAS - Pasaporte' },
  { value: 'NES', label: 'NES - Número establecido por Secretaría' },
]
const studentDocumentTypeOptions = documentTypeOptions
const guardianDocumentTypeOptions = documentTypeOptions.filter((option) => option.value !== 'RC' && option.value !== 'TI')

const form = reactive({
  firstName: '',
  middleName: '',
  lastName: '',
  documentType: 'TI',
  documentNumber: '',
  birthDate: '',
  gender: 'masculino',
  bloodType: '',
  status: 'active',
})

const admissionForm = reactive({
  requestedGradeId: '',
  requestedGroupId: '',
  source: 'new_student' as 'new_student' | 'transfer' | 'reentry',
  notes: '',
  guardian: {
    firstName: '',
    lastName: '',
    documentType: 'CC',
    documentNumber: '',
    phone: '',
    email: '',
    relationship: 'madre',
  },
})
const dynamicTextValues = reactive<Record<string, string>>({})
const dynamicBooleanValues = reactive<Record<string, boolean>>({})
const dynamicArrayValues = reactive<Record<string, string[]>>({})

const admissionGroupOptions = computed(() =>
  admissionForm.requestedGradeId
    ? courseOptions.value.filter((course) => course.gradeId === admissionForm.requestedGradeId && (!selectedAcademicYearId.value || course.academicYearId === selectedAcademicYearId.value))
    : courseOptions.value.filter((course) => !selectedAcademicYearId.value || course.academicYearId === selectedAcademicYearId.value),
)

const hasAdmissionMinimumData = computed(() =>
  Boolean(
    selectedAcademicYearId.value &&
    admissionForm.requestedGradeId &&
    admissionForm.guardian.firstName.trim() &&
    admissionForm.guardian.lastName.trim() &&
    admissionForm.guardian.documentType &&
    admissionForm.guardian.documentNumber.trim() &&
    admissionForm.guardian.phone.trim() &&
    admissionForm.guardian.email.trim(),
  ),
)

const activeAdmission = computed(() => admissionProfile.value)
const dynamicSections = computed<AdmissionFormSectionDto[]>(() => activeAdmissionForm.value?.sections ?? [])

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
  if (fieldType === 'datetime') return 'datetime-local'
  return 'text'
}

const hasDynamicValue = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

const resetDynamicAnswers = () => {
  Object.keys(dynamicTextValues).forEach((key) => delete dynamicTextValues[key])
  Object.keys(dynamicBooleanValues).forEach((key) => delete dynamicBooleanValues[key])
  Object.keys(dynamicArrayValues).forEach((key) => delete dynamicArrayValues[key])
}

const buildDynamicAnswers = () => ({
  ...Object.fromEntries(Object.entries(dynamicTextValues).filter(([, value]) => hasDynamicValue(value))),
  ...Object.fromEntries(Object.entries(dynamicBooleanValues).filter(([, value]) => value === true || value === false)),
  ...Object.fromEntries(Object.entries(dynamicArrayValues).filter(([, value]) => value.length > 0)),
})

const validateDynamicRequiredFields = () => {
  const answers = buildDynamicAnswers()
  return dynamicSections.value
    .flatMap((section) => section.fields)
    .filter((field) => field.isRequired)
    .filter((field) => !hasDynamicValue(answers[field.code]))
    .map((field) => field.label)
}

const initializeDynamicAnswers = () => {
  resetDynamicAnswers()
  dynamicSections.value.forEach((section) => {
    section.fields.forEach((field: AdmissionFormFieldDto) => {
      if (field.fieldType === 'checkbox') {
        dynamicBooleanValues[field.code] = false
      } else if (field.fieldType === 'multiselect') {
        dynamicArrayValues[field.code] = []
      } else {
        dynamicTextValues[field.code] = ''
      }
    })
  })
}

const resetAdmissionForm = () => {
  admissionForm.requestedGradeId = gradeOptions.value[0]?.id ?? ''
  admissionForm.requestedGroupId = ''
  admissionForm.source = 'new_student'
  admissionForm.notes = ''
  Object.assign(admissionForm.guardian, {
    firstName: '',
    lastName: '',
    documentType: 'CC',
    documentNumber: '',
    phone: '',
    email: '',
    relationship: 'madre',
  })
  resetDynamicAnswers()
}

const resetForm = () => {
  form.firstName = ''
  form.middleName = ''
  form.lastName = ''
  form.documentType = 'TI'
  form.documentNumber = ''
  form.birthDate = ''
  form.gender = 'masculino'
  form.bloodType = ''
  form.status = 'active'
  admissionProfile.value = null
  admissionProfileLoading.value = false
  admissionProfileError.value = ''
  activeAdmissionForm.value = null
  activeAdmissionFormLoading.value = false
  activeAdmissionFormError.value = ''
  editingId.value = ''
  resetAdmissionForm()
}

const fetchStudents = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getStudents({
    page,
    pageSize,
    query,
    year: selectedAcademicYearNumber.value,
    gradeId: filters.gradeId,
    groupId: filters.groupId,
  })
  return {
    ...response.data,
    items: response.data.items as unknown as Array<{ id: string } & Record<string, unknown>>,
  }
}

const loadCatalogs = async () => {
  const [gradesResponse, coursesResponse] = await Promise.all([
    api.getAcademicGrades({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
  ])
  gradeOptions.value = gradesResponse.data.items
  courseOptions.value = coursesResponse.data.items
}

const loadActiveAdmissionForm = async () => {
  activeAdmissionForm.value = null
  activeAdmissionFormError.value = ''

  if (!selectedAcademicYearNumber.value) return

  activeAdmissionFormLoading.value = true
  try {
    const response = await api.getActiveAdmissionForm(selectedAcademicYearNumber.value)
    activeAdmissionForm.value = response.data.form
    initializeDynamicAnswers()
  } catch (error) {
    activeAdmissionForm.value = null
    activeAdmissionFormError.value = error instanceof Error ? error.message : 'No fue posible cargar el formulario de inscripción.'
  } finally {
    activeAdmissionFormLoading.value = false
  }
}

const openCreate = async () => {
  feedback.value = ''
  resetForm()
  isModalOpen.value = true
  await loadActiveAdmissionForm()
}

const loadAdmissionProfile = async (studentId: string) => {
  admissionProfileLoading.value = true
  admissionProfileError.value = ''

  try {
    const response = await api.getStudentAdmissionProfile(studentId, selectedAcademicYearNumber.value)
    admissionProfile.value = response.data.admission
  } catch (error) {
    admissionProfile.value = null
    admissionProfileError.value = error instanceof Error ? error.message : 'No fue posible cargar la inscripción asociada.'
  } finally {
    admissionProfileLoading.value = false
  }
}

const openEdit = async (row: Record<string, unknown>) => {
  feedback.value = ''
  const student = row as unknown as StudentDto
  editingId.value = student.id
  form.firstName = student.firstName
  form.middleName = student.middleName ?? ''
  form.lastName = student.lastName
  form.documentType = student.documentType
  form.documentNumber = student.documentNumber
  form.birthDate = student.birthDate ?? ''
  form.gender = student.gender ?? 'masculino'
  form.bloodType = student.bloodType ?? ''
  form.status = student.status
  isModalOpen.value = true
  void loadAdmissionProfile(student.id).then(() => {
    if (activeAdmission.value) {
      const app = activeAdmission.value.application
      admissionForm.requestedGradeId = app.requestedGradeId
      admissionForm.requestedGroupId = app.requestedGroupId ?? ''
      admissionForm.source = (app.source as 'new_student' | 'transfer' | 'reentry') || 'new_student'
      admissionForm.notes = app.notes ?? ''
      if (activeAdmission.value.guardian) {
        const g = activeAdmission.value.guardian
        admissionForm.guardian.firstName = g.firstName
        admissionForm.guardian.lastName = g.lastName
        admissionForm.guardian.documentType = g.documentType
        admissionForm.guardian.documentNumber = g.documentNumber
        admissionForm.guardian.phone = g.phone
        admissionForm.guardian.email = g.email
        admissionForm.guardian.relationship = g.relationship
      }
    }
  })
}

const openDelete = (row: Record<string, unknown>) => {
  studentToDelete.value = row as unknown as StudentDto
}

const closeModal = () => {
  isModalOpen.value = false
  resetForm()
}

const saveStudentOnly = async () => {
  const payload = { ...form }

  saving.value = true
  feedback.value = ''
  try {
    if (editingId.value) {
      await api.updateStudent(editingId.value, payload)
      feedback.value = 'Estudiante actualizado correctamente.'
    } else {
      await api.createStudent(payload)
      feedback.value = 'Estudiante creado correctamente.'
    }

    await listViewRef.value?.reload()
    closeModal()
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar el estudiante.'
  } finally {
    saving.value = false
  }
}

const submitAdmissionWizard = async () => {
  if (!selectedAcademicYearId.value) {
    feedback.value = 'No hay un año lectivo activo para crear la inscripción.'
    return
  }
  if (!hasAdmissionMinimumData.value) {
    feedback.value = 'Completa grado solicitado y los datos obligatorios del acudiente.'
    return
  }
  const missingDynamicFields = validateDynamicRequiredFields()
  if (missingDynamicFields.length) {
    feedback.value = `Faltan campos obligatorios del formulario: ${missingDynamicFields.join(', ')}.`
    return
  }

  saving.value = true
  feedback.value = ''
  try {
    await api.createManualAdmission({
      academicYearId: selectedAcademicYearId.value,
      requestedGradeId: admissionForm.requestedGradeId,
      requestedGroupId: admissionForm.requestedGroupId || null,
      source: admissionForm.source,
      notes: admissionForm.notes || null,
      student: {
        firstName: form.firstName,
        middleName: form.middleName || null,
        lastName: form.lastName,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        birthDate: form.birthDate,
        gender: form.gender,
        bloodType: form.bloodType || null,
      },
      guardian: {
        firstName: admissionForm.guardian.firstName,
        lastName: admissionForm.guardian.lastName,
        documentType: admissionForm.guardian.documentType,
        documentNumber: admissionForm.guardian.documentNumber,
        phone: admissionForm.guardian.phone,
        email: admissionForm.guardian.email,
        relationship: admissionForm.guardian.relationship,
      },
      answers: buildDynamicAnswers(),
    })
    await listViewRef.value?.reload()
    feedback.value = 'Estudiante e inscripción creados correctamente.'
    closeModal()
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible crear la inscripción.'
  } finally {
    saving.value = false
  }
}

const submitForm = async () => {
  if (!editingId.value) {
    await submitAdmissionWizard()
    return
  }

  if (editingId.value && activeAdmission.value) {
    saving.value = true
    feedback.value = ''
    try {
      await api.updateStudent(editingId.value, { ...form })
      await api.updateAdmissionApplication(activeAdmission.value.application.id, {
        requestedGradeId: admissionForm.requestedGradeId,
        requestedGroupId: admissionForm.requestedGroupId || null,
        source: admissionForm.source,
        notes: admissionForm.notes || null,
        guardian: { ...admissionForm.guardian },
      })
      feedback.value = 'Estudiante e inscripción actualizados correctamente.'
      await listViewRef.value?.reload()
      closeModal()
    } catch (error) {
      feedback.value = error instanceof Error ? error.message : 'No fue posible guardar los cambios.'
    } finally {
      saving.value = false
    }
    return
  }

  await saveStudentOnly()
}

const confirmDelete = async () => {
  if (!studentToDelete.value) return
  await api.deleteStudent(studentToDelete.value.id)
  await listViewRef.value?.reload()
  studentToDelete.value = null
}

watch(
  () => filters.gradeId,
  () => {
    if (!filteredGroups.value.find((group) => group.id === filters.groupId)) {
      filters.groupId = ''
    }
  },
)

watch(
  () => admissionForm.requestedGradeId,
  () => {
    if (!admissionGroupOptions.value.find((group) => group.id === admissionForm.requestedGroupId)) {
      admissionForm.requestedGroupId = ''
    }
  },
)

watch(
  () => academicContext.selectedYear,
  () => {
    if (!filteredGroups.value.find((group) => group.id === filters.groupId)) {
      filters.groupId = ''
    }
  },
)

onMounted(async () => {
  if (!academicContext.academicYears.length) {
    await academicContext.loadAcademicYears()
  }
  await loadCatalogs()
})

</script>

<style scoped>
.student-admission-wizard {
  display: grid;
  gap: 1rem;
}

@media (min-width: 1100px) {
  .student-form-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.student-admission-grid {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface-soft);
}

.section-divider {
  padding-top: 0.25rem;
}

.dynamic-section {
  display: grid;
  gap: 0.85rem;
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface);
}

.dynamic-section__header {
  display: grid;
  gap: 0.2rem;
}

.dynamic-section__header small,
.dynamic-answer-list dt {
  color: var(--text-soft);
}

.field-checkbox {
  align-items: flex-start;
}

.field-checkbox input {
  width: auto;
}

.choice-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.choice-pill {
  display: inline-flex;
  width: auto;
  flex-direction: row;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--surface-soft);
}

.choice-pill input {
  width: auto;
}

.dynamic-answer-list {
  display: grid;
  gap: 0.65rem;
  margin: 0;
}

.dynamic-answer-list div {
  display: grid;
  gap: 0.15rem;
}

.dynamic-answer-list dt,
.dynamic-answer-list dd {
  margin: 0;
}

.dynamic-answer-list dd {
  font-weight: 700;
}
</style>
