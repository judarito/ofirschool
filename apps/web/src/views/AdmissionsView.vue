<template>
  <section class="stack module-page module-page--admissions">
    <PageHeader
      eyebrow="Inscripción escolar"
      title="Inscripciones"
      subtitle="Revisa solicitudes pendientes, toma decisiones y convierte aprobadas en matrículas sin perder el contexto del año activo."
    >
      <template #actions>
        <label class="page-inline-filter">
          <span>Año lectivo activo</span>
          <input :value="academicContext.activeYearName" disabled />
        </label>
        <button class="button button--ghost" type="button" @click="openCreate">Registrar aspirante</button>
        <button class="button button--brand" type="button" :disabled="!isSelectedYearActive" @click="openPendingQueue">Revisar pendientes</button>
      </template>
    </PageHeader>

    <SurfaceCard class="module-inline-summary">
      <div class="module-inline-summary__copy">
        <strong>{{ primaryTask.title }}</strong>
        <p>{{ primaryTask.helper }}</p>
      </div>
      <div class="module-inline-summary__meta">
        <span>{{ primaryTask.value }}</span>
        <small>{{ admissionProcess.startsOn || '--' }} a {{ admissionProcess.endsOn || '--' }}</small>
      </div>
      <div class="module-inline-summary__actions">
        <button class="button button--ghost" type="button" :disabled="!isSelectedYearActive" @click="openProcess">Proceso</button>
        <button class="button button--ghost" type="button" :disabled="!isSelectedYearActive" @click="openPendingQueue">{{ primaryTask.actionLabel }}</button>
      </div>
    </SurfaceCard>

    <ListView
      ref="listViewRef"
      title="Bandeja de inscripciones"
      subtitle="Filtra, revisa y convierte solicitudes aprobadas sin salir del módulo."
      :columns="listColumns"
      :fetcher="fetchAdmissions"
      search-placeholder="Buscar por estudiante, documento o acudiente"
      empty-title="Sin solicitudes"
      empty-description="No hay inscripciones para los filtros seleccionados."
      create-label=""
      :show-actions="true"
      :reload-key="reloadKey"
    >
      <template #toolbar-actions>
        <div class="admissions-toolbar">
          <div class="admissions-queue-tabs" role="tablist" aria-label="Filtros rápidos por estado">
            <button
              v-for="tab in queueTabs"
              :key="tab.value"
              class="chip-button"
              :class="{ 'chip-button--active': filters.status === tab.value }"
              type="button"
              @click="setStatusFilter(tab.value)"
            >
              {{ tab.label }} <span>{{ tab.count }}</span>
            </button>
          </div>
          <div class="admissions-toolbar__actions">
            <button class="button button--ghost" type="button" @click="showAdvancedFilters = !showAdvancedFilters">
              {{ showAdvancedFilters ? 'Ocultar filtros' : 'Más filtros' }}
            </button>
            <button class="button button--ghost" type="button" @click="openCreate">Registrar aspirante</button>
          </div>
        </div>
        <div v-if="showAdvancedFilters" class="admissions-advanced-filters">
          <select v-model="filters.gradeId" class="toolbar-select">
            <option value="">Todos los grados</option>
            <option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
          <select v-model="filters.groupId" class="toolbar-select">
            <option value="">Todos los cursos</option>
            <option v-for="group in filteredAdmissionGroups" :key="group.id" :value="group.id">{{ group.name }}</option>
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

      <template #cell-guardianName="{ row }">
        <div class="list-view__primary-cell">
          <strong>{{ row.guardianName }}</strong>
          <small>{{ row.guardianEmail || 'Sin correo' }}</small>
        </div>
      </template>

      <template #cell-requestedGroupName="{ value }">
        {{ value || 'Asignar después' }}
      </template>

      <template #cell-status="{ value }">
        <StatusBadge :status="statusLabel(String(value))" />
      </template>

      <template #cell-submittedAt="{ row }">
        {{ formatDate(String(row.submittedAt || row.applicationDate)) }}
      </template>

      <template #row-actions="{ row }">
        <button class="table-action" type="button" @click="selectAdmission(row as unknown as AdmissionApplicationDto)">Ver detalle</button>
        <button
          v-if="primaryRowAction(String(row.status)).action === 'reviewing'"
          class="table-action"
          type="button"
          @click="openStatusAction(row as unknown as AdmissionApplicationDto, 'reviewing')"
        >
          {{ primaryRowAction(String(row.status)).label }}
        </button>
        <button
          v-else-if="primaryRowAction(String(row.status)).action === 'accepted'"
          class="table-action"
          type="button"
          @click="openStatusAction(row as unknown as AdmissionApplicationDto, 'accepted')"
        >
          {{ primaryRowAction(String(row.status)).label }}
        </button>
        <button
          v-else-if="primaryRowAction(String(row.status)).action === 'convert'"
          class="table-action"
          type="button"
          @click="openConvertModal(row as unknown as AdmissionApplicationDto)"
        >
          {{ primaryRowAction(String(row.status)).label }}
        </button>
      </template>
    </ListView>

    <FormModal :open="activeModal === 'create'" title="Registrar aspirante" @close="closeModal">
      <form class="form-grid" @submit.prevent="createAdmission">
        <label>
          Año lectivo activo
          <input :value="academicContext.activeYearName" disabled />
        </label>
        <label>
          Grado solicitado
          <select v-model="newAdmission.requestedGradeId">
            <option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>
        <label>
          Curso sugerido
          <select v-model="newAdmission.requestedGroupId">
            <option value="">Asignar después</option>
            <option v-for="group in filteredCourseOptions" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
        </label>
        <label>
          Tipo de ingreso
          <select v-model="newAdmission.source">
            <option value="new_student">Alumno nuevo</option>
            <option value="transfer">Traslado</option>
            <option value="reentry">Reingreso</option>
          </select>
        </label>
        <label>
          Nombres estudiante
          <input v-model="newAdmission.student.firstName" required />
        </label>
        <label>
          Segundo nombre
          <input v-model="newAdmission.student.middleName" />
        </label>
        <label>
          Apellidos estudiante
          <input v-model="newAdmission.student.lastName" required />
        </label>
        <label>
          Tipo documento estudiante
          <select v-model="newAdmission.student.documentType">
            <option value="TI">TI</option>
            <option value="RC">RC</option>
            <option value="CC">CC</option>
          </select>
        </label>
        <label>
          Documento estudiante
          <input v-model="newAdmission.student.documentNumber" required />
        </label>
        <label>
          Fecha nacimiento
          <input v-model="newAdmission.student.birthDate" type="date" required />
        </label>
        <label>
          Género
          <select v-model="newAdmission.student.gender">
            <option value="masculino">Masculino</option>
            <option value="femenino">Femenino</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <label>
          Grupo sanguíneo
          <input v-model="newAdmission.student.bloodType" placeholder="O+" />
        </label>
        <label>
          Nombres acudiente
          <input v-model="newAdmission.guardian.firstName" required />
        </label>
        <label>
          Apellidos acudiente
          <input v-model="newAdmission.guardian.lastName" required />
        </label>
        <label>
          Tipo documento acudiente
          <select v-model="newAdmission.guardian.documentType">
            <option value="CC">CC</option>
            <option value="CE">CE</option>
            <option value="PP">Pasaporte</option>
          </select>
        </label>
        <label>
          Documento acudiente
          <input v-model="newAdmission.guardian.documentNumber" required />
        </label>
        <label>
          Teléfono acudiente
          <input v-model="newAdmission.guardian.phone" required />
        </label>
        <label>
          Correo acudiente
          <input v-model="newAdmission.guardian.email" type="email" required />
        </label>
        <label>
          Parentesco
          <select v-model="newAdmission.guardian.relationship">
            <option value="madre">Madre</option>
            <option value="padre">Padre</option>
            <option value="abuelo">Abuelo(a)</option>
            <option value="tio">Tío(a)</option>
            <option value="otro">Otro</option>
          </select>
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="busy">{{ busy ? 'Guardando...' : 'Crear solicitud' }}</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'process'" title="Proceso público de inscripción" size="lg" presentation="drawer" @close="closeModal">
      <form class="form-grid" @submit.prevent="saveProcess">
        <label>
          Año lectivo activo
          <input :value="academicContext.activeYearName" disabled />
        </label>
        <label>
          Nombre del proceso
          <input v-model="processForm.name" required />
        </label>
        <label>
          Fecha apertura pública
          <input v-model="processForm.startsOn" type="date" required />
        </label>
        <label>
          Fecha cierre pública
          <input v-model="processForm.endsOn" type="date" required />
        </label>
        <label>
          Slug del colegio
          <input :value="admissionProcess.tenantSlug" disabled />
        </label>
        <label>
          Estado público
          <input :value="admissionProcess.publicStatus" disabled />
        </label>
        <p v-if="!isSelectedYearActive" class="form-note form-grid__wide">
          Solo puedes configurar el proceso público del año lectivo activo.
        </p>
        <p v-else-if="pendingReadinessItems.length" class="form-note form-grid__wide">
          Antes de abrir este proceso te faltan: {{ pendingReadinessItems.join(', ') }}.
        </p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="busy || !isSelectedYearActive">{{ busy ? 'Guardando...' : 'Guardar proceso' }}</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'detail'" title="Detalle de la inscripción" size="full" presentation="drawer" @close="closeModal">
      <div v-if="selectedAdmissionDetail" class="admission-detail-stack">
        <section class="admission-detail-grid">
          <article class="detail-panel">
            <span class="window-strip__label">Estudiante</span>
            <strong>{{ selectedAdmissionDetail.application.studentName }}</strong>
            <dl class="detail-list">
              <div><dt>Documento</dt><dd>{{ selectedAdmissionDetail.application.studentDocument }}</dd></div>
              <div><dt>Nacimiento</dt><dd>{{ selectedAdmissionDetail.student.birthDate || 'Sin dato' }}</dd></div>
              <div><dt>Género</dt><dd>{{ selectedAdmissionDetail.student.gender || 'Sin dato' }}</dd></div>
              <div><dt>Grupo sanguíneo</dt><dd>{{ selectedAdmissionDetail.student.bloodType || 'Sin dato' }}</dd></div>
            </dl>
          </article>

          <article class="detail-panel">
            <span class="window-strip__label">Acudiente principal</span>
            <strong>{{ selectedAdmissionDetail.guardian ? `${selectedAdmissionDetail.guardian.firstName} ${selectedAdmissionDetail.guardian.lastName}` : 'Sin acudiente' }}</strong>
            <dl class="detail-list">
              <div><dt>Documento</dt><dd>{{ selectedAdmissionDetail.guardian ? `${selectedAdmissionDetail.guardian.documentType} ${selectedAdmissionDetail.guardian.documentNumber}` : 'Sin dato' }}</dd></div>
              <div><dt>Correo</dt><dd>{{ selectedAdmissionDetail.guardian?.email || 'Sin dato' }}</dd></div>
              <div><dt>Teléfono</dt><dd>{{ selectedAdmissionDetail.guardian?.phone || 'Sin dato' }}</dd></div>
              <div><dt>Parentesco</dt><dd>{{ selectedAdmissionDetail.guardian?.relationship || 'Sin dato' }}</dd></div>
            </dl>
          </article>
        </section>

        <section class="admission-detail-grid">
          <article class="detail-panel">
            <span class="window-strip__label">Solicitud</span>
            <strong>{{ selectedAdmissionDetail.application.academicYearName }}</strong>
            <dl class="detail-list">
              <div><dt>Grado solicitado</dt><dd>{{ selectedAdmissionDetail.application.requestedGradeName }}</dd></div>
              <div><dt>Curso sugerido</dt><dd>{{ selectedAdmissionDetail.application.requestedGroupName || 'Asignar después' }}</dd></div>
              <div><dt>Estado</dt><dd>{{ statusLabel(selectedAdmissionDetail.application.status) }}</dd></div>
              <div><dt>Enviada</dt><dd>{{ formatDateTime(selectedAdmissionDetail.application.submittedAt || selectedAdmissionDetail.application.applicationDate) }}</dd></div>
            </dl>
            <p v-if="selectedAdmissionDetail.application.notes" class="detail-note">
              {{ selectedAdmissionDetail.application.notes }}
            </p>
          </article>

          <article class="detail-panel">
            <span class="window-strip__label">Formulario</span>
            <strong>{{ selectedAdmissionDetail.submission ? 'Respuesta recibida' : 'Sin envío asociado' }}</strong>
            <dl class="detail-list">
              <div><dt>Estado</dt><dd>{{ selectedAdmissionDetail.submission?.status || 'Sin dato' }}</dd></div>
              <div><dt>Progreso</dt><dd>{{ selectedAdmissionDetail.submission?.progressPercent ?? 0 }}%</dd></div>
              <div><dt>Secciones</dt><dd>{{ selectedAdmissionDetail.sections.length }}</dd></div>
              <div><dt>Documentos</dt><dd>{{ selectedAdmissionDetail.documents.length }}</dd></div>
            </dl>
          </article>
        </section>

        <section class="detail-panel">
          <div class="card-headline">
            <div>
              <h3>Respuestas dinámicas</h3>
              <p>Esto es exactamente lo que envió el acudiente en el formulario público.</p>
            </div>
          </div>
          <div v-if="selectedAdmissionDetail.sections.length" class="detail-section-list">
            <article v-for="section in selectedAdmissionDetail.sections" :key="section.title" class="detail-section-card">
              <h4>{{ section.title }}</h4>
              <div class="detail-field-grid">
                <div v-for="field in section.fields" :key="field.fieldCode" class="detail-field-card">
                  <span>{{ field.fieldLabel }}</span>
                  <strong>{{ field.displayValue }}</strong>
                </div>
              </div>
            </article>
          </div>
          <EmptyState
            v-else
            title="Sin respuestas dinámicas"
            description="Esta solicitud todavía no tiene respuestas adicionales publicadas."
          />
        </section>

        <section class="detail-panel">
          <div class="card-headline">
            <div>
              <h3>Documentos adjuntos</h3>
              <p>Aquí puedes revisar lo que llegó en la inscripción y descargar lo que ya está almacenado en R2.</p>
            </div>
          </div>
          <div v-if="selectedAdmissionDetail.documents.length" class="detail-document-list">
            <div v-for="document in selectedAdmissionDetail.documents" :key="document.id" class="detail-document-row">
              <div>
                <strong>{{ document.name }}</strong>
                <small>{{ document.fileName }}</small>
              </div>
              <div class="detail-document-meta">
                <span>{{ document.mimeType || 'Tipo no informado' }}</span>
                <span>{{ formatFileSize(document.fileSizeBytes) }}</span>
                <StatusBadge :status="document.source === 'uploaded' ? 'aprobado' : 'revision'" />
                <button
                  v-if="document.source === 'uploaded'"
                  class="table-action"
                  type="button"
                  :disabled="busy"
                  @click="downloadDocument(document.id, document.fileName)"
                >
                  Descargar
                </button>
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            title="Sin documentos listados"
            description="La inscripción no reportó adjuntos o todavía no fueron cargados."
          />
        </section>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cerrar</button>
          <button
            v-if="selectedAdmissionDetail.application.status === 'submitted'"
            class="button button--ghost"
            type="button"
            :disabled="busy"
            @click="openStatusAction(selectedAdmissionDetail.application, 'reviewing', 'detail')"
          >
            Pasar a revisión
          </button>
          <button
            v-if="['submitted', 'reviewing', 'rejected'].includes(selectedAdmissionDetail.application.status)"
            class="button button--ghost"
            type="button"
            :disabled="busy"
            @click="openStatusAction(selectedAdmissionDetail.application, 'accepted', 'detail')"
          >
            Aprobar
          </button>
          <button
            v-if="['submitted', 'reviewing', 'accepted'].includes(selectedAdmissionDetail.application.status)"
            class="button button--ghost"
            type="button"
            :disabled="busy"
            @click="openStatusAction(selectedAdmissionDetail.application, 'rejected', 'detail')"
          >
            Rechazar
          </button>
          <button
            class="button button--brand"
            type="button"
            :disabled="busy || selectedAdmissionDetail.application.status !== 'accepted'"
            @click="openConvertModal(selectedAdmissionDetail.application, 'detail')"
          >
            {{ selectedAdmissionDetail.application.status === 'converted' ? 'Ya matriculada' : 'Convertir a matrícula' }}
          </button>
        </div>
      </div>
    </FormModal>

    <FormModal :open="activeModal === 'status'" :title="statusModalTitle" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitStatusAction">
        <label>
          Estudiante
          <input :value="actionAdmission?.studentName || ''" disabled />
        </label>
        <label>
          Nuevo estado
          <input :value="statusLabel(statusActionForm.status)" disabled />
        </label>
        <label class="form-grid__wide">
          {{ statusActionForm.status === 'rejected' ? 'Causal o comentario' : 'Comentario interno' }}
          <textarea
            v-model="statusActionForm.notes"
            :required="statusActionForm.status === 'rejected'"
            :placeholder="statusActionForm.status === 'rejected' ? 'Explica el motivo del rechazo' : 'Observación opcional para la trazabilidad interna'"
          />
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="busy">{{ busy ? 'Guardando...' : 'Confirmar cambio' }}</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'convert'" title="Convertir a matrícula" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitConversion">
        <label>
          Estudiante
          <input :value="actionAdmission?.studentName || ''" disabled />
        </label>
        <label>
          Año lectivo
          <input :value="actionAdmission?.academicYearName || ''" disabled />
        </label>
        <label>
          Grado destino
          <select v-model="conversionForm.gradeId" required>
            <option v-for="grade in gradeOptions" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>
        <label>
          Curso destino
          <select v-model="conversionForm.groupId">
            <option value="">Asignar después</option>
            <option v-for="group in conversionCourseOptions" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
        </label>
        <label>
          Estado inicial
          <select v-model="conversionForm.enrollmentStatus">
            <option value="draft">Borrador</option>
            <option value="pending">Pendiente</option>
            <option value="active">Activa</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>
        <label>
          Fecha de matrícula
          <input v-model="conversionForm.enrollmentDate" type="date" required />
        </label>
        <p class="form-note">Confirma grado, curso, estado y fecha antes de crear la matrícula desde esta solicitud aprobada.</p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="busy">{{ busy ? 'Convirtiendo...' : 'Crear matrícula' }}</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AcademicGradeDto, AdmissionApplicationDetailDto, AdmissionApplicationDto, AdmissionOverviewDto, AdmissionProcessDto, CourseDto } from '@ofir/shared'
