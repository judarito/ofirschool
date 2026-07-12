<template>
  <section class="stack">
    <PageHeader eyebrow="Inclusión" title="PIAR / Inclusión" subtitle="Plan Individual de Ajustes Razonables. Gestión de barreras, ajustes y seguimiento para estudiantes con necesidades específicas.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreate">Nuevo registro</button>
      </template>
    </PageHeader>

    <SurfaceCard class="confidentiality-notice">
      <div class="card-headline">
        <span class="confidentiality-badge">Confidencial</span>
        <div>
          <h3>Protección de datos sensibles</h3>
          <p>La información de diagnóstico, salud y discapacidad está protegida por la Ley 1581 de 2012. Solo personal autorizado puede acceder a estos registros.</p>
        </div>
      </div>
    </SurfaceCard>

    <ListView
      ref="listViewRef"
      title="Registros PIAR"
      subtitle="Estudiantes con ajustes razonables registrados en el año lectivo."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar por estudiante"
      create-label="Nuevo registro"
      @create="openCreate"
      @edit="viewDetail"
    >
      <template #cell-status="{ value }">
        <span :class="['meta-badge', statusBadge(String(value))]">{{ statusLabel(String(value)) }}</span>
      </template>
      <template #cell-hasPIAR="{ value }">
        {{ value ? 'Sí' : 'No' }}
      </template>
      <template #row-actions="{ row }">
        <button class="table-action" type="button" @click="viewDetail(row)">Ver</button>
      </template>
    </ListView>

    <FormModal :open="isCreateOpen" title="Nuevo registro PIAR" @close="closeCreate">
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
        <label>Tipo de discapacidad<input v-model="form.disabilityType" placeholder="Ej: Cognitiva, Motora, Sensorial" /></label>
        <label>Categoría<input v-model="form.disabilityCategory" placeholder="Ej: Leve, moderada, severa" /></label>
        <label>
          Tiene PIAR
          <select v-model="form.hasPIAR">
            <option :value="true">Sí</option>
            <option :value="false">No</option>
          </select>
        </label>
        <label>Fecha de aprobación<input v-model="form.approvalDate" type="date" /></label>
        <label>Información diagnóstica<textarea v-model="form.diagnosticInfo" rows="3" placeholder="Diagnóstico profesional" /></label>
        <label>Condiciones de salud<textarea v-model="form.healthConditions" rows="3" placeholder="Condiciones médicas relevantes" /></label>
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
            <h3>Información del estudiante</h3>
            <span class="confidentiality-badge">Confidencial</span>
          </div>
          <dl class="detail-grid">
            <dt>Estado</dt>
            <dd><span :class="['meta-badge', statusBadge(detail.record.status)]">{{ statusLabel(detail.record.status) }}</span></dd>
            <dt>Tiene PIAR</dt>
            <dd>{{ detail.record.hasPIAR ? 'Sí' : 'No' }}</dd>
            <dt v-if="detail.record.disabilityType">Tipo de discapacidad</dt>
            <dd v-if="detail.record.disabilityType">{{ detail.record.disabilityType }}</dd>
            <dt v-if="detail.record.disabilityCategory">Categoría</dt>
            <dd v-if="detail.record.disabilityCategory">{{ detail.record.disabilityCategory }}</dd>
            <dt v-if="detail.record.approvalDate">Fecha de aprobación</dt>
            <dd v-if="detail.record.approvalDate">{{ detail.record.approvalDate }}</dd>
          </dl>
        </SurfaceCard>

        <SurfaceCard v-if="detail.record.diagnosticInfo || detail.record.healthConditions">
          <div class="card-headline">
            <h3>Información clínica</h3>
            <span class="confidentiality-badge">Confidencial</span>
          </div>
          <dl class="detail-grid">
            <dt v-if="detail.record.diagnosticInfo">Diagnóstico</dt>
            <dd v-if="detail.record.diagnosticInfo" class="text-pre">{{ detail.record.diagnosticInfo }}</dd>
            <dt v-if="detail.record.healthConditions">Condiciones de salud</dt>
            <dd v-if="detail.record.healthConditions" class="text-pre">{{ detail.record.healthConditions }}</dd>
          </dl>
        </SurfaceCard>

        <SurfaceCard>
          <div class="card-headline">
            <h3>Ajustes razonables ({{ detail.adjustments.length }})</h3>
            <button class="chip-button" type="button" @click="openAddAdjustment">+ Agregar</button>
          </div>
          <table v-if="detail.adjustments.length" class="list-view__table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Materia</th>
                <th>Descripción</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in detail.adjustments" :key="a.id">
                <td>{{ a.adjustmentType }}</td>
                <td>{{ a.subjectName ?? '—' }}</td>
                <td>{{ a.description }}</td>
                <td><span :class="['meta-badge', a.status === 'active' ? 'meta-badge--green' : 'meta-badge--amber']">{{ a.status === 'active' ? 'Activo' : 'Inactivo' }}</span></td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty-state">Sin ajustes registrados.</p>
        </SurfaceCard>

        <SurfaceCard>
          <div class="card-headline">
            <h3>Seguimientos ({{ detail.followUps.length }})</h3>
            <button class="chip-button" type="button" @click="openAddFollowUp">+ Agregar</button>
          </div>
          <table v-if="detail.followUps.length" class="list-view__table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Progreso</th>
                <th>Estado ajustes</th>
                <th>Realizado por</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in detail.followUps" :key="f.id">
                <td>{{ f.followUpDate }}</td>
                <td>{{ f.progress }}</td>
                <td><span :class="['meta-badge', adjustmentsStatusBadge(f.adjustmentsStatus)]">{{ adjustmentsStatusLabel(f.adjustmentsStatus) }}</span></td>
                <td>{{ f.performedByName ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty-state">Sin seguimientos registrados.</p>
        </SurfaceCard>
      </div>
    </FormModal>

    <FormModal :open="isAdjustmentOpen" title="Agregar ajuste razonable" @close="closeAddAdjustment">
      <form class="form-grid" @submit.prevent="submitAdjustment">
        <label>Tipo de ajuste<input v-model="adjustmentForm.adjustmentType" required placeholder="Ej: Evaluación diferenciada" /></label>
        <label>Descripción<textarea v-model="adjustmentForm.description" required rows="3" /></label>
        <label>Responsable<input v-model="adjustmentForm.responsibleName" placeholder="Nombre del responsable" /></label>
        <label>Fecha inicio<input v-model="adjustmentForm.startDate" type="date" /></label>
        <label>Fecha fin<input v-model="adjustmentForm.endDate" type="date" /></label>
        <label>Criterios de evaluación<textarea v-model="adjustmentForm.evaluationCriteria" rows="2" placeholder="Cómo se evaluará" /></label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeAddAdjustment">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="submitting">Guardar</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="isFollowUpOpen" title="Registrar seguimiento" @close="closeAddFollowUp">
      <form class="form-grid" @submit.prevent="submitFollowUp">
        <label>Fecha de seguimiento<input v-model="followUpForm.followUpDate" type="date" required /></label>
        <label>Progreso<textarea v-model="followUpForm.progress" required rows="3" placeholder="Describa el progreso del estudiante" /></label>
        <label>Dificultades<textarea v-model="followUpForm.difficulties" rows="2" placeholder="Dificultades encontradas" /></label>
        <label>
          Estado de ajustes
          <select v-model="followUpForm.adjustmentsStatus">
            <option value="ongoing">En progreso</option>
            <option value="effective">Efectivos</option>
            <option value="ineffective">Inefectivos</option>
            <option value="modified">Modificados</option>
          </select>
        </label>
        <label>Recomendaciones<textarea v-model="followUpForm.recommendations" rows="2" /></label>
        <label>Realizado por<input v-model="followUpForm.performedByName" placeholder="Nombre de quien realiza" /></label>
        <label>Acuerdos con familia<textarea v-model="followUpForm.agreementsWithFamily" rows="2" placeholder="Compromisos con la familia" /></label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeAddFollowUp">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="submitting">Guardar</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AcademicYearDto, PiarRecordDetailDto, StudentDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'

type TableRow = { id: string } & Record<string, unknown>

const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isCreateOpen = ref(false)
const isDetailOpen = ref(false)
const isAdjustmentOpen = ref(false)
const isFollowUpOpen = ref(false)
const submitting = ref(false)
const feedback = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const students = ref<StudentDto[]>([])
const detail = ref<PiarRecordDetailDto | null>(null)

const columns = [
  { key: 'studentFirstName', label: 'Estudiante' },
  { key: 'disabilityType', label: 'Tipo discapacidad' },
  { key: 'hasPIAR', label: 'PIAR' },
  { key: 'status', label: 'Estado' },
  { key: 'academicYearName', label: 'Año lectivo' },
]

const form = reactive({
  academicYearId: '',
  studentId: '',
  disabilityType: '',
  disabilityCategory: '',
  hasPIAR: true,
  approvalDate: '',
  diagnosticInfo: '',
  healthConditions: '',
})

const adjustmentForm = reactive({
  adjustmentType: '',
  description: '',
  responsibleName: '',
  startDate: '',
  endDate: '',
  evaluationCriteria: '',
})

const followUpForm = reactive({
  followUpDate: new Date().toISOString().split('T')[0],
  progress: '',
  difficulties: '',
  adjustmentsStatus: 'ongoing',
  recommendations: '',
  performedByName: '',
  agreementsWithFamily: '',
})

const detailTitle = computed(() => {
  if (!detail.value) return ''
  return `${detail.value.record.studentFirstName} ${detail.value.record.studentLastName} — PIAR`
})

const statusLabel = (value: string) => {
  if (value === 'active') return 'Activo'
  if (value === 'inactive') return 'Inactivo'
  if (value === 'completed') return 'Completado'
  return value
}

const statusBadge = (value: string) => {
  if (value === 'active') return 'meta-badge--green'
  if (value === 'completed') return 'meta-badge--blue'
  return 'meta-badge--amber'
}

const adjustmentsStatusLabel = (value: string) => {
  if (value === 'ongoing') return 'En progreso'
  if (value === 'effective') return 'Efectivos'
  if (value === 'ineffective') return 'Inefectivos'
  if (value === 'modified') return 'Modificados'
  return value
}

const adjustmentsStatusBadge = (value: string) => {
  if (value === 'effective') return 'meta-badge--green'
  if (value === 'ineffective') return 'meta-badge--red'
  if (value === 'modified') return 'meta-badge--amber'
  return 'meta-badge--blue'
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

const fetchRows = async () => {
  const response = await api.getPiarRecords()
  return { items: response.data.items as unknown as TableRow[], total: response.data.items.length, page: 1, pageSize: 100 }
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
  form.disabilityType = ''
  form.disabilityCategory = ''
  form.hasPIAR = true
  form.approvalDate = ''
  form.diagnosticInfo = ''
  form.healthConditions = ''
  isCreateOpen.value = true
}

const closeCreate = () => {
  isCreateOpen.value = false
}

const submitCreate = async () => {
  submitting.value = true
  try {
    await api.createPiarRecord({ ...form })
    closeCreate()
    await listViewRef.value?.reload()
    feedback.value = 'Registro PIAR creado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible crear el registro.'
  } finally {
    submitting.value = false
  }
}

const viewDetail = async (row: Record<string, unknown>) => {
  feedback.value = ''
  try {
    const response = await api.getPiarRecord(String(row.id))
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

const openAddAdjustment = () => {
  adjustmentForm.adjustmentType = ''
  adjustmentForm.description = ''
  adjustmentForm.responsibleName = ''
  adjustmentForm.startDate = ''
  adjustmentForm.endDate = ''
  adjustmentForm.evaluationCriteria = ''
  isAdjustmentOpen.value = true
}

const closeAddAdjustment = () => {
  isAdjustmentOpen.value = false
}

const submitAdjustment = async () => {
  if (!detail.value) return
  submitting.value = true
  try {
    await api.createPiarAdjustment(detail.value.record.id, { ...adjustmentForm })
    closeAddAdjustment()
    const response = await api.getPiarRecord(detail.value.record.id)
    detail.value = response.data
    feedback.value = 'Ajuste registrado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible registrar el ajuste.'
  } finally {
    submitting.value = false
  }
}

const openAddFollowUp = () => {
  followUpForm.followUpDate = new Date().toISOString().split('T')[0]
  followUpForm.progress = ''
  followUpForm.difficulties = ''
  followUpForm.adjustmentsStatus = 'ongoing'
  followUpForm.recommendations = ''
  followUpForm.performedByName = ''
  followUpForm.agreementsWithFamily = ''
  isFollowUpOpen.value = true
}

const closeAddFollowUp = () => {
  isFollowUpOpen.value = false
}

const submitFollowUp = async () => {
  if (!detail.value) return
  submitting.value = true
  try {
    await api.createPiarFollowUp(detail.value.record.id, { ...followUpForm })
    closeAddFollowUp()
    const response = await api.getPiarRecord(detail.value.record.id)
    detail.value = response.data
    feedback.value = 'Seguimiento registrado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible registrar el seguimiento.'
  } finally {
    submitting.value = false
  }
}

onMounted(loadYears)
</script>

<style scoped>
.confidentiality-notice {
  border-left: 4px solid var(--brand, #0f766e);
}

.confidentiality-badge {
  background: color-mix(in srgb, var(--brand, #0f766e) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--brand, #0f766e) 30%, transparent);
  color: var(--brand, #0f766e);
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

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
