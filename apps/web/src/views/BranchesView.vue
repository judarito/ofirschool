<template>
  <section class="stack">
    <PageHeader
      eyebrow="Institucional"
      title="Sedes"
      subtitle="Gestiona las sedes físicas del colegio. Cada sede puede tener sus propios cursos, jornadas e inscripciones."
    >
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">
          <span>＋</span> Nueva sede
        </button>
      </template>
    </PageHeader>

    <!-- Branch cards grid -->
    <div v-if="!loading && branches.length > 0" class="branches-grid">
      <div
        v-for="branch in branches"
        :key="branch.id"
        class="branch-card"
      >
        <div class="branch-card__header">
          <div class="branch-card__icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
            </svg>
          </div>
          <div class="branch-card__actions">
            <button class="icon-btn" title="Editar sede" @click="openEdit(branch)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
            </button>
            <button class="icon-btn icon-btn--danger" title="Eliminar sede" @click="openDelete(branch)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </div>

        <div class="branch-card__body">
          <h3 class="branch-card__name">{{ branch.name }}</h3>
          <p v-if="branch.code" class="branch-card__code">Código: {{ branch.code }}</p>

          <div class="branch-card__details">
            <div v-if="branch.address" class="branch-detail">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <span>{{ branch.address }}{{ branch.city ? `, ${branch.city}` : '' }}</span>
            </div>
            <div v-if="branch.phone" class="branch-detail">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 6.75Z" />
              </svg>
              <span>{{ branch.phone }}</span>
            </div>
            <div v-if="!branch.address && !branch.phone" class="branch-detail branch-detail--empty">
              <span>Sin información de contacto</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && branches.length === 0" class="empty-state">
      <div class="empty-state__icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
        </svg>
      </div>
      <p class="empty-state__title">Aún no hay sedes registradas</p>
      <p class="empty-state__subtitle">Crea la primera sede para comenzar a segmentar la operación del colegio.</p>
      <button class="button button--brand" type="button" @click="openCreate">Crear primera sede</button>
    </div>

    <!-- Loading -->
    <div v-else class="loading-state">
      <div class="loading-spinner" />
      <span>Cargando sedes...</span>
    </div>

    <!-- Form Modal -->
    <FormModal
      :open="isModalOpen"
      :title="editingId ? 'Editar sede' : 'Nueva sede'"
      @close="closeModal"
    >
      <form class="form-grid" @submit.prevent="submitForm">
        <label class="form-grid__wide">
          Nombre de la sede <span class="required">*</span>
          <input
            v-model="form.name"
            required
            minlength="2"
            maxlength="160"
            placeholder="Ej. Sede Principal — Centro"
            id="branch-name"
          />
        </label>

        <label>
          Código
          <input
            v-model="form.code"
            maxlength="30"
            placeholder="Ej. SP-001"
            id="branch-code"
          />
        </label>

        <label>
          Ciudad
          <input
            v-model="form.city"
            maxlength="120"
            placeholder="Ej. Bogotá"
            id="branch-city"
          />
        </label>

        <label class="form-grid__wide">
          Dirección
          <input
            v-model="form.address"
            maxlength="255"
            placeholder="Ej. Calle 45 # 12-34"
            id="branch-address"
          />
        </label>

        <label>
          Teléfono
          <input
            v-model="form.phone"
            maxlength="30"
            placeholder="Ej. 601 234 5678"
            id="branch-phone"
          />
        </label>

        <div v-if="formError" class="form-error">{{ formError }}</div>

        <div class="modal-actions form-grid__wide">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="submitting">
            {{ submitting ? 'Guardando...' : 'Guardar sede' }}
          </button>
        </div>
      </form>
    </FormModal>

    <!-- Delete confirmation -->
    <FormModal
      :open="isDeleteOpen"
      title="Eliminar sede"
      @close="isDeleteOpen = false"
    >
      <div class="delete-confirm">
        <p>¿Estás seguro de que deseas eliminar la sede <strong>{{ deletingBranch?.name }}</strong>?</p>
        <p class="delete-confirm__warning">Esta acción no se puede deshacer. Si la sede tiene cursos o inscripciones activas, no podrá eliminarse.</p>
        <div v-if="deleteError" class="form-error">{{ deleteError }}</div>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="isDeleteOpen = false">Cancelar</button>
          <button class="button button--danger" type="button" :disabled="submitting" @click="confirmDelete">
            {{ submitting ? 'Eliminando...' : 'Sí, eliminar' }}
          </button>
        </div>
      </div>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { BranchDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import PageHeader from '../components/PageHeader.vue'
import { api } from '../lib/api'

const branches = ref<BranchDto[]>([])
const loading = ref(true)
const isModalOpen = ref(false)
const isDeleteOpen = ref(false)
const editingId = ref('')
const deletingBranch = ref<BranchDto | null>(null)
const feedback = ref('')
const formError = ref('')
const deleteError = ref('')
const submitting = ref(false)

const form = reactive({
  name: '',
  code: '',
  address: '',
  city: '',
  phone: '',
})

const loadBranches = async () => {
  loading.value = true
  try {
    const response = await api.getBranches()
    branches.value = response.data.branches
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible cargar las sedes.'
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  feedback.value = ''
  formError.value = ''
  editingId.value = ''
  Object.assign(form, { name: '', code: '', address: '', city: '', phone: '' })
  isModalOpen.value = true
}

const openEdit = (branch: BranchDto) => {
  feedback.value = ''
  formError.value = ''
  editingId.value = branch.id
  Object.assign(form, {
    name: branch.name,
    code: branch.code ?? '',
    address: branch.address ?? '',
    city: branch.city ?? '',
    phone: branch.phone ?? '',
  })
  isModalOpen.value = true
}

const openDelete = (branch: BranchDto) => {
  deleteError.value = ''
  deletingBranch.value = branch
  isDeleteOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
  formError.value = ''
}

const submitForm = async () => {
  formError.value = ''
  submitting.value = true
  try {
    const payload = {
      name: form.name,
      code: form.code || null,
      address: form.address || null,
      city: form.city || null,
      phone: form.phone || null,
    }
    if (editingId.value) {
      await api.updateBranch(editingId.value, payload)
      feedback.value = 'Sede actualizada correctamente.'
    } else {
      await api.createBranch(payload)
      feedback.value = 'Sede creada correctamente.'
    }
    closeModal()
    await loadBranches()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'No fue posible guardar la sede.'
  } finally {
    submitting.value = false
  }
}

const confirmDelete = async () => {
  if (!deletingBranch.value) return
  deleteError.value = ''
  submitting.value = true
  try {
    await api.deleteBranch(deletingBranch.value.id)
    isDeleteOpen.value = false
    feedback.value = 'Sede eliminada.'
    await loadBranches()
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : 'No fue posible eliminar la sede.'
  } finally {
    submitting.value = false
  }
}

onMounted(loadBranches)
</script>

<style scoped>
.branches-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}

.branch-card {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: box-shadow 0.2s, transform 0.2s;
}

.branch-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.branch-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.branch-card__icon {
  width: 48px;
  height: 48px;
  background: var(--color-brand-subtle, #ede9fe);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-brand, #7c3aed);
  flex-shrink: 0;
}

.branch-card__icon svg {
  width: 24px;
  height: 24px;
}

.branch-card__actions {
  display: flex;
  gap: 0.5rem;
}

.icon-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-muted, #64748b);
  transition: background 0.15s, color 0.15s;
}

.icon-btn:hover {
  background: var(--color-surface-hover, #f1f5f9);
  color: var(--color-text, #0f172a);
}

.icon-btn--danger:hover {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fca5a5;
}

.icon-btn svg {
  width: 16px;
  height: 16px;
}

.branch-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.branch-card__name {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text, #0f172a);
  margin: 0;
}

.branch-card__code {
  font-size: 0.78rem;
  color: var(--color-text-muted, #64748b);
  background: var(--color-surface-secondary, #f8fafc);
  border-radius: 6px;
  padding: 0.2rem 0.5rem;
  width: fit-content;
  margin: 0;
  font-family: monospace;
}

.branch-card__details {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.branch-detail {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary, #475569);
}

.branch-detail svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-text-muted, #94a3b8);
}

.branch-detail--empty {
  color: var(--color-text-muted, #94a3b8);
  font-style: italic;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty-state__icon {
  width: 72px;
  height: 72px;
  background: var(--color-brand-subtle, #ede9fe);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-brand, #7c3aed);
}

.empty-state__icon svg {
  width: 36px;
  height: 36px;
}

.empty-state__title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text, #0f172a);
  margin: 0;
}

.empty-state__subtitle {
  color: var(--color-text-muted, #64748b);
  max-width: 380px;
  margin: 0;
}

/* Loading */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--color-text-muted, #64748b);
}

.loading-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-brand, #7c3aed);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Form */
.form-error {
  grid-column: 1 / -1;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}

.required {
  color: #dc2626;
}

.delete-confirm {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.delete-confirm p {
  margin: 0;
  color: var(--color-text, #0f172a);
}

.delete-confirm__warning {
  font-size: 0.875rem;
  color: var(--color-text-muted, #64748b);
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  padding: 0.75rem 1rem;
}
</style>
