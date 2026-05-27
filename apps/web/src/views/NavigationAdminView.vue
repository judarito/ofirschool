<template>
  <section class="stack">
    <PageHeader eyebrow="Administración" title="Menú y navegación" subtitle="Administra secciones, opciones y visibilidad por rol del menú lateral y móvil.">
      <template #actions>
        <button class="button button--ghost" type="button" @click="openSectionCreate">Nueva sección</button>
        <button class="button button--brand" type="button" :disabled="!selectedSectionId" @click="openItemCreate">Nuevo ítem</button>
      </template>
    </PageHeader>

    <SurfaceCard class="module-inline-summary">
      <div class="module-inline-summary__copy">
        <strong>Menú dinámico por rol</strong>
        <p>Los cambios se reflejan en sidebar y navegación móvil después de guardar.</p>
      </div>
      <div class="module-inline-summary__meta">
        <span>{{ sections.length }} secciones</span>
        <small>{{ totalItems }} ítems configurados</small>
      </div>
      <div class="module-inline-summary__actions">
        <button class="button button--ghost" type="button" @click="reload">Recargar</button>
      </div>
    </SurfaceCard>

    <div class="navigation-admin-layout">
      <SurfaceCard class="navigation-admin-sections">
        <div class="card-headline">
          <div>
            <h3>Secciones</h3>
            <p>Elige una sección para administrar sus opciones.</p>
          </div>
        </div>

        <div class="navigation-admin-section-list">
          <button
            v-for="section in sections"
            :key="section.id"
            class="navigation-admin-section-row"
            :class="{ 'navigation-admin-section-row--active': selectedSectionId === section.id }"
            type="button"
            @click="selectedSectionId = section.id"
          >
            <div>
              <strong>{{ section.title }}</strong>
              <small>{{ section.code }} · {{ section.items.length }} ítems</small>
            </div>
            <span :class="['meta-badge', section.isActive ? 'meta-badge--success' : 'meta-badge--muted']">
              {{ section.isActive ? 'Activa' : 'Inactiva' }}
            </span>
          </button>
        </div>

        <div v-if="selectedSection" class="modal-actions">
          <button class="button button--ghost" type="button" @click="openSectionEdit(selectedSection)">Editar sección</button>
          <button class="button button--ghost" type="button" @click="deleteSection(selectedSection)">Eliminar</button>
        </div>
      </SurfaceCard>

      <ListView
        ref="listViewRef"
        title="Ítems del menú"
        subtitle="Edita ruta, orden, roles y presencia en móvil por cada opción."
        :columns="columns"
        :fetcher="fetchRows"
        search-placeholder="Buscar por nombre, código o ruta"
        create-label="Nuevo ítem"
        :show-actions="Boolean(selectedSectionId)"
        :reload-key="reloadKey"
        @create="openItemCreate"
        @edit="openItemEdit"
        @delete="openItemDelete"
      >
        <template #toolbar-actions>
          <div class="navigation-admin-toolbar">
            <select v-model="selectedSectionId" class="toolbar-select">
              <option v-for="section in sections" :key="section.id" :value="section.id">{{ section.title }}</option>
            </select>
            <button class="button button--brand" type="button" :disabled="!selectedSectionId" @click="openItemCreate">Nuevo ítem</button>
          </div>
        </template>

        <template #cell-label="{ row }">
          <div class="list-view__primary-cell">
            <strong>{{ row.label }}</strong>
            <small>{{ row.to }}</small>
          </div>
        </template>

        <template #cell-roleCodes="{ row }">
          <span>{{ row.roleCodesLabel }}</span>
        </template>

        <template #cell-mobileVisible="{ row }">
          <span>{{ row.mobileVisible ? 'Sí' : 'No' }}</span>
        </template>

        <template #cell-isActive="{ row }">
          <span :class="['status-badge', row.isActive ? 'status-badge--active' : 'status-badge--inactive']">
            {{ row.isActive ? 'Activo' : 'Inactivo' }}
          </span>
        </template>
      </ListView>
    </div>

    <FormModal :open="activeModal === 'section'" :title="editingSectionId ? 'Editar sección' : 'Nueva sección'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitSection">
        <label>
          Código
          <input v-model="sectionForm.code" required placeholder="institutional" />
        </label>
        <label>
          Título
          <input v-model="sectionForm.title" required placeholder="Institucional" />
        </label>
        <label>
          Orden
          <input v-model.number="sectionForm.sortOrder" type="number" min="0" />
        </label>
        <label class="checkbox-field">
          <input v-model="sectionForm.isActive" type="checkbox" />
          <span>Sección activa</span>
        </label>
        <div class="modal-actions form-grid__wide">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar sección</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'item'" :title="editingItemId ? 'Editar ítem' : 'Nuevo ítem'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitItem">
        <label>
          Sección
          <select v-model="itemForm.sectionId" required>
            <option v-for="section in sections" :key="section.id" :value="section.id">{{ section.title }}</option>
          </select>
        </label>
        <label>
          Código
          <input v-model="itemForm.code" required placeholder="users" />
        </label>
        <label class="form-grid__wide">
          Etiqueta
          <input v-model="itemForm.label" required placeholder="Usuarios" />
        </label>
        <label class="form-grid__wide">
          Ruta
          <input v-model="itemForm.to" required placeholder="/users" />
        </label>
        <label>
          Sigla
          <input v-model="itemForm.shortLabel" required maxlength="10" placeholder="US" />
        </label>
        <label>
          Orden
          <input v-model.number="itemForm.sortOrder" type="number" min="0" />
        </label>
        <label>
          Permiso requerido
          <input v-model="itemForm.requiredPermission" placeholder="users.manage" />
        </label>
        <label>
          Badge
          <input v-model.number="itemForm.badge" type="number" min="0" />
        </label>
        <label class="checkbox-field">
          <input v-model="itemForm.mobileVisible" type="checkbox" />
          <span>Visible en móvil</span>
        </label>
        <label class="checkbox-field">
          <input v-model="itemForm.isActive" type="checkbox" />
          <span>Ítem activo</span>
        </label>
        <label class="form-grid__wide">
          Roles visibles
          <div class="role-grid">
            <label v-for="role in roles" :key="role.id" class="role-chip">
              <input :checked="itemForm.roleCodes.includes(role.code)" type="checkbox" @change="toggleItemRole(role.code)" />
              <span>{{ role.name }}</span>
              <small>{{ role.code }}</small>
            </label>
          </div>
        </label>
        <div class="modal-actions form-grid__wide">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar ítem</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { NavigationAdminDto, NavigationAdminItemDto, NavigationAdminSectionDto, RoleOptionDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'
import { useSessionStore } from '../stores/session'

type TableRow = { id: string } & Record<string, unknown>

const session = useSessionStore()
const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const activeModal = ref<'' | 'section' | 'item'>('')
const editingSectionId = ref('')
const editingItemId = ref('')
const selectedSectionId = ref('')
const feedback = ref('')
const reloadKey = ref(0)
const sections = ref<NavigationAdminSectionDto[]>([])
const roles = ref<RoleOptionDto[]>([])

const columns = [
  { key: 'label', label: 'Ítem' },
  { key: 'code', label: 'Código' },
  { key: 'shortLabel', label: 'Sigla' },
  { key: 'sortOrder', label: 'Orden' },
  { key: 'roleCodes', label: 'Roles' },
  { key: 'mobileVisible', label: 'Móvil' },
  { key: 'isActive', label: 'Estado' },
]

const sectionForm = reactive({
  code: '',
  title: '',
  sortOrder: 0,
  isActive: true,
})

const itemForm = reactive({
  sectionId: '',
  code: '',
  label: '',
  to: '',
  shortLabel: '',
  badge: null as number | null,
  sortOrder: 0,
  requiredPermission: '',
  mobileVisible: false,
  isActive: true,
  roleCodes: [] as string[],
})

const selectedSection = computed(() => sections.value.find((section) => section.id === selectedSectionId.value) ?? null)
const totalItems = computed(() => sections.value.reduce((total, section) => total + section.items.length, 0))

const resetSectionForm = () => {
  Object.assign(sectionForm, {
    code: '',
    title: '',
    sortOrder: sections.value.length + 1,
    isActive: true,
  })
}

const resetItemForm = () => {
  Object.assign(itemForm, {
    sectionId: selectedSectionId.value || sections.value[0]?.id || '',
    code: '',
    label: '',
    to: '',
    shortLabel: '',
    badge: null,
    sortOrder: (selectedSection.value?.items.length ?? 0) + 1,
    requiredPermission: '',
    mobileVisible: false,
    isActive: true,
    roleCodes: [],
  })
}

const reload = async () => {
  const response = await api.getNavigationAdmin()
  sections.value = response.data.sections
  roles.value = response.data.roles
  if (!selectedSectionId.value || !sections.value.some((section) => section.id === selectedSectionId.value)) {
    selectedSectionId.value = sections.value[0]?.id ?? ''
  }
  reloadKey.value += 1
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const items = (selectedSection.value?.items ?? [])
    .filter((item) => {
      const normalized = query.trim().toLowerCase()
      if (!normalized) return true
      return [item.label, item.code, item.to, item.shortLabel].some((value) => String(value).toLowerCase().includes(normalized))
    })
    .map((item) => ({
      ...item,
      roleCodesLabel: item.roleCodes.length ? item.roleCodes.join(', ') : 'Sin roles',
    }))

  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize) as unknown as TableRow[],
    total: items.length,
    page,
    pageSize,
  }
}

