<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Plan académico y logros" subtitle="Organiza logros por grado, materia y periodo del año lectivo.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo logro</button>
      </template>
    </PageHeader>

    <ListView
      ref="listViewRef"
      title="Logros configurados"
      subtitle="Cada logro queda asociado a un grado, una materia, un periodo y una competencia SIEE."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar logro, código o materia"
      create-label="Nuevo logro"
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
        <select v-model="filters.academicPeriodId" class="toolbar-select">
          <option value="">Todos los periodos</option>
          <option v-for="period in filteredPeriods" :key="period.id" :value="period.id">{{ period.name }}</option>
        </select>
        <select v-model="filters.gradeId" class="toolbar-select">
          <option value="">Todos los grados</option>
          <option v-for="grade in grades" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
        </select>
        <select v-model="filters.subjectId" class="toolbar-select">
          <option value="">Todas las materias</option>
          <option v-for="subject in filteredSubjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
        </select>
      </template>

      <template #cell-title="{ row }">
        <div class="achievement-title-cell">
          <strong class="block text-gray-900">{{ row.title }}</strong>
          <p class="text-xs text-gray-500 mt-1 mb-2">{{ row.description }}</p>
          <div class="flex flex-wrap gap-2">
            <span v-if="row.competencyName" class="meta-badge meta-badge--blue">
              🧩 Competencia: {{ row.competencyName }}
            </span>
            <span v-if="row.expectedPerformance" class="meta-badge meta-badge--green">
              🎯 Desempeño esperado: {{ translatePerformance(String(row.expectedPerformance)) }}
            </span>
          </div>
        </div>
      </template>

      <template #cell-indicators="{ row }">
        <div class="flex items-center gap-2">
          <span class="indicators-count-pill">{{ (row as any).indicators?.length || 0 }}</span>
          <button class="button button--ghost button--sm" type="button" @click.stop="openIndicatorsModal(row)">
            📝 Evidencias
          </button>
        </div>
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar logro' : 'Nuevo logro'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>
          Año lectivo
          <select v-model="form.academicYearId" required>
            <option value="" disabled>Selecciona un año</option>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Periodo
          <select v-model="form.academicPeriodId" required :disabled="!form.academicYearId">
            <option value="" disabled>{{ form.academicYearId ? 'Selecciona un periodo' : 'Primero elige el año' }}</option>
            <option v-for="period in modalPeriods" :key="period.id" :value="period.id">{{ period.name }}</option>
          </select>
        </label>
        <label>
          Grado
          <select v-model="form.gradeId" required :disabled="!form.academicYearId">
            <option value="" disabled>{{ form.academicYearId ? 'Selecciona un grado' : 'Primero elige el año' }}</option>
            <option v-for="grade in grades" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>
        <label>
          Materia
          <select v-model="form.subjectId" required :disabled="!form.gradeId">
            <option value="" disabled>{{ form.gradeId ? 'Selecciona una materia' : 'Primero elige el grado' }}</option>
            <option v-for="subject in modalSubjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
          </select>
        </label>
        
        <label class="form-grid__wide">
          Competencia SIEE Asociada
          <select v-model="form.competencyId">
            <option value="">-- Sin competencia --</option>
            <option v-for="comp in filteredCompetenciesForForm" :key="comp.id" :value="comp.id">
              [{{ comp.academicAreaName }}] {{ comp.name }}
            </option>
          </select>
        </label>

        <label>Código<input v-model="form.code" required placeholder="LG-01" /></label>
        <label>Peso %<input v-model.number="form.weight" type="number" min="1" max="100" required /></label>
        
        <label>
          Desempeño Esperado
          <select v-model="form.expectedPerformance">
            <option value="">-- Sin especificar --</option>
            <option value="SUPERIOR">Superior</option>
            <option value="HIGH">Alto</option>
            <option value="BASIC">Básico</option>
            <option value="LOW">Bajo</option>
          </select>
        </label>

        <label>
          Orden de Visualización
          <input v-model.number="form.orderNumber" type="number" min="0" required />
        </label>

        <label class="form-grid__wide">Título<input v-model="form.title" required placeholder="Resuelve problemas con números enteros" /></label>
        <label class="form-grid__wide">Descripción<textarea v-model="form.description" required placeholder="Describe el alcance esperado para este periodo." /></label>
        
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar</button>
        </div>
      </form>
    </FormModal>

    <!-- Indicators Modal -->
    <FormModal :open="isIndicatorsModalOpen" :title="`Evidencias de Logro: ${selectedAchievement?.code || ''}`" @close="closeIndicatorsModal">
      <div class="indicators-manager">
        <div class="achievement-preview mb-4">
          <p class="text-sm font-semibold text-gray-800">{{ selectedAchievement?.title }}</p>
          <p class="text-xs text-gray-500">{{ selectedAchievement?.description }}</p>
        </div>

        <div class="indicators-list mb-6">
          <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Evidencias Configuradas</h4>
          <div v-for="ind in indicators" :key="ind.id" class="indicator-item">
            <div class="indicator-info">
              <span class="order-badge">#{{ ind.orderNumber }}</span>
              <p class="indicator-desc">{{ ind.description }}</p>
            </div>
            <div class="indicator-actions">
              <button class="action-btn" type="button" @click="editIndicator(ind)" title="Editar">✏️</button>
              <button class="action-btn text-red" type="button" @click="deleteIndicator(ind)" title="Eliminar">🗑️</button>
            </div>
          </div>
          <p v-if="indicators.length === 0" class="empty-state">
            No hay indicadores de logro / evidencias agregadas a este logro.
          </p>
        </div>

        <form @submit.prevent="saveIndicator" class="indicator-form">
          <h5 class="form-title">{{ editingIndicatorId ? 'Editar Evidencia' : 'Nueva Evidencia' }}</h5>
          <div class="form-grid">
            <label class="col-span-2">
              Descripción de la evidencia / indicador *
              <input v-model="indicatorForm.description" required placeholder="Identifica el conjunto de enteros..." />
            </label>
            <label>
              Orden
              <input v-model.number="indicatorForm.orderNumber" type="number" min="0" required />
            </label>
            <div class="indicator-form-actions col-span-2">
              <button v-if="editingIndicatorId" class="button button--ghost button--sm" type="button" @click="cancelEditIndicator">Cancelar</button>
              <button class="button button--brand button--sm" type="submit">{{ editingIndicatorId ? 'Guardar Cambios' : 'Agregar Evidencia' }}</button>
            </div>
          </div>
        </form>
      </div>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type {
  AcademicGradeDto,
  AcademicPeriodDto,
  AcademicYearDto,
  GradeSubjectDto,
  LearningAchievementDto,
  SubjectDto,
  CompetencyDto,
  AchievementIndicatorDto,
} from '@ofir/shared'
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
const periods = ref<AcademicPeriodDto[]>([])
const grades = ref<AcademicGradeDto[]>([])
const gradeSubjects = ref<GradeSubjectDto[]>([])
const subjects = ref<SubjectDto[]>([])
const competencies = ref<CompetencyDto[]>([])