import { api } from '../lib/api'
import EmptyState from '../components/EmptyState.vue'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { useAcademicContextStore } from '../stores/academic-context'

const activeModal = ref<'create' | 'process' | 'detail' | 'status' | 'convert' | null>(null)
const busy = ref(false)
const feedback = ref('')
const showAdvancedFilters = ref(false)
const gradeOptions = ref<AcademicGradeDto[]>([])
const courseOptions = ref<CourseDto[]>([])
const applications = ref<AdmissionApplicationDto[]>([])
const selectedAdmissionDetail = ref<AdmissionApplicationDetailDto | null>(null)
const actionAdmission = ref<AdmissionApplicationDto | null>(null)
const modalReturnTarget = ref<'detail' | null>(null)
const listViewRef = ref<InstanceType<typeof ListView> | null>(null)
const listMeta = reactive({
  total: 0,
  page: 1,
  pageSize: 10,
})
const admissionOverview = ref<AdmissionOverviewDto | null>(null)
const academicContext = useAcademicContextStore()
const selectedYear = computed(() => academicContext.selectedYear)
const selectedYearNumber = computed(() => academicContext.selectedYearNumber)
const filters = reactive({
  status: '',
  gradeId: '',
  groupId: '',
})
const listColumns = [
  { key: 'studentName', label: 'Estudiante' },
  { key: 'guardianName', label: 'Acudiente' },
  { key: 'requestedGradeName', label: 'Grado' },
  { key: 'requestedGroupName', label: 'Curso' },
  { key: 'status', label: 'Estado' },
  { key: 'submittedAt', label: 'Fecha' },
]
const admissionProcess = reactive<AdmissionProcessDto>({
  year: 2026,
  academicYearId: '',
  academicYearName: 'Año lectivo 2026',
  tenantSlug: 'colegio-demo-ofir',
  name: 'Inscripciones 2026',
  startsOn: '',
  endsOn: '',
  publicStatus: 'programado',
  publicLink: '/inscripcion/colegio-demo-ofir/2026',
})
const processForm = reactive({
  year: '2026',
  name: 'Inscripciones 2026',
  startsOn: '',
  endsOn: '',
})
const statusActionForm = reactive({
  status: 'reviewing' as 'reviewing' | 'accepted' | 'rejected',
  notes: '',
})
const conversionForm = reactive({
  academicYearId: '',
  gradeId: '',
  groupId: '',
  enrollmentStatus: 'active',
  enrollmentDate: new Date().toISOString().slice(0, 10),
})
const newAdmission = reactive({
  academicYearId: '',
  requestedGradeId: '',
  requestedGroupId: '',
  source: 'new_student',
  student: {
    firstName: '',
    middleName: '',
    lastName: '',
    documentType: 'TI',
    documentNumber: '',
    birthDate: '',
    gender: 'masculino',
    bloodType: '',
  },
  guardian: {
    firstName: '',
    lastName: '',
    documentType: 'CC',
    documentNumber: '',
    phone: '',
    email: '',
    relationship: 'madre',
  },
})

