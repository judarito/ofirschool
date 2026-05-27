<template>
  <section class="page-container">
    <PageHeader
      eyebrow="SIEE"
      title="Competencias Académicas"
      subtitle="Define las competencias institucionales por área y grado académico."
    />

    <div class="filters-panel card mb-6">
      <div class="form-grid">
        <label>
          Área Académica
          <select v-model="filterAreaId" @change="reloadList">
            <option value="">-- Todas las áreas --</option>
            <option v-for="area in areas" :key="area.id" :value="area.id">{{ area.name }}</option>
          </select>
        </label>
        <label>
          Grado Académico
          <select v-model="filterGradeId" @change="reloadList">
            <option value="">-- Todos los grados --</option>
            <option v-for="grade in grades" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>
        <label>
          Asignatura
          <select v-model="filterSubjectId" @change="reloadList">
            <option value="">-- Todas las asignaturas --</option>
            <option v-for="sub in subjects" :key="sub.id" :value="sub.id">{{ sub.name }}</option>
          </select>
        </label>
      </div>
    </div>

    <ListView
      ref="listViewRef"
      title="Listado de competencias"
      subtitle="Las competencias agrupan los logros e indicadores evaluativos."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar competencia..."
      create-label="Nueva competencia"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #cell-isActive="{ row }">
        <span :class="['status-badge', row.isActive ? 'status-badge--active' : 'status-badge--inactive']">
          {{ row.isActive ? 'Activa' : 'Inactiva' }}
        </span>
      </template>
      <template #cell-academicAreaName="{ row }">
        <div class="flex items-center gap-2">
          <span class="color-indicator" :style="{ backgroundColor: String(row.academicAreaColor || '#ccc') }"></span>
          <span>{{ row.academicAreaName }}</span>
        </div>
      </template>
      <template #cell-gradeName="{ row }">
        {{ row.gradeName || 'General (Todos)' }}
      </template>
      <template #cell-subjectName="{ row }">
        {{ row.subjectName || 'General (Área)' }}
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar competencia' : 'Nueva competencia'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label class="col-span-2">
          Nombre de la Competencia
          <input v-model="form.name" required placeholder="Ej. Resolución de problemas algebraicos" />
        </label>

        <label>
          Área Académica (SIEE) *
          <select v-model="form.academicAreaId" required>
            <option value="">-- Seleccionar área --</option>
            <option v-for="area in areas" :key="area.id" :value="area.id">{{ area.name }}</option>
          </select>
        </label>

        <label>
          Grado Académico (Opcional)
          <select v-model="form.gradeId">
            <option value="">-- General (Todos los grados) --</option>
            <option v-for="grade in grades" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>

        <label>
          Asignatura (Opcional)
          <select v-model="form.subjectId">
            <option value="">-- General (Área completa) --</option>
            <option v-for="sub in subjects" :key="sub.id" :value="sub.id">{{ sub.name }}</option>
          </select>
        </label>

        <label>
          Orden de Visualización
          <input v-model.number="form.orderNumber" type="number" min="0" required />
        </label>

        <label class="col-span-2">
          Descripción
          <textarea v-model="form.description" rows="3" placeholder="Detalle pedagógico de la competencia..."></textarea>
        </label>

        <div class="col-span-2 flex items-center gap-2">
          <input id="comp-active" v-model="form.isActive" type="checkbox" />
          <label for="comp-active">Competencia activa</label>
        </div>

        <div class="modal-actions col-span-2">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { CompetencyDto, AcademicAreaDto, AcademicGradeDto, SubjectDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import { api } from '../lib/api'

type TableRow = { id: string } & Record<string, unknown>

const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isModalOpen = ref(false)
const editingId = ref('')
const feedback = ref('')

const areas = ref<AcademicAreaDto[]>([])
const grades = ref<AcademicGradeDto[]>([])
const subjects = ref<SubjectDto[]>([])

// Filters
const filterAreaId = ref('')
const filterGradeId = ref('')
const filterSubjectId = ref('')

const columns = [
  { key: 'name', label: 'Competencia' },
  { key: 'academicAreaName', label: 'Área' },
  { key: 'gradeName', label: 'Grado' },
  { key: 'subjectName', label: 'Materia' },
  { key: 'orderNumber', label: 'Orden' },
  { key: 'isActive', label: 'Estado' },
]

const form = reactive({
  name: '',
  description: '',
  academicAreaId: '',
  gradeId: '',
  subjectId: '',
  orderNumber: 0,
  isActive: true,
})

const reloadList = () => {
  void listViewRef.value?.reload()
}

const loadDependencies = async () => {
  try {
    const [areasRes, gradesRes, subjectsRes] = await Promise.all([
      api.getAcademicAreas({ page: 1, pageSize: 100 }),
      api.getAcademicGrades({ page: 1, pageSize: 100 }),
      api.getSubjects({ page: 1, pageSize: 100 }),
    ])
    areas.value = areasRes.data.items
    grades.value = gradesRes.data.items
    subjects.value = subjectsRes.data.items
  } catch (error) {
    console.error('Error al cargar dependencias:', error)
  }
}

onMounted(() => {
  void loadDependencies()
})

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getCompetencies({
    page,
    pageSize,
    query,
    academicAreaId: filterAreaId.value,
    gradeId: filterGradeId.value,
    subjectId: filterSubjectId.value,
  })
  // Enrich academicAreaColor from loaded areas
  const items = response.data.items.map((item) => {
    const area = areas.value.find((a) => a.id === item.academicAreaId)
    return {
      ...item,
      academicAreaColor: area?.color || '#ccc',
    }
  })
  return { ...response.data, items: items as unknown as TableRow[] }
}

const openCreate = () => {
  feedback.value = ''
  editingId.value = ''
  Object.assign(form, {
    name: '',
    description: '',
    academicAreaId: filterAreaId.value,
    gradeId: filterGradeId.value,
    subjectId: filterSubjectId.value,
    orderNumber: 0,
    isActive: true,
  })
  isModalOpen.value = true
}

const openEdit = (row: Record<string, unknown>) => {
  feedback.value = ''
  const item = row as unknown as CompetencyDto
  editingId.value = item.id
  Object.assign(form, {
    name: item.name,
    description: item.description ?? '',
    academicAreaId: item.academicAreaId,
    gradeId: item.gradeId ?? '',
    subjectId: item.subjectId ?? '',
    orderNumber: item.orderNumber,
    isActive: item.isActive,
  })
  isModalOpen.value = true
}

const openDelete = async (row: Record<string, unknown>) => {
  if (!confirm(`¿Estás seguro de que deseas eliminar la competencia "${row.name}"?`)) return
  try {
    await api.deleteCompetency(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Competencia eliminada.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar la competencia.'
  }
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitForm = async () => {
  try {
    const payload = {
      ...form,
      gradeId: form.gradeId || null,
      subjectId: form.subjectId || null,
      description: form.description || null,
    }
    if (editingId.value) await api.updateCompetency(editingId.value, payload)
    else await api.createCompetency(payload)
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Competencia guardada correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar la competencia.'
  }
}
</script>

<style scoped>
.filters-panel {
  padding: 1.25rem;
  background-color: var(--color-bg-surface, #ffffff);
  border-radius: 8px;
  border: 1px solid var(--color-border, #e5e7eb);
}
.color-indicator {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.flex {
  display: flex;
}
.items-center {
  align-items: center;
}
.gap-2 {
  gap: 0.5rem;
}
.mb-6 {
  margin-bottom: 1.5rem;
}
</style>