// Indicators Management
const isIndicatorsModalOpen = ref(false)
const selectedAchievement = ref<LearningAchievementDto | null>(null)
const indicators = ref<AchievementIndicatorDto[]>([])
const editingIndicatorId = ref('')
const indicatorForm = reactive({
  description: '',
  orderNumber: 0,
})

const filters = reactive({ academicYearId: '', academicPeriodId: '', gradeId: '', subjectId: '' })
const columns = [
  { key: 'academicPeriodName', label: 'Periodo' },
  { key: 'gradeName', label: 'Grado' },
  { key: 'subjectName', label: 'Materia' },
  { key: 'code', label: 'Código' },
  { key: 'title', label: 'Logro' },
  { key: 'indicators', label: 'Evidencias' },
]

const form = reactive({
  academicYearId: '',
  academicPeriodId: '',
  gradeId: '',
  subjectId: '',
  competencyId: '',
  code: '',
  title: '',
  description: '',
  weight: 100,
  orderNumber: 0,
  expectedPerformance: '',
})

const reloadKey = computed(() => `${filters.academicYearId}-${filters.academicPeriodId}-${filters.gradeId}-${filters.subjectId}`)
const filteredPeriods = computed(() => filters.academicYearId ? periods.value.filter((p) => p.academicYearId === filters.academicYearId) : periods.value)
const filteredSubjects = computed(() => {
  const matches = gradeSubjects.value.filter((item) =>
    (!filters.academicYearId || item.academicYearId === filters.academicYearId) &&
    (!filters.gradeId || item.gradeId === filters.gradeId),
  )
  const ids = new Set(matches.map((item) => item.subjectId))
  return ids.size ? subjects.value.filter((subject) => ids.has(subject.id)) : subjects.value
})
const modalPeriods = computed(() => form.academicYearId ? periods.value.filter((p) => p.academicYearId === form.academicYearId) : periods.value)
const modalSubjects = computed(() => {
  const matches = gradeSubjects.value.filter((item) =>
    item.academicYearId === form.academicYearId &&
    (!form.gradeId || item.gradeId === form.gradeId),
  )
  const ids = new Set(matches.map((item) => item.subjectId))
  return ids.size ? subjects.value.filter((subject) => ids.has(subject.id)) : subjects.value
})

