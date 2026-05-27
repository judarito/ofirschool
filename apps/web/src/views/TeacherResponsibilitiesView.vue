<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Directores y coordinaciones" subtitle="Define directores de grupo y cargos de coordinación para el año lectivo.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nueva responsabilidad</button>
      </template>
    </PageHeader>

    <ListView
      ref="listViewRef"
      title="Responsabilidades vigentes"
      subtitle="El director de grupo se asigna por curso. Las coordinaciones pueden tener un cargo o alcance general."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar docente, curso o cargo"
      create-label="Nueva responsabilidad"
      :reload-key="reloadKey"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #toolbar-actions>
        <select v-model="filters.academicYearId" class="toolbar-select">
          <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
        </select>
        <select v-model="filters.responsibilityType" class="toolbar-select">
          <option value="">Todas</option>
          <option value="group_director">Directores de grupo</option>
          <option value="coordinator">Coordinaciones</option>
        </select>
        <button class="button button--brand" type="button" @click="openCreate">Nueva responsabilidad</button>
      </template>

      <template #cell-responsibilityType="{ row }">
        {{ row.responsibilityType === 'group_director' ? 'Director de grupo' : 'Coordinación' }}
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar responsabilidad' : 'Nueva responsabilidad'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>
          Año lectivo
          <select v-model="form.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Tipo de responsabilidad
          <select v-model="form.responsibilityType" required>
            <option value="group_director">Director de grupo</option>
            <option value="coordinator">Coordinación</option>
          </select>
        </label>
        <label>
          Docente
          <select v-model="form.teacherId" required>
            <option value="" disabled>Seleccione</option>
            <option v-for="teacher in activeTeachers" :key="teacher.id" :value="teacher.id">{{ teacher.fullName }}</option>
          </select>
        </label>
        <label v-if="form.responsibilityType === 'group_director'">
          Curso
          <select v-model="form.groupId" required>
            <option value="" disabled>Seleccione</option>
            <option v-for="course in modalCourses" :key="course.id" :value="course.id">{{ course.gradeName }} · {{ course.name }}</option>
          </select>
        </label>
        <label v-else>
          Alcance
          <select v-model="form.scopeType" required>
            <option value="global">Todo el colegio</option>
            <option value="level">Nivel</option>
            <option value="grade">Grado</option>
          </select>
        </label>
        <label v-if="form.responsibilityType === 'coordinator' && form.scopeType === 'level'">
          Nivel
          <select v-model="form.levelName" required>
            <option value="" disabled>Seleccione</option>
            <option value="preschool">Preescolar</option>
            <option value="primary">Primaria</option>
            <option value="secondary">Secundaria</option>
            <option value="middle">Media / bachillerato</option>
          </select>
        </label>
        <label v-if="form.responsibilityType === 'coordinator' && form.scopeType === 'grade'">
          Grado
          <select v-model="form.gradeId" required>
            <option value="" disabled>Seleccione</option>
            <option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>
        <label v-if="form.responsibilityType === 'coordinator'">
          Cargo o alcance
          <input v-model="form.title" required placeholder="Ej. Coordinación académica primaria" />
        </label>
        <label class="form-grid__wide">
          Notas
          <textarea v-model="form.notes" rows="3" placeholder="Observaciones internas sobre la responsabilidad..." />
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar responsabilidad</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AcademicGradeDto, AcademicYearDto, CourseDto, TeacherDto, TeacherResponsibilityDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import { api } from '../lib/api'
import { useAcademicContextStore } from '../stores/academic-context'

type TableRow = { id: string } & Record<string, unknown>

const academicContext = useAcademicContextStore()
const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isModalOpen = ref(false)
const editingId = ref('')
const feedback = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const gradeOptions = ref<AcademicGradeDto[]>([])
const courses = ref<CourseDto[]>([])
const teachers = ref<TeacherDto[]>([])

const filters = reactive({
  academicYearId: '',
  responsibilityType: '',
})

const form = reactive<{
  academicYearId: string
  teacherId: string
  responsibilityType: 'group_director' | 'coordinator'
  scopeType: 'global' | 'branch' | 'level' | 'grade' | 'group'
  levelName: string
  gradeId: string
  groupId: string
  title: string
  notes: string
}>({
  academicYearId: '',
  teacherId: '',
  responsibilityType: 'group_director',
  scopeType: 'group',
  levelName: '',
  gradeId: '',
  groupId: '',
  title: '',
  notes: '',
})

