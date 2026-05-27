<template>
  <section class="stack">
    <PageHeader eyebrow="SIEE Académico" title="Áreas Académicas" subtitle="Administra las áreas obligatorias y optativas según la Ley 115 para organizar tus asignaturas.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nueva área académica</button>
      </template>
    </PageHeader>

    <ListView
      ref="listViewRef"
      title="Listado de áreas"
      subtitle="Las áreas agrupan materias (ej: Matemáticas agrupa Álgebra y Geometría) para los boletines oficiales."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar área por nombre o código"
      create-label="Nueva área académica"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #cell-color="{ row }">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span :style="{ backgroundColor: String(row.color || '#6366f1'), width: '16px', height: '16px', borderRadius: '4px', display: 'inline-block', border: '1px solid var(--border)' }"></span>
          <code>{{ row.color }}</code>
        </div>
      </template>
      <template #cell-isActive="{ value }">
        <span class="status-badge" :data-status="value ? 'active' : 'inactive'">
          {{ value ? 'Activa' : 'Inactiva' }}
        </span>
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar área académica' : 'Nueva área académica'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label class="col-span-2">
          Nombre de la área
          <input v-model="form.name" required placeholder="Ej. Humanidades y Lengua Castellana" />
        </label>
        
        <label>
          Código / Sigla
          <input v-model="form.code" required placeholder="Ej. HUM" />
        </label>
        
        <label>
          Orden de visualización
          <input v-model.number="form.orderNumber" type="number" min="0" placeholder="Ej. 1" />
        </label>

        <label>
          Color distintivo
          <div style="display: flex; gap: 8px; align-items: center;">
            <input v-model="form.color" type="color" style="width: 44px; height: 38px; padding: 2px; cursor: pointer;" />
            <input v-model="form.color" placeholder="#6366f1" required style="flex: 1;" />
          </div>
        </label>

        <label style="display: flex; flex-direction: row; align-items: center; gap: 10px; margin-top: 24px;">
          <input v-model="form.isActive" type="checkbox" />
          <span>Área activa</span>
        </label>

        <label class="col-span-2">
          Descripción / Observaciones
          <textarea v-model="form.description" placeholder="Opcional. Escribe detalles sobre los lineamientos curriculares de esta área." rows="3"></textarea>
        </label>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar área</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { AcademicAreaDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import { api } from '../lib/api'

type TableRow = { id: string } & Record<string, unknown>

const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isModalOpen = ref(false)
const editingId = ref('')
const feedback = ref('')

const columns = [
  { key: 'name', label: 'Área Académica' },
  { key: 'code', label: 'Código' },
  { key: 'color', label: 'Color' },
  { key: 'orderNumber', label: 'Orden' },
  { key: 'isActive', label: 'Estado' },
]

const form = reactive({
  name: '',
  code: '',
  description: '',
  color: '#6366f1',
  orderNumber: 1,
  isActive: true,
})

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getAcademicAreas({ page, pageSize, query })
  return { ...response.data, items: response.data.items as unknown as TableRow[] }
}

const openCreate = () => {
  feedback.value = ''
  editingId.value = ''
  Object.assign(form, {
    name: '',
    code: '',
    description: '',
    color: '#6366f1',
    orderNumber: 1,
    isActive: true,
  })
  isModalOpen.value = true
}

const openEdit = (row: Record<string, unknown>) => {
  feedback.value = ''
  const item = row as unknown as AcademicAreaDto
  editingId.value = item.id
  Object.assign(form, {
    name: item.name,
    code: item.code,
    description: item.description ?? '',
    color: item.color ?? '#6366f1',
    orderNumber: item.orderNumber ?? 0,
    isActive: item.isActive,
  })
  isModalOpen.value = true
}

const openDelete = async (row: Record<string, unknown>) => {
  if (!confirm(`¿Estás seguro de que deseas eliminar el área académica "${row.name}"?`)) return
  try {
    await api.deleteAcademicArea(String(row.id))
    await listViewRef.value?.reload()
    showFeedback('Área académica eliminada correctamente.')
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'No fue posible eliminar la área.')
  }
}

const closeModal = () => {
  isModalOpen.value = false
}

const showFeedback = (msg: string) => {
  feedback.value = msg
  setTimeout(() => {
    if (feedback.value === msg) feedback.value = ''
  }, 4000)
}

const submitForm = async () => {
  try {
    const payload = {
      ...form,
      orderNumber: Number(form.orderNumber || 0),
    }
    if (editingId.value) {
      await api.updateAcademicArea(editingId.value, payload)
    } else {
      await api.createAcademicArea(payload)
    }
    closeModal()
    await listViewRef.value?.reload()
    showFeedback('Área académica guardada correctamente.')
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'No fue posible guardar la área.')
  }
}
</script>

<style scoped>
.col-span-2 {
  grid-column: span 2;
}
</style>
