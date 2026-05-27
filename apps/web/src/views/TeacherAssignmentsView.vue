<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Carga docente" subtitle="Asigna docentes por curso y materia, respetando la intensidad horaria máxima semanal.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nueva asignación</button>
      </template>
    </PageHeader>

    <SurfaceCard>
      <div class="form-grid">
        <label>
          Año lectivo
          <select v-model="filters.academicYearId">
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Curso
          <select v-model="filters.groupId">
            <option value="">Todos</option>
            <option v-for="course in filteredCourses" :key="course.id" :value="course.id">{{ course.gradeName }} · {{ course.name }}</option>
          </select>
        </label>
        <label>
          Docente
          <select v-model="filters.teacherId">
            <option value="">Todos</option>
            <option v-for="teacher in activeTeachers" :key="teacher.id" :value="teacher.id">{{ teacher.fullName }}</option>
          </select>
        </label>
      </div>
    </SurfaceCard>

    <SurfaceCard v-if="selectedTeacher">
      <div class="card-headline">
        <div>
          <h3>{{ selectedTeacher.fullName }}</h3>
          <p>{{ selectedTeacher.specialty || 'Sin especialidad registrada' }}</p>
        </div>
        <strong>{{ selectedTeacherAssignedHours }}h / {{ selectedTeacher.maxWeeklyHours }}h</strong>
      </div>
      <p class="text-xs text-gray-500">
        Disponibles: <strong>{{ selectedTeacher.maxWeeklyHours - selectedTeacherAssignedHours }}h</strong>
      </p>
    </SurfaceCard>

    <ListView
      ref="listViewRef"
      title="Asignaciones operativas"
      subtitle="La malla base sigue siendo por grado, pero la carga docente se define por curso y materia."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar curso, grado, materia o docente"
      create-label="Nueva asignación"
      :reload-key="reloadKey"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #toolbar-actions>
        <button class="button button--brand" type="button" @click="openCreate">Nueva asignación</button>
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar asignación docente' : 'Nueva asignación docente'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>
          Año lectivo
          <select v-model="form.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Curso
          <select v-model="form.groupId" required>
            <option v-for="course in modalCourses" :key="course.id" :value="course.id">{{ course.gradeName }} · {{ course.name }}</option>
          </select>
        </label>
        <label>
          Materia
          <select v-model="form.subjectId" required>
            <option v-for="subject in modalSubjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
          </select>
        </label>
        <label>
          Docente
          <select v-model="form.teacherId">
            <option value="">Sin asignar</option>
            <option v-for="teacher in activeTeachers" :key="teacher.id" :value="teacher.id">{{ teacher.fullName }}</option>
          </select>
        </label>
        <label>
          Horas semanales
          <input v-model.number="form.weeklyHours" type="number" min="1" max="40" required />
        </label>
        <p class="form-note">
          {{ teacherLoadHint }}
        </p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar asignación</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AcademicYearDto, CourseDto, CourseSubjectDto, GradeSubjectDto, SubjectDto, TeacherDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'
import { useAcademicContextStore } from '../stores/academic-context'

type TableRow = { id: string } & Record<string, unknown>

const academicContext = useAcademicContextStore()
const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isModalOpen = ref(false)
const editingId = ref('')
const feedback = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const courses = ref<CourseDto[]>([])
const gradeSubjects = ref<GradeSubjectDto[]>([])
const teachers = ref<TeacherDto[]>([])
const assignments = ref<CourseSubjectDto[]>([])
const yearAssignments = ref<CourseSubjectDto[]>([])

const filters = reactive({
  academicYearId: '',
  groupId: '',
  teacherId: '',
})

const form = reactive({
  academicYearId: '',
  groupId: '',
  subjectId: '',
  teacherId: '',
  weeklyHours: 4,
})

const columns = [
  { key: 'academicYearName', label: 'Año lectivo' },
  { key: 'groupLabel', label: 'Curso' },
  { key: 'subjectName', label: 'Materia' },
  { key: 'teacherName', label: 'Docente' },
  { key: 'weeklyHours', label: 'Horas/semana' },
]

const filteredCourses = computed(() => courses.value.filter((course) => course.academicYearId === filters.academicYearId))
const modalCourses = computed(() => courses.value.filter((course) => course.academicYearId === form.academicYearId))
const activeTeachers = computed(() => teachers.value.filter((teacher) => teacher.status === 'active'))
const selectedTeacher = computed(() => teachers.value.find((teacher) => teacher.id === filters.teacherId) ?? null)
const reloadKey = computed(() => `${filters.academicYearId}-${filters.groupId}-${filters.teacherId}`)

