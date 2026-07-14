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
        <button class="button button--ghost" type="button" @click="runPrimaryWorkflowAction">{{ primaryWorkflow.actionLabel }}</button>
      </div>
    </SurfaceCard>

    <section class="enrollment-action-grid" aria-label="Acciones principales de matrícula">
      <button
        v-for="action in workflowActions"
        :key="action.key"
        class="enrollment-action-card"
        type="button"
        @click="action.run"
      >
        <span class="enrollment-action-card__eyebrow">{{ action.eyebrow }}</span>
        <strong>{{ action.title }}</strong>
        <small>{{ action.description }}</small>
      </button>
    </section>

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
          <div class="enrollments-toolbar__context">
            <strong>Bandeja de consulta</strong>
            <small>{{ enrollments.length }} matrículas visibles con los filtros actuales.</small>
          </div>
          <div class="enrollments-toolbar__actions">
            <button class="button button--ghost" type="button" @click="showAdvancedFilters = !showAdvancedFilters">
              {{ showAdvancedFilters ? 'Ocultar filtros' : 'Más filtros' }}
            </button>
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

    <FormModal :open="activeModal === 'create'" title="Crear matrícula" size="full" @close="closeModal">
      <form class="form-grid" @submit.prevent="createEnrollment">
        <div class="form-grid__wide">
          <label>
            Estudiante
            <PaginatedCombobox
              v-model="newEnrollment.studentId"
              v-model:search="candidateSearch"
              :selected-label="selectedCandidateLabel"
              placeholder="Selecciona un estudiante"
              search-placeholder="Buscar por nombre o identificación"
              :items="enrollmentCandidates"
              :total="candidateTotal"
              :page="candidatePage"
              :page-size="candidatePageSize"
              :disabled="busy"
              :get-item-key="candidateKey"
              :get-item-label="candidateLabel"
              no-results-text="No hay estudiantes disponibles para matricular."
              @page-change="goToCandidatePage"
              @select="selectCandidate"
            >
              <template #option="{ item }">
                <span class="candidate-option__body">
                  <span>
                    <strong>{{ (item as EnrollmentCandidateDto).studentName }}</strong>
                    <small>{{ (item as EnrollmentCandidateDto).studentDocument }}</small>
                  </span>
                  <small v-if="(item as EnrollmentCandidateDto).admissionApplication">
                    Inscripción {{ statusLabel((item as EnrollmentCandidateDto).admissionApplication?.status || '') }}
                  </small>
                  <small v-else-if="(item as EnrollmentCandidateDto).latestEnrollment">
                    Última matrícula {{ (item as EnrollmentCandidateDto).latestEnrollment?.academicYearName }}
                  </small>
                </span>
              </template>
            </PaginatedCombobox>
          </label>
        </div>
        <p v-if="!enrollmentCandidates.length" class="form-note form-grid__wide">
          No encontramos estudiantes elegibles para el año lectivo activo. Revisa que existan estudiantes sin matrícula en este año o cambia el año lectivo en la barra superior.
        </p>
        <label>
          Año lectivo activo
          <input :value="academicContext.activeYearName" disabled />
        </label>
        <label>
          Grado
          <select v-model="newEnrollment.gradeId">
            <option value="">Selecciona un grado</option>
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
            <option value="">Selecciona el origen</option>
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
        <p v-if="selectedCandidate?.admissionApplication" class="form-note form-grid__wide">
          Inscripción asociada: {{ statusLabel(selectedCandidate.admissionApplication.status) }} ·
          Grado solicitado: {{ selectedCandidate.admissionApplication.requestedGradeName || 'Sin grado' }} ·
          Curso: {{ selectedCandidate.admissionApplication.requestedGroupName || 'Por asignar' }}
        </p>
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
          <button class="button button--brand" type="submit" :disabled="busy || !canCreateEnrollment">{{ busy ? 'Guardando...' : 'Guardar matrícula' }}</button>
        </div>
      </form>
    </FormModal>

    <ConfirmDialog
      :open="showAdmissionApprovalDialog"
      title="Aprobar inscripción y matricular"
      :description="admissionApprovalMessage"
      confirm-label="Aprobar y matricular"
      cancel-label="No continuar"
      variant="brand"
      @cancel="cancelAdmissionApproval"
      @confirm="confirmAdmissionApproval"
    />

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
            <button class="button button--ghost" type="submit" :disabled="continuityActionBusy">
              {{ continuityPreviewLoading ? 'Actualizando...' : 'Actualizar preview' }}
            </button>
            <button class="button button--brand" type="button" :disabled="continuityActionBusy || Boolean(continuityExecuteHint)" @click="executeContinuityBatch">
              {{ continuityBatchRunning ? 'Ejecutando...' : 'Ejecutar lote' }}
            </button>
          </div>
          <p v-if="continuityExecuteHint" class="form-note form-grid__wide">{{ continuityExecuteHint }}</p>
          <p v-if="continuityFeedback" class="action-feedback form-grid__wide">{{ continuityFeedback }}</p>
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

    <FormModal class="annual-close-drawer" :open="activeModal === 'annual-close'" title="Cierre anual y promoción" size="full" presentation="drawer" @close="closeModal">
      <div class="stack">
        <section class="annual-close-controls">
          <label>
            Grado
            <select v-model="annualFilters.gradeId">
              <option value="">Todos los grados</option>
              <option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
            </select>
          </label>
          <label>
            Curso
            <select v-model="annualFilters.groupId">
              <option value="">Todos los cursos</option>
              <option v-for="group in annualFilterGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
            </select>
          </label>
          <label>
            Buscar estudiante
            <input v-model="annualFilters.query" placeholder="Nombre o documento" />
          </label>
          <label>
            Decisión global
            <select v-model="annualBulkDecision">
              <option value="">Selecciona una decisión</option>
              <option value="promoted">Promovido</option>
              <option value="conditional">Condicional</option>
              <option value="not_promoted">No promovido</option>
              <option value="pending">Pendiente</option>
            </select>
          </label>
          <div class="annual-close-controls__actions">
            <button class="button button--ghost" type="button" @click="clearAnnualFilters">Limpiar filtros</button>
            <button class="button button--ghost" type="button" :disabled="annualActionBusy" @click="applyAnnualFiltersAndBulkDecision">
              {{ annualPreviewLoading ? 'Actualizando...' : annualFilterActionLabel }}
            </button>
          </div>
        </section>

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
          <button class="button button--brand" type="button" :disabled="annualActionBusy || annualDecisionItems.length === 0" @click="applyAnnualPromotionDecisions">
            {{ annualApplying ? 'Aplicando...' : 'Aplicar decisiones' }}
          </button>
        </div>
        <p v-if="annualFeedback" class="action-feedback">{{ annualFeedback }}</p>

        <div v-if="annualPromotionPreview?.items.length" class="detail-section-list">
          <div class="annual-close-pagination">
            <span>{{ annualPaginationLabel }}</span>
            <div class="annual-close-pagination__actions">
              <button class="button button--ghost" type="button" :disabled="annualPage <= 1" @click="annualPage -= 1">Anterior</button>
              <button class="button button--ghost" type="button" :disabled="annualPage >= annualTotalPages" @click="annualPage += 1">Siguiente</button>
            </div>
          </div>
          <article v-for="item in annualPagedItems" :key="item.enrollmentId" class="detail-section-card">
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
import ConfirmDialog from '../components/ConfirmDialog.vue'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import PaginatedCombobox from '../components/PaginatedCombobox.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { useAcademicContextStore } from '../stores/academic-context'
import { columns, formatDate, formatNumeric, originLabel, promotionDecisionLabel, statusLabel } from './enrollments/enrollmentsConfig'

