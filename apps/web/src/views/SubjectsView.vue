<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Materias" subtitle="Administra el catálogo base de materias del colegio.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nueva materia</button>
      </template>
    </PageHeader>

    <ListView
      ref="listViewRef"
      title="Listado de materias"
      subtitle="Estas materias luego se asignan a cursos y alimentan logros y notas."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar materia, código o área"
      create-label="Nueva materia"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #cell-area="{ row }">
        {{ row.academicAreaName || row.area || 'Sin área' }}
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar materia' : 'Nueva materia'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>Nombre<input v-model="form.name" required placeholder="Matemáticas" /></label>
        <label>Código<input v-model="form.code" required placeholder="MAT" /></label>
        
        <label>
          Área Académica (SIEE)
          <select v-model="form.academicAreaId">
            <option value="">-- Seleccionar Área --</option>
            <option v-for="area in areas" :key="area.id" :value="area.id">{{ area.name }}</option>
          </select>
        </label>
        
        <label>Área de Fallback (Texto)<input v-model="form.area" placeholder="Ej. Ciencias básicas" /></label>
        
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
import { onMounted, reactive, ref } from 'vue'
import type { SubjectDto, AcademicAreaDto } from '@ofir/shared'
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

const columns = [
  { key: 'name', label: 'Materia' },
  { key: 'code', label: 'Código' },
  { key: 'area', label: 'Área' },
]
const form = reactive({ name: '', code: '', area: '', academicAreaId: '' })

const loadAreas = async () => {
  try {
    const response = await api.getAcademicAreas({ page: 1, pageSize: 100 })
    areas.value = response.data.items
  } catch (error) {
    console.error('Error al cargar áreas académicas:', error)
  }
}

onMounted(() => {
  void loadAreas()
})

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getSubjects({ page, pageSize, query })
  return { ...response.data, items: response.data.items as unknown as TableRow[] }
}

const openCreate = () => {
  feedback.value = ''
  editingId.value = ''
  Object.assign(form, { name: '', code: '', area: '', academicAreaId: '' })
  isModalOpen.value = true
}

const openEdit = (row: Record<string, unknown>) => {
  feedback.value = ''
  const item = row as unknown as SubjectDto
  editingId.value = item.id
  Object.assign(form, {
    name: item.name,
    code: item.code,
    area: item.area ?? '',
    academicAreaId: item.academicAreaId ?? '',
  })
  isModalOpen.value = true
}

const openDelete = async (row: Record<string, unknown>) => {
  if (!confirm(`¿Estás seguro de que deseas eliminar la materia "${row.name}"?`)) return
  try {
    await api.deleteSubject(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Materia eliminada.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar la materia.'
  }
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitForm = async () => {
  try {
    const payload = {
      ...form,
      academicAreaId: form.academicAreaId || null,
      area: form.area || null,
    }
    if (editingId.value) await api.updateSubject(editingId.value, payload)
    else await api.createSubject(payload)
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Materia guardada correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar la materia.'
  }
}
</script>
