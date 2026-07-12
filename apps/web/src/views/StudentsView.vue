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

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar estudiante' : 'Nuevo estudiante'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
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
              <p>Luego de la ficha fija puedes crear la inscripción anual en el mismo guardado.</p>
            </div>
          </div>

          <div class="wizard-steps wizard-steps--compact">
            <button
              class="wizard-step"
              :class="{ 'wizard-step--active': formStep === 'student' }"
              type="button"
              @click="formStep = 'student'"
            >
              <span>1</span>
              Ficha
            </button>
            <button
              class="wizard-step"
              :class="{ 'wizard-step--active': formStep === 'admission' }"
              type="button"
              :disabled="!canOpenAdmissionStep"
              @click="goToAdmissionStep"
            >
              <span>2</span>
              Inscripción
            </button>
          </div>

          <div v-if="formStep === 'student'" class="detail-panel">
            <p class="detail-note">
              Puedes guardar solo la ficha del estudiante o continuar para pedir grado, curso y acudiente antes de guardar.
            </p>
          </div>

          <div v-else class="form-grid student-admission-grid">
            <label>
              Año lectivo activo
              <input :value="academicContext.activeYearName" disabled />
            </label>
            <label>
              Tipo de ingreso
              <select v-model="admissionForm.source">
                <option value="new_student">Alumno nuevo</option>
                <option value="transfer">Traslado</option>
                <option value="reentry">Reingreso</option>
              </select>
            </label>
            <label>
              Grado solicitado
              <select v-model="admissionForm.requestedGradeId" required>
                <option value="">Selecciona un grado</option>
                <option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
              </select>
            </label>
            <label>
              Curso sugerido
              <select v-model="admissionForm.requestedGroupId">
                <option value="">Asignar después</option>
                <option v-for="group in admissionGroupOptions" :key="group.id" :value="group.id">{{ group.name }}</option>
              </select>
            </label>

            <div class="form-grid__wide section-divider">
              <strong>Acudiente principal</strong>
            </div>

            <label>
              Nombres acudiente
              <input v-model="admissionForm.guardian.firstName" required />
            </label>
            <label>
              Apellidos acudiente
              <input v-model="admissionForm.guardian.lastName" required />
            </label>
            <label>
              Tipo documento acudiente
              <select v-model="admissionForm.guardian.documentType" required>
                <option v-for="option in guardianDocumentTypeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label>
              Documento acudiente
              <input v-model="admissionForm.guardian.documentNumber" required />
            </label>
            <label>
              Teléfono
              <input v-model="admissionForm.guardian.phone" required />
            </label>
            <label>
              Correo
              <input v-model="admissionForm.guardian.email" type="email" required />
            </label>
            <label>
              Parentesco
              <select v-model="admissionForm.guardian.relationship" required>
                <option value="madre">Madre</option>
                <option value="padre">Padre</option>
                <option value="abuelo">Abuelo/a</option>
                <option value="tio">Tío/a</option>
                <option value="acudiente">Acudiente</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label class="form-grid__wide">
              Observaciones
              <textarea v-model="admissionForm.notes" placeholder="Información interna para admisiones" />
            </label>
          </div>
        </section>

        <section v-else class="form-grid__wide">
          <div class="card-headline">
            <div>
              <h3>Datos de inscripción del año activo</h3>
              <p>Los campos dinámicos no se editan desde esta ficha. Aquí se muestran como referencia del proceso anual.</p>
            </div>
            <button
              v-if="editingId"
              class="button button--ghost"
              type="button"
              @click="openAdmissionsModule"
            >
              Ir a inscripciones
            </button>
          </div>

          <div v-if="!editingId" class="detail-panel">
            <p class="detail-note">
              Primero guarda la ficha fija del estudiante. Luego podrás consultar su inscripción asociada al año lectivo activo.
            </p>
          </div>

          <div v-else-if="admissionProfileLoading" class="detail-panel">
            <p class="detail-note">Cargando inscripción asociada...</p>
          </div>

          <div v-else-if="admissionProfileError" class="detail-panel">
            <p class="detail-note">{{ admissionProfileError }}</p>
          </div>

          <div v-else-if="activeAdmission" class="admission-detail-stack">
            <section class="admission-detail-grid">
              <article class="detail-panel">
                <span class="window-strip__label">Solicitud</span>
                <strong>{{ activeAdmission.application.academicYearName }}</strong>
                <dl class="detail-list">
                  <div><dt>Estado</dt><dd><StatusBadge :status="String(activeAdmission.application.status)" /></dd></div>
                  <div><dt>Grado solicitado</dt><dd>{{ activeAdmission.application.requestedGradeName }}</dd></div>
                  <div><dt>Curso sugerido</dt><dd>{{ activeAdmission.application.requestedGroupName || 'Asignar después' }}</dd></div>
                  <div><dt>Enviada</dt><dd>{{ activeAdmission.application.submittedAt || activeAdmission.application.applicationDate }}</dd></div>
                </dl>
              </article>

              <article class="detail-panel">
                <span class="window-strip__label">Acudiente principal</span>
                <strong>{{ activeAdmission.guardian ? `${activeAdmission.guardian.firstName} ${activeAdmission.guardian.lastName}` : 'Sin acudiente' }}</strong>
                <dl class="detail-list">
                  <div><dt>Documento</dt><dd>{{ activeAdmission.guardian ? `${activeAdmission.guardian.documentType} ${activeAdmission.guardian.documentNumber}` : 'Sin dato' }}</dd></div>
                  <div><dt>Teléfono</dt><dd>{{ activeAdmission.guardian?.phone || 'Sin dato' }}</dd></div>
                  <div><dt>Correo</dt><dd>{{ activeAdmission.guardian?.email || 'Sin dato' }}</dd></div>
                  <div><dt>Parentesco</dt><dd>{{ activeAdmission.guardian?.relationship || 'Sin dato' }}</dd></div>
                </dl>
              </article>
            </section>

            <section class="detail-panel">
              <div class="card-headline">
                <div>
                  <h3>Campos dinámicos</h3>
                  <p>Información capturada desde el formulario de inscripción del año activo.</p>
                </div>
              </div>

              <div v-if="activeAdmission.sections.length" class="detail-section-list">
                <article v-for="section in activeAdmission.sections" :key="section.title" class="detail-section-card">
                  <h4>{{ section.title }}</h4>
                  <div class="detail-field-grid">
                    <div v-for="field in section.fields" :key="field.fieldCode" class="detail-field-card">
                      <span>{{ field.fieldLabel }}</span>
                      <strong>{{ field.displayValue }}</strong>
                    </div>
                  </div>
                </article>
              </div>
              <EmptyState
                v-else
                title="Sin respuestas dinámicas"
                description="La inscripción asociada no tiene campos adicionales respondidos."
              />
            </section>

            <section class="detail-panel">
              <div class="card-headline">
                <div>
                  <h3>Documentos reportados</h3>
                  <p>Adjuntos ligados a la inscripción del año activo.</p>
                </div>
              </div>

              <div v-if="activeAdmission.documents.length" class="detail-document-list">
                <div v-for="document in activeAdmission.documents" :key="document.id" class="detail-document-row">
                  <div>
                    <strong>{{ document.name }}</strong>
                    <small>{{ document.fileName }}</small>
                  </div>
                  <div class="detail-document-meta">
                    <span>{{ document.mimeType || 'Tipo no informado' }}</span>
                    <StatusBadge :status="String(document.status)" />
                  </div>
                </div>
              </div>
              <EmptyState
                v-else
                title="Sin documentos"
                description="No hay documentos listados para esta inscripción."
              />
            </section>
          </div>

          <div v-else class="detail-panel">
            <p class="detail-note">
              Este estudiante no tiene una inscripción asociada al año lectivo activo. Los datos dinámicos se diligencian desde el módulo de inscripciones.
            </p>
          </div>
        </section>
        <p v-if="feedback" class="action-feedback form-grid__wide">{{ feedback }}</p>
        <div v-if="!editingId && formStep === 'student'" class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--ghost" type="button" :disabled="saving" @click="submitStudentOnly">
            {{ saving ? 'Guardando...' : 'Guardar solo ficha' }}
          </button>
          <button class="button button--brand" type="button" @click="goToAdmissionStep">
            Continuar a inscripción
          </button>
        </div>
        <div v-else-if="!editingId" class="modal-actions">
          <button class="button button--ghost" type="button" :disabled="saving" @click="formStep = 'student'">Atrás</button>
          <button class="button button--ghost" type="button" :disabled="saving" @click="submitStudentOnly">
            Guardar solo ficha
          </button>
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
import type { AcademicGradeDto, CourseDto, StudentAdmissionProfileDto, StudentDto } from '@ofir/shared'
import { useRouter } from 'vue-router'
import { api } from '../lib/api'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import EmptyState from '../components/EmptyState.vue'
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
const formStep = ref<'student' | 'admission'>('student')
const studentToDelete = ref<StudentDto | null>(null)
const admissionProfile = ref<StudentAdmissionProfileDto['admission'] | null>(null)
const admissionProfileLoading = ref(false)
const admissionProfileError = ref('')
const academicContext = useAcademicContextStore()
const router = useRouter()
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

