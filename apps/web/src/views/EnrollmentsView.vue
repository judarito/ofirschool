<template>
  <section class="stack module-page module-page--enrollments">
    <PageHeader
      eyebrow="Matrícula académica"
      title="Matrículas"
      subtitle="Organiza la matrícula del año activo, separando claramente creación manual, continuidad y cierre anual."
    >
      <template #actions>
        <label class="page-inline-filter">
          <span>Año lectivo activo</span>
          <input :value="academicContext.activeYearName" disabled />
        </label>
        <button class="button button--ghost" type="button" @click="openAnnualClosure">Cierre anual</button>
        <button class="button button--ghost" type="button" @click="openContinuity">Continuidad</button>
        <button class="button button--brand" type="button" @click="openCreate">Matricular estudiante</button>
      </template>
    </PageHeader>

    <SurfaceCard class="module-inline-summary">
      <div class="module-inline-summary__copy">
        <strong>{{ primaryWorkflow.title }}</strong>
        <p>{{ primaryWorkflow.helper }}</p>
      </div>
      <div class="module-inline-summary__meta">
        <span>{{ primaryWorkflow.value }}</span>
        <small>{{ activeYearName }} · {{ activeYearRange }}</small>
      </div>
      <div class="module-inline-summary__actions">
        <button class="button button--ghost" type="button" @click="setViewMode('overview')">Bandeja</button>
        <button class="button button--ghost" type="button" @click="runPrimaryWorkflowAction">{{ primaryWorkflow.actionLabel }}</button>
      </div>
    </SurfaceCard>

    <ListView
      ref="listViewRef"
      title="Bandeja de matrículas"
      subtitle="Consulta la cohorte actual y aplica filtros rápidos cuando la tarea sea revisar o depurar la matrícula."
      :columns="columns"
      :fetcher="fetchEnrollments"
      search-placeholder="Buscar por identificación o nombre"
      empty-title="Sin matrículas"
      empty-description="No hay matrículas para los filtros seleccionados."
      create-label=""
      :show-actions="false"
      :reload-key="reloadKey"
    >
      <template #toolbar-actions>
        <div class="enrollments-toolbar">
          <div class="enrollments-view-tabs" role="tablist" aria-label="Flujos principales">
            <button
              v-for="tab in workflowTabs"
              :key="tab.value"
              class="chip-button"
              :class="{ 'chip-button--active': viewMode === tab.value }"
              type="button"
              @click="setViewMode(tab.value)"
            >
              {{ tab.label }}
            </button>
          </div>
          <div class="enrollments-toolbar__actions">
            <button class="button button--ghost" type="button" @click="showAdvancedFilters = !showAdvancedFilters">
              {{ showAdvancedFilters ? 'Ocultar filtros' : 'Más filtros' }}
            </button>
            <button class="button button--ghost" type="button" @click="exportEnrollments">Exportar</button>
            <button class="button button--brand" type="button" @click="runPrimaryWorkflowAction">{{ primaryWorkflow.actionLabel }}</button>
          </div>
        </div>
        <div v-if="showAdvancedFilters" class="enrollments-advanced-filters">
          <select v-model="filters.gradeId" class="toolbar-select">
            <option value="">Todos los grados</option>
            <option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
          <select v-model="filters.groupId" class="toolbar-select">
            <option value="">Todos los cursos</option>
            <option v-for="group in filteredEnrollmentGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
          <button class="button button--ghost" type="button" @click="clearAdvancedFilters">Limpiar filtros</button>
        </div>
      </template>

      <template #cell-studentName="{ row }">
        <div class="list-view__primary-cell">
          <strong>{{ row.studentName }}</strong>
          <small>{{ row.studentDocument }}</small>
        </div>
      </template>

      <template #cell-groupName="{ value }">
        {{ value || 'Por asignar' }}
      </template>

      <template #cell-enrollmentType="{ value }">
        {{ originLabel(String(value)) }}
      </template>

      <template #cell-enrollmentDate="{ value }">
        {{ formatDate(String(value)) }}
      </template>

      <template #cell-enrollmentStatus="{ value }">
        <StatusBadge :status="statusLabel(String(value))" />
      </template>
    </ListView>

    <FormModal :open="activeModal === 'create'" title="Crear matrícula" @close="closeModal">
      <form class="form-grid" @submit.prevent="createEnrollment">
        <label>
          Estudiante
          <select v-model="newEnrollment.studentId">
            <option v-for="candidate in enrollmentCandidates" :key="candidate.studentId" :value="candidate.studentId">
              {{ candidate.studentName }} · {{ candidate.studentDocument }}
            </option>
          </select>
        </label>
        <label>
          Año lectivo activo
          <input :value="academicContext.activeYearName" disabled />
        </label>
        <label>
          Grado
          <select v-model="newEnrollment.gradeId">
            <option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>
        <label>
          Grupo
          <select v-model="newEnrollment.groupId">
            <option value="">Por asignar</option>
            <option v-for="group in filteredCourseOptions" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
        </label>
        <label>
          Origen
          <select v-model="newEnrollment.enrollmentType">
            <option value="new">Nuevo ingreso directo</option>
            <option value="renewal">Renovación</option>
            <option value="promotion">Promoción</option>
            <option value="auto_promotion">Promoción automática</option>
            <option value="transfer">Traslado</option>
          </select>
        </label>
        <label>
          Matrícula anterior de referencia
          <select v-model="newEnrollment.previousEnrollmentId" :disabled="!selectedCandidate?.latestEnrollment">
            <option value="">No aplica</option>
            <option
              v-if="selectedCandidate?.latestEnrollment"
              :value="selectedCandidate.latestEnrollment.id"
            >
              {{ selectedCandidate.latestEnrollment.academicYearName }} · {{ selectedCandidate.latestEnrollment.gradeName }} · {{ selectedCandidate.latestEnrollment.groupName || 'Sin grupo' }}
            </option>
          </select>
        </label>
        <label>
          Estado de matrícula
          <select v-model="newEnrollment.enrollmentStatus">
            <option value="draft">Borrador</option>
            <option value="pending">Pendiente</option>
            <option value="active">Activa</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>
        <label>
          Fecha de matrícula
          <input v-model="newEnrollment.enrollmentDate" type="date" required />
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="busy">{{ busy ? 'Guardando...' : 'Guardar matrícula' }}</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'continuity'" title="Continuidad masiva" size="full" presentation="drawer" @close="closeModal">
      <div class="stack">
        <form class="form-grid" @submit.prevent="loadContinuityPreview">
          <label>
            Año lectivo activo
            <input :value="academicContext.activeYearName" disabled />
          </label>
          <label>
            Modo
            <select v-model="continuityForm.mode">
              <option value="promotion">Promoción</option>
              <option value="auto_promotion">Promoción automática</option>
              <option value="renewal">Renovación</option>
            </select>
          </label>
          <label>
            Filtrar por grado anterior
            <select v-model="continuityForm.sourceGradeId">
              <option value="">Todos</option>
              <option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
            </select>
          </label>
          <label>
            Buscar estudiante
            <input v-model="continuityForm.query" placeholder="Nombre o documento" />
          </label>
          <label>
            Estado inicial
            <select v-model="continuityForm.enrollmentStatus">
              <option value="draft">Borrador</option>
              <option value="pending">Pendiente</option>
              <option value="active">Activa</option>
            </select>
          </label>
          <label>
            Fecha matrícula
            <input v-model="continuityForm.enrollmentDate" type="date" required />
          </label>
          <div class="modal-actions">
            <button class="button button--ghost" type="button" @click="closeModal">Cerrar</button>
            <button class="button button--ghost" type="submit" :disabled="busy">Actualizar preview</button>
            <button class="button button--brand" type="button" :disabled="busy || !selectedContinuityIds.length || hasOverbookedContinuitySelection" @click="executeContinuityBatch">
              Ejecutar lote
            </button>
          </div>
        </form>

        <SurfaceCard v-if="continuityPreview" variant="ghost">
          <div class="card-headline">
            <div>
              <h3>{{ continuityTitle }}</h3>
              <p>{{ continuityPreview.sourceAcademicYearName }} hacia {{ continuityPreview.targetAcademicYearName }}</p>
            </div>
          </div>
          <div class="module-note-list">
            <article class="module-note-list__item">
              <span>Total</span>
              <strong>{{ continuityPreview.totalCandidates }}</strong>
            </article>
            <article class="module-note-list__item">
              <span>Elegibles</span>
              <strong>{{ continuityPreview.eligibleCandidates }}</strong>
            </article>
            <article class="module-note-list__item">
              <span>Bloqueados</span>
              <strong>{{ continuityPreview.blockedCandidates }}</strong>
            </article>
          </div>
          <p v-if="hasOverbookedContinuitySelection" class="detail-note">
            Hay grupos seleccionados por encima de sus cupos visibles. Revisa la asignación antes de ejecutar el lote.
          </p>
        </SurfaceCard>

        <div v-if="continuityPreview?.items.length" class="detail-section-list">
          <div class="modal-actions">
            <button class="button button--ghost" type="button" @click="toggleSelectAllContinuity">
              {{ allEligibleSelected ? 'Limpiar selección' : 'Seleccionar elegibles' }}
            </button>
          </div>
          <article
            v-for="item in continuityPreview.items"
            :key="item.previousEnrollmentId"
            class="detail-section-card"
          >
            <div class="field-row field-row--editor">
              <label class="choice-pill">
                <input
                  :checked="selectedContinuityIds.includes(item.studentId)"
                  type="checkbox"
                  :disabled="!item.eligible"
                  @change="toggleContinuitySelection(item.studentId)"
                />
                <span>{{ item.studentName }}</span>
              </label>
              <StatusBadge :status="item.eligible ? 'aprobado' : 'rechazado'" />
            </div>
            <div class="detail-field-grid">
              <div class="detail-field-card">
                <span>Documento</span>
                <strong>{{ item.studentDocument }}</strong>
              </div>
              <div class="detail-field-card">
                <span>Origen</span>
                <strong>{{ item.previousGradeName }} · {{ item.previousGroupName || 'Sin grupo' }}</strong>
              </div>
              <div class="detail-field-card">
                <span>Sugerido</span>
                <strong>{{ item.suggestedGradeName || 'Sin sugerencia' }}</strong>
              </div>
              <div class="detail-field-card">
                <span>Tipo</span>
                <strong>{{ originLabel(item.suggestedEnrollmentType) }}</strong>
              </div>
              <div class="detail-field-card">
                <span>Promedio anual</span>
                <strong>{{ item.academicSummary.annualAverage !== null ? formatNumeric(item.academicSummary.annualAverage) : 'Sin cierre' }}</strong>
              </div>
              <div class="detail-field-card">
                <span>Materias perdidas</span>
                <strong>{{ item.academicSummary.failedSubjects }}</strong>
              </div>
              <div class="detail-field-card">
                <span>Planes pendientes</span>
                <strong>{{ item.academicSummary.pendingSupportStrategies }}</strong>
              </div>
            </div>
            <p v-if="item.academicSummary.failedSubjectNames.length" class="detail-note">
              Materias en riesgo: {{ item.academicSummary.failedSubjectNames.join(', ') }}.
            </p>
            <label v-if="item.eligible && item.suggestedGradeId" class="field-row field-row--stacked">
              <span>Grupo destino</span>
              <select v-model="continuityGroupSelections[item.studentId]">
                <option value="">Por asignar</option>
                <option v-for="group in item.suggestedGroupOptions" :key="group.id" :value="group.id">
                  {{ group.name }} · {{ group.availableSeats }} cupos libres de {{ group.capacity }}
                </option>
              </select>
            </label>
            <p
              v-if="continuityGroupSelections[item.studentId] && overbookedContinuityGroupIds.has(continuityGroupSelections[item.studentId])"
              class="detail-note"
            >
              El grupo destino seleccionado ya no alcanza para todas las matrículas marcadas en este lote.
            </p>
            <p v-if="item.issues.length" class="detail-note">
              {{ item.issues.join('. ') }}
            </p>
          </article>
        </div>

        <SurfaceCard v-else variant="ghost">
          <p>No hay candidatos para esta continuidad con los filtros actuales.</p>
        </SurfaceCard>
      </div>
    </FormModal>

    <FormModal :open="activeModal === 'annual-close'" title="Cierre anual y promoción" size="full" presentation="drawer" @close="closeModal">
      <div class="stack">
        <SurfaceCard v-if="annualPromotionPreview" variant="ghost">
          <div class="card-headline">
            <div>
              <h3>{{ annualPromotionPreview.academicYearName }}</h3>
              <p>Resumen institucional de promoción para la cohorte visible.</p>
            </div>
          </div>
          <div class="module-note-list">
            <article class="module-note-list__item">
              <span>Total cohorte</span>
              <strong>{{ annualPromotionPreview.totalStudents }}</strong>
            </article>
            <article class="module-note-list__item">
              <span>Promovidos</span>
              <strong>{{ annualPromotionPreview.promotedCount }}</strong>
            </article>
            <article class="module-note-list__item">
              <span>Condicionales</span>
              <strong>{{ annualPromotionPreview.conditionalCount }}</strong>
            </article>
            <article class="module-note-list__item">
              <span>No promovidos</span>
              <strong>{{ annualPromotionPreview.notPromotedCount }}</strong>
            </article>
            <article class="module-note-list__item">
              <span>Pendientes</span>
              <strong>{{ annualPromotionPreview.pendingCount }}</strong>
            </article>
          </div>
        </SurfaceCard>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" :disabled="busy" @click="loadAnnualPromotionPreview">Actualizar preview</button>
          <button class="button button--brand" type="button" :disabled="busy || annualDecisionItems.length === 0" @click="applyAnnualPromotionDecisions">
            {{ busy ? 'Aplicando...' : 'Aplicar decisiones' }}
          </button>
        </div>

        <div v-if="annualPromotionPreview?.items.length" class="detail-section-list">
          <article v-for="item in annualPromotionPreview.items" :key="item.enrollmentId" class="detail-section-card">
            <div class="field-row field-row--editor">
              <div>
                <strong>{{ item.studentName }}</strong>
                <p class="detail-note">{{ item.studentDocument }} · {{ item.gradeName }}{{ item.groupName ? ` · ${item.groupName}` : '' }}</p>
              </div>
              <StatusBadge :status="promotionDecisionLabel(item.suggestedPromotionStatus)" />
            </div>
            <div class="detail-field-grid">
              <div class="detail-field-card">
                <span>Promedio anual</span>
                <strong>{{ item.academicSummary.annualAverage !== null ? formatNumeric(item.academicSummary.annualAverage) : 'Sin cierre' }}</strong>
              </div>
              <div class="detail-field-card">
                <span>Materias perdidas</span>
                <strong>{{ item.academicSummary.failedSubjects }}</strong>
              </div>
              <div class="detail-field-card">
                <span>Planes pendientes</span>
                <strong>{{ item.academicSummary.pendingSupportStrategies }}</strong>
              </div>
              <div class="detail-field-card">
                <span>Estado actual</span>
                <strong>{{ promotionDecisionLabel(item.currentPromotionStatus || 'pending') }}</strong>
              </div>
            </div>
            <label class="field-row field-row--stacked">
              <span>Decisión final</span>
              <select v-model="annualDecisionSelections[item.enrollmentId]">
                <option value="promoted">Promovido</option>
                <option value="conditional">Condicional</option>
                <option value="not_promoted">No promovido</option>
                <option value="pending">Pendiente</option>
              </select>
            </label>
            <p v-if="item.academicSummary.failedSubjectNames.length" class="detail-note">
              Materias comprometidas: {{ item.academicSummary.failedSubjectNames.join(', ') }}.
            </p>
            <p v-if="item.issues.length" class="detail-note">
              {{ item.issues.join('. ') }}
            </p>
          </article>
        </div>

        <SurfaceCard v-else variant="ghost">
          <p>No hay estudiantes visibles para construir el cierre anual con los filtros actuales.</p>
        </SurfaceCard>
      </div>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AcademicGradeDto, AnnualPromotionPreviewDto, CourseDto, EnrollmentCandidateDto, EnrollmentContinuityPreviewDto, EnrollmentDto } from '@ofir/shared'