const filteredCourseOptions = computed(() =>
  newAdmission.requestedGradeId
    ? courseOptions.value.filter((course) => course.gradeId === newAdmission.requestedGradeId && course.academicYearId === newAdmission.academicYearId)
    : courseOptions.value.filter((course) => course.academicYearId === newAdmission.academicYearId),
)
const filteredAdmissionGroups = computed(() =>
  filters.gradeId
    ? courseOptions.value.filter((course) => course.gradeId === filters.gradeId && course.academicYearId === admissionProcess.academicYearId)
    : courseOptions.value.filter((course) => course.academicYearId === admissionProcess.academicYearId),
)
const reloadKey = computed(() => `${selectedYear.value}-${filters.status}-${filters.gradeId}-${filters.groupId}`)
const readinessChecklist = computed(() => admissionOverview.value?.checklist ?? [])
const conversionCourseOptions = computed(() =>
  actionAdmission.value
    ? courseOptions.value.filter(
        (course) =>
          course.academicYearId === actionAdmission.value?.academicYearId &&
          (!conversionForm.gradeId || course.gradeId === conversionForm.gradeId),
      )
    : [],
)
const isSelectedYearActive = computed(() => admissionProcess.academicYearId === academicContext.activeYearId)
const pendingReadinessItems = computed(() =>
  readinessChecklist.value.filter((item) => !item.ready).map((item) => item.label.toLowerCase()),
)
const queueTabs = computed(() => [
  { value: '', label: 'Todas', count: metrics.value.total },
  { value: 'submitted', label: 'Nuevas', count: metrics.value.submitted },
  { value: 'reviewing', label: 'En revisión', count: metrics.value.reviewing },
  { value: 'accepted', label: 'Aprobadas', count: metrics.value.approved - metrics.value.converted },
  { value: 'converted', label: 'Convertidas', count: metrics.value.converted },
  { value: 'rejected', label: 'Rechazadas', count: applications.value.filter((item) => item.status === 'rejected').length },
])
const primaryTask = computed(() => {
  if (metrics.value.reviewing > 0) {
    return {
      title: 'Solicitudes en revisión',
      value: `${metrics.value.reviewing} por decidir`,
      helper: 'El siguiente paso es aprobar o rechazar las solicitudes que ya fueron validadas.',
      description: 'La bandeja ya tiene solicitudes activas que esperan decisión académica o administrativa.',
      actionLabel: 'Ir a revisión',
      status: 'revision',
    }
  }
  if (metrics.value.submitted > 0) {
    return {
      title: 'Solicitudes nuevas',
      value: `${metrics.value.submitted} recién enviadas`,
      helper: 'Conviene moverlas primero a revisión para que el equipo no pierda trazabilidad.',
      description: 'Todavía hay aspirantes nuevos sin tomar en cola formal de revisión.',
      actionLabel: 'Tomar solicitudes nuevas',
      status: 'nuevo',
    }
  }
  if (metrics.value.approved - metrics.value.converted > 0) {
    return {
      title: 'Conversión pendiente',
      value: `${metrics.value.approved - metrics.value.converted} por matricular`,
      helper: 'Ya fueron aprobadas; falta convertirlas en matrícula anual.',
      description: 'El cuello de botella ya no está en revisar sino en cerrar la matrícula de quienes fueron aceptados.',
      actionLabel: 'Ver aprobadas',
      status: 'aprobado',
    }
  }
  return {
    title: 'Proceso controlado',
    value: 'Sin urgencias visibles',
    helper: 'Puedes revisar el proceso público o registrar manualmente nuevos aspirantes.',
    description: 'La bandeja no tiene pendientes críticos en este momento.',
    actionLabel: 'Ver todas',
    status: 'aprobado',
  }
})
const statusModalTitle = computed(() => {
  if (statusActionForm.status === 'accepted') return 'Aprobar solicitud'
  if (statusActionForm.status === 'rejected') return 'Rechazar solicitud'
  return 'Pasar a revisión'
})