const admissionGroupOptions = computed(() =>
  admissionForm.requestedGradeId
    ? courseOptions.value.filter((course) => course.gradeId === admissionForm.requestedGradeId && (!selectedAcademicYearId.value || course.academicYearId === selectedAcademicYearId.value))
    : courseOptions.value.filter((course) => !selectedAcademicYearId.value || course.academicYearId === selectedAcademicYearId.value),
)

const hasStudentMinimumData = computed(() =>
  Boolean(form.firstName.trim() && form.lastName.trim() && form.documentType && form.documentNumber.trim() && form.birthDate && form.gender),
)
const canOpenAdmissionStep = computed(() => Boolean(hasStudentMinimumData.value && selectedAcademicYearId.value))
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
  formStep.value = 'student'
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

const openCreate = () => {
  feedback.value = ''
  resetForm()
  isModalOpen.value = true
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
  void loadAdmissionProfile(student.id)
}

const openDelete = (row: Record<string, unknown>) => {
  studentToDelete.value = row as unknown as StudentDto
}

const closeModal = () => {
  isModalOpen.value = false
  resetForm()
}

const openAdmissionsModule = async () => {
  closeModal()
  await router.push('/admissions')
}

const goToAdmissionStep = () => {
  if (!canOpenAdmissionStep.value) {
    feedback.value = selectedAcademicYearId.value
      ? 'Completa nombres, apellidos, tipo y número de documento, fecha de nacimiento y género antes de continuar.'
      : 'No hay un año lectivo activo para crear la inscripción.'
    return
  }
  feedback.value = ''
  admissionForm.requestedGradeId ||= gradeOptions.value[0]?.id ?? ''
  formStep.value = 'admission'
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

const submitStudentOnly = async () => {
  await saveStudentOnly()
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
  if (!editingId.value && formStep.value === 'admission') {
    await submitAdmissionWizard()
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

.wizard-steps--compact {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.wizard-step {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface);
  color: var(--text-soft);
  padding: 0.75rem 0.9rem;
  font-weight: 700;
  text-align: left;
}

.wizard-step span {
  display: inline-flex;
  width: 1.7rem;
  height: 1.7rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--surface-soft);
  color: var(--text-soft);
  font-size: 0.85rem;
}

.wizard-step--active {
  border-color: rgba(124, 92, 255, 0.4);
  background: rgba(124, 92, 255, 0.08);
  color: var(--text);
}

.wizard-step--active span {
  background: var(--brand-primary);
  color: white;
}

.wizard-step:disabled {
  cursor: not-allowed;
  opacity: 0.55;
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
</style>
