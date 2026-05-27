<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Grados" subtitle="Administra el catalogo de grados desde la base de datos.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo grado</button>
      </template>
    </PageHeader>

    <section class="academic-rule-card">
      <span class="academic-rule-card__icon">GR</span>
      <div>
        <strong>Los grados no tienen calendario propio</strong>
        <p>Son catalogos permanentes. Las fechas se manejan en anos lectivos, periodos, inscripciones y matriculas.</p>
      </div>
    </section>

    <ListView
      ref="listViewRef"
      title="Listado de grados"
      subtitle="Datos cargados desde PostgreSQL."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar grado"
      create-label="Nuevo grado"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #cell-levelName="{ value }">
        {{ translateLevelName(String(value)) }}
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar grado' : 'Nuevo grado'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>Nombre<input v-model="form.name" required placeholder="Sexto" /></label>
        <label>Nivel Numérico<input v-model.number="form.level" type="number" required /></label>
        
        <label>
          Nivel SIEE (Nacional)
          <select v-model="form.levelName" required>
            <option value="preschool">Preescolar</option>
            <option value="primary">Primaria</option>
            <option value="secondary">Secundaria</option>
            <option value="middle">Media (10-11)</option>
          </select>
        </label>
        
        <label>Orden de Visualización<input v-model.number="form.orderNumber" type="number" required /></label>
        
        <p class="form-note">Los grados no tienen fechas ni estado editable en este flujo.</p>
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
import type { AcademicGradeDto } from '@ofir/shared'
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
  { key: 'name', label: 'Grado' },
  { key: 'level', label: 'Nivel Numérico' },
  { key: 'levelName', label: 'Nivel SIEE' },
  { key: 'orderNumber', label: 'Orden' },
]

const form = reactive({ name: '', level: 1, levelName: 'primary', orderNumber: 0 })

const translateLevelName = (name?: string | null) => {
  const map: Record<string, string> = {
    preschool: 'Preescolar 🧸',
    primary: 'Primaria 📖',
    secondary: 'Secundaria 🎒',
    middle: 'Media 🎓',
  }
  return map[name || ''] || 'No configurado'
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getAcademicGrades({ page, pageSize, query })
  return { ...response.data, items: response.data.items as unknown as TableRow[] }
}
const openCreate = () => {
  editingId.value = ''
  Object.assign(form, { name: '', level: 1, levelName: 'primary', orderNumber: 0 })
  isModalOpen.value = true
}
const openEdit = (row: Record<string, unknown>) => {
  const item = row as unknown as AcademicGradeDto
  editingId.value = item.id
  Object.assign(form, {
    name: item.name,
    level: item.level,
    levelName: item.levelName ?? 'primary',
    orderNumber: item.orderNumber ?? 0
  })
  isModalOpen.value = true
}
const openDelete = async (row: Record<string, unknown>) => {
  if (!confirm(`¿Estás seguro de que deseas eliminar el grado "${row.name}"?`)) return
  try {
    await api.deleteAcademicGrade(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Grado eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el grado.'
  }
}
const closeModal = () => {
  isModalOpen.value = false
}
const submitForm = async () => {
  try {
    const payload = {
      ...form,
      level: Number(form.level),
      orderNumber: Number(form.orderNumber),
    }
    if (editingId.value) await api.updateAcademicGrade(editingId.value, payload)
    else await api.createAcademicGrade(payload)
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Grado guardado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar el grado.'
  }
}
</script>
