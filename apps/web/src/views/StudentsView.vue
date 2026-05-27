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
          <input v-model="form.documentType" required />
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
        <section class="form-grid__wide">
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
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar</button>
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
const editingId = ref('')
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

const activeAdmission = computed(() => admissionProfile.value)

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
  editingId.value = ''
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

const submitForm = async () => {
  const payload = { ...form }

  if (editingId.value) {
    await api.updateStudent(editingId.value, payload)
  } else {
    await api.createStudent(payload)
  }

  await listViewRef.value?.reload()
  closeModal()
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
