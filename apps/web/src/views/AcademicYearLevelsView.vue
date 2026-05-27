<template>
  <section class="stack">
    <PageHeader eyebrow="Académico" title="Niveles educativos" subtitle="Define la oferta del colegio por año lectivo y jornada, por ejemplo preescolar, primaria o media.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo nivel educativo</button>
      </template>
    </PageHeader>

    <SurfaceCard>
      <form class="form-grid" @submit.prevent="reloadList">
        <label>
          Año lectivo
          <select v-model="filters.academicYearId">
            <option value="">Todos</option>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Jornada
          <select v-model="filters.journeyId">
            <option value="">Todas</option>
            <option v-for="journey in filteredJourneys" :key="journey.id" :value="journey.id">{{ journey.name }}</option>
          </select>
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="resetFilters">Limpiar</button>
          <button class="button button--brand" type="submit">Aplicar filtros</button>
        </div>
      </form>
    </SurfaceCard>

    <ListView
      ref="listViewRef"
      title="Catálogo operativo de niveles"
      subtitle="Estos niveles sí son configurables por año lectivo y jornada."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar nivel educativo"
      create-label="Nuevo nivel"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #cell-levelCode="{ value }">
        {{ translateLevelCode(String(value)) }}
      </template>
      <template #cell-journeyName="{ value }">
        {{ value || 'Todas las jornadas' }}
      </template>
      <template #cell-isActive="{ value }">
        {{ value ? 'Activo' : 'Inactivo' }}
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar nivel educativo' : 'Nuevo nivel educativo'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>
          Año lectivo
          <select v-model="form.academicYearId" required>
            <option value="" disabled>Seleccione</option>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Jornada
          <select v-model="form.journeyId">
            <option value="">Todas las jornadas</option>
            <option v-for="journey in modalJourneys" :key="journey.id" :value="journey.id">{{ journey.name }}</option>
          </select>
        </label>
        <label>
          Código base
          <select v-model="form.levelCode" required>
            <option value="preschool">Preescolar</option>
            <option value="primary">Primaria</option>
            <option value="secondary">Secundaria</option>
            <option value="middle">Media / bachillerato</option>
          </select>
        </label>
        <label>
          Nombre visible
          <input v-model="form.name" required placeholder="Ej. Primaria mañana" />
        </label>
        <label>
          Orden
          <input v-model.number="form.orderNumber" type="number" min="0" required />
        </label>
        <label style="display: flex; flex-direction: row; align-items: center; gap: 10px; margin-top: 24px;">
          <input v-model="form.isActive" type="checkbox" />
          <span>Nivel activo</span>
        </label>
        <p class="form-note">Úsalo para declarar qué oferta académica existe en cada año y jornada antes de configurar horarios, escalas o coordinaciones.</p>
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AcademicYearDto, AcademicYearJourneyDto, AcademicYearLevelDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'
import { useAcademicContextStore } from '../stores/academic-context'

type TableRow = { id: string } & Record<string, unknown>

const academicContext = useAcademicContextStore()
const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const feedback = ref('')
const isModalOpen = ref(false)
const editingId = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const journeys = ref<AcademicYearJourneyDto[]>([])

const filters = reactive({
  academicYearId: '',
  journeyId: '',
})

const form = reactive({
  academicYearId: '',
  journeyId: '',
  levelCode: 'primary' as 'preschool' | 'primary' | 'secondary' | 'middle',
  name: '',
  orderNumber: 0,
  isActive: true,
})

const columns = [
  { key: 'academicYearName', label: 'Año lectivo' },
  { key: 'journeyName', label: 'Jornada' },
  { key: 'levelCode', label: 'Nivel base' },
  { key: 'name', label: 'Nombre visible' },
  { key: 'orderNumber', label: 'Orden' },
  { key: 'isActive', label: 'Estado' },
]

const filteredJourneys = computed(() =>
  journeys.value.filter((journey) => !filters.academicYearId || journey.academicYearId === filters.academicYearId),
)

const modalJourneys = computed(() =>
  journeys.value.filter((journey) => !form.academicYearId || journey.academicYearId === form.academicYearId),
)

const translateLevelCode = (code: string) => {
  if (code === 'preschool') return 'Preescolar'
  if (code === 'primary') return 'Primaria'
  if (code === 'secondary') return 'Secundaria'
  if (code === 'middle') return 'Media / bachillerato'
  return code
}

const loadCatalogs = async () => {
  const [yearsResponse, journeysResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getJourneys({}),
  ])
  academicYears.value = yearsResponse.data.items
  journeys.value = journeysResponse.data.items
  filters.academicYearId ||= academicContext.activeYearId || academicYears.value[0]?.id || ''
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getAcademicYearLevels({
    page,
    pageSize,
    query,
    academicYearId: filters.academicYearId,
    journeyId: filters.journeyId,
  })
  return { ...response.data, items: response.data.items as unknown as TableRow[] }
}

const reloadList = async () => {
  await listViewRef.value?.reload()
}

const resetFilters = async () => {
  filters.academicYearId = academicContext.activeYearId || academicYears.value[0]?.id || ''
  filters.journeyId = ''
  await reloadList()
}

const openCreate = () => {
  editingId.value = ''
  Object.assign(form, {
    academicYearId: filters.academicYearId || academicContext.activeYearId || academicYears.value[0]?.id || '',
    journeyId: '',
    levelCode: 'primary',
    name: 'Primaria',
    orderNumber: 0,
    isActive: true,
  })
  isModalOpen.value = true
}

const openEdit = (row: Record<string, unknown>) => {
  const item = row as unknown as AcademicYearLevelDto
  editingId.value = item.id
  Object.assign(form, {
    academicYearId: item.academicYearId,
    journeyId: item.journeyId || '',
    levelCode: item.levelCode as 'preschool' | 'primary' | 'secondary' | 'middle',
    name: item.name,
    orderNumber: item.orderNumber,
    isActive: item.isActive,
  })
  isModalOpen.value = true
}

const openDelete = async (row: Record<string, unknown>) => {
  if (!confirm(`¿Eliminar el nivel educativo "${row.name}"?`)) return
  try {
    await api.deleteAcademicYearLevel(String(row.id))
    await reloadList()
    feedback.value = 'Nivel educativo eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el nivel educativo.'
  }
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitForm = async () => {
  try {
    const payload = {
      academicYearId: form.academicYearId,
      journeyId: form.journeyId || null,
      levelCode: form.levelCode,
      name: form.name,
      orderNumber: Number(form.orderNumber),
      isActive: form.isActive,
    }
    if (editingId.value) await api.updateAcademicYearLevel(editingId.value, payload)
    else await api.createAcademicYearLevel(payload)
    closeModal()
    await reloadList()
    feedback.value = 'Nivel educativo guardado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar el nivel educativo.'
  }
}

watch(() => form.levelCode, (levelCode) => {
  if (!editingId.value && !form.name) {
    form.name = translateLevelCode(levelCode)
  }
})

watch(() => form.academicYearId, () => {
  if (form.journeyId && !modalJourneys.value.some((journey) => journey.id === form.journeyId)) {
    form.journeyId = ''
  }
})

onMounted(async () => {
  await loadCatalogs()
})
</script>