import { api } from '../lib/api'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { useAcademicContextStore } from '../stores/academic-context'

const activeModal = ref<'create' | 'continuity' | 'annual-close' | null>(null)
const busy = ref(false)
const feedback = ref('')
const showAdvancedFilters = ref(false)
const viewMode = ref<'overview' | 'create' | 'continuity' | 'annual-close'>('overview')
const gradeOptions = ref<AcademicGradeDto[]>([])
const courseOptions = ref<CourseDto[]>([])
const enrollmentCandidates = ref<EnrollmentCandidateDto[]>([])
const enrollments = ref<EnrollmentDto[]>([])
const continuityPreview = ref<EnrollmentContinuityPreviewDto | null>(null)
const annualPromotionPreview = ref<AnnualPromotionPreviewDto | null>(null)
const selectedContinuityIds = ref<string[]>([])
const continuityGroupSelections = ref<Record<string, string>>({})
const annualDecisionSelections = ref<Record<string, 'pending' | 'promoted' | 'not_promoted' | 'conditional'>>({})
const listViewRef = ref<InstanceType<typeof ListView> | null>(null)
const academicContext = useAcademicContextStore()
const selectedYear = computed(() => academicContext.selectedYear)
const selectedYearNumber = computed(() => academicContext.selectedYearNumber)
const filters = reactive({
  gradeId: '',
  groupId: '',
})
const columns = [
  { key: 'studentName', label: 'Estudiante' },
  { key: 'academicYearName', label: 'Año lectivo' },
  { key: 'gradeName', label: 'Grado' },
  { key: 'groupName', label: 'Curso' },
  { key: 'enrollmentType', label: 'Origen' },
  { key: 'enrollmentDate', label: 'Fecha matrícula' },
  { key: 'enrollmentStatus', label: 'Estado' },
]

