<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Boletines" subtitle="Consolida boletin por periodo o boletin final anual con una cola de trabajo mas clara para coordinacion y secretaria.">
      <template #actions>
        <button class="button button--ghost" type="button" :disabled="!reportCard && !annualReportCard" @click="printReportCard">Imprimir</button>
        <button class="button button--brand" type="button" :disabled="loading || !primaryActionEnabled" @click="runPrimaryAction">
          {{ loading ? 'Generando...' : primaryTask.actionLabel }}
        </button>
      </template>
    </PageHeader>

    <section class="module-grid module-grid--split report-cards-workboard">
      <SurfaceCard class="report-cards-focus-card">
        <div class="card-headline">
          <div>
            <h3>Que conviene hacer ahora</h3>
            <p>{{ primaryTask.description }}</p>
          </div>
          <span class="meta-badge meta-badge--green">{{ workspaceModeLabel }}</span>
        </div>

        <div class="module-note-list">
          <article class="module-note-list__item">
            <span>{{ primaryTask.title }}</span>
            <strong>{{ primaryTask.value }}</strong>
            <p>{{ primaryTask.helper }}</p>
          </article>
        </div>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="focusQueue">Ir a la cola</button>
          <button class="button button--brand" type="button" :disabled="loading || !primaryActionEnabled" @click="runPrimaryAction">
            {{ loading ? 'Generando...' : primaryTask.actionLabel }}
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard class="report-cards-context-card">
        <div class="card-headline">
          <div>
            <h3>Contexto del corte</h3>
            <p>{{ contextSummary.description }}</p>
          </div>
        </div>

        <div class="module-note-list">
          <article class="module-note-list__item">
            <span>Ano lectivo</span>
            <strong>{{ contextSummary.academicYear }}</strong>
            <p>Se precarga el ano activo cuando existe contexto institucional.</p>
          </article>
          <article class="module-note-list__item">
            <span>Corte actual</span>
            <strong>{{ contextSummary.period }}</strong>
            <p>{{ contextSummary.periodHelper }}</p>
          </article>
          <article class="module-note-list__item">
            <span>Curso</span>
            <strong>{{ contextSummary.course }}</strong>
            <p>{{ contextSummary.courseHelper }}</p>
          </article>
        </div>
      </SurfaceCard>
    </section>

    <SurfaceCard>
      <div class="report-cards-toolbar">
        <div class="report-cards-modes" role="tablist" aria-label="Modo de trabajo de boletines">
          <button
            v-for="mode in workspaceModes"
            :key="mode.value"
            type="button"
            class="report-cards-mode"
            :class="{ 'report-cards-mode--active': workspaceMode === mode.value }"
            @click="setWorkspaceMode(mode.value)"
          >
            <strong>{{ mode.label }}</strong>
            <span>{{ mode.helper }}</span>
          </button>
        </div>
      </div>

      <form class="form-grid" @submit.prevent="loadReportCard">
        <label>
          Ano lectivo
          <select v-model="filters.academicYearId" required>
            <option value="">Seleccione</option>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Tipo de boletin
          <select v-model="filters.reportType">
            <option value="period">Periodo</option>
            <option value="annual">Final anual</option>
          </select>
        </label>
        <label v-if="filters.reportType === 'period'">
          Periodo
          <select v-model="filters.academicPeriodId" required>
            <option value="">Seleccione</option>
            <option v-for="period in filteredPeriods" :key="period.id" :value="period.id">
              {{ period.name }}
            </option>
          </select>
        </label>
        <label>
          Curso
          <select v-model="filters.groupId" required>
            <option value="">Seleccione</option>
            <option v-for="course in filteredCourses" :key="course.id" :value="course.id">{{ course.gradeName }} · {{ course.name }}</option>
          </select>
        </label>
        <label v-if="workspaceMode === 'individual'">
          Estudiante
          <select v-model="filters.studentId" required :disabled="loadingStudents || !filters.groupId">
            <option value="">{{ loadingStudents ? 'Cargando...' : 'Seleccione' }}</option>
            <option v-for="item in availableStudents" :key="item.studentId" :value="item.studentId">
              {{ item.studentName }}
            </option>
          </select>
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="resetFilters">Limpiar</button>
          <button class="button button--brand" type="submit" :disabled="loading || !canLoad">Generar</button>
        </div>
      </form>
    </SurfaceCard>

    <section v-if="filters.groupId" ref="queueSectionRef" class="module-grid module-grid--split report-cards-queue">
      <SurfaceCard class="report-cards-queue-card">
        <div class="card-headline">
          <div>
            <h3>{{ queueTitle }}</h3>
            <p>{{ queueDescription }}</p>
          </div>
          <span class="meta-badge meta-badge--amber">{{ queueStudents.length }} estudiantes</span>
        </div>

        <div v-if="queueStudents.length" class="report-cards-student-list">
          <button
            v-for="student in queueStudents"
            :key="student.studentId"
            type="button"
            class="report-cards-student-item"
            :class="{ 'report-cards-student-item--active': filters.studentId === student.studentId }"
            @click="selectStudent(student.studentId, workspaceMode !== 'individual')"
          >
            <div>
              <strong>{{ student.studentName }}</strong>
              <span>{{ student.studentDocument }}</span>
            </div>
            <small>{{ studentStatusLabel(student) }}</small>
          </button>
        </div>
        <p v-else class="tracking-empty">Selecciona un curso para cargar la cola de estudiantes.</p>
      </SurfaceCard>

      <SurfaceCard class="report-cards-queue-card">
        <div class="card-headline">
          <div>
            <h3>Siguiente accion</h3>
            <p>{{ queueActionDescription }}</p>
          </div>
        </div>

        <div class="module-note-list">
          <article class="module-note-list__item">
            <span>Estudiante seleccionado</span>
            <strong>{{ selectedStudentName }}</strong>
            <p>{{ selectedStudentHelper }}</p>
          </article>
          <article class="module-note-list__item">
            <span>Modo de salida</span>
            <strong>{{ reportTypeLabel }}</strong>
            <p>{{ reportTypeHelper }}</p>
          </article>
          <article class="module-note-list__item">
            <span>Uso sugerido</span>
            <strong>{{ workspaceModeUsage.title }}</strong>
            <p>{{ workspaceModeUsage.helper }}</p>
          </article>
        </div>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" :disabled="!queueStudents.length" @click="selectNextStudent">Siguiente estudiante</button>
          <button class="button button--brand" type="button" :disabled="loading || !canLoad" @click="loadReportCard">
            {{ loading ? 'Generando...' : 'Generar boletin seleccionado' }}
          </button>
        </div>
      </SurfaceCard>
    </section>

    <SurfaceCard v-if="filters.reportType === 'period' && reportCard" class="report-card">
      <div class="report-card__header">
        <div>
          <p class="report-card__eyebrow">Boletin del periodo</p>
          <h2>{{ reportCard.student.fullName }}</h2>
          <p>{{ reportCard.student.document }}</p>
        </div>
        <div class="report-card__meta">
          <span>{{ reportCard.academicYear.name }}</span>
          <span>{{ reportCard.academicPeriod.name }} · {{ translatePeriodStatus(reportCard.academicPeriod.status) }}</span>
          <span>{{ reportCard.enrollment.gradeName }}{{ reportCard.enrollment.groupName ? ` · ${reportCard.enrollment.groupName}` : '' }}</span>
          <span v-if="reportCard.groupDirector">Director de grupo: {{ reportCard.groupDirector }}</span>
        </div>
      </div>

      <div class="report-card__summary">
        <article>
          <span>Promedio del periodo</span>
          <strong>{{ reportCard.summary.averageScore !== null ? formatScore(reportCard.summary.averageScore, reportCard.scale.decimalPlaces) : 'Pendiente' }}</strong>
          <small>{{ reportCard.summary.subjectsWithGrades }}/{{ reportCard.summary.totalSubjects }} materias calificadas</small>
        </article>
        <article>
          <span>Escala aplicada</span>
          <strong>{{ reportCard.scale.name }}</strong>
          <small>{{ reportCard.scale.scaleType === 'numeric' ? `Aprueba desde ${formatScore(reportCard.scale.passingValue, reportCard.scale.decimalPlaces)} / ${formatScore(reportCard.scale.maxValue, reportCard.scale.decimalPlaces)}` : `Rango institucional: ${formatScore(reportCard.scale.minValue, reportCard.scale.decimalPlaces)} a ${formatScore(reportCard.scale.maxValue, reportCard.scale.decimalPlaces)}` }}</small>
        </article>
        <article>
          <span>Asistencia del periodo</span>
          <strong>{{ reportCard.summary.attendance.absent }} fallas</strong>
          <small>{{ reportCard.summary.attendance.late }} retardos · {{ reportCard.summary.attendance.excused }} excusas</small>
        </article>
        <article>
          <span>Planes de apoyo</span>
          <strong>{{ reportCard.summary.pendingSupportStrategies }}</strong>
          <small>Pendientes por cerrar</small>
        </article>
      </div>

      <div class="list-view__table-wrap">
        <table class="list-view__table">
          <thead>
            <tr>
              <th>Materia</th>
              <th>Area</th>
              <th>Docente</th>
              <th>{{ reportCard.scale.scaleType === 'numeric' ? 'Nota' : 'Valor base' }}</th>
              <th>Desempeno</th>
              <th>Asistencia</th>
              <th>Seguimiento</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="subject in reportCard.subjects" :key="subject.subjectId">
              <td>
                <strong>{{ subject.subjectName }}</strong>
                <small v-if="subject.notes" class="table-note">{{ subject.notes }}</small>
              </td>
              <td>{{ subject.academicAreaName || 'Sin area' }}</td>
              <td>{{ subject.teacherName || 'Sin asignar' }}</td>
              <td>
                <strong v-if="subject.gradeValue && reportCard.scale.scaleType !== 'numeric'">{{ subject.gradeValue }}</strong>
                <span v-else>{{ subject.score !== null && subject.score !== undefined ? formatScore(subject.score, reportCard.scale.decimalPlaces) : 'Pendiente' }}</span>
                <small v-if="subject.gradeValue && reportCard.scale.scaleType !== 'numeric' && subject.score !== null && subject.score !== undefined" class="table-note">
                  Base: {{ formatScore(subject.score, reportCard.scale.decimalPlaces) }}
                </small>
              </td>
              <td>
                <strong v-if="subject.performanceLevel">{{ subject.institutionalLabel || subject.performanceLevel }}</strong>
                <small v-if="subject.performanceLevel" class="table-note">{{ subject.performanceLevel }}</small>
                <span v-else>Pendiente</span>
              </td>
              <td>
                <strong>{{ subject.attendance.absent }} fallas</strong>
                <small class="table-note">{{ subject.attendance.late }} retardos · {{ subject.attendance.excused }} excusas</small>
              </td>
              <td>
                <div class="subject-tracking">
                  <p v-if="subject.observations.length === 0 && subject.supportStrategies.length === 0" class="tracking-empty">Sin novedades.</p>
                  <div v-for="observation in subject.observations" :key="observation.id" class="tracking-chip">
                    <strong>{{ translateObservationType(observation.type) }}:</strong> {{ observation.text }}
                  </div>
                  <div v-for="strategy in subject.supportStrategies" :key="strategy.id" class="tracking-chip tracking-chip--support">
                    <strong>{{ translateSupportStatus(strategy.status) }}:</strong> {{ strategy.description }}
                    <span v-if="strategy.resultScore !== null && strategy.resultScore !== undefined"> ({{ formatScore(strategy.resultScore, reportCard.scale.decimalPlaces) }})</span>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="report-card__footer">
        Generado el {{ formatDateTime(reportCard.generatedAt) }}. Este boletin refleja la informacion registrada en el periodo seleccionado.
      </p>
    </SurfaceCard>

    <SurfaceCard v-else-if="filters.reportType === 'annual' && annualReportCard" class="report-card">
      <div class="report-card__header">
        <div>
          <p class="report-card__eyebrow">Boletin final anual</p>
          <h2>{{ annualReportCard.student.fullName }}</h2>
          <p>{{ annualReportCard.student.document }}</p>
        </div>
        <div class="report-card__meta">
          <span>{{ annualReportCard.academicYear.name }}</span>
          <span>{{ annualReportCard.enrollment.gradeName }}{{ annualReportCard.enrollment.groupName ? ` · ${annualReportCard.enrollment.groupName}` : '' }}</span>
          <span>Promocion: {{ translatePromotionStatus(annualReportCard.enrollment.promotionStatus) }}</span>
          <span v-if="annualReportCard.groupDirector">Director de grupo: {{ annualReportCard.groupDirector }}</span>
        </div>
      </div>

      <div class="report-card__summary">
        <article>
          <span>Promedio anual</span>
          <strong>{{ annualReportCard.summary.annualAverage !== null ? formatScore(annualReportCard.summary.annualAverage, annualReportCard.scale.decimalPlaces) : 'Pendiente' }}</strong>
          <small>{{ annualReportCard.summary.subjectsWithScores }}/{{ annualReportCard.summary.totalSubjects }} materias consolidadas</small>
        </article>
        <article>
          <span>Escala aplicada</span>
          <strong>{{ annualReportCard.scale.name }}</strong>
          <small>{{ annualReportCard.scale.scaleType === 'numeric' ? `Aprueba desde ${formatScore(annualReportCard.scale.passingValue, annualReportCard.scale.decimalPlaces)} / ${formatScore(annualReportCard.scale.maxValue, annualReportCard.scale.decimalPlaces)}` : `Rango institucional: ${formatScore(annualReportCard.scale.minValue, annualReportCard.scale.decimalPlaces)} a ${formatScore(annualReportCard.scale.maxValue, annualReportCard.scale.decimalPlaces)}` }}</small>
        </article>
        <article>
          <span>Resultado final</span>
          <strong>{{ translatePromotionStatus(annualReportCard.enrollment.promotionStatus) }}</strong>
          <small>{{ annualReportCard.summary.failedSubjects }} materias perdidas</small>
        </article>
        <article>
          <span>Asistencia anual</span>
          <strong>{{ annualReportCard.summary.attendance.absent }} fallas</strong>
          <small>{{ annualReportCard.summary.attendance.late }} retardos · {{ annualReportCard.summary.attendance.excused }} excusas</small>
        </article>
        <article>
          <span>Planes de apoyo</span>
          <strong>{{ annualReportCard.summary.pendingSupportStrategies }}</strong>
          <small>Pendientes por cerrar</small>
        </article>
      </div>

      <div class="list-view__table-wrap">
        <table class="list-view__table">
          <thead>
            <tr>
              <th>Materia</th>
              <th>{{ annualReportCard.scale.scaleType === 'numeric' ? 'Definitiva anual' : 'Valor anual' }}</th>
              <th>Desempeno</th>
              <th>Periodos</th>
              <th>Seguimiento</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="subject in annualReportCard.subjects" :key="subject.subjectId">
              <td>
                <strong>{{ subject.subjectName }}</strong>
                <small class="table-note">{{ subject.academicAreaName || 'Sin area' }} · {{ subject.teacherName || 'Sin docente' }}</small>
              </td>
              <td>
                <strong v-if="subject.annualGradeValue && annualReportCard.scale.scaleType !== 'numeric'">{{ subject.annualGradeValue }}</strong>
                <span v-else>{{ subject.annualScore !== null && subject.annualScore !== undefined ? formatScore(subject.annualScore, annualReportCard.scale.decimalPlaces) : 'Pendiente' }}</span>
                <small v-if="subject.annualGradeValue && annualReportCard.scale.scaleType !== 'numeric' && subject.annualScore !== null && subject.annualScore !== undefined" class="table-note">
                  Base: {{ formatScore(subject.annualScore, annualReportCard.scale.decimalPlaces) }}
                </small>
              </td>
              <td>
                <strong v-if="subject.performanceLevel">{{ subject.institutionalLabel || subject.performanceLevel }}</strong>
                <small v-if="subject.performanceLevel" class="table-note">{{ subject.performanceLevel }}</small>
                <span v-else>Pendiente</span>
              </td>
              <td>
                <div class="subject-tracking">
                  <div v-for="period in subject.periodScores" :key="period.academicPeriodId" class="tracking-chip">
                    <strong>{{ period.academicPeriodName }}:</strong>
                    {{ period.score !== null && period.score !== undefined ? formatScore(period.score, annualReportCard.scale.decimalPlaces) : 'Pendiente' }}
                    <span class="table-note">({{ period.weight }}%)</span>
                  </div>
                </div>
              </td>
              <td>
                <div class="subject-tracking">
                  <p v-if="subject.observations.length === 0 && subject.supportStrategies.length === 0" class="tracking-empty">Sin novedades.</p>
                  <div v-for="observation in subject.observations" :key="observation.id" class="tracking-chip">
                    <strong>{{ translateObservationType(observation.type) }}:</strong> {{ observation.text }}
                  </div>
                  <div v-for="strategy in subject.supportStrategies" :key="strategy.id" class="tracking-chip tracking-chip--support">
                    <strong>{{ translateSupportStatus(strategy.status) }}:</strong> {{ strategy.description }}
                    <span v-if="strategy.resultScore !== null && strategy.resultScore !== undefined"> ({{ formatScore(strategy.resultScore, annualReportCard.scale.decimalPlaces) }})</span>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="report-card__footer">
        Generado el {{ formatDateTime(annualReportCard.generatedAt) }}. Este boletin final consolida todos los periodos del ano lectivo.
      </p>
    </SurfaceCard>

    <SurfaceCard v-else variant="ghost">
      <p>{{ emptyStateMessage }}</p>
    </SurfaceCard>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { AcademicPeriodDto, AcademicYearDto, AnnualStudentReportCardDto, CourseDto, EnrollmentDto, StudentReportCardDto } from '@ofir/shared'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'
