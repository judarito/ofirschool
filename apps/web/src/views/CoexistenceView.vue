<template>
  <section class="stack">
    <PageHeader eyebrow="Convivencia" title="Convivencia escolar" subtitle="Gestiona casos de convivencia clasificados por Tipo I, II y III con ruta de atención y seguimiento.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo caso</button>
      </template>
    </PageHeader>

    <ListView
      ref="listViewRef"
      title="Casos de convivencia"
      subtitle="Registro de situaciones clasificadas según el manual de convivencia."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar por estudiante o categoría"
      @create="openCreate"
      @edit="viewDetail"
    >
      <template #cell-classification="{ value }">
        <span :class="['meta-badge', classificationBadge(String(value))]">{{ classificationLabel(String(value)) }}</span>
      </template>
      <template #cell-priority="{ value }">
        <span :class="['meta-badge', priorityBadge(String(value))]">{{ priorityLabel(String(value)) }}</span>
      </template>
      <template #cell-status="{ value }">
        <span :class="['meta-badge', statusBadge(String(value))]">{{ statusLabel(String(value)) }}</span>
      </template>
      <template #cell-isConfidential="{ value }">
        {{ value ? 'Sí' : 'No' }}
      </template>
      <template #row-actions="{ row }">
        <button class="table-action" type="button" @click="viewDetail(row)">Ver</button>
      </template>
    </ListView>

    <FormModal :open="isCreateOpen" title="Nuevo caso de convivencia" @close="closeCreate">
      <form class="form-grid" @submit.prevent="submitCreate">
        <label>
          Año lectivo
          <select v-model="form.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Estudiante
          <select v-model="form.studentId" required>
            <option value="">Seleccione</option>
            <option v-for="s in students" :key="s.id" :value="s.id">{{ s.firstName }} {{ s.lastName }}</option>
          </select>
        </label>
        <label>
          Clasificación
          <select v-model="form.classification" required>
            <option value="tipo_i">Tipo I</option>
            <option value="tipo_ii">Tipo II</option>
            <option value="tipo_iii">Tipo III</option>
          </select>
        </label>
        <label>
          Prioridad
          <select v-model="form.priority">
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </label>
        <label>Categoría<input v-model="form.category" required placeholder="Ej: Agresión verbal, Acoso escolar" /></label>
        <label>Fecha del incidente<input v-model="form.incidentDate" type="date" required /></label>
        <label>Descripción<textarea v-model="form.description" required rows="4" placeholder="Describe la situación detalladamente" /></label>
        <label>Evidencia<textarea v-model="form.evidence" rows="3" placeholder="URLs, descripción de documentos, testigos" /></label>
        <label>Acciones inmediatas<textarea v-model="form.immediateActions" rows="3" placeholder="Medidas tomadas en el momento" /></label>
        <label>
          Nombre del reporta
          <input v-model="form.reporterName" placeholder="Quién reporta el caso" />
        </label>
        <label>
          Confidencial
          <select v-model="form.isConfidential">
            <option :value="false">No</option>
            <option :value="true">Sí</option>
          </select>
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeCreate">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="submitting">Guardar</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="isDetailOpen" :title="detailTitle" @close="closeDetail">
      <div v-if="detail" class="detail-stack">
        <SurfaceCard>
          <div class="card-headline"><h3>Información del caso</h3></div>
          <dl class="detail-grid">
            <dt>Clasificación</dt>
            <dd><span :class="['meta-badge', classificationBadge(detail.classification)]">{{ classificationLabel(detail.classification) }}</span></dd>
            <dt>Categoría</dt>
            <dd>{{ detail.category }}</dd>
            <dt>Estado</dt>
            <dd><span :class="['meta-badge', statusBadge(detail.status)]">{{ statusLabel(detail.status) }}</span></dd>
            <dt>Prioridad</dt>
            <dd><span :class="['meta-badge', priorityBadge(detail.priority)]">{{ priorityLabel(detail.priority) }}</span></dd>
            <dt>Fecha del incidente</dt>
            <dd>{{ detail.incidentDate }}</dd>
            <dt>Reportado por</dt>
            <dd>{{ detail.reporterName ?? '—' }}</dd>
            <dt>Confidencial</dt>
            <dd>{{ detail.isConfidential ? 'Sí' : 'No' }}</dd>
          </dl>
        </SurfaceCard>

        <SurfaceCard>
          <div class="card-headline"><h3>Descripción</h3></div>
          <p class="text-pre">{{ detail.description }}</p>
        </SurfaceCard>

        <SurfaceCard v-if="detail.evidence || detail.immediateActions">
          <div class="card-headline"><h3>Evidencia y acciones</h3></div>
          <dl class="detail-grid">
            <dt v-if="detail.evidence">Evidencia</dt>
            <dd v-if="detail.evidence" class="text-pre">{{ detail.evidence }}</dd>
            <dt v-if="detail.immediateActions">Acciones inmediatas</dt>
            <dd v-if="detail.immediateActions" class="text-pre">{{ detail.immediateActions }}</dd>
          </dl>
        </SurfaceCard>

        <SurfaceCard>
          <div class="card-headline">
            <h3>Intervenciones ({{ detail.interventions.length }})</h3>
            <button v-if="detail.status !== 'closed'" class="chip-button" type="button" @click="openAddIntervention">+ Agregar</button>
          </div>
          <table v-if="detail.interventions.length" class="list-view__table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Realizado por</th>
                <th>Resultado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in detail.interventions" :key="i.id">
                <td>{{ i.interventionType }}</td>
                <td>{{ i.interventionDate }}</td>
                <td>{{ i.performedByName ?? '—' }}</td>
                <td>{{ i.outcome ?? '—' }}</td>
                <td><span :class="['meta-badge', i.status === 'completed' ? 'meta-badge--green' : 'meta-badge--amber']">{{ i.status === 'completed' ? 'Completada' : i.status === 'pending' ? 'Pendiente' : 'Seguimiento' }}</span></td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty-state">Sin intervenciones registradas.</p>
        </SurfaceCard>

        <div v-if="detail.status !== 'closed'" class="modal-actions">
          <button class="button button--ghost" type="button" @click="changeStatus('in_progress')" :disabled="detail.status === 'in_progress'">En progreso</button>
          <button class="button button--brand" type="button" @click="changeStatus('resolved')" :disabled="detail.status === 'resolved'">Resolver</button>
          <button class="button button--ghost" type="button" @click="changeStatus('closed')" :disabled="detail.status === 'closed'">Cerrar</button>
        </div>
      </div>
    </FormModal>

    <FormModal :open="isInterventionOpen" title="Registrar intervención" @close="closeAddIntervention">
      <form class="form-grid" @submit.prevent="submitIntervention">
        <label>Tipo de intervención<input v-model="interventionForm.interventionType" required placeholder="Ej: Citación a acudientes" /></label>
        <label>Descripción<textarea v-model="interventionForm.description" required rows="3" /></label>
        <label>Realizado por<input v-model="interventionForm.performedByName" placeholder="Nombre de quien realizó" /></label>
        <label>Fecha de intervención<input v-model="interventionForm.interventionDate" type="date" required /></label>
        <label>Fecha de seguimiento<input v-model="interventionForm.followUpDate" type="date" /></label>
        <label>Resultado<textarea v-model="interventionForm.outcome" rows="2" /></label>
        <label>
          Estado
          <select v-model="interventionForm.status">
            <option value="completed">Completada</option>
            <option value="pending">Pendiente</option>
            <option value="follow_up">Seguimiento</option>
          </select>
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeAddIntervention">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="submitting">Guardar</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AcademicYearDto, CoexistenceCaseDetailDto, StudentDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'

