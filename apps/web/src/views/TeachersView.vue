<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Docentes" subtitle="Administra la planta docente y controla su intensidad horaria máxima semanal.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo docente</button>
      </template>
    </PageHeader>

    <section class="window-strip">
      <div>
        <span class="window-strip__label">Control de carga</span>
        <strong>La disponibilidad se calcula con la carga docente del año lectivo seleccionado.</strong>
      </div>
      <div class="date-chip-list">
        <span class="date-chip">{{ selectedYear?.name ?? 'Sin ano activo' }}</span>
      </div>
    </section>

    <ListView
      ref="listViewRef"
      title="Listado de docentes"
      subtitle="Visualiza horas máximas, horas ya asignadas y disponibilidad restante."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar docente o especialidad"
      create-label="Nuevo docente"
      :reload-key="filters.academicYearId"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #toolbar-actions>
        <select v-model="filters.academicYearId" class="toolbar-select">
          <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
        </select>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo docente</button>
      </template>

      <template #cell-status="{ row }">
        <span :class="['status-badge', row.status === 'active' ? 'status-badge--active' : 'status-badge--inactive']">
          {{ row.status === 'active' ? 'Activo' : 'Inactivo' }}
        </span>
      </template>

      <template #cell-workload="{ row }">
        <strong>{{ row.assignedHours }}h / {{ row.maxWeeklyHours }}h</strong>
      </template>

      <template #cell-availableHours="{ row }">
        <span :class="row.availableHours < 0 ? 'text-red' : ''">{{ row.availableHours }}h</span>
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar docente' : 'Nuevo docente'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label class="form-grid__wide">
          Nombre completo
          <input v-model="form.fullName" required placeholder="Ej. Maria Fernanda Perez" />
        </label>
        <label class="form-grid__wide">
          Usuario del sistema
          <select v-model="form.userId">
            <option value="">-- Sin vincular --</option>
            <option v-for="candidate in availableUserCandidates" :key="candidate.id" :value="candidate.id">
              {{ candidate.fullName }} · {{ candidate.email }}{{ candidate.hasTeacherRole ? '' : ' · sin rol docente' }}
            </option>
          </select>
        </label>
        <label>
          Correo
          <input v-model="form.email" type="email" placeholder="docente@colegio.edu.co" />
        </label>
        <label>
          Telefono
          <input v-model="form.phone" placeholder="3001234567" />
        </label>
        <label>
          Especialidad
          <input v-model="form.specialty" placeholder="Matematicas, Ingles, Ciencias..." />
        </label>
        <label>
          Estado
          <select v-model="form.status" required>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
        <label>
          Maximo de horas semanales
          <input v-model.number="form.maxWeeklyHours" type="number" min="1" max="168" required />
        </label>
        <p class="form-note">
          Solo los usuarios con rol `teacher` verán su operación académica filtrada automáticamente al iniciar sesión.
        </p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar docente</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AcademicYearDto, CourseSubjectDto, TeacherDto, TeacherUserCandidateDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import { api } from '../lib/api'
import { useAcademicContextStore } from '../stores/academic-context'

type TeacherRow = TeacherDto & {
  assignedHours: number
  availableHours: number
  workload: string
}

type TableRow = { id: string } & Record<string, unknown>

const academicContext = useAcademicContextStore()
const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isModalOpen = ref(false)
const editingId = ref('')
const feedback = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const userCandidates = ref<TeacherUserCandidateDto[]>([])
const filters = reactive({ academicYearId: '' })
const form = reactive({
  userId: '',
  fullName: '',
  email: '',
  phone: '',
  specialty: '',
  status: 'active',
  maxWeeklyHours: 22,
})

const columns = [
  { key: 'fullName', label: 'Docente' },
  { key: 'linkedUserLabel', label: 'Usuario vinculado' },
  { key: 'specialty', label: 'Especialidad' },
  { key: 'status', label: 'Estado' },
  { key: 'workload', label: 'Carga semanal' },
  { key: 'availableHours', label: 'Disponible' },
]

const selectedYear = computed(() => academicYears.value.find((year) => year.id === filters.academicYearId))
const availableUserCandidates = computed(() =>
  userCandidates.value.filter((candidate) => !candidate.linkedTeacherId || candidate.linkedTeacherId === editingId.value),
)

const loadOptions = async () => {
  const [yearsResponse, userCandidatesResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getTeacherUserCandidates(),
  ])
  academicYears.value = yearsResponse.data.items
  userCandidates.value = userCandidatesResponse.data.items
  filters.academicYearId ||= academicContext.activeYearId || academicYears.value[0]?.id || ''
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const teachersResponse = await api.getTeachers({ page, pageSize, query })
  const assignmentsItems = filters.academicYearId
    ? (await api.getCourseSubjects({ academicYearId: filters.academicYearId })).data.items
    : []

  const assignedHoursByTeacher = (assignmentsItems as CourseSubjectDto[]).reduce<Record<string, number>>((acc, item) => {
    if (!item.teacherId) return acc
    acc[item.teacherId] = (acc[item.teacherId] ?? 0) + (item.weeklyHours ?? 0)
    return acc
  }, {})

  const items = teachersResponse.data.items.map((item) => {
    const assignedHours = assignedHoursByTeacher[item.id] ?? 0
    const availableHours = item.maxWeeklyHours - assignedHours
    return {
      ...item,
      linkedUserLabel: item.userId
        ? userCandidates.value.find((candidate) => candidate.id === item.userId)?.email || 'Usuario vinculado'
        : 'Sin vincular',
      specialty: item.specialty || 'Sin especialidad',
      assignedHours,
      availableHours,
      workload: `${assignedHours}h / ${item.maxWeeklyHours}h`,
    }
  })

  return { ...teachersResponse.data, items: items as unknown as TableRow[] }
}

const openCreate = () => {
  feedback.value = ''
  editingId.value = ''
  Object.assign(form, {
    userId: '',
    fullName: '',
    email: '',
    phone: '',
    specialty: '',
    status: 'active',
    maxWeeklyHours: 22,
  })
  isModalOpen.value = true
}

const openEdit = (row: Record<string, unknown>) => {
  feedback.value = ''
  const item = row as unknown as TeacherDto
  editingId.value = item.id
  Object.assign(form, {
    userId: item.userId || '',
    fullName: item.fullName,
    email: item.email || '',
    phone: item.phone || '',
    specialty: item.specialty || '',
    status: item.status,
    maxWeeklyHours: item.maxWeeklyHours,
  })
  isModalOpen.value = true
}

const openDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteTeacher(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Docente eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el docente.'
  }
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitForm = async () => {
  try {
    const payload = {
      userId: form.userId || null,
      fullName: form.fullName,
      email: form.email || null,
      phone: form.phone || null,
      specialty: form.specialty || null,
      status: form.status,
      maxWeeklyHours: form.maxWeeklyHours,
    }
    if (editingId.value) await api.updateTeacher(editingId.value, payload)
    else await api.createTeacher(payload)
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Docente guardado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar el docente.'
  }
}

watch(
  () => form.userId,
  (userId) => {
    const candidate = userCandidates.value.find((item) => item.id === userId)
    if (!candidate || editingId.value) return
    form.fullName = candidate.fullName
    form.email = candidate.email
  },
)

onMounted(loadOptions)
</script>