const newEnrollment = reactive({
  studentId: '',
  academicYearId: '',
  gradeId: '',
  groupId: '',
  enrollmentType: 'new',
  enrollmentStatus: 'draft',
  enrollmentDate: new Date().toISOString().slice(0, 10),
  previousEnrollmentId: '',
})
const continuityForm = reactive({
  mode: 'promotion' as 'renewal' | 'promotion' | 'auto_promotion',
  sourceGradeId: '',
  query: '',
  enrollmentStatus: 'pending' as 'draft' | 'pending' | 'active',
  enrollmentDate: new Date().toISOString().slice(0, 10),
})

const activeYear = computed(() => academicContext.activeYear)
const activeYearName = computed(() => academicContext.activeYearName)
const activeYearRange = computed(() => activeYear.value ? `${activeYear.value.startsOn} a ${activeYear.value.endsOn}` : '--')
const activeYearStatus = computed(() => activeYear.value?.status ?? 'planeado')
const reloadKey = computed(() => `${selectedYear.value}-${filters.gradeId}-${filters.groupId}`)
const filteredEnrollmentGroups = computed(() =>
  filters.gradeId
    ? courseOptions.value.filter((course) => course.gradeId === filters.gradeId && course.academicYearId === activeYear.value?.id)
    : courseOptions.value.filter((course) => course.academicYearId === activeYear.value?.id),
)