const openSectionCreate = () => {
  feedback.value = ''
  editingSectionId.value = ''
  resetSectionForm()
  activeModal.value = 'section'
}

const openSectionEdit = (section: NavigationAdminSectionDto) => {
  feedback.value = ''
  editingSectionId.value = section.id
  Object.assign(sectionForm, {
    code: section.code,
    title: section.title,
    sortOrder: section.sortOrder,
    isActive: section.isActive,
  })
  activeModal.value = 'section'
}

const openItemCreate = () => {
  if (!selectedSectionId.value) return
  feedback.value = ''
  editingItemId.value = ''
  resetItemForm()
  activeModal.value = 'item'
}

const openItemEdit = (row: Record<string, unknown>) => {
  const item = row as unknown as NavigationAdminItemDto
  feedback.value = ''
  editingItemId.value = item.id
  Object.assign(itemForm, {
    sectionId: item.sectionId,
    code: item.code,
    label: item.label,
    to: item.to,
    shortLabel: item.shortLabel,
    badge: item.badge,
    sortOrder: item.sortOrder,
    requiredPermission: item.requiredPermission ?? '',
    mobileVisible: item.mobileVisible,
    isActive: item.isActive,
    roleCodes: [...item.roleCodes],
  })
  activeModal.value = 'item'
}