import { useAcademicContextStore } from '../stores/academic-context'

const academicContext = useAcademicContextStore()
const loading = ref(false)
const loadingStudents = ref(false)
const feedback = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const periods = ref<AcademicPeriodDto[]>([])
const courses = ref<CourseDto[]>([])
const availableStudents = ref<EnrollmentDto[]>([])
const reportCard = ref<StudentReportCardDto | null>(null)
const annualReportCard = ref<AnnualStudentReportCardDto | null>(null)
const queueSectionRef = ref<HTMLElement | null>(null)
const workspaceMode = ref<'individual' | 'course' | 'ready'>('individual')

const filters = reactive({
  reportType: 'period' as 'period' | 'annual',
  academicYearId: '',
  academicPeriodId: '',
  groupId: '',
  studentId: '',
})

const workspaceModes = [
  { value: 'individual' as const, label: 'Boletin individual', helper: 'Para generar un estudiante puntual.' },
  { value: 'course' as const, label: 'Boletines del curso', helper: 'Para recorrer el grupo sin rearmar filtros.' },
  { value: 'ready' as const, label: 'Listos para imprimir', helper: 'Para trabajar solo la cola del corte actual.' },
]

const filteredPeriods = computed(() => periods.value.filter((period) => period.academicYearId === filters.academicYearId))
const filteredCourses = computed(() => courses.value.filter((course) => course.academicYearId === filters.academicYearId))
const selectedYearNumber = computed(() => academicYears.value.find((item) => item.id === filters.academicYearId)?.year ?? null)
const selectedPeriod = computed(() => filteredPeriods.value.find((item) => item.id === filters.academicPeriodId) ?? null)
const selectedCourse = computed(() => filteredCourses.value.find((item) => item.id === filters.groupId) ?? null)
const selectedStudent = computed(() => availableStudents.value.find((item) => item.studentId === filters.studentId) ?? null)
const canLoad = computed(() =>
  Boolean(
    filters.academicYearId &&
      filters.groupId &&
      filters.studentId &&
      (filters.reportType === 'annual' || filters.academicPeriodId),
  ),
)
const workspaceModeLabel = computed(() => workspaceModes.find((mode) => mode.value === workspaceMode.value)?.label ?? 'Boletines')
const reportTypeLabel = computed(() => (filters.reportType === 'annual' ? 'Final anual' : 'Periodo'))
const queueStudents = computed(() => {
  if (workspaceMode.value !== 'ready') return availableStudents.value

  return availableStudents.value.filter((student) => {
    if (filters.reportType === 'annual') return student.promotionStatus !== 'pending'
    return selectedPeriod.value?.status === 'published' || selectedPeriod.value?.status === 'closed'
  })
})
const contextSummary = computed(() => ({
  academicYear: academicYears.value.find((item) => item.id === filters.academicYearId)?.name ?? 'Sin seleccionar',
  period:
    filters.reportType === 'annual'
      ? 'Cierre anual'
      : selectedPeriod.value
        ? `${selectedPeriod.value.name} · ${translatePeriodStatus(selectedPeriod.value.status)}`
        : 'Sin periodo seleccionado',
  periodHelper:
    filters.reportType === 'annual'
      ? 'Este modo consolida todos los periodos del ano lectivo y usa la decision final de promocion.'
      : selectedPeriod.value
        ? 'Conviene publicar o cerrar el periodo antes de imprimir boletines masivos.'
        : 'Selecciona el periodo para preparar el corte academico.',
  course: selectedCourse.value ? `${selectedCourse.value.gradeName} · ${selectedCourse.value.name}` : 'Sin curso seleccionado',
  courseHelper: selectedCourse.value ? 'La cola de estudiantes se carga a partir de este curso.' : 'Selecciona un curso para trabajar por cohorte.',
  description:
    filters.reportType === 'annual'
      ? 'Usa esta salida para cierre anual, promocion y entrega final a familias.'
      : 'Usa esta salida para cortes de periodo y revision antes del cierre definitivo.',
}))
const primaryTask = computed(() => {
  if (!filters.groupId) {
    return {
      title: 'Siguiente paso',
      value: 'Seleccionar curso',
      helper: 'Primero elige el curso para cargar la cola de estudiantes y trabajar con un solo contexto.',
      description: 'La vista se vuelve mucho mas rapida cuando arrancas desde un curso y no desde un estudiante suelto.',
      actionLabel: 'Preparar curso',
    }
  }

  if (!filters.studentId && queueStudents.value[0]) {
    return {
      title: 'Cola disponible',
      value: `${queueStudents.value.length} estudiantes`,
      helper: 'Ya puedes seleccionar el primer estudiante de la cola y generar su boletin.',
      description: 'El curso ya esta listo. El siguiente paso es empezar a recorrer la cola de boletines.',
      actionLabel: 'Tomar primer estudiante',
    }
  }

  if (canLoad.value) {
    return {
      title: 'Boletin listo para generar',
      value: selectedStudent.value?.studentName ?? 'Estudiante seleccionado',
      helper: 'Con este contexto ya no necesitas tocar mas filtros para generar la salida academica.',
      description: 'El corte ya esta armado. Ahora conviene generar el boletin y seguir con el siguiente estudiante.',
      actionLabel: 'Generar boletin',
    }
  }

  return {
    title: 'Contexto incompleto',
    value: workspaceModeLabel.value,
    helper: 'Completa ano, curso y estudiante para destrabar la generacion.',
    description: 'Todavia faltan datos para generar el boletin seleccionado.',
    actionLabel: 'Ir a la cola',
  }
})
const primaryActionEnabled = computed(() => Boolean(filters.groupId && (canLoad.value || queueStudents.value[0])))
const queueTitle = computed(() => {
  if (workspaceMode.value === 'course') return 'Boletines del curso'
  if (workspaceMode.value === 'ready') return 'Boletines listos para imprimir'
  return 'Estudiantes del curso'
})
const queueDescription = computed(() => {
  if (workspaceMode.value === 'course') return 'Recorre el grupo sin volver a seleccionar curso y ano en cada boletin.'
  if (workspaceMode.value === 'ready') return 'La cola se filtra para mostrar primero estudiantes listos en este corte.'
  return 'Selecciona un estudiante puntual o usa la cola para avanzar mas rapido.'
})
const queueActionDescription = computed(() => {
  if (workspaceMode.value === 'course') return 'Pensado para secretaria o coordinacion cuando deben sacar varios boletines seguidos.'
  if (workspaceMode.value === 'ready') return 'Pensado para el momento de impresion, con menos ruido operativo.'
  return 'Pensado para consultas individuales o casos especiales.'
})
const selectedStudentName = computed(() => selectedStudent.value?.studentName ?? 'Sin seleccionar')
const selectedStudentHelper = computed(() =>
  selectedStudent.value
    ? `${selectedStudent.value.gradeName}${selectedStudent.value.groupName ? ` · ${selectedStudent.value.groupName}` : ''}`
    : 'Elige un estudiante desde la cola para continuar.',
)
const reportTypeHelper = computed(() =>
  filters.reportType === 'annual'
    ? 'Consolida el ano completo con promedio, periodos y promocion final.'
    : 'Consolida el corte actual con desempeno, asistencia y seguimiento.',
)
const workspaceModeUsage = computed(() => {
  if (workspaceMode.value === 'course') {
    return {
      title: 'Recorrido por cohorte',
      helper: 'Ideal cuando el colegio necesita procesar un curso completo de forma continua.',
    }
  }
  if (workspaceMode.value === 'ready') {
    return {
      title: 'Momento de entrega',
      helper: 'Ideal cuando el periodo ya fue publicado o el ano ya tiene cierre aplicado.',
    }
  }
  return {
    title: 'Caso puntual',
    helper: 'Ideal para reimpresiones, consultas individuales o seguimiento a un estudiante concreto.',
  }
})
const emptyStateMessage = computed(() => {
  if (!filters.groupId) return 'Selecciona ano, curso y tipo de boletin para cargar la cola academica del grupo.'
  if (!filters.studentId) return 'Selecciona un estudiante en la cola para generar el consolidado academico.'
  return 'Genera el boletin seleccionado para ver el consolidado academico.'
})