const filteredCourseOptions = computed(() =>
  courseOptions.value.filter(
    (course) =>
      course.academicYearId === newEnrollment.academicYearId &&
      (!newEnrollment.gradeId || course.gradeId === newEnrollment.gradeId),
  ),
)

const selectedCandidate = computed(
  () => enrollmentCandidates.value.find((candidate) => candidate.studentId === newEnrollment.studentId) ?? null,
)
const continuityPendingCount = computed(() => continuityPreview.value?.eligibleCandidates ?? 0)
const continuityTitle = computed(() => {
  if (continuityForm.mode === 'renewal') return 'Bandeja de renovación'
  if (continuityForm.mode === 'auto_promotion') return 'Bandeja de promoción automática'
  return 'Bandeja de promoción'
})
const allEligibleSelected = computed(() => {
  const eligibleIds = continuityPreview.value?.items.filter((item) => item.eligible).map((item) => item.studentId) ?? []
  return eligibleIds.length > 0 && eligibleIds.every((id) => selectedContinuityIds.value.includes(id))
})
const continuitySeatUsage = computed(() => {
  const usage = new Map<string, number>()
  for (const item of continuityPreview.value?.items ?? []) {
    if (!item.eligible || !selectedContinuityIds.value.includes(item.studentId)) continue
    const groupId = continuityGroupSelections.value[item.studentId]
    if (!groupId) continue
    usage.set(groupId, (usage.get(groupId) ?? 0) + 1)
  }
  return usage
})
const overbookedContinuityGroupIds = computed(() => {
  const blocked = new Set<string>()
  for (const item of continuityPreview.value?.items ?? []) {
    for (const group of item.suggestedGroupOptions) {
      const requested = continuitySeatUsage.value.get(group.id) ?? 0
      if (requested > group.availableSeats) {
        blocked.add(group.id)
      }
    }
  }
  return blocked
})
const hasOverbookedContinuitySelection = computed(() => overbookedContinuityGroupIds.value.size > 0)
const annualDecisionItems = computed(() =>
  annualPromotionPreview.value
    ? annualPromotionPreview.value.items.map((item) => ({
        enrollmentId: item.enrollmentId,
        promotionStatus: annualDecisionSelections.value[item.enrollmentId] ?? item.suggestedPromotionStatus,
      }))
    : [],
)
const workflowTabs = computed(() => [
  { value: 'overview', label: 'Bandeja' },
  { value: 'create', label: 'Matricular' },
  { value: 'continuity', label: 'Continuidad' },
  { value: 'annual-close', label: 'Cierre anual' },
])