type TableRow = { id: string } & Record<string, unknown>

const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isCreateOpen = ref(false)
const isDetailOpen = ref(false)
const isInterventionOpen = ref(false)
const submitting = ref(false)
const feedback = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const students = ref<StudentDto[]>([])
const detail = ref<CoexistenceCaseDetailDto | null>(null)

const columns = [
  { key: 'studentName', label: 'Estudiante' },
  { key: 'classification', label: 'Tipo' },
  { key: 'category', label: 'Categoría' },
  { key: 'status', label: 'Estado' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'incidentDate', label: 'Fecha' },
  { key: 'isConfidential', label: 'Confidencial' },
]

const form = reactive({
  academicYearId: '',
  studentId: '',
  classification: 'tipo_i',
  priority: 'medium',
  category: '',
  incidentDate: new Date().toISOString().split('T')[0],
  description: '',
  evidence: '',
  immediateActions: '',
  reporterName: '',
  isConfidential: false,
})

const interventionForm = reactive({
  interventionType: '',
  description: '',
  performedByName: '',
  interventionDate: new Date().toISOString().split('T')[0],
  followUpDate: '',
  outcome: '',
  status: 'completed',
})

const detailTitle = computed(() => {
  if (!detail.value) return ''
  return `Caso #${detail.value.id.slice(0, 8)} — ${detail.value.category}`
})

