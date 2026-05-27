<template>
  <section class="stack">
    <PageHeader
      eyebrow="Academico"
      title="Anos lectivos"
      subtitle="Define el calendario macro del colegio. Los datos vienen de la base de datos."
    >
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo ano lectivo</button>
      </template>
    </PageHeader>

    <ListView
      ref="listViewRef"
      title="Listado de anos lectivos"
      subtitle="Cada ano lectivo tiene fecha de inicio, fecha fin y estado."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar ano lectivo"
      create-label="Nuevo ano lectivo"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #cell-window="{ row }">
        <span class="date-range-cell">{{ row.window }}</span>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge :status="String(row.status)" />
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar ano lectivo' : 'Nuevo ano lectivo'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>Nombre<input v-model="form.name" required placeholder="Ano lectivo 2026" /></label>
        <label>Ano<input v-model.number="form.year" type="number" required /></label>
        <label>Fecha inicio<input v-model="form.startsOn" type="date" required /></label>
        <label>Fecha fin<input v-model="form.endsOn" type="date" required /></label>
        <label>
          Estado
          <select v-model="form.status">
            <option value="activo">Activo</option>
            <option value="planeado">Planeado</option>
          </select>
        </label>
        <p class="form-note">Cerrado ahora es un estado calculado por fechas, no una opción editable.</p>
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
import { reactive, ref } from 'vue'
import type { AcademicYearDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { api } from '../lib/api'

type Row = AcademicYearDto & { window: string }
type TableRow = { id: string } & Record<string, unknown>
const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isModalOpen = ref(false)
const editingId = ref('')
const feedback = ref('')
const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'year', label: 'Ano' },
  { key: 'window', label: 'Vigencia' },
  { key: 'status', label: 'Estado' },
]
const form = reactive({ name: '', year: 2026, startsOn: '2026-01-20', endsOn: '2026-11-30', status: 'planeado' })

const toRow = (item: AcademicYearDto): Row => ({ ...item, window: `${item.startsOn} - ${item.endsOn}` })
const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getAcademicYears({ page, pageSize, query })
  return { ...response.data, items: response.data.items.map(toRow) as unknown as TableRow[] }
}
const openCreate = () => {
  feedback.value = ''
  editingId.value = ''
  Object.assign(form, { name: '', year: 2026, startsOn: '2026-01-20', endsOn: '2026-11-30', status: 'planeado' })
  isModalOpen.value = true
}
const openEdit = (row: Record<string, unknown>) => {
  feedback.value = ''
  const item = row as unknown as Row
  editingId.value = item.id
  Object.assign(form, {
    name: item.name,
    year: item.year,
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    status: item.status === 'activo' ? 'activo' : 'planeado',
  })
  isModalOpen.value = true
}
const openDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteAcademicYear(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Ano lectivo eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el ano lectivo.'
  }
}
const closeModal = () => {
  isModalOpen.value = false
}
const submitForm = async () => {
  try {
    if (editingId.value) await api.updateAcademicYear(editingId.value, { ...form })
    else await api.createAcademicYear({ ...form })
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Ano lectivo guardado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar el ano lectivo.'
  }
}
</script>