watch(
  () => newEnrollment.gradeId,
  () => {
    if (!filteredCourseOptions.value.find((course) => course.id === newEnrollment.groupId)) {
      newEnrollment.groupId = ''
    }
  },
)

const metrics = computed(() => ({
  total: enrollments.value.length,
  active: enrollments.value.filter((item) => item.enrollmentStatus === 'active').length,
  pending: enrollments.value.filter((item) => item.enrollmentStatus === 'pending' || item.enrollmentStatus === 'draft').length,
  withoutGroup: enrollments.value.filter((item) => !item.groupId).length,
  fromAdmissions: enrollments.value.filter((item) => item.enrollmentType === 'new').length,
  renewals: enrollments.value.filter((item) => item.enrollmentType !== 'new').length,
}))

const primaryWorkflow = computed(() => {
  if (continuityPendingCount.value > 0) {
    return {
      title: 'Continuidad pendiente',
      value: `${continuityPendingCount.value} estudiantes`,
      helper: 'Conviene procesar primero la cohorte del año anterior antes de seguir creando matrículas manuales.',
      description: 'El mayor impacto operativo ahora está en pasar la continuidad del año anterior al año activo.',
      actionLabel: 'Abrir continuidad',
      action: 'continuity' as const,
      status: 'revision',
    }
  }
  if (metrics.value.pending > 0) {
    return {
      title: 'Cierre anual y estados',
      value: `${metrics.value.pending} matrículas abiertas`,
      helper: 'Hay matrículas en borrador o pendientes que conviene cerrar o revisar antes de seguir avanzando.',
      description: 'La prioridad actual no es crear más registros sino depurar la cohorte y cerrar pendientes.',
      actionLabel: 'Abrir cierre anual',
      action: 'annual-close' as const,
      status: 'revision',
    }
  }
  return {
    title: 'Matrícula manual',
    value: `${enrollmentCandidates.value.length} candidatos visibles`,
    helper: 'Puedes registrar nuevos ingresos o casos puntuales desde la bandeja manual.',
    description: 'La operación está estable; el siguiente paso útil es matricular estudiantes nuevos o rezagados.',
    actionLabel: 'Crear matrícula',
    action: 'create' as const,
    status: 'aprobado',
  }
})
const originLabel = (value: string) => {
  if (value === 'new') return 'Inscripción aceptada'
  if (value === 'renewal') return 'Renovación'
  if (value === 'promotion') return 'Promoción'
  if (value === 'auto_promotion') return 'Promoción automática'
  if (value === 'transfer') return 'Traslado'
  return value
}