const columns = [
  { key: 'academicYearName', label: 'Año lectivo' },
  { key: 'responsibilityType', label: 'Tipo' },
  { key: 'teacherName', label: 'Docente' },
  { key: 'scopeLabel', label: 'Alcance' },
]

const activeTeachers = computed(() => teachers.value.filter((teacher) => teacher.status === 'active'))
const modalCourses = computed(() => courses.value.filter((course) => course.academicYearId === form.academicYearId))
const reloadKey = computed(() => `${filters.academicYearId}-${filters.responsibilityType}`)

const loadOptions = async () => {
  const [yearsResponse, gradesResponse, coursesResponse, teachersResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getAcademicGrades({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
    api.getTeachers({ page: 1, pageSize: 100 }),
  ])
  academicYears.value = yearsResponse.data.items
  gradeOptions.value = gradesResponse.data.items
  courses.value = coursesResponse.data.items
  teachers.value = teachersResponse.data.items
  filters.academicYearId ||= academicContext.activeYearId || academicYears.value[0]?.id || ''
}

const translateLevelName = (value: string | null | undefined) => {
  if (value === 'preschool') return 'Preescolar'
  if (value === 'primary') return 'Primaria'
  if (value === 'secondary') return 'Secundaria'
  if (value === 'middle') return 'Media / bachillerato'
  return 'Todo el colegio'
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getTeacherResponsibilities({
    academicYearId: filters.academicYearId,
    responsibilityType: filters.responsibilityType,
  })
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = response.data.items
    .map((item) => ({
      ...item,
      scopeLabel: item.responsibilityType === 'group_director'
        ? `${item.gradeName || ''} · ${item.groupName || ''}`
        : item.scopeType === 'level'
          ? `${item.title || 'Coordinación'} · ${translateLevelName(item.levelName)}`
          : item.scopeType === 'grade'
            ? `${item.title || 'Coordinación'} · ${item.gradeName || 'Grado'}`
            : item.title || 'Coordinación general',
    }))
    .filter((item) =>
      !normalizedQuery ||
      [item.teacherName, item.groupName, item.gradeName, item.title, item.scopeLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    )
  const start = (page - 1) * pageSize
  return {
    items: filtered.slice(start, start + pageSize) as unknown as TableRow[],
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
    teacherId: activeTeachers.value[0]?.id || '',
    responsibilityType: 'group_director',
    scopeType: 'group',
    levelName: '',
    gradeId: '',
    groupId: defaultCourse?.id || '',
    title: '',
    notes: '',
  })
  isModalOpen.value = true
}

const openEdit = (row: Record<string, unknown>) => {
  feedback.value = ''
  const item = row as unknown as TeacherResponsibilityDto
  editingId.value = item.id
  Object.assign(form, {
    academicYearId: item.academicYearId,
    teacherId: item.teacherId,
    responsibilityType: item.responsibilityType,
    scopeType: item.scopeType,
    levelName: item.levelName || '',
    gradeId: item.gradeId || '',
    groupId: item.groupId || '',
    title: item.title || '',
    notes: item.notes || '',
  })
  isModalOpen.value = true
}

const openDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteTeacherResponsibility(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Responsabilidad eliminada.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar la responsabilidad.'
  }
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitForm = async () => {
  try {
    const payload = {
      academicYearId: form.academicYearId,
      teacherId: form.teacherId,
      responsibilityType: form.responsibilityType,
      scopeType: form.responsibilityType === 'group_director' ? 'group' : form.scopeType,
      levelName: form.responsibilityType === 'coordinator' ? form.levelName || null : null,
      gradeId: form.responsibilityType === 'coordinator' ? form.gradeId || null : null,
      groupId: form.responsibilityType === 'group_director' ? form.groupId : null,
      title: form.responsibilityType === 'coordinator' ? form.title : null,
      notes: form.notes || null,
    }
    if (editingId.value) await api.updateTeacherResponsibility(editingId.value, payload)
    else await api.createTeacherResponsibility(payload)
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Responsabilidad guardada correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar la responsabilidad.'
  }
}

watch(
  () => form.responsibilityType,
  (type) => {
    if (type === 'group_director') {
      form.scopeType = 'group'
      form.levelName = ''
      form.gradeId = ''
      form.title = ''
      form.groupId ||= modalCourses.value[0]?.id || ''
      return
    }
    form.groupId = ''
    if (form.scopeType === 'group') {
      form.scopeType = 'global'
    }
  },
)

onMounted(loadOptions)
</script>