const closeModal = () => {
  activeModal.value = ''
}

const toggleItemRole = (roleCode: string) => {
  if (itemForm.roleCodes.includes(roleCode)) {
    itemForm.roleCodes = itemForm.roleCodes.filter((item) => item !== roleCode)
    return
  }
  itemForm.roleCodes = [...itemForm.roleCodes, roleCode]
}

const submitSection = async () => {
  try {
    const payload = { ...sectionForm }
    if (editingSectionId.value) {
      await api.updateNavigationSection(editingSectionId.value, payload)
    } else {
      await api.createNavigationSection(payload)
    }
    closeModal()
    await reload()
    await session.loadNavigation()
    feedback.value = 'Sección guardada correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar la sección.'
  }
}

const submitItem = async () => {
  try {
    const payload = {
      ...itemForm,
      badge: itemForm.badge ?? null,
      requiredPermission: itemForm.requiredPermission || null,
    }
    if (editingItemId.value) {
      await api.updateNavigationItem(editingItemId.value, payload)
    } else {
      await api.createNavigationItem(payload)
    }
    closeModal()
    await reload()
    await session.loadNavigation()
    feedback.value = 'Ítem guardado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar el ítem.'
  }
}

const deleteSection = async (section: NavigationAdminSectionDto) => {
  try {
    await api.deleteNavigationSection(section.id)
    await reload()
    await session.loadNavigation()
    feedback.value = 'Sección eliminada.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar la sección.'
  }
}

const openItemDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteNavigationItem(String(row.id))
    await reload()
    await session.loadNavigation()
    feedback.value = 'Ítem eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el ítem.'
  }
}

onMounted(reload)
</script>

<style scoped>
.module-inline-summary {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) auto auto;
  gap: 1rem;
  align-items: center;
}

.module-inline-summary__copy {
  display: grid;
  gap: 0.3rem;
}

.module-inline-summary__copy p,
.module-inline-summary__meta small {
  color: var(--text-muted);
}

.module-inline-summary__meta {
  display: grid;
  gap: 0.2rem;
  justify-items: end;
  text-align: right;
}

.module-inline-summary__meta span {
  font-weight: 700;
}

.module-inline-summary__actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.navigation-admin-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 1rem;
}

.navigation-admin-sections {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.navigation-admin-section-list {
  display: grid;
  gap: 0.65rem;
}

.navigation-admin-section-row {
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: var(--surface-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  text-align: left;
}

.navigation-admin-section-row small {
  color: var(--text-muted);
}

.navigation-admin-section-row--active {
  border-color: color-mix(in srgb, var(--brand-primary) 30%, var(--border-color));
  background: color-mix(in srgb, var(--brand-primary-soft) 65%, white);
}

.navigation-admin-toolbar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.role-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.role-chip {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 14px;
}

.role-chip small {
  color: var(--color-text-muted, #64748b);
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.checkbox-field input {
  width: auto;
}

@media (max-width: 980px) {
  .module-inline-summary,
  .navigation-admin-layout {
    grid-template-columns: 1fr;
  }

  .module-inline-summary__meta {
    justify-items: start;
    text-align: left;
  }
}
</style>