const statusLabel = (value: string) => {
  if (value === 'active') return 'activa'
  if (value === 'pending') return 'pendiente'
  if (value === 'draft') return 'revision'
  if (value === 'cancelled') return 'cancelada'
  return value
}

const formatDate = (value: string) => new Date(value).toLocaleDateString('es-CO')
const formatNumeric = (value: number) => value.toFixed(2)
const promotionDecisionLabel = (value: string) => {
  if (value === 'promoted') return 'promovido'
  if (value === 'conditional') return 'condicional'
  if (value === 'not_promoted') return 'no_promovido'
  return 'pendiente'
}

const resetForm = () => {
  newEnrollment.studentId = enrollmentCandidates.value[0]?.studentId ?? ''
  newEnrollment.academicYearId = academicContext.activeYearId
  newEnrollment.gradeId = gradeOptions.value[0]?.id ?? ''
  newEnrollment.groupId = ''
  newEnrollment.enrollmentType = 'new'
  newEnrollment.enrollmentStatus = 'draft'
  newEnrollment.enrollmentDate = new Date().toISOString().slice(0, 10)
  newEnrollment.previousEnrollmentId = ''
}

const setViewMode = (mode: 'overview' | 'create' | 'continuity' | 'annual-close') => {
  viewMode.value = mode
}

const clearAdvancedFilters = () => {
  filters.gradeId = ''
  filters.groupId = ''
  showAdvancedFilters.value = false
}

const requireSelectedYearNumber = () => {
  if (!selectedYearNumber.value) {
    throw new Error('No se pudo resolver el año lectivo actual.')
  }
  return selectedYearNumber.value
}

