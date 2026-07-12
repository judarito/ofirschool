<template>
  <section class="stack">
    <PageHeader eyebrow="Calificador" :title="`Registrar Notas: ${activity?.name || 'Actividad'}`" :subtitle="activitySubtitle">
      <template #actions>
        <button 
          class="button button--ghost" 
          type="button" 
          @click="goBack"
        >
          Volver a actividades
        </button>
        <button 
          class="button button--brand" 
          type="button" 
          :disabled="saving || isPeriodLocked || !activity" 
          @click="saveScores"
        >
          {{ saving ? 'Guardando...' : 'Guardar Calificaciones' }}
        </button>
      </template>
    </PageHeader>

    <!-- Alerta de periodo cerrado -->
    <div v-if="isPeriodLocked" class="alert alert--warning">
      ⚠️ El periodo académico para esta actividad se encuentra <strong>{{ periodStatusLabel }}</strong>. Las calificaciones no pueden ser modificadas.
    </div>

    <!-- Cargar datos -->
    <SurfaceCard v-if="loading" class="empty-state">
      Cargando planilla de estudiantes...
    </SurfaceCard>

    <!-- Formulario / Tabla de notas -->
    <SurfaceCard v-else-if="students.length > 0">
      <div class="card-headline">
        <div>
          <h3>Planilla de Calificaciones</h3>
          <p class="text-xs text-gray-500 mt-1">
            Ingresa las notas de cada estudiante. Escala aplicada: <strong>{{ activeScale?.name || 'Cargando escala...' }}</strong>
            <span v-if="activeScale">
              ({{ scoreLabel }}: {{ activeScale.minValue }} - {{ activeScale.maxValue }})
            </span>
          </p>
        </div>
        <div class="flex gap-2">
          <button 
            v-if="!isPeriodLocked"
            class="button button--ghost button--sm" 
            type="button" 
            @click="fillDefaultScores"
          >
            Copiar nota base
          </button>
          <button 
            class="button button--brand button--sm" 
            type="button" 
            :disabled="saving || isPeriodLocked" 
            @click="saveScores"
          >
            {{ saving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>

      <div class="list-view__table-wrap">
        <table class="list-view__table">
          <thead>
            <tr>
              <th width="30%">Estudiante</th>
              <th width="15%">Documento</th>
              <th width="15%">{{ scoreLabel }} <span v-if="activity">(Máx. {{ activity?.maxScore }})</span></th>
              <th width="15%">Desempeño</th>
              <th width="25%">Observación / Retroalimentación</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.studentId">
              <td>
                <strong class="text-gray-900">{{ student.studentName }}</strong>
              </td>
              <td>{{ student.studentDocument }}</td>
              <td>
                <select
                  v-if="usesVisibleScaleSelection"
                  :value="student.gradeValue ?? ''"
                  class="score-input"
                  :disabled="isPeriodLocked"
                  @change="applyVisibleSelection(student, (($event.target as HTMLSelectElement | null)?.value) ?? '')"
                >
                  <option value="">Seleccione</option>
                  <option v-for="option in visibleScaleOptions" :key="option.label" :value="option.label">
                    {{ option.label }}
                  </option>
                </select>
                <input 
                  v-else
                  v-model.number="student.score" 
                  type="number" 
                  min="0" 
                  :max="activity?.maxScore" 
                  step="0.01" 
                  placeholder="0.0" 
                  class="score-input"
                  :disabled="isPeriodLocked"
                  @input="onScoreInput(student)"
                />
                <small v-if="usesVisibleScaleSelection && student.score !== null && student.score !== undefined && student.score !== ''" class="table-note">
                  Base: {{ formatScore(Number(student.score)) }}
                </small>
              </td>
              <td>
                <span 
                  v-if="student.score !== null && student.score !== undefined && student.score !== ''" 
                  :class="['meta-badge', getPerformanceBadgeClass(student.performanceLevel)]"
                >
                  {{ translatePerformanceLevel(student.performanceLevel) }}
                </span>
                <span v-else class="text-gray-400 text-xs">Sin calificar</span>
              </td>
              <td>
                <input 
                  v-model="student.observations" 
                  placeholder="Ej. Excelente trabajo, requiere mejorar..." 
                  class="obs-input"
                  :disabled="isPeriodLocked"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-end gap-2 mt-6">
        <button class="button button--ghost" type="button" @click="goBack">Cancelar</button>
        <button 
          class="button button--brand" 
          type="button" 
          :disabled="saving || isPeriodLocked" 
          @click="saveScores"
        >
          {{ saving ? 'Guardando...' : 'Guardar Calificaciones' }}
        </button>
      </div>
    </SurfaceCard>

    <SurfaceCard v-else class="empty-state">
      <p>No se encontraron estudiantes matriculados en este curso.</p>
      <button class="button button--ghost mt-4" type="button" @click="goBack">Volver</button>
    </SurfaceCard>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>

    <!-- Modal Relleno por defecto -->
    <FormModal :open="isFillModalOpen" title="Copiar Nota Base a Todos" @close="isFillModalOpen = false">
      <form class="form-grid" @submit.prevent="applyDefaultScores">
        <label class="form-grid__wide">
          <span v-if="usesVisibleScaleSelection">Selecciona la valoración que deseas copiar a todos los estudiantes sin nota registrada:</span>
          <span v-else>Ingresa la calificación que deseas copiar a todos los estudiantes sin nota registrada:</span>
          <select v-if="usesVisibleScaleSelection" v-model="defaultVisibleScoreLabel" required>
            <option value="">Seleccione</option>
            <option v-for="option in visibleScaleOptions" :key="option.label" :value="option.label">{{ option.label }}</option>
          </select>
          <input v-else v-model.number="defaultScoreValue" type="number" min="0" :max="activity?.maxScore" step="0.1" required />
        </label>
        <div class="modal-actions col-span-2">
          <button class="button button--ghost" type="button" @click="isFillModalOpen = false">Cancelar</button>
          <button class="button button--brand" type="submit">Aplicar</button>
        </div>
      </form>
    </FormModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { 
  AppliedGradingScaleDto,
  EvaluationActivityDto,
} from '@ofir/shared'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import FormModal from '../components/FormModal.vue'
import { api } from '../lib/api'

interface StudentScoreRow {
  studentId: string
  studentName: string
  studentDocument: string
  score: number | null | string
  gradeValue: string | null
  performanceLevel: string | null
  observations: string | null
}

const route = useRoute()
const router = useRouter()
const activityId = route.params.activityId as string

const loading = ref(true)
const saving = ref(false)
const feedback = ref('')

const activity = ref<EvaluationActivityDto | null>(null)
const students = ref<StudentScoreRow[]>([])
const activeScale = ref<AppliedGradingScaleDto | null>(null)

// Default filling modal
const isFillModalOpen = ref(false)
const defaultScoreValue = ref(4.0)
const defaultVisibleScoreLabel = ref('')

const activitySubtitle = computed(() => {
  if (!activity.value) return 'Cargando información...'
  return `${activity.value.groupName || 'Curso'} · ${activity.value.subjectName || 'Materia'} · Periodo ${activity.value.academicPeriodId}`
})

const isPeriodLocked = ref(false)
const periodStatusLabel = ref('')
const hasScoredStudents = computed(() =>
  students.value.some((student) => student.score !== null && student.score !== undefined && student.score !== ''),
)
const scoreLabel = computed(() => (activeScale.value?.scaleType === 'numeric' ? 'Nota' : 'Valor institucional'))
const usesVisibleScaleSelection = computed(() => Boolean(activeScale.value && activeScale.value.scaleType !== 'numeric'))
const visibleScaleOptions = computed(() =>
  (activeScale.value?.ranges ?? []).map((range) => ({
    label: range.institutionalLabel || range.nationalLevel,
    score: Number(((range.minScore + range.maxScore) / 2).toFixed(activeScale.value?.decimalPlaces ?? 2)),
    performanceLevel: range.nationalLevel,
  })),
)
const invalidScoresCount = computed(() =>
  students.value.filter((student) => {
    if (student.score === null || student.score === undefined || student.score === '') return false
    const numericScore = Number(student.score)
    return Number.isNaN(numericScore) || numericScore < Number(activeScale.value?.minValue ?? 0) || numericScore > Number(activity.value?.maxScore ?? activeScale.value?.maxValue ?? 5)
  }).length,
)

const translatePerformanceLevel = (level: string | null) => {
  if (!level) return ''
  const map: Record<string, string> = {
    SUPERIOR: 'Superior',
    HIGH: 'Alto',
    BASIC: 'Básico',
    LOW: 'Bajo',
  }
  return map[level.toUpperCase()] || level
}

const getPerformanceBadgeClass = (level: string | null) => {
  if (!level) return ''
  const lvl = level.toUpperCase()
  if (lvl === 'SUPERIOR') return 'meta-badge--blue'
  if (lvl === 'HIGH') return 'meta-badge--green'
  if (lvl === 'BASIC') return 'meta-badge--yellow'
  return 'meta-badge--red'
}

const onScoreInput = (student: StudentScoreRow) => {
  if (student.score === null || student.score === undefined || student.score === '') {
    student.performanceLevel = null
    return
  }
  const numericScore = Number(student.score)
  if (isNaN(numericScore)) {
    student.performanceLevel = null
    return
  }

  // Find range
  const matchedRange = performanceRanges.value.find(r => {
    const min = Number(r.minScore)
    const max = Number(r.maxScore)
    return numericScore >= min && numericScore <= max
  })
  student.performanceLevel = matchedRange ? matchedRange.nationalLevel : null
  student.gradeValue = matchedRange ? matchedRange.institutionalLabel : null
}

const loadData = async () => {
  loading.value = true
  feedback.value = ''
  try {
    // 1. Fetch activity details
    const actRes = await api.getEvaluationActivity(activityId)
    activity.value = actRes.data

    // 2. Fetch academic periods to check lock status
    const periodsRes = await api.getAcademicPeriods({ page: 1, pageSize: 100 })
    const matchedPeriod = periodsRes.data.items.find(p => p.id === activity.value?.academicPeriodId)
    if (matchedPeriod) {
      isPeriodLocked.value = matchedPeriod.status === 'closed' || matchedPeriod.status === 'published'
      periodStatusLabel.value = matchedPeriod.status === 'closed' ? 'cerrado' : matchedPeriod.status === 'published' ? 'publicado' : ''
    }

    // 3. Fetch students scores and resolved scale
    const scoresRes = await api.getEvaluationActivityScores(activityId)
    activeScale.value = scoresRes.data.scale
    students.value = scoresRes.data.items.map((item: any) => ({
      studentId: item.studentId,
      studentName: item.studentName,
      studentDocument: item.studentDocument,
      score: item.score !== null ? Number(item.score) : '',
      gradeValue: item.gradeValue ?? null,
      performanceLevel: item.performanceLevel,
      observations: item.observations,
    }))

  } catch (err: any) {
    feedback.value = err.message || 'Error al cargar los datos.'
  } finally {
    loading.value = false
  }
}

const fillDefaultScores = () => {
  if (isPeriodLocked.value) {
    feedback.value = `El periodo está ${periodStatusLabel.value}. No puedes copiar una nota base en este momento.`
    return
  }
  defaultScoreValue.value = activeScale.value ? Number(activeScale.value.maxValue) * 0.8 : 4.0
  defaultVisibleScoreLabel.value = visibleScaleOptions.value[0]?.label ?? ''
  isFillModalOpen.value = true
}

const applyDefaultScores = () => {
  if (!activity.value) {
    feedback.value = 'Todavía no se cargó la actividad para aplicar la nota base.'
    return
  }
  if (!usesVisibleScaleSelection.value && (defaultScoreValue.value < 0 || defaultScoreValue.value > Number(activity.value.maxScore))) {
    feedback.value = `La nota base debe estar entre 0 y ${activity.value.maxScore}.`
    return
  }
  isFillModalOpen.value = false
  let updatedCount = 0
  students.value.forEach(student => {
    if (student.score === null || student.score === undefined || student.score === '') {
      if (usesVisibleScaleSelection.value) {
        applyVisibleSelection(student, defaultVisibleScoreLabel.value)
      } else {
        student.score = defaultScoreValue.value
        onScoreInput(student)
      }
      updatedCount += 1
    }
  })
  feedback.value = updatedCount
    ? `Se aplicó la nota base a ${updatedCount} estudiantes sin calificación.`
    : 'No había estudiantes sin nota para completar con la base seleccionada.'
}

const saveScores = async () => {
  if (isPeriodLocked.value) {
    feedback.value = `El periodo está ${periodStatusLabel.value}. Las calificaciones ya no pueden modificarse.`
    return
  }
  if (!activity.value) {
    feedback.value = 'No se pudo identificar la actividad a calificar.'
    return
  }
  if (!hasScoredStudents.value) {
    feedback.value = 'Ingresa al menos una calificación antes de guardar.'
    return
  }
  if (invalidScoresCount.value) {
    feedback.value = `Hay ${invalidScoresCount.value} calificaciones fuera del rango permitido para esta actividad.`
    return
  }
  saving.value = true
  feedback.value = ''
  try {
    const scoresPayload = students.value
      .filter(s => s.score !== null && s.score !== undefined && s.score !== '')
      .map(s => ({
        studentId: s.studentId,
        score: Number(s.score),
        observations: s.observations || null,
      }))

    // Save scores to database
    await api.saveEvaluationActivityScores(activityId, scoresPayload)

    // Automatically trigger final grade calculations for this subject/period
    await api.calculatePeriodGrades({
      academicYearId: activity.value.academicYearId,
      academicPeriodId: activity.value.academicPeriodId,
      groupId: activity.value.groupId,
      subjectId: activity.value.subjectId,
    })

    feedback.value = 'Calificaciones guardadas y consolidadas con éxito.'
  } catch (err: any) {
    feedback.value = err.message || 'Error al guardar las calificaciones.'
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  if (loading.value || saving.value) {
    feedback.value = 'Espera a que termine la operación actual antes de salir.'
    return
  }
  router.push('/evaluation-activities')
}

onMounted(() => {
  loadData()
})

const performanceRanges = computed(() => activeScale.value?.ranges ?? [])

const applyVisibleSelection = (student: StudentScoreRow, label: string) => {
  if (!label) {
    student.score = ''
    student.gradeValue = null
    student.performanceLevel = null
    return
  }
  const option = visibleScaleOptions.value.find((item) => item.label === label)
  if (!option) return
  student.score = option.score
  student.gradeValue = option.label
  student.performanceLevel = option.performanceLevel
}

const formatScore = (value: number) => value.toFixed(activeScale.value?.decimalPlaces ?? 2)
</script>

<style scoped>
.score-input {
  width: 90px;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--gray-200);
  border-radius: 6px;
  text-align: center;
  font-weight: bold;
}
.obs-input {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--gray-200);
  border-radius: 6px;
}
</style>
