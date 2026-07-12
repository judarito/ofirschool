<template>
  <section class="stack">
    <PageHeader eyebrow="Académico" title="Comités académicos" subtitle="Gestiona reuniones de comités de evaluación y promoción, con actas, asistentes y decisiones.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo comité</button>
      </template>
    </PageHeader>

    <ListView
      ref="listViewRef"
      title="Reuniones de comité"
      subtitle="Comités de evaluación y promoción registrados en el año lectivo."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar por título o tipo"
      @create="openCreate"
      @edit="viewDetail"
      @delete="openDelete"
    >
      <template #cell-committeeType="{ value }">
        {{ value === 'evaluation' ? 'Evaluación' : 'Promoción' }}
      </template>
      <template #cell-status="{ value }">
        <span :class="['meta-badge', badgeClass(String(value))]">{{ value === 'approved' ? 'Aprobado' : 'Borrador' }}</span>
      </template>
      <template #cell-meetingDate="{ value }">
        {{ value ? String(value).split('T')[0] : '' }}
      </template>
      <template #row-actions="{ row }">
        <button class="table-action" type="button" @click="viewDetail(row)">Ver</button>
        <button
          v-if="String(row.status) === 'draft'"
          class="table-action"
          type="button"
          @click="approveCommittee(row)"
        >
          Aprobar
        </button>
        <button
          v-if="String(row.status) === 'draft'"
          class="table-action table-action--danger"
          type="button"
          @click="openDelete(row)"
        >
          Eliminar
        </button>
      </template>
    </ListView>

    <FormModal :open="isCreateOpen" title="Nuevo comité académico" @close="closeCreate">
      <form class="form-grid" @submit.prevent="submitCreate">
        <label>
          Año lectivo
          <select v-model="form.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Tipo
          <select v-model="form.committeeType" required>
            <option value="evaluation">Comité de evaluación</option>
            <option value="promotion">Comité de promoción</option>
          </select>
        </label>
        <label>Título<input v-model="form.title" required placeholder="Comité primer periodo" /></label>
        <label>Fecha de reunión<input v-model="form.meetingDate" type="date" required /></label>
        <label>Objetivo<textarea v-model="form.objective" rows="3" placeholder="Propósito de la reunión" /></label>
        <label>Convocatoria<textarea v-model="form.callTo" rows="2" placeholder="A quiénes se convoca y cómo" /></label>
        <fieldset class="form-fieldset">
          <legend>Asistentes</legend>
          <div v-for="(a, i) in form.attendees" :key="i" class="form-row">
            <input v-model="a.fullName" required placeholder="Nombre completo" />
            <input v-model="a.role" required placeholder="Rol (ej: Docente, Coordinador)" />
            <button type="button" class="table-action table-action--danger" @click="removeAttendee(i)">X</button>
          </div>
          <button type="button" class="chip-button" @click="addAttendee">+ Agregar asistente</button>
        </fieldset>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeCreate">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="submitting">Guardar</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="isDetailOpen" :title="detailTitle" @close="closeDetail">
      <div v-if="detail" class="detail-stack">
        <SurfaceCard>
          <div class="card-headline">
            <h3>Información general</h3>
          </div>
          <dl class="detail-grid">
            <dt>Tipo</dt>
            <dd>{{ detail.committeeType === 'evaluation' ? 'Evaluación' : 'Promoción' }}</dd>
            <dt>Fecha</dt>
            <dd>{{ detail.meetingDate }}</dd>
            <dt>Consecutivo</dt>
            <dd>Acta N° {{ detail.meetingNumber }}</dd>
            <dt>Estado</dt>
            <dd>
              <span :class="['meta-badge', badgeClass(detail.status)]">{{ detail.status === 'approved' ? 'Aprobado' : 'Borrador' }}</span>
            </dd>
            <dt v-if="detail.objective">Objetivo</dt>
            <dd v-if="detail.objective">{{ detail.objective }}</dd>
            <dt v-if="detail.callTo">Convocatoria</dt>
            <dd v-if="detail.callTo">{{ detail.callTo }}</dd>
            <dt v-if="detail.development">Desarrollo</dt>
            <dd v-if="detail.development" class="text-pre">{{ detail.development }}</dd>
            <dt v-if="detail.conclusions">Conclusiones</dt>
            <dd v-if="detail.conclusions" class="text-pre">{{ detail.conclusions }}</dd>
          </dl>
        </SurfaceCard>

        <SurfaceCard>
          <div class="card-headline">
            <h3>Asistentes ({{ detail.attendees.length }})</h3>
          </div>
          <table v-if="detail.attendees.length" class="list-view__table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Asistió</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in detail.attendees" :key="a.id">
                <td>{{ a.fullName }}</td>
                <td>{{ a.role }}</td>
                <td>{{ a.attended ? 'Sí' : 'No' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty-state">Sin asistentes registrados.</p>
        </SurfaceCard>

        <SurfaceCard>
          <div class="card-headline">
            <h3>Decisiones ({{ detail.decisions.length }})</h3>
          </div>
          <table v-if="detail.decisions.length" class="list-view__table">
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Tipo</th>
                <th>Decisión</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in detail.decisions" :key="d.id">
                <td>{{ d.studentName ?? '—' }}</td>
                <td>{{ d.decisionType }}</td>
                <td>{{ d.decision }}</td>
                <td>{{ d.description }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty-state">Sin decisiones registradas.</p>
        </SurfaceCard>

        <div v-if="detail.status === 'draft'" class="modal-actions">
          <button class="button button--brand" type="button" :disabled="submitting" @click="approveFromDetail">Aprobar acta</button>
        </div>
      </div>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AcademicYearDto, CommitteeDetailDto, CommitteeDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'

type TableRow = { id: string } & Record<string, unknown>

const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isCreateOpen = ref(false)
const isDetailOpen = ref(false)
const submitting = ref(false)
const feedback = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const detail = ref<CommitteeDetailDto | null>(null)

const columns = [
  { key: 'title', label: 'Título' },
  { key: 'committeeType', label: 'Tipo' },
  { key: 'meetingDate', label: 'Fecha' },
  { key: 'meetingNumber', label: 'Acta N°' },
  { key: 'academicYearName', label: 'Año lectivo' },
  { key: 'status', label: 'Estado' },
]

const form = reactive({
  academicYearId: '',
  committeeType: 'evaluation',
  meetingDate: '',
  title: '',
  objective: '',
  callTo: '',
  attendees: [] as { fullName: string; role: string }[],
})

const detailTitle = computed(() => {
  if (!detail.value) return ''
  return `${detail.value.title} — Acta N° ${detail.value.meetingNumber}`
})

const badgeClass = (value: string) => {
  if (value === 'approved') return 'meta-badge--green'
  return 'meta-badge--amber'
}

const loadYears = async () => {
  const response = await api.getAcademicYears({ page: 1, pageSize: 100 })
  academicYears.value = response.data.items
  if (!form.academicYearId && academicYears.value[0]) {
    form.academicYearId = academicYears.value[0].id
  }
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getCommittees({ page, pageSize, query })
  return response.data as { items: TableRow[]; total: number; page: number; pageSize: number }
}

const addAttendee = () => {
  form.attendees.push({ fullName: '', role: '' })
}

const removeAttendee = (index: number) => {
  form.attendees.splice(index, 1)
}

const openCreate = async () => {
  feedback.value = ''
  submitting.value = false
  try {
    await loadYears()
  } catch {
    // years may not load if API is unavailable; modal still opens
  }
  form.academicYearId = academicYears.value[0]?.id ?? ''
  form.committeeType = 'evaluation'
  form.meetingDate = new Date().toISOString().split('T')[0]
  form.title = ''
  form.objective = ''
  form.callTo = ''
  form.attendees = []
  isCreateOpen.value = true
}

const closeCreate = () => {
  isCreateOpen.value = false
}

const submitCreate = async () => {
  submitting.value = true
  try {
    await api.createCommittee({ ...form })
    closeCreate()
    await listViewRef.value?.reload()
    feedback.value = 'Comité creado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible crear el comité.'
  } finally {
    submitting.value = false
  }
}

const viewDetail = async (row: Record<string, unknown>) => {
  feedback.value = ''
  try {
    const response = await api.getCommittee(String(row.id))
    detail.value = response.data
    isDetailOpen.value = true
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible cargar el detalle.'
  }
}

const closeDetail = () => {
  isDetailOpen.value = false
  detail.value = null
}

const approveCommittee = async (row: Record<string, unknown>) => {
  if (!confirm('Vas a aprobar esta acta de comité. Una vez aprobada no podrá modificarse. ¿Deseas continuar?')) return
  try {
    await api.updateCommittee(String(row.id), { status: 'approved' })
    await listViewRef.value?.reload()
    feedback.value = 'Comité aprobado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible aprobar el comité.'
  }
}

const approveFromDetail = async () => {
  if (!detail.value) return
  if (!confirm('Vas a aprobar esta acta de comité. Una vez aprobada no podrá modificarse. ¿Deseas continuar?')) return
  submitting.value = true
  try {
    await api.updateCommittee(detail.value.id, { status: 'approved' })
    detail.value.status = 'approved'
    await listViewRef.value?.reload()
    feedback.value = 'Comité aprobado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible aprobar el comité.'
  } finally {
    submitting.value = false
  }
}

const openDelete = async (row: Record<string, unknown>) => {
  if (!confirm('¿Eliminar este comité? Esta acción no puede deshacerse.')) return
  try {
    await api.deleteCommittee(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Comité eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el comité.'
  }
}

onMounted(loadYears)
</script>

<style scoped>
.detail-stack {
  display: grid;
  gap: 1rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem 1rem;
}

.detail-grid dt {
  color: var(--text-soft);
  font-size: 0.85rem;
}

.text-pre {
  white-space: pre-wrap;
}

.form-fieldset {
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: grid;
  gap: 0.5rem;
}

.form-fieldset legend {
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0 0.25rem;
}

.form-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.form-row input {
  flex: 1;
}
</style>