const modalSubjects = computed(() => {
  const course = courses.value.find((item) => item.id === form.groupId)
  if (!course) return [] as Array<{ id: string; name: string }>
  const seen = new Set<string>()
  return gradeSubjects.value
    .filter((item) => item.academicYearId === form.academicYearId && item.gradeId === course.gradeId)
    .filter((item) => {
      if (seen.has(item.subjectId)) return false
      seen.add(item.subjectId)
      return true
    })
    .map((item) => ({ id: item.subjectId, name: item.subjectName }))
})

const selectedTeacherAssignedHours = computed(() =>
  yearAssignments.value
    .filter((item) => item.academicYearId === filters.academicYearId && item.teacherId === filters.teacherId)
    .reduce((acc, item) => acc + (item.weeklyHours ?? 0), 0),
)

const teacherLoadHint = computed(() => {
  if (!form.teacherId) return 'Puedes dejar la asignación sin docente y completarla después.'
  const teacher = teachers.value.find((item) => item.id === form.teacherId)
  if (!teacher) return 'Selecciona un docente válido.'
  const currentLoad = yearAssignments.value
    .filter((item) => item.academicYearId === form.academicYearId && item.teacherId === form.teacherId && item.id !== editingId.value)
    .reduce((acc, item) => acc + (item.weeklyHours ?? 0), 0)
  const projected = currentLoad + form.weeklyHours
  return `Carga proyectada: ${projected}h de ${teacher.maxWeeklyHours}h máximas.`
})

const loadOptions = async () => {
  const [yearsResponse, coursesResponse, gradeSubjectsResponse, teachersResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
    api.getGradeSubjects({ page: 1, pageSize: 100 }),
    api.getTeachers({ page: 1, pageSize: 100 }),
  ])
  academicYears.value = yearsResponse.data.items
  courses.value = coursesResponse.data.items
  gradeSubjects.value = gradeSubjectsResponse.data.items
  teachers.value = teachersResponse.data.items
  filters.academicYearId ||= academicContext.activeYearId || academicYears.value[0]?.id || ''
  form.academicYearId ||= filters.academicYearId
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const [response, allYearResponse] = await Promise.all([
    api.getCourseSubjects({
      academicYearId: filters.academicYearId,
      groupId: filters.groupId,
      teacherId: filters.teacherId,
    }),
    api.getCourseSubjects({ academicYearId: filters.academicYearId }),
  ])
  assignments.value = response.data.items
  yearAssignments.value = allYearResponse.data.items
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = response.data.items
    .map((item) => ({
      ...item,
      groupLabel: `${item.gradeName || ''} · ${item.groupName || ''}`,
      teacherName: item.teacherName || 'Sin asignar',
    }))
    .filter((item) =>
      !normalizedQuery ||
      [item.groupName, item.gradeName, item.subjectName, item.teacherName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    )

  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)
  return {
    items: items as unknown as TableRow[],
    total: filtered.length,
    page,
    pageSize,
  }
}

const openCreate = () => {
  feedback.value = ''
  editingId.value = ''
  const defaultAcademicYearId = filters.academicYearId || academicContext.activeYearId || academicYears.value[0]?.id || ''
  const defaultCourse = courses.value.find((course) => course.academicYearId === defaultAcademicYearId)
  Object.assign(form, {
    academicYearId: defaultAcademicYearId,
    groupId: filters.groupId || defaultCourse?.id || '',
    subjectId: '',
    teacherId: filters.teacherId || '',
    weeklyHours: 4,
  })
  form.subjectId = modalSubjects.value[0]?.id || ''
  isModalOpen.value = true
}

const openEdit = (row: Record<string, unknown>) => {
  feedback.value = ''
  const item = row as unknown as CourseSubjectDto
  editingId.value = item.id
  Object.assign(form, {
    academicYearId: item.academicYearId,
    groupId: item.groupId,
    subjectId: item.subjectId,
    teacherId: item.teacherId || '',
    weeklyHours: item.weeklyHours,
  })
  isModalOpen.value = true
}

const openDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteCourseSubject(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Asignación eliminada.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar la asignación.'
  }
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitForm = async () => {
  try {
    const payload = {
      academicYearId: form.academicYearId,
      groupId: form.groupId,
      subjectId: form.subjectId,
      teacherId: form.teacherId || null,
      weeklyHours: form.weeklyHours,
    }
    if (editingId.value) await api.updateCourseSubject(editingId.value, payload)
    else await api.createCourseSubject(payload)
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Asignación docente guardada correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar la asignación.'
  }
}

watch(
  () => [form.academicYearId, form.groupId],
  () => {
    if (!modalSubjects.value.find((subject) => subject.id === form.subjectId)) {
      form.subjectId = modalSubjects.value[0]?.id || ''
    }
  },
)

onMounted(loadOptions)
</script>