const pickDefaultPeriodId = (academicYearId: string) =>
  periods.value.find((period) => period.academicYearId === academicYearId && period.status === 'published')?.id ??
  periods.value.find((period) => period.academicYearId === academicYearId && period.status === 'open')?.id ??
  periods.value.find((period) => period.academicYearId === academicYearId)?.id ??
  ''

const loadCatalogs = async () => {
  const [yearsResponse, periodsResponse, coursesResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getAcademicPeriods({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
  ])

  academicYears.value = yearsResponse.data.items
  periods.value = periodsResponse.data.items
  courses.value = coursesResponse.data.items
  filters.academicYearId ||= academicContext.activeYearId || academicYears.value[0]?.id || ''
  filters.academicPeriodId ||= pickDefaultPeriodId(filters.academicYearId)
}

const loadStudents = async () => {
  if (!selectedYearNumber.value || !filters.groupId) {
    availableStudents.value = []
    filters.studentId = ''
    return
  }

  loadingStudents.value = true
  try {
    const response = await api.getEnrollments({
      year: selectedYearNumber.value,
      groupId: filters.groupId,
      page: 1,
      pageSize: 200,
    })
    availableStudents.value = response.data.items
    if (!availableStudents.value.some((item) => item.studentId === filters.studentId)) {
      filters.studentId = workspaceMode.value === 'individual' ? '' : queueStudents.value[0]?.studentId ?? ''
    }
  } catch (error) {
    availableStudents.value = []
    filters.studentId = ''
    feedback.value = error instanceof Error ? error.message : 'No fue posible cargar los estudiantes del curso.'
  } finally {
    loadingStudents.value = false
  }
}

const loadReportCard = async () => {
  if (!canLoad.value) return
  loading.value = true
  feedback.value = ''
  try {
    if (filters.reportType === 'annual') {
      const response = await api.getAnnualStudentReportCard({
        academicYearId: filters.academicYearId,
        studentId: filters.studentId,
      })
      annualReportCard.value = response.data
      reportCard.value = null
    } else {
      const response = await api.getStudentReportCard({
        academicYearId: filters.academicYearId,
        academicPeriodId: filters.academicPeriodId,
        studentId: filters.studentId,
      })
      reportCard.value = response.data
      annualReportCard.value = null
    }
  } catch (error) {
    reportCard.value = null
    annualReportCard.value = null
    feedback.value = error instanceof Error ? error.message : 'No fue posible generar el boletin.'
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.academicPeriodId = pickDefaultPeriodId(filters.academicYearId)
  filters.groupId = ''
  filters.studentId = ''
  availableStudents.value = []
  reportCard.value = null
  annualReportCard.value = null
  feedback.value = ''
}

const printReportCard = () => {
  if (typeof window !== 'undefined') {
    window.print()
  }
}

const setWorkspaceMode = (mode: 'individual' | 'course' | 'ready') => {
  workspaceMode.value = mode
  if (mode !== 'individual' && !filters.studentId && queueStudents.value[0]) {
    filters.studentId = queueStudents.value[0].studentId
  }
}

const studentStatusLabel = (student: EnrollmentDto) => {
  if (filters.reportType === 'annual') return translatePromotionStatus(student.promotionStatus)
  if (selectedPeriod.value?.status === 'closed') return 'Corte cerrado'
  if (selectedPeriod.value?.status === 'published') return 'Listo para imprimir'
  return 'En preparacion'
}

const selectStudent = async (studentId: string, autoLoad = false) => {
  filters.studentId = studentId
  if (autoLoad && canLoad.value) {
    await loadReportCard()
  }
}

const selectNextStudent = async () => {
  if (!queueStudents.value.length) return
  const currentIndex = queueStudents.value.findIndex((student) => student.studentId === filters.studentId)
  const next = queueStudents.value[currentIndex + 1] ?? queueStudents.value[0]
  await selectStudent(next.studentId, workspaceMode.value !== 'individual')
}

const focusQueue = async () => {
  await nextTick()
  queueSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const runPrimaryAction = async () => {
  if (!filters.groupId) {
    await focusQueue()
    return
  }

  if (!filters.studentId && queueStudents.value[0]) {
    await selectStudent(queueStudents.value[0].studentId, workspaceMode.value !== 'individual')
    return
  }

  if (canLoad.value) {
    await loadReportCard()
    return
  }

  await focusQueue()
}

const formatScore = (value: number, decimalPlaces = 2) => value.toFixed(decimalPlaces)

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

const translateObservationType = (value: string) => {
  if (value === 'strength') return 'Fortaleza'
  if (value === 'difficulty') return 'Dificultad'
  if (value === 'recommendation') return 'Recomendacion'
  if (value === 'recovery_plan') return 'Plan de recuperacion'
  return 'General'
}

const translateSupportStatus = (value: string) => {
  if (value === 'approved') return 'Recuperado'
  if (value === 'rejected') return 'No recuperado'
  return 'Pendiente'
}

const translatePeriodStatus = (value: string) => {
  if (value === 'closed') return 'cerrado'
  if (value === 'published') return 'publicado'
  return 'abierto'
}

const translatePromotionStatus = (value?: string | null) => {
  if (value === 'promoted') return 'Promovido'
  if (value === 'conditional') return 'Condicional'
  if (value === 'not_promoted') return 'No promovido'
  return 'Pendiente'
}

watch(() => [filters.academicYearId, filters.groupId], loadStudents)
watch(() => filters.academicYearId, () => {
  filters.academicPeriodId = pickDefaultPeriodId(filters.academicYearId)
  filters.groupId = ''
  filters.studentId = ''
  availableStudents.value = []
  reportCard.value = null
  annualReportCard.value = null
})
watch(() => filters.academicPeriodId, () => {
  reportCard.value = null
  annualReportCard.value = null
})
watch(() => filters.studentId, () => {
  reportCard.value = null
  annualReportCard.value = null
})
watch(() => filters.reportType, () => {
  reportCard.value = null
  annualReportCard.value = null
})
watch(queueStudents, (students) => {
  if (!students.length) {
    filters.studentId = workspaceMode.value === 'individual' ? filters.studentId : ''
    return
  }
  if (!students.some((student) => student.studentId === filters.studentId) && workspaceMode.value !== 'individual') {
    filters.studentId = students[0]?.studentId ?? ''
  }
})

onMounted(loadCatalogs)
</script>

<style scoped>
.report-cards-workboard,
.report-cards-queue {
  align-items: stretch;
}

.report-cards-focus-card,
.report-cards-context-card,
.report-cards-queue-card {
  display: grid;
  gap: 1rem;
}

.report-cards-toolbar {
  display: grid;
  gap: 1rem;
  margin-bottom: 1rem;
}

.report-cards-modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.report-cards-mode {
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: transparent;
  display: grid;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  text-align: left;
}

.report-cards-mode strong {
  font-size: 0.95rem;
}

.report-cards-mode span {
  color: var(--muted-foreground, #667085);
  font-size: 0.82rem;
  line-height: 1.35;
}

.report-cards-mode--active {
  background: color-mix(in srgb, var(--brand, #0f766e) 12%, white);
  border-color: color-mix(in srgb, var(--brand, #0f766e) 34%, var(--border-color));
}

.report-cards-student-list {
  display: grid;
  gap: 0.65rem;
  max-height: 28rem;
  overflow: auto;
}

.report-cards-student-item {
  align-items: center;
  background: color-mix(in srgb, var(--surface-2, #f8fafc) 94%, white);
  border: 1px solid transparent;
  border-radius: 0.9rem;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  padding: 0.85rem 0.95rem;
  text-align: left;
}

.report-cards-student-item strong,
.report-cards-student-item span,
.report-cards-student-item small {
  display: block;
}

.report-cards-student-item span,
.report-cards-student-item small {
  color: var(--muted-foreground, #667085);
}

.report-cards-student-item--active {
  border-color: color-mix(in srgb, var(--brand, #0f766e) 34%, var(--border-color));
  background: color-mix(in srgb, var(--brand, #0f766e) 10%, white);
}

.report-card {
  gap: 1.25rem;
}

.report-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.report-card__header h2 {
  margin: 0.15rem 0;
}

.report-card__eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: var(--muted-foreground, #667085);
}

.report-card__meta {
  display: grid;
  gap: 0.35rem;
  color: var(--muted-foreground, #667085);
  font-size: 0.92rem;
}

.report-card__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.9rem;
}

.report-card__summary article {
  padding: 1rem;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--surface-2, #f8fafc) 92%, white);
  display: grid;
  gap: 0.35rem;
}

.report-card__summary span,
.report-card__summary small,
.table-note,
.tracking-empty {
  color: var(--muted-foreground, #667085);
}

.report-card__summary strong {
  font-size: 1.35rem;
}

.table-note {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
}

.subject-tracking {
  display: grid;
  gap: 0.4rem;
}

.tracking-chip {
  padding: 0.5rem 0.65rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--surface-2, #f8fafc) 94%, white);
  font-size: 0.84rem;
  line-height: 1.35;
}

.tracking-chip--support {
  background: color-mix(in srgb, #ecfdf3 92%, white);
}

.report-card__footer {
  margin: 0;
  color: var(--muted-foreground, #667085);
  font-size: 0.85rem;
}

@media print {
  .button,
  .action-feedback,
  .page-header__actions,
  .stack > :first-child,
  .stack > :nth-child(2),
  .stack > :nth-child(3),
  .stack > :nth-child(4) {
    display: none !important;
  }

  .report-card {
    box-shadow: none;
    border: none;
    padding: 0;
  }
}
</style>