watch(
  () => newAdmission.requestedGradeId,
  () => {
    if (!filteredCourseOptions.value.find((course) => course.id === newAdmission.requestedGroupId)) {
      newAdmission.requestedGroupId = ''
    }
  },
)

watch(
  () => conversionForm.gradeId,
  () => {
    if (!conversionCourseOptions.value.find((course) => course.id === conversionForm.groupId)) {
      conversionForm.groupId = ''
    }
  },
)

const publicAdmissionLink = computed(() => {
  const origin = typeof window === 'undefined' ? 'https://app.ofirschool.com' : window.location.origin
  return `${origin}${admissionProcess.publicLink}`
})

const metrics = computed(() => ({
  total: listMeta.total,
  submitted: applications.value.filter((item) => item.status === 'submitted').length,
  reviewing: applications.value.filter((item) => item.status === 'reviewing').length,
  approved: applications.value.filter((item) => ['accepted', 'converted'].includes(item.status)).length,
  converted: applications.value.filter((item) => item.status === 'converted').length,
}))

const statusLabel = (status: string) => {
  if (status === 'submitted') return 'nuevo'
  if (status === 'reviewing') return 'revision'
  if (status === 'accepted' || status === 'converted') return 'aprobado'
  if (status === 'rejected') return 'rechazado'
  return status
}
const primaryRowAction = (status: string) => {
  if (status === 'submitted') return { action: 'reviewing', label: 'Tomar en revisión' }
  if (status === 'reviewing' || status === 'rejected') return { action: 'accepted', label: 'Aprobar' }
  if (status === 'accepted') return { action: 'convert', label: 'Matricular' }
  return { action: 'detail', label: 'Ver detalle' }
}

