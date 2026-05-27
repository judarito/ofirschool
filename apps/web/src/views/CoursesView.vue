<template>
  <section class="stack">
    <PageHeader
      eyebrow="Academico"
      title="Cursos"
      subtitle="Crea cursos o grupos para un ano lectivo. La vigencia se hereda desde la DB."
    >
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo curso</button>
      </template>
    </PageHeader>

    <section class="window-strip">
      <div>
        <span class="window-strip__label">Cursos por ano lectivo</span>
        <strong>El curso se crea dentro de un ano lectivo</strong>
      </div>
      <div class="date-chip-list">
        <span class="date-chip">{{ selectedYear?.name ?? 'Sin ano activo' }}</span>
        <span class="date-chip date-chip--start">Inicio {{ selectedYear?.startsOn ?? '--' }}</span>
        <span class="date-chip date-chip--end">Fin {{ selectedYear?.endsOn ?? '--' }}</span>
      </div>
    </section>

    <ListView
      ref="listViewRef"
      title="Listado de cursos"
      subtitle="Ejemplo real: Primero A - Ano lectivo 2026. El curso muestra la vigencia heredada del ano."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar curso, grado o ano"
      create-label="Nuevo curso"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #cell-window="{ row }">
        <span class="date-range-cell">{{ row.window }}</span>
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar curso' : 'Crear curso'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>
          Ano lectivo
          <select v-model="form.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Grado
          <select v-model="form.gradeId" required>
            <option v-for="grade in grades" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>
        <label>Nombre del curso<input v-model="form.name" required placeholder="Ej. Primero A" /></label>
        <label>Cupos<input v-model.number="form.capacity" type="number" required min="1" /></label>
        <p class="form-note">Vigencia heredada: {{ inheritedWindow }}.</p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar curso</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AcademicGradeDto, AcademicYearDto, CourseDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import { api } from '../lib/api'

type Row = CourseDto & { window: string }
type TableRow = { id: string } & Record<string, unknown>
const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isModalOpen = ref(false)
const editingId = ref('')
const feedback = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const grades = ref<AcademicGradeDto[]>([])
const columns = [
  { key: 'name', label: 'Curso' },
  { key: 'academicYearName', label: 'Ano lectivo' },
  { key: 'gradeName', label: 'Grado' },
  { key: 'capacity', label: 'Cupos' },
  { key: 'window', label: 'Vigencia heredada' },
]
const form = reactive({ name: '', academicYearId: '', gradeId: '', branchId: '', capacity: 35 })
const selectedYear = computed(() => academicYears.value.find((year) => year.id === form.academicYearId) ?? academicYears.value[0])
const inheritedWindow = computed(() => selectedYear.value ? `${selectedYear.value.startsOn} - ${selectedYear.value.endsOn}` : '')
const toRow = (item: CourseDto): Row => ({ ...item, window: `${item.inheritedStartsOn ?? '--'} - ${item.inheritedEndsOn ?? '--'}` })
const loadOptions = async () => {
  const [yearsResponse, gradesResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getAcademicGrades({ page: 1, pageSize: 100 }),
  ])
  academicYears.value = yearsResponse.data.items
  grades.value = gradesResponse.data.items
  if (!form.academicYearId && academicYears.value[0]) form.academicYearId = academicYears.value[0].id
  if (!form.gradeId && grades.value[0]) form.gradeId = grades.value[0].id
}
const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getCourses({ page, pageSize, query })
  return { ...response.data, items: response.data.items.map(toRow) as unknown as TableRow[] }
}
const openCreate = async () => {
  feedback.value = ''
  await loadOptions()
  editingId.value = ''
  Object.assign(form, { name: '', academicYearId: academicYears.value[0]?.id ?? '', gradeId: grades.value[0]?.id ?? '', branchId: '', capacity: 35 })
  isModalOpen.value = true
}
const openEdit = async (row: Record<string, unknown>) => {
  feedback.value = ''
  await loadOptions()
  const item = row as unknown as Row
  editingId.value = item.id
  Object.assign(form, { name: item.name, academicYearId: item.academicYearId, gradeId: item.gradeId, branchId: item.branchId ?? '', capacity: item.capacity })
  isModalOpen.value = true
}
const openDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteCourse(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Curso eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el curso.'
  }
}
const closeModal = () => {
  isModalOpen.value = false
}
const submitForm = async () => {
  try {
    if (editingId.value) await api.updateCourse(editingId.value, { ...form })
    else await api.createCourse({ ...form })
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Curso guardado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar el curso.'
  }
}
onMounted(loadOptions)
</script>