const loadCatalogs = async () => {
  const year = requireSelectedYearNumber()
  const [gradesResponse, coursesResponse, candidatesResponse] = await Promise.all([
    api.getAcademicGrades({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
    api.getEnrollmentCandidates({ year, page: 1, pageSize: 100 }),
  ])
  gradeOptions.value = gradesResponse.data.items
  courseOptions.value = coursesResponse.data.items
  enrollmentCandidates.value = candidatesResponse.data.items
}

const loadContinuityPreview = async () => {
  const year = requireSelectedYearNumber()
  continuityPreview.value = null
  selectedContinuityIds.value = []
  continuityGroupSelections.value = {}
  const response = await api.getEnrollmentContinuityPreview({
    year,
    mode: continuityForm.mode,
    sourceGradeId: continuityForm.sourceGradeId,
    query: continuityForm.query,
  })
  continuityPreview.value = response.data
  selectedContinuityIds.value = response.data.items.filter((item) => item.eligible).map((item) => item.studentId)
  continuityGroupSelections.value = Object.fromEntries(
    response.data.items.map((item) => {
      const sameNamedGroup = item.previousGroupName
        ? item.suggestedGroupOptions.find((group) => group.name === item.previousGroupName)
        : null
      return [item.studentId, sameNamedGroup?.id ?? '']
    }),
  )
}

const loadAnnualPromotionPreview = async () => {
  const year = requireSelectedYearNumber()
  const response = await api.getAnnualPromotionPreview({
    year,
    gradeId: filters.gradeId,
    groupId: filters.groupId,
  })
  annualPromotionPreview.value = response.data
  annualDecisionSelections.value = Object.fromEntries(
    response.data.items.map((item) => [item.enrollmentId, item.suggestedPromotionStatus]),
  )
}

const fetchEnrollments = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const year = requireSelectedYearNumber()
  const response = await api.getEnrollments({
    year,
    gradeId: filters.gradeId,
    groupId: filters.groupId,
    query,
    page,
    pageSize,
  })
  enrollments.value = response.data.items
  return {
    ...response.data,
    items: response.data.items as unknown as Array<{ id: string } & Record<string, unknown>>,
  }
}

const reload = async () => {
  busy.value = true
  try {
    await loadCatalogs()
    await loadContinuityPreview()
    if (activeModal.value === 'annual-close') {
      await loadAnnualPromotionPreview()
    }
    await listViewRef.value?.reload()
    resetForm()
  } finally {
    busy.value = false
  }
}

const closeModal = () => {
  activeModal.value = null
}

const openCreate = () => {
  viewMode.value = 'create'
  resetForm()
  activeModal.value = 'create'
}

const openContinuity = async () => {
  viewMode.value = 'continuity'
  activeModal.value = 'continuity'
  busy.value = true
  try {
    await loadContinuityPreview()
  } finally {
    busy.value = false
  }
}

const openAnnualClosure = async () => {
  viewMode.value = 'annual-close'
  activeModal.value = 'annual-close'
  busy.value = true
  try {
    await loadAnnualPromotionPreview()
  } finally {
    busy.value = false
  }
}

const runPrimaryWorkflowAction = () => {
  if (primaryWorkflow.value.action === 'continuity') {
    void openContinuity()
    return
  }
  if (primaryWorkflow.value.action === 'annual-close') {
    void openAnnualClosure()
    return
  }
  openCreate()
}

const createEnrollment = async () => {
  busy.value = true
  try {
    await api.createEnrollment({
      studentId: newEnrollment.studentId,
      academicYearId: newEnrollment.academicYearId,
      gradeId: newEnrollment.gradeId,
      groupId: newEnrollment.groupId || null,
      enrollmentType: newEnrollment.enrollmentType,
      enrollmentStatus: newEnrollment.enrollmentStatus,
      enrollmentDate: newEnrollment.enrollmentDate,
      previousEnrollmentId: newEnrollment.previousEnrollmentId || null,
    })
    await listViewRef.value?.reload()
    feedback.value = 'Matrícula creada correctamente.'
    closeModal()
  } finally {
    busy.value = false
  }
}

const exportEnrollments = () => {
  feedback.value = `Exportación preparada con ${enrollments.value.length} matrículas visibles.`
}

const toggleContinuitySelection = (studentId: string) => {
  selectedContinuityIds.value = selectedContinuityIds.value.includes(studentId)
    ? selectedContinuityIds.value.filter((id) => id !== studentId)
    : [...selectedContinuityIds.value, studentId]
}

const toggleSelectAllContinuity = () => {
  const eligibleIds = continuityPreview.value?.items.filter((item) => item.eligible).map((item) => item.studentId) ?? []
  selectedContinuityIds.value = allEligibleSelected.value ? [] : eligibleIds
}

const executeContinuityBatch = async () => {
  if (!continuityPreview.value) return
  if (hasOverbookedContinuitySelection.value) {
    feedback.value = 'La selección supera los cupos visibles de uno o más grupos. Ajusta las asignaciones antes de ejecutar.'
    return
  }

  const items = continuityPreview.value.items
    .filter((item) => item.eligible && selectedContinuityIds.value.includes(item.studentId) && item.suggestedGradeId)
    .map((item) => ({
      studentId: item.studentId,
      previousEnrollmentId: item.previousEnrollmentId,
      gradeId: item.suggestedGradeId as string,
      groupId: continuityGroupSelections.value[item.studentId] || null,
    }))

  if (!items.length) {
    feedback.value = 'No hay estudiantes elegibles seleccionados para ejecutar la continuidad.'
    return
  }

  busy.value = true
  try {
    const response = await api.createEnrollmentContinuityBatch({
      academicYearId: continuityPreview.value.targetAcademicYearId,
      mode: continuityForm.mode,
      enrollmentStatus: continuityForm.enrollmentStatus,
      enrollmentDate: continuityForm.enrollmentDate,
      items,
    })
    await reload()
    feedback.value = `${response.data.createdCount} matrículas creadas${response.data.skippedCount ? `, ${response.data.skippedCount} omitidas` : ''}.`
    activeModal.value = null
  } finally {
    busy.value = false
  }
}

const applyAnnualPromotionDecisions = async () => {
  if (!annualPromotionPreview.value || !annualDecisionItems.value.length) return
  busy.value = true
  try {
    const response = await api.saveAnnualPromotionDecisions({
      academicYearId: annualPromotionPreview.value.academicYearId,
      items: annualDecisionItems.value,
    })
    await listViewRef.value?.reload()
    await loadAnnualPromotionPreview()
    feedback.value = `${response.data.updatedCount} decisiones de cierre anual aplicadas correctamente.`
  } finally {
    busy.value = false
  }
}

watch(selectedYear, async () => {
  if (filters.groupId && !filteredEnrollmentGroups.value.find((group) => group.id === filters.groupId)) {
    filters.groupId = ''
  }
  await loadCatalogs()
  await loadContinuityPreview()
  if (activeModal.value === 'annual-close') {
    await loadAnnualPromotionPreview()
  }
  resetForm()
})

watch(
  selectedCandidate,
  (candidate) => {
    if (!candidate) {
      newEnrollment.previousEnrollmentId = ''
      newEnrollment.enrollmentType = 'new'
      return
    }

    const latest = candidate.latestEnrollment
    if (!latest) {
      newEnrollment.previousEnrollmentId = ''
      if (newEnrollment.enrollmentType !== 'transfer') {
        newEnrollment.enrollmentType = 'new'
      }
      return
    }

    newEnrollment.previousEnrollmentId = latest.id
    if (newEnrollment.enrollmentType === 'new' || !newEnrollment.enrollmentType) {
      newEnrollment.enrollmentType = candidate.recommendedEnrollmentType
    }
    if (!newEnrollment.gradeId) {
      newEnrollment.gradeId = latest.gradeId
    }
  },
  { immediate: true },
)

watch(
  () => newEnrollment.enrollmentType,
  (value) => {
    if (value === 'new') {
      newEnrollment.previousEnrollmentId = ''
      return
    }

    if (selectedCandidate.value?.latestEnrollment) {
      newEnrollment.previousEnrollmentId = selectedCandidate.value.latestEnrollment.id
    }
  },
)

watch(
  () => filters.gradeId,
  () => {
    if (!filteredEnrollmentGroups.value.find((group) => group.id === filters.groupId)) {
      filters.groupId = ''
    }
  },
)

onMounted(async () => {
  if (!academicContext.academicYears.length) {
    await academicContext.loadAcademicYears()
  }
  await reload()
})
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

.enrollments-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  width: 100%;
}

.enrollments-toolbar__actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.enrollments-view-tabs {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.enrollments-view-tabs .chip-button--active {
  background: var(--brand-primary-soft);
  border-color: color-mix(in srgb, var(--brand-primary) 28%, var(--border));
  color: var(--brand-primary);
}

.enrollments-advanced-filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  width: 100%;
  padding-top: 0.25rem;
}

.enrollments-advanced-filters > * {
  min-width: 180px;
  flex: 1 1 180px;
}

@media (max-width: 900px) {
  .module-inline-summary,
  .enrollments-toolbar,
  .enrollments-toolbar__actions,
  .enrollments-advanced-filters {
    display: grid;
  }

  .module-inline-summary__meta {
    justify-items: start;
    text-align: left;
  }
}
</style>