const filteredCompetenciesForForm = computed(() => {
  if (!form.subjectId) return competencies.value
  const sub = subjects.value.find((s) => s.id === form.subjectId)
  if (!sub || !sub.academicAreaId) return competencies.value
  return competencies.value.filter((c) => c.academicAreaId === sub.academicAreaId)
})

const translatePerformance = (level: string) => {
  const map: Record<string, string> = {
    SUPERIOR: 'Superior',
    HIGH: 'Alto',
    BASIC: 'Básico',
    LOW: 'Bajo',
  }
  return map[level] || level
}

// Reset dependientes cuando cambia el año
watch(() => form.academicYearId, () => {
  form.academicPeriodId = ''
  form.gradeId = ''
  form.subjectId = ''
  form.competencyId = ''
})

// Reset materia cuando cambia el grado
watch(() => form.gradeId, () => {
  form.subjectId = ''
  form.competencyId = ''
})

// Reset competencia cuando cambia materia
watch(() => form.subjectId, () => {
  form.competencyId = ''
})

const bestYearId = () =>
  academicContext.activeYearId || academicYears.value[0]?.id || ''

const loadOptions = async () => {
  const [yearsResponse, periodsResponse, gradesResponse, subjectsResponse, gradeSubjectsResponse, competenciesResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getAcademicPeriods({ page: 1, pageSize: 100 }),
    api.getAcademicGrades({ page: 1, pageSize: 100 }),
    api.getSubjects({ page: 1, pageSize: 100 }),
    api.getGradeSubjects({ page: 1, pageSize: 100 }),
    api.getCompetencies({ page: 1, pageSize: 200 }),
  ])
  academicYears.value = yearsResponse.data.items
  periods.value = periodsResponse.data.items
  grades.value = gradesResponse.data.items
  subjects.value = subjectsResponse.data.items
  gradeSubjects.value = gradeSubjectsResponse.data.items
  competencies.value = competenciesResponse.data.items
  filters.academicYearId ||= bestYearId()
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getLearningAchievements({
    page,
    pageSize,
    query,
    academicYearId: filters.academicYearId,
    academicPeriodId: filters.academicPeriodId,
    gradeId: filters.gradeId,
    subjectId: filters.subjectId,
  })
  return { ...response.data, items: response.data.items as unknown as TableRow[] }
}

const openCreate = () => {
  feedback.value = ''
  editingId.value = ''
  Object.assign(form, {
    academicYearId: filters.academicYearId || bestYearId(),
    academicPeriodId: '',
    gradeId: filters.gradeId || '',
    subjectId: '',
    competencyId: '',
    code: '',
    title: '',
    description: '',
    weight: 100,
    orderNumber: 0,
    expectedPerformance: '',
  })
  isModalOpen.value = true
}

const openEdit = (row: Record<string, unknown>) => {
  feedback.value = ''
  const item = row as unknown as LearningAchievementDto
  editingId.value = item.id
  Object.assign(form, {
    academicYearId: item.academicYearId,
    academicPeriodId: item.academicPeriodId,
    gradeId: item.gradeId,
    subjectId: item.subjectId,
    competencyId: item.competencyId ?? '',
    code: item.code,
    title: item.title,
    description: item.description,
    weight: item.weight,
    orderNumber: item.orderNumber || 0,
    expectedPerformance: item.expectedPerformance ?? '',
  })
  isModalOpen.value = true
}

