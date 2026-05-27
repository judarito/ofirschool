<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Materias por grado" subtitle="Define la malla base de materias por grado para el año lectivo.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nueva asignación</button>
      </template>
    </PageHeader>

    <ListView
      ref="listViewRef"
      title="Asignaciones vigentes"
      subtitle="Todos los cursos del mismo grado heredan esta base para logros y notas."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar grado o materia"
      create-label="Nueva asignación"
      :reload-key="reloadKey"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #toolbar-actions>
        <select v-model="filters.academicYearId" class="toolbar-select">
          <option value="">Todos los años</option>
          <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
        </select>
        <select v-model="filters.gradeId" class="toolbar-select">
          <option value="">Todos los grados</option>
          <option v-for="grade in filteredGrades" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
        </select>
        <button class="button button--brand" type="button" @click="openCreate">Nueva asignación</button>
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar asignación' : 'Nueva asignación'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>
          Año lectivo
          <select v-model="form.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Grado
          <select v-model="form.gradeId" required>
            <option v-for="grade in modalGrades" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>
        <label>
          Materia
          <select v-model="form.subjectId" required>
            <option v-for="subject in subjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
          </select>
        </label>
        <label>Horas semanales<input v-model.number="form.weeklyHours" type="number" min="1" max="20" required /></label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AcademicGradeDto, AcademicYearDto, GradeSubjectDto, SubjectDto } from '@ofir/shared'
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
const grades = ref<AcademicGradeDto[]>([])
const subjects = ref<SubjectDto[]>([])
const filters = reactive({ academicYearId: '', gradeId: '' })
const columns = [
  { key: 'academicYearName', label: 'Año lectivo' },
  { key: 'gradeName', label: 'Grado' },
  { key: 'subjectName', label: 'Materia' },
  { key: 'weeklyHours', label: 'Horas/semana' },
]
const form = reactive({ academicYearId: '', gradeId: '', subjectId: '', weeklyHours: 4 })
const reloadKey = computed(() => `${filters.academicYearId}-${filters.gradeId}`)
const filteredGrades = computed(() =>
  grades.value,
)
const modalGrades = computed(() => grades.value)

const loadOptions = async () => {
  const [yearsResponse, gradesResponse, subjectsResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getAcademicGrades({ page: 1, pageSize: 100 }),
    api.getSubjects({ page: 1, pageSize: 100 }),
  ])
  academicYears.value = yearsResponse.data.items
  grades.value = gradesResponse.data.items
  subjects.value = subjectsResponse.data.items
  filters.academicYearId ||= academicContext.activeYearId
  form.academicYearId ||= academicContext.activeYearId || academicYears.value[0]?.id || ''
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getGradeSubjects({
    page,
    pageSize,
    query,
    academicYearId: filters.academicYearId,
    gradeId: filters.gradeId,
  })
  return { ...response.data, items: response.data.items as unknown as TableRow[] }
}

const openCreate = () => {
  feedback.value = ''
  editingId.value = ''
  Object.assign(form, {
    academicYearId: filters.academicYearId || academicContext.activeYearId || academicYears.value[0]?.id || '',
    gradeId: grades.value[0]?.id ?? '',
    subjectId: subjects.value[0]?.id ?? '',
    weeklyHours: 4,
  })
  isModalOpen.value = true
}

const openEdit = (row: Record<string, unknown>) => {
  feedback.value = ''
  const item = row as unknown as GradeSubjectDto
  editingId.value = item.id
  Object.assign(form, {
    academicYearId: item.academicYearId,
    gradeId: item.gradeId,
    subjectId: item.subjectId,
    weeklyHours: item.weeklyHours,
  })
  isModalOpen.value = true
}

const openDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteGradeSubject(String(row.id))
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
    if (editingId.value) await api.updateGradeSubject(editingId.value, { ...form })
    else await api.createGradeSubject({ ...form })
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Asignación guardada correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar la asignación.'
  }
}

onMounted(loadOptions)
</script>