const classificationLabel = (value: string) => {
  if (value === 'tipo_i') return 'Tipo I'
  if (value === 'tipo_ii') return 'Tipo II'
  if (value === 'tipo_iii') return 'Tipo III'
  return value
}

const classificationBadge = (value: string) => {
  if (value === 'tipo_iii') return 'meta-badge--red'
  if (value === 'tipo_ii') return 'meta-badge--amber'
  return 'meta-badge--green'
}

const statusLabel = (value: string) => {
  if (value === 'open') return 'Abierto'
  if (value === 'in_progress') return 'En progreso'
  if (value === 'resolved') return 'Resuelto'
  if (value === 'closed') return 'Cerrado'
  return value
}

const statusBadge = (value: string) => {
  if (value === 'closed') return 'meta-badge--red'
  if (value === 'resolved') return 'meta-badge--green'
  if (value === 'in_progress') return 'meta-badge--amber'
  return 'meta-badge--blue'
}

const priorityLabel = (value: string) => {
  if (value === 'critical') return 'Crítica'
  if (value === 'high') return 'Alta'
  if (value === 'medium') return 'Media'
  return 'Baja'
}

const priorityBadge = (value: string) => {
  if (value === 'critical') return 'meta-badge--red'
  if (value === 'high') return 'meta-badge--amber'
  return 'meta-badge--green'
}

const loadYears = async () => {
  const response = await api.getAcademicYears({ page: 1, pageSize: 100 })
  academicYears.value = response.data.items
  if (!form.academicYearId && academicYears.value[0]) {
    form.academicYearId = academicYears.value[0].id
  }
}

const loadStudents = async () => {
  const response = await api.getStudents({ page: 1, pageSize: 500 })
  students.value = response.data.items
}

const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getCoexistenceCases({ page, pageSize, query })
  return response.data as { items: TableRow[]; total: number; page: number; pageSize: number }
}

const openCreate = async () => {
  feedback.value = ''
  submitting.value = false
  try {
    await loadYears()
  } catch {
    // years may not load if API is unavailable; modal still opens
  }
  try {
    await loadStudents()
  } catch {
    // students may not load if API is unavailable; modal still opens
  }
  form.academicYearId = academicYears.value[0]?.id ?? ''
  form.studentId = ''
  form.classification = 'tipo_i'
  form.priority = 'medium'
  form.category = ''
  form.incidentDate = new Date().toISOString().split('T')[0]
  form.description = ''
  form.evidence = ''
  form.immediateActions = ''
  form.reporterName = ''
  form.isConfidential = false
  isCreateOpen.value = true
}

const closeCreate = () => {
  isCreateOpen.value = false
}

const submitCreate = async () => {
  submitting.value = true
  try {
    await api.createCoexistenceCase({ ...form })
    closeCreate()
    await listViewRef.value?.reload()
    feedback.value = 'Caso de convivencia creado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible crear el caso.'
  } finally {
    submitting.value = false
  }
}

const viewDetail = async (row: Record<string, unknown>) => {
  feedback.value = ''
  try {
    const response = await api.getCoexistenceCase(String(row.id))
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

const changeStatus = async (status: string) => {
  if (!detail.value) return
  if (!confirm(`¿Cambiar estado a "${statusLabel(status)}"?`)) return
  try {
    await api.updateCoexistenceCase(detail.value.id, { status })
    detail.value.status = status
    await listViewRef.value?.reload()
    feedback.value = `Estado actualizado a "${statusLabel(status)}".`
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible actualizar el estado.'
  }
}

const openAddIntervention = () => {
  interventionForm.interventionType = ''
  interventionForm.description = ''
  interventionForm.performedByName = ''
  interventionForm.interventionDate = new Date().toISOString().split('T')[0]
  interventionForm.followUpDate = ''
  interventionForm.outcome = ''
  interventionForm.status = 'completed'
  isInterventionOpen.value = true
}

const closeAddIntervention = () => {
  isInterventionOpen.value = false
}

const submitIntervention = async () => {
  if (!detail.value) return
  submitting.value = true
  try {
    await api.createCoexistenceIntervention(detail.value.id, { ...interventionForm })
    closeAddIntervention()
    const response = await api.getCoexistenceCase(detail.value.id)
    detail.value = response.data
    feedback.value = 'Intervención registrada.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible registrar la intervención.'
  } finally {
    submitting.value = false
  }
}

const openDelete = async (row: Record<string, unknown>) => {
  if (!confirm('¿Eliminar este caso de convivencia? Esta acción no puede deshacerse.')) return
  try {
    await api.deleteCoexistenceCase(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Caso eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el caso.'
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
</style>