const formatDate = (value: string) => new Date(value).toLocaleDateString('es-CO')
const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
const formatFileSize = (value: number | null) => {
  if (!value || value <= 0) return 'Tamaño no informado'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

const resetNewAdmission = () => {
  newAdmission.academicYearId = academicContext.activeYearId
  newAdmission.requestedGradeId = gradeOptions.value[0]?.id ?? ''
  newAdmission.requestedGroupId = ''
  newAdmission.source = 'new_student'
  Object.assign(newAdmission.student, {
    firstName: '',
    middleName: '',
    lastName: '',
    documentType: 'TI',
    documentNumber: '',
    birthDate: '',
    gender: 'masculino',
    bloodType: '',
  })
  Object.assign(newAdmission.guardian, {
    firstName: '',
    lastName: '',
    documentType: 'CC',
    documentNumber: '',
    phone: '',
    email: '',
    relationship: 'madre',
  })
}

const setStatusFilter = (status: string) => {
  filters.status = status
}

const clearAdvancedFilters = () => {
  filters.gradeId = ''
  filters.groupId = ''
  showAdvancedFilters.value = false
}

const loadProcess = async () => {
  if (!selectedYearNumber.value) throw new Error('No se pudo resolver el año lectivo actual.')
  const response = await api.getAdmissionProcess(selectedYearNumber.value)
  Object.assign(admissionProcess, response.data)
  Object.assign(processForm, {
    year: String(response.data.year),
    name: response.data.name,
    startsOn: response.data.startsOn,
    endsOn: response.data.endsOn,
  })
}

const loadOverview = async () => {
  if (!selectedYearNumber.value) throw new Error('No se pudo resolver el año lectivo actual.')
  const response = await api.getAdmissionOverview(selectedYearNumber.value)
  admissionOverview.value = response.data
}

const fetchAdmissions = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getAdmissionApplications({
    year: selectedYearNumber.value ?? undefined,
    status: filters.status,
    gradeId: filters.gradeId,
    groupId: filters.groupId,
    query,
    page,
    pageSize,
  })
  applications.value = response.data.items
  listMeta.total = response.data.total
  listMeta.page = response.data.page
  listMeta.pageSize = response.data.pageSize
  return {
    ...response.data,
    items: response.data.items as unknown as Array<{ id: string } & Record<string, unknown>>,
  }
}

