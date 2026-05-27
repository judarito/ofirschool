<template>
  <section class="stack">
    <PageHeader eyebrow="Administracion" title="Usuarios y roles" subtitle="Crea usuarios internos y asigna roles como `teacher`, `admin` o `coordinator`.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo usuario</button>
      </template>
    </PageHeader>

    <ListView
      ref="listViewRef"
      title="Usuarios del tenant"
      subtitle="Los roles controlan accesos. El rol `teacher` habilita experiencia docente filtrada."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar usuario o correo"
      create-label="Nuevo usuario"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #cell-status="{ row }">
        <span :class="['status-badge', row.status === 'active' ? 'status-badge--active' : 'status-badge--inactive']">
          {{ row.status === 'active' ? 'Activo' : 'Inactivo' }}
        </span>
      </template>

      <template #cell-roleNames="{ row }">
        <span>{{ row.roleNamesLabel }}</span>
      </template>

      <template #cell-linkedTeacherId="{ row }">
        <span>{{ row.linkedTeacherId ? 'Sí' : 'No' }}</span>
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar usuario' : 'Nuevo usuario'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label class="form-grid__wide">
          Nombre completo
          <input v-model="form.fullName" required placeholder="Ej. Laura Andrea Gomez" />
        </label>
        <label>
          Correo
          <input v-model="form.email" type="email" required placeholder="usuario@colegio.edu.co" />
        </label>
        <label>
          Estado
          <select v-model="form.status" required>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
        <label class="form-grid__wide">
          {{ editingId ? 'Nueva contraseña (opcional)' : 'Contraseña' }}
          <input v-model="form.password" type="password" :required="!editingId" minlength="8" placeholder="Mínimo 8 caracteres" />
        </label>
        <label class="form-grid__wide">
          Roles
          <div class="role-grid">
            <label v-for="role in roles" :key="role.id" class="role-chip">
              <input
                :checked="form.roleCodes.includes(role.code)"
                type="checkbox"
                @change="toggleRole(role.code)"
              />
              <span>{{ role.name }}</span>
              <small>{{ role.code }}</small>
            </label>
          </div>
        </label>
        <p class="form-note">
          Para que un usuario opere como docente debe tener rol `teacher` y estar vinculado en el módulo `Docentes`.
        </p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar usuario</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { RoleOptionDto, UserManagementDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import { api } from '../lib/api'

type TableRow = { id: string } & Record<string, unknown>

const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isModalOpen = ref(false)
const editingId = ref('')
const feedback = ref('')
const roles = ref<RoleOptionDto[]>([])
const form = reactive({
  fullName: '',
  email: '',
  status: 'active',
  password: '',
  roleCodes: [] as string[],
})

const columns = [
  { key: 'fullName', label: 'Usuario' },
  { key: 'email', label: 'Correo' },
  { key: 'status', label: 'Estado' },
  { key: 'roleNames', label: 'Roles' },
  { key: 'linkedTeacherId', label: 'Vinculado a docente' },
]

const loadRoles = async () => {
  const response = await api.getRoles()
  roles.value = response.data.items
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getUsers({ page, pageSize, query })
  const items = response.data.items.map((item) => ({
    ...item,
    roleNamesLabel: item.roleNames.length ? item.roleNames.join(', ') : 'Sin roles',
  }))
  return { ...response.data, items: items as unknown as TableRow[] }
}

const openCreate = () => {
  feedback.value = ''
  editingId.value = ''
  Object.assign(form, {
    fullName: '',
    email: '',
    status: 'active',
    password: '',
    roleCodes: [],
  })
  isModalOpen.value = true
}

const openEdit = (row: Record<string, unknown>) => {
  feedback.value = ''
  const item = row as unknown as UserManagementDto
  editingId.value = item.id
  Object.assign(form, {
    fullName: item.fullName,
    email: item.email,
    status: item.status,
    password: '',
    roleCodes: [...item.roleCodes],
  })
  isModalOpen.value = true
}

const openDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteUser(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Usuario eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el usuario.'
  }
}

const closeModal = () => {
  isModalOpen.value = false
}

const toggleRole = (roleCode: string) => {
  if (form.roleCodes.includes(roleCode)) {
    form.roleCodes = form.roleCodes.filter((item) => item !== roleCode)
    return
  }
  form.roleCodes = [...form.roleCodes, roleCode]
}

const submitForm = async () => {
  try {
    const payload = {
      fullName: form.fullName,
      email: form.email,
      status: form.status,
      password: form.password || null,
      roleCodes: form.roleCodes,
    }
    if (editingId.value) {
      await api.updateUser(editingId.value, payload)
    } else {
      await api.createUser({
        ...payload,
        password: form.password,
      })
    }
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Usuario guardado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar el usuario.'
  }
}

onMounted(loadRoles)
</script>

<style scoped>
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
</style>