const activeModal = ref<'create' | 'continuity' | 'annual-close' | null>(null)
const busy = ref(false)
const feedback = ref('')
const continuityFeedback = ref('')
const continuityPreviewLoading = ref(false)
const continuityBatchRunning = ref(false)
const annualFeedback = ref('')
const annualPreviewLoading = ref(false)
const annualApplying = ref(false)
const annualPage = ref(1)
const annualPageSize = 25
const annualBulkDecision = ref<'' | 'pending' | 'promoted' | 'not_promoted' | 'conditional'>('')
const showAdvancedFilters = ref(false)
const gradeOptions = ref<AcademicGradeDto[]>([])
const courseOptions = ref<CourseDto[]>([])
const enrollmentCandidates = ref<EnrollmentCandidateDto[]>([])
const selectedEnrollmentCandidate = ref<EnrollmentCandidateDto | null>(null)
const candidateSearch = ref('')
const candidatePage = ref(1)
const candidatePageSize = 8
const candidateTotal = ref(0)
const showAdmissionApprovalDialog = ref(false)
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
const annualFilters = reactive({
  gradeId: '',
  groupId: '',
  query: '',
})
const newEnrollment = reactive({
  studentId: '',
  academicYearId: '',
  gradeId: '',
  groupId: '',
  enrollmentType: '',
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
const reloadKey = computed(() => `${selectedYear.value}-${filters.gradeId}-${filters.groupId}`)
const filteredEnrollmentGroups = computed(() =>
  filters.gradeId
    ? courseOptions.value.filter((course) => course.gradeId === filters.gradeId && course.academicYearId === activeYear.value?.id)
    : courseOptions.value.filter((course) => course.academicYearId === activeYear.value?.id),
)
const annualFilterGroups = computed(() =>
  annualFilters.gradeId
    ? courseOptions.value.filter((course) => course.gradeId === annualFilters.gradeId && course.academicYearId === activeYear.value?.id)
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
  () => selectedEnrollmentCandidate.value,
)
const selectedCandidateLabel = computed(() =>
  selectedCandidate.value ? `${selectedCandidate.value.studentName} · ${selectedCandidate.value.studentDocument}` : '',
)
const admissionApprovalMessage = computed(() => {
  const admission = selectedCandidate.value?.admissionApplication
  const studentName = selectedCandidate.value?.studentName ?? 'este estudiante'
  const status = admission ? statusLabel(admission.status) : 'sin aprobar'
  return `La inscripción de ${studentName} está en estado "${status}". Para crear la matrícula debes aprobarla. Si continúas, el sistema aprobará la inscripción y creará la matrícula.`
})
const candidateTotalPages = computed(() => Math.max(Math.ceil(candidateTotal.value / candidatePageSize), 1))
const canCreateEnrollment = computed(() =>
  Boolean(newEnrollment.studentId && newEnrollment.academicYearId && newEnrollment.gradeId && newEnrollment.enrollmentType && newEnrollment.enrollmentDate),
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
const continuityActionBusy = computed(() => busy.value || continuityPreviewLoading.value || continuityBatchRunning.value)
const continuityExecuteHint = computed(() => {
  if (!continuityPreview.value) return 'Actualiza el preview para ver candidatos antes de ejecutar el lote.'
  if (hasOverbookedContinuitySelection.value) return 'Ajusta los grupos destino: hay selecciones que superan los cupos visibles.'
  if (!selectedContinuityIds.value.length) return 'Selecciona al menos un estudiante elegible para ejecutar el lote.'
  return ''
})
const approvedAdmissionStatuses = new Set(['accepted', 'converted'])
const annualDecisionItems = computed(() =>
  annualPromotionPreview.value
    ? annualPromotionPreview.value.items.map((item) => ({
        enrollmentId: item.enrollmentId,
        promotionStatus: annualDecisionSelections.value[item.enrollmentId] ?? item.suggestedPromotionStatus,
      }))
    : [],
)
const annualActionBusy = computed(() => busy.value || annualPreviewLoading.value || annualApplying.value)
const annualTotalPages = computed(() => Math.max(Math.ceil((annualPromotionPreview.value?.items.length ?? 0) / annualPageSize), 1))
const annualPagedItems = computed(() => {
  const start = (annualPage.value - 1) * annualPageSize
  return annualPromotionPreview.value?.items.slice(start, start + annualPageSize) ?? []
})
const annualPaginationLabel = computed(() => {
  const total = annualPromotionPreview.value?.items.length ?? 0
  if (!total) return 'Sin estudiantes para mostrar'
  const start = (annualPage.value - 1) * annualPageSize + 1
  const end = Math.min(start + annualPageSize - 1, total)
  return `Mostrando ${start}-${end} de ${total} estudiantes filtrados`
})
const annualFilterActionLabel = computed(() =>
  annualBulkDecision.value ? 'Actualizar y aplicar decisión' : 'Actualizar resultados',
)
watch(
  () => newEnrollment.gradeId,
  () => {
    if (!filteredCourseOptions.value.find((course) => course.id === newEnrollment.groupId)) {
      newEnrollment.groupId = ''
    }
  },
)

watch(
  () => annualFilters.gradeId,
  () => {
    if (!annualFilterGroups.value.find((group) => group.id === annualFilters.groupId)) {
      annualFilters.groupId = ''
    }
  },
)

watch(annualTotalPages, (totalPages) => {
  if (annualPage.value > totalPages) {
    annualPage.value = totalPages
  }
})

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
const workflowActions = computed(() => [
  {
    key: 'create',
    eyebrow: 'Caso individual',
    title: 'Matricular estudiante',
    description: 'Para un aspirante aprobado, traslado o caso puntual que no entra por lote.',
    run: () => {
      void openCreate()
    },
  },
  {
    key: 'continuity',
    eyebrow: 'Proceso masivo',
    title: 'Renovar o promover curso',
    description: 'Para pasar estudiantes del año anterior al año activo en lote.',
    run: () => {
      void openContinuity()
    },
  },
  {
    key: 'annual-close',
    eyebrow: 'Fin de año',
    title: 'Registrar promoción final',
    description: 'Para marcar promovido, no promovido o pendiente antes del siguiente año.',
    run: () => {
      void openAnnualClosure()
    },
  },
])
const resetForm = () => {
  newEnrollment.studentId = ''
  newEnrollment.academicYearId = academicContext.activeYearId
  newEnrollment.gradeId = ''
  newEnrollment.groupId = ''
  newEnrollment.enrollmentType = ''
  newEnrollment.enrollmentStatus = 'draft'
  newEnrollment.enrollmentDate = new Date().toISOString().slice(0, 10)
  newEnrollment.previousEnrollmentId = ''
  selectedEnrollmentCandidate.value = null
  candidateSearch.value = ''
  candidatePage.value = 1
}

const clearAdvancedFilters = () => {
  filters.gradeId = ''
  filters.groupId = ''
  showAdvancedFilters.value = false
}

const clearAnnualFilters = () => {
  annualFilters.gradeId = ''
  annualFilters.groupId = ''
  annualFilters.query = ''
  annualBulkDecision.value = ''
  annualPage.value = 1
}

const applyAnnualBulkDecision = () => {
  if (!annualBulkDecision.value || !annualPromotionPreview.value?.items.length) {
    annualFeedback.value = 'Selecciona una decisión y actualiza el preview antes de aplicar cambios globales.'
    return
  }

  annualPromotionPreview.value.items.forEach((item) => {
    annualDecisionSelections.value[item.enrollmentId] = annualBulkDecision.value || item.suggestedPromotionStatus
  })
  annualFeedback.value = `Decisión "${promotionDecisionLabel(annualBulkDecision.value)}" aplicada a ${annualPromotionPreview.value.items.length} estudiantes filtrados. Revisa y luego guarda con "Aplicar decisiones".`
}

const applyAnnualFiltersAndBulkDecision = async () => {
  await loadAnnualPromotionPreview()
  if (annualBulkDecision.value && annualPromotionPreview.value?.items.length) {
    applyAnnualBulkDecision()
  }
}

const requireSelectedYearNumber = () => {
  if (!selectedYearNumber.value) {
    throw new Error('No se pudo resolver el año lectivo actual.')
  }
  return selectedYearNumber.value
}

const loadCatalogs = async () => {
  const [gradesResponse, coursesResponse] = await Promise.all([
    api.getAcademicGrades({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
  ])
  gradeOptions.value = gradesResponse.data.items
  courseOptions.value = coursesResponse.data.items
  await loadEnrollmentCandidates()
}

const loadEnrollmentCandidates = async () => {
  const year = requireSelectedYearNumber()
  const candidatesResponse = await api.getEnrollmentCandidates({
    year,
    query: candidateSearch.value,
    page: candidatePage.value,
    pageSize: candidatePageSize,
  })
  enrollmentCandidates.value = candidatesResponse.data.items
  candidateTotal.value = candidatesResponse.data.total
}

const goToCandidatePage = async (page: number) => {
  candidatePage.value = Math.min(Math.max(page, 1), candidateTotalPages.value)
  await loadEnrollmentCandidates()
}

const candidateKey = (item: unknown) => (item as EnrollmentCandidateDto).studentId
const candidateLabel = (item: unknown) => {
  const candidate = item as EnrollmentCandidateDto
  return `${candidate.studentName} · ${candidate.studentDocument}`
}

const selectCandidate = (item: unknown) => {
  const candidate = item as EnrollmentCandidateDto
  selectedEnrollmentCandidate.value = candidate
  newEnrollment.studentId = candidate.studentId

  if (candidate.admissionApplication) {
    newEnrollment.gradeId = candidate.admissionApplication.requestedGradeId
    newEnrollment.groupId = candidate.admissionApplication.requestedGroupId ?? ''
  } else {
    newEnrollment.gradeId = ''
    newEnrollment.groupId = ''
  }

  newEnrollment.previousEnrollmentId =
    newEnrollment.enrollmentType && newEnrollment.enrollmentType !== 'new' && candidate.latestEnrollment
      ? candidate.latestEnrollment.id
      : ''
}

const loadContinuityPreview = async () => {
  continuityPreviewLoading.value = true
  continuityFeedback.value = 'Actualizando candidatos de continuidad...'
  try {
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
    continuityFeedback.value = response.data.totalCandidates
      ? `Preview actualizado: ${response.data.eligibleCandidates} elegibles de ${response.data.totalCandidates} candidatos.`
      : 'Preview actualizado: no hay candidatos con los filtros actuales.'
  } catch (caught) {
    continuityPreview.value = null
    selectedContinuityIds.value = []
    continuityGroupSelections.value = {}
    continuityFeedback.value = caught instanceof Error ? caught.message : 'No fue posible actualizar el preview de continuidad.'
  } finally {
    continuityPreviewLoading.value = false
  }
}

const loadAnnualPromotionPreview = async () => {
  annualPreviewLoading.value = true
  annualFeedback.value = 'Actualizando estudiantes para cierre anual...'
  try {
    const year = requireSelectedYearNumber()
    const response = await api.getAnnualPromotionPreview({
      year,
      gradeId: annualFilters.gradeId,
      groupId: annualFilters.groupId,
      query: annualFilters.query,
    })
    annualPromotionPreview.value = response.data
    annualPage.value = 1
    annualDecisionSelections.value = Object.fromEntries(
      response.data.items.map((item) => [item.enrollmentId, item.suggestedPromotionStatus]),
    )
    annualFeedback.value = response.data.totalStudents
      ? `Preview actualizado: ${response.data.totalStudents} estudiantes visibles para cierre anual.`
      : 'Preview actualizado: no hay estudiantes con los filtros actuales.'
  } catch (caught) {
    annualPromotionPreview.value = null
    annualDecisionSelections.value = {}
    annualFeedback.value = caught instanceof Error ? caught.message : 'No fue posible actualizar el preview de cierre anual.'
  } finally {
    annualPreviewLoading.value = false
  }
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
  showAdmissionApprovalDialog.value = false
}

const openCreate = async () => {
  busy.value = true
  try {
    resetForm()
    await loadCatalogs()
    activeModal.value = 'create'
  } catch (caught) {
    feedback.value = caught instanceof Error ? caught.message : 'No pudimos cargar los estudiantes disponibles para matrícula.'
  } finally {
    busy.value = false
  }
}

const openContinuity = async () => {
  activeModal.value = 'continuity'
  continuityFeedback.value = ''
  await loadContinuityPreview()
}

const openAnnualClosure = async () => {
  activeModal.value = 'annual-close'
  annualFeedback.value = ''
  await loadAnnualPromotionPreview()
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
  void openCreate()
}

const createEnrollment = async () => {
  if (!canCreateEnrollment.value) {
    feedback.value = 'Selecciona estudiante, año lectivo, grado, origen y fecha antes de guardar la matrícula.'
    return
  }

  const admissionApplication = selectedCandidate.value?.admissionApplication ?? null
  const approveAdmissionIfNeeded = Boolean(admissionApplication && !approvedAdmissionStatuses.has(admissionApplication.status))

  if (approveAdmissionIfNeeded) {
    showAdmissionApprovalDialog.value = true
    return
  }

  await submitEnrollment(false)
}

const submitEnrollment = async (approveAdmissionIfNeeded: boolean) => {
  const admissionApplication = selectedCandidate.value?.admissionApplication ?? null
  busy.value = true
  try {
    await api.createEnrollment({
      studentId: newEnrollment.studentId,
      academicYearId: newEnrollment.academicYearId,
      gradeId: newEnrollment.gradeId,
      groupId: newEnrollment.groupId || null,
      admissionApplicationId: admissionApplication?.id ?? null,
      approveAdmissionIfNeeded,
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

const cancelAdmissionApproval = () => {
  showAdmissionApprovalDialog.value = false
  feedback.value = 'Matrícula cancelada. La inscripción no fue modificada.'
}

const confirmAdmissionApproval = async () => {
  showAdmissionApprovalDialog.value = false
  await submitEnrollment(true)
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
  if (!continuityPreview.value) {
    continuityFeedback.value = 'Primero actualiza el preview para ver candidatos.'
    return
  }
  if (hasOverbookedContinuitySelection.value) {
    continuityFeedback.value = 'La selección supera los cupos visibles de uno o más grupos. Ajusta las asignaciones antes de ejecutar.'
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
    continuityFeedback.value = 'No hay estudiantes elegibles seleccionados para ejecutar la continuidad.'
    return
  }

  continuityBatchRunning.value = true
  continuityFeedback.value = `Ejecutando lote de ${items.length} estudiantes...`
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
    continuityFeedback.value = feedback.value
    activeModal.value = null
  } catch (caught) {
    continuityFeedback.value = caught instanceof Error ? caught.message : 'No fue posible ejecutar el lote de continuidad.'
  } finally {
    continuityBatchRunning.value = false
  }
}

const applyAnnualPromotionDecisions = async () => {
  if (!annualPromotionPreview.value || !annualDecisionItems.value.length) {
    annualFeedback.value = 'Actualiza el preview antes de aplicar decisiones.'
    return
  }
  annualApplying.value = true
  annualFeedback.value = `Aplicando ${annualDecisionItems.value.length} decisiones de cierre anual...`
  try {
    const response = await api.saveAnnualPromotionDecisions({
      academicYearId: annualPromotionPreview.value.academicYearId,
      items: annualDecisionItems.value,
    })
    await listViewRef.value?.reload()
    await loadAnnualPromotionPreview()
    feedback.value = `${response.data.updatedCount} decisiones de cierre anual aplicadas correctamente.`
    annualFeedback.value = feedback.value
  } catch (caught) {
    annualFeedback.value = caught instanceof Error ? caught.message : 'No fue posible aplicar las decisiones de cierre anual.'
  } finally {
    annualApplying.value = false
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
      return
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

let candidateSearchTimer: ReturnType<typeof setTimeout> | null = null
watch(candidateSearch, () => {
  if (activeModal.value !== 'create') return
  if (candidateSearchTimer) clearTimeout(candidateSearchTimer)
  candidateSearchTimer = setTimeout(() => {
    candidatePage.value = 1
    void loadEnrollmentCandidates()
  }, 250)
})

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

<style src="./enrollments/EnrollmentsView.css" scoped></style>