const loadCatalogs = async () => {
  const [gradesResponse, coursesResponse] = await Promise.all([
    api.getAcademicGrades({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
  ])
  gradeOptions.value = gradesResponse.data.items
  courseOptions.value = coursesResponse.data.items
}

const reload = async () => {
  busy.value = true
  try {
    await loadCatalogs()
    await loadProcess()
    await loadOverview()
    await listViewRef.value?.reload()
    resetNewAdmission()
  } finally {
    busy.value = false
  }
}

const closeModal = () => {
  const nextTarget = modalReturnTarget.value
  if ((activeModal.value === 'status' || activeModal.value === 'convert') && nextTarget === 'detail' && selectedAdmissionDetail.value) {
    modalReturnTarget.value = null
    actionAdmission.value = null
    activeModal.value = 'detail'
    return
  }

  activeModal.value = null
  actionAdmission.value = null
  modalReturnTarget.value = null
  selectedAdmissionDetail.value = null
}

const openCreate = () => {
  resetNewAdmission()
  activeModal.value = 'create'
}

const openPendingQueue = () => {
  filters.status = metrics.value.reviewing > 0 ? 'reviewing' : metrics.value.submitted > 0 ? 'submitted' : ''
}

const openProcess = () => {
  Object.assign(processForm, {
    year: String(selectedYearNumber.value ?? ''),
    name: admissionProcess.name,
    startsOn: admissionProcess.startsOn,
    endsOn: admissionProcess.endsOn,
  })
  activeModal.value = 'process'
}

const copyPublicLink = async () => {
  await navigator.clipboard?.writeText(publicAdmissionLink.value)
  feedback.value = `Link público copiado: ${publicAdmissionLink.value}`
}

const saveProcess = async () => {
  busy.value = true
  try {
    if (!selectedYearNumber.value) throw new Error('No se pudo resolver el año lectivo actual.')
    const response = await api.saveAdmissionProcess(selectedYearNumber.value, {
      year: selectedYearNumber.value,
      name: processForm.name,
      startsOn: processForm.startsOn,
      endsOn: processForm.endsOn,
    })
    Object.assign(admissionProcess, response.data)
    await loadOverview()
    feedback.value = `${response.message}. Link: ${publicAdmissionLink.value}`
    closeModal()
  } finally {
    busy.value = false
  }
}

const createAdmission = async () => {
  busy.value = true
  try {
    await api.createManualAdmission({
      academicYearId: newAdmission.academicYearId,
      requestedGradeId: newAdmission.requestedGradeId,
      requestedGroupId: newAdmission.requestedGroupId || null,
      source: newAdmission.source,
      student: newAdmission.student,
      guardian: newAdmission.guardian,
    })
    await listViewRef.value?.reload()
    await loadOverview()
    feedback.value = 'Solicitud creada correctamente.'
    closeModal()
  } finally {
    busy.value = false
  }
}

const openStatusAction = (
  item: AdmissionApplicationDto,
  status: 'reviewing' | 'accepted' | 'rejected',
  returnTarget: 'detail' | null = null,
) => {
  actionAdmission.value = item
  modalReturnTarget.value = returnTarget
  statusActionForm.status = status
  statusActionForm.notes =
    selectedAdmissionDetail.value?.application.id === item.id
      ? selectedAdmissionDetail.value.application.notes ?? ''
      : ''
  activeModal.value = 'status'
}

const submitStatusAction = async () => {
  if (!actionAdmission.value) return
  busy.value = true
  try {
    await api.updateAdmissionStatus(actionAdmission.value.id, {
      status: statusActionForm.status,
      notes: statusActionForm.notes.trim() || null,
    })
    await listViewRef.value?.reload()
    await loadOverview()
    if (selectedAdmissionDetail.value?.application.id === actionAdmission.value.id) {
      selectedAdmissionDetail.value.application.status = statusActionForm.status
      selectedAdmissionDetail.value.application.notes = statusActionForm.notes.trim() || null
    }
    feedback.value = `Solicitud actualizada a ${statusLabel(statusActionForm.status)}.`
    if (modalReturnTarget.value === 'detail' && selectedAdmissionDetail.value?.application.id === actionAdmission.value.id) {
      activeModal.value = 'detail'
      actionAdmission.value = null
      modalReturnTarget.value = null
    } else {
      activeModal.value = null
      actionAdmission.value = null
      modalReturnTarget.value = null
    }
  } finally {
    busy.value = false
  }
}

const selectAdmission = async (item: AdmissionApplicationDto) => {
  busy.value = true
  try {
    const response = await api.getAdmissionApplicationDetail(item.id)
    selectedAdmissionDetail.value = response.data
    activeModal.value = 'detail'
  } finally {
    busy.value = false
  }
}

const openConvertModal = (item: AdmissionApplicationDto, returnTarget: 'detail' | null = null) => {
  actionAdmission.value = item
  modalReturnTarget.value = returnTarget
  conversionForm.academicYearId = item.academicYearId
  conversionForm.gradeId = item.requestedGradeId
  conversionForm.groupId = item.requestedGroupId || ''
  conversionForm.enrollmentStatus = 'active'
  conversionForm.enrollmentDate = new Date().toISOString().slice(0, 10)
  activeModal.value = 'convert'
}

const submitConversion = async () => {
  if (!actionAdmission.value) return
  busy.value = true
  try {
    const admission = actionAdmission.value
    await api.convertAdmissionToEnrollment(admission.id, {
      academicYearId: conversionForm.academicYearId,
      gradeId: conversionForm.gradeId,
      groupId: conversionForm.groupId || null,
      enrollmentStatus: conversionForm.enrollmentStatus,
      enrollmentDate: conversionForm.enrollmentDate,
    })
    await listViewRef.value?.reload()
    await loadOverview()
    if (selectedAdmissionDetail.value?.application.id === admission.id) {
      selectedAdmissionDetail.value.application.status = 'converted'
      selectedAdmissionDetail.value.application.convertedEnrollmentId = 'creada'
      selectedAdmissionDetail.value.application.requestedGradeId = conversionForm.gradeId
      selectedAdmissionDetail.value.application.requestedGroupId = conversionForm.groupId || null
      const grade = gradeOptions.value.find((item) => item.id === conversionForm.gradeId)
      const group = conversionCourseOptions.value.find((item) => item.id === conversionForm.groupId)
      selectedAdmissionDetail.value.application.requestedGradeName = grade?.name ?? selectedAdmissionDetail.value.application.requestedGradeName
      selectedAdmissionDetail.value.application.requestedGroupName = group?.name ?? null
    }
    feedback.value = `${admission.studentName} fue convertido a matrícula.`
    if (modalReturnTarget.value === 'detail' && selectedAdmissionDetail.value?.application.id === admission.id) {
      activeModal.value = 'detail'
      actionAdmission.value = null
      modalReturnTarget.value = null
    } else {
      activeModal.value = null
      actionAdmission.value = null
      modalReturnTarget.value = null
    }
  } finally {
    busy.value = false
  }
}

const downloadDocument = async (documentId: string, fileName: string) => {
  busy.value = true
  try {
    await api.downloadAdmissionDocument(documentId, fileName)
    feedback.value = `Descarga iniciada: ${fileName}`
  } finally {
    busy.value = false
  }
}

watch(selectedYear, async () => {
  if (filters.groupId && !filteredAdmissionGroups.value.find((group) => group.id === filters.groupId)) {
    filters.groupId = ''
  }
  await loadProcess()
  await loadOverview()
  resetNewAdmission()
})

watch(
  () => filters.gradeId,
  () => {
    if (!filteredAdmissionGroups.value.find((group) => group.id === filters.groupId)) {
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

.admissions-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  width: 100%;
}

.admissions-toolbar__actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.admissions-queue-tabs {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.admissions-queue-tabs .chip-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.admissions-queue-tabs .chip-button span {
  display: inline-flex;
  min-width: 22px;
  justify-content: center;
  font-size: 0.76rem;
  font-weight: 700;
  color: inherit;
}

.admissions-queue-tabs .chip-button--active {
  background: var(--brand-primary-soft);
  border-color: color-mix(in srgb, var(--brand-primary) 28%, var(--border));
  color: var(--brand-primary);
}

.admissions-advanced-filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  width: 100%;
  padding-top: 0.25rem;
}

.admissions-advanced-filters > * {
  min-width: 180px;
  flex: 1 1 180px;
}

@media (max-width: 900px) {
  .module-inline-summary,
  .admissions-toolbar,
  .admissions-toolbar__actions,
  .admissions-advanced-filters {
    display: grid;
  }

  .module-inline-summary__meta {
    justify-items: start;
    text-align: left;
  }
}
</style>