const openDelete = async (row: Record<string, unknown>) => {
  if (!confirm(`¿Estás seguro de que deseas eliminar el logro "${row.code}"?`)) return
  try {
    await api.deleteLearningAchievement(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Logro eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el logro.'
  }
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitForm = async () => {
  try {
    const payload = {
      ...form,
      competencyId: form.competencyId || null,
      expectedPerformance: form.expectedPerformance || null,
    }
    if (editingId.value) await api.updateLearningAchievement(editingId.value, payload)
    else await api.createLearningAchievement(payload)
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Logro guardado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar el logro.'
  }
}

// Nested Indicators Methods
const openIndicatorsModal = async (row: Record<string, unknown>) => {
  selectedAchievement.value = row as unknown as LearningAchievementDto
  isIndicatorsModalOpen.value = true
  await reloadIndicators()
  cancelEditIndicator()
}

const closeIndicatorsModal = () => {
  isIndicatorsModalOpen.value = false
  selectedAchievement.value = null
  indicators.value = []
  void listViewRef.value?.reload()
}

const reloadIndicators = async () => {
  if (!selectedAchievement.value) return
  try {
    const response = await api.getAchievementIndicators(selectedAchievement.value.id)
    indicators.value = response.data.items
  } catch (error) {
    console.error('Error al cargar indicadores:', error)
  }
}

const editIndicator = (ind: AchievementIndicatorDto) => {
  editingIndicatorId.value = ind.id
  indicatorForm.description = ind.description
  indicatorForm.orderNumber = ind.orderNumber
}

const cancelEditIndicator = () => {
  editingIndicatorId.value = ''
  indicatorForm.description = ''
  indicatorForm.orderNumber = indicators.value.length + 1
}

const deleteIndicator = async (ind: AchievementIndicatorDto) => {
  if (!confirm('¿Estás seguro de que deseas eliminar esta evidencia / indicador?')) return
  try {
    await api.deleteAchievementIndicator(ind.id)
    await reloadIndicators()
    cancelEditIndicator()
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Error al eliminar el indicador.')
  }
}

const saveIndicator = async () => {
  if (!selectedAchievement.value) return
  try {
    const payload = {
      achievementId: selectedAchievement.value.id,
      description: indicatorForm.description,
      orderNumber: indicatorForm.orderNumber,
      isActive: true,
    }
    if (editingIndicatorId.value) {
      await api.updateAchievementIndicator(editingIndicatorId.value, payload)
    } else {
      await api.createAchievementIndicator(payload)
    }
    await reloadIndicators()
    cancelEditIndicator()
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Error al guardar el indicador.')
  }
}

onMounted(loadOptions)
</script>

<style scoped>
.achievement-title-cell {
  max-width: 500px;
}
.meta-subtext {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.meta-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  text-transform: uppercase;
}
.meta-badge--blue {
  background-color: var(--color-brand-light, #eff6ff);
  color: var(--color-brand, #3b82f6);
}
.meta-badge--green {
  background-color: #f0fdf4;
  color: #16a34a;
}
.indicators-count-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-neutral-light, #f3f4f6);
  color: var(--color-neutral-dark, #374151);
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 9999px;
  width: 24px;
  height: 24px;
}
.indicators-manager {
  display: flex;
  flex-direction: column;
}
.achievement-preview {
  padding: 0.75rem;
  background-color: var(--color-bg-light, #f9fafb);
  border-radius: 6px;
  border-left: 4px solid var(--color-brand, #3b82f6);
}
.indicators-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border, #e5e7eb);
  padding: 0.75rem;
  border-radius: 6px;
}
.indicator-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  margin-bottom: 0.4rem;
  gap: 0.75rem;
}
.indicator-info {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  flex-grow: 1;
}
.order-badge {
  font-size: 0.7rem;
  font-weight: 700;
  background-color: #f3f4f6;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  color: #6b7280;
  margin-top: 0.1rem;
}
.indicator-desc {
  font-size: 0.8rem;
  color: #374151;
  line-height: 1.3;
}
.indicator-actions {
  display: flex;
  gap: 0.25rem;
}
.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.2rem;
  font-size: 0.85rem;
  border-radius: 4px;
}
.action-btn:hover {
  background-color: #f3f4f6;
}
.empty-state {
  text-align: center;
  color: #9ca3af;
  font-size: 0.8rem;
  padding: 2rem 0;
}
.indicator-form {
  border-top: 1px solid #e5e7eb;
  padding-top: 1rem;
}
.form-title {
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: #1f2937;
}
.indicator-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>

