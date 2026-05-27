<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Notas" subtitle="Carga y actualiza la nota final por periodo, curso y materia.">
      <template #actions>
        <button class="button button--brand" type="button" :disabled="busy" @click="loadGradebook">
          {{ busy ? gradebookActionLabel : 'Cargar libro' }}
        </button>
      </template>
    </PageHeader>

    <SurfaceCard>
      <form class="form-grid" @submit.prevent="loadGradebook">
        <label>
          Año lectivo
          <select v-model="filters.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Periodo
          <select v-model="filters.academicPeriodId" required>
            <option value="">Seleccione</option>
            <option v-for="period in filteredPeriods" :key="period.id" :value="period.id">{{ period.name }}</option>
          </select>
        </label>
        <label>
          Curso
          <select v-model="filters.groupId" required>
            <option value="">Seleccione</option>
            <option v-for="course in filteredCourses" :key="course.id" :value="course.id">{{ course.gradeName }} · {{ course.name }}</option>
          </select>
        </label>
        <label>
          Materia
          <select v-model="filters.subjectId" required>
            <option value="">Seleccione</option>
            <option v-for="subject in availableSubjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
          </select>
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="resetGradebook">Limpiar</button>
          <button class="button button--brand" type="submit" :disabled="busy">
            {{ busy ? gradebookActionLabel : 'Cargar estudiantes' }}
          </button>
        </div>
      </form>
    </SurfaceCard>

    <SurfaceCard v-if="entries.length">
      <div class="card-headline">
        <div>
          <h3>Libro de notas</h3>
          <p>{{ headerSummary }}</p>
        </div>
        <button class="button button--brand" type="button" :disabled="busy" @click="saveGradebook">
          {{ busy ? 'Guardando...' : 'Guardar notas' }}
        </button>
      </div>

      <p v-if="resolvedScale" class="table-note">
        Escala aplicada: <strong>{{ resolvedScale.name }}</strong>
        · {{ scoreLabel }}
        entre {{ formatScore(resolvedScale.minValue) }} y {{ formatScore(resolvedScale.maxValue) }}
        · Aprueba desde {{ formatScore(resolvedScale.passingValue) }}
      </p>

      <div class="list-view__table-wrap">
        <table class="list-view__table">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Documento</th>
              <th>{{ scoreLabel }}</th>
              <th>Base numérica</th>
              <th>Máxima</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.studentId">
              <td>{{ entry.studentName }}</td>
              <td>{{ entry.studentDocument }}</td>
              <td>
                <select
                  v-if="usesVisibleScaleSelection"
                  :value="resolveEntryDisplayValue(entry)"
                  @change="applyVisibleSelection(entry, (($event.target as HTMLSelectElement | null)?.value) ?? '')"
                >
                  <option value="">Seleccione</option>
                  <option v-for="option in visibleScaleOptions" :key="option.label" :value="option.label">
                    {{ option.label }}
                  </option>
                </select>
                <input
                  v-else
                  v-model.number="entry.score"
                  type="number"
                  :min="resolvedScale?.minValue ?? 0"
                  :max="resolvedScale?.maxValue ?? 5"
                  :step="scoreStep"
                />
              </td>
              <td>{{ entry.score !== null && entry.score !== undefined ? formatScore(Number(entry.score)) : 'Pendiente' }}</td>
              <td><input v-model.number="entry.maxScore" type="number" :min="0.1" :max="resolvedScale?.maxValue ?? 100" :step="scoreStep" :readonly="usesVisibleScaleSelection" /></td>
              <td><input v-model="entry.notes" placeholder="Observación breve" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </SurfaceCard>

    <SurfaceCard v-else variant="ghost">
      <p>No hay estudiantes cargados todavía para esta combinación de curso, periodo y materia.</p>
    </SurfaceCard>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AcademicPeriodDto, AcademicYearDto, AppliedGradingScaleDto, CourseDto, GradeSubjectDto, GradebookEntryDto } from '@ofir/shared'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'
import { useAcademicContextStore } from '../stores/academic-context'

const academicContext = useAcademicContextStore()
const busy = ref(false)
const feedback = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const periods = ref<AcademicPeriodDto[]>([])
const courses = ref<CourseDto[]>([])
const gradeSubjects = ref<GradeSubjectDto[]>([])
const entries = ref<GradebookEntryDto[]>([])
const resolvedScale = ref<AppliedGradingScaleDto | null>(null)
const filters = reactive({
  academicYearId: '',
  academicPeriodId: '',
  groupId: '',
  subjectId: '',
})

const filteredPeriods = computed(() => periods.value.filter((period) => period.academicYearId === filters.academicYearId))
const filteredCourses = computed(() => courses.value.filter((course) => course.academicYearId === filters.academicYearId))
const availableSubjects = computed(() => {
  const matches = gradeSubjects.value.filter((item) =>
    item.academicYearId === filters.academicYearId &&
    (!filters.groupId || filteredCourses.value.find((course) => course.id === filters.groupId)?.gradeId === item.gradeId),
  )
  const seen = new Set<string>()
  return matches.filter((item) => {
    if (seen.has(item.subjectId)) return false
    seen.add(item.subjectId)
    return true
  }).map((item) => ({ id: item.subjectId, name: item.subjectName }))
})
const canLoadGradebook = computed(() => Boolean(filters.academicYearId && filters.academicPeriodId && filters.groupId && filters.subjectId))
const gradebookActionLabel = computed(() => (entries.value.length ? 'Guardando...' : 'Cargando...'))
const scoreLabel = computed(() => (resolvedScale.value?.scaleType === 'numeric' ? 'Nota' : 'Valor institucional'))
const usesVisibleScaleSelection = computed(() => Boolean(resolvedScale.value && resolvedScale.value.scaleType !== 'numeric'))
const visibleScaleOptions = computed(() =>
  (resolvedScale.value?.ranges ?? []).map((range) => ({
    label: range.institutionalLabel || range.nationalLevel,
    score: Number(((range.minScore + range.maxScore) / 2).toFixed(resolvedScale.value?.decimalPlaces ?? 2)),
  })),
)
const scoreStep = computed(() => {
  const decimalPlaces = resolvedScale.value?.decimalPlaces ?? 2
  return decimalPlaces <= 0 ? '1' : `0.${'0'.repeat(Math.max(decimalPlaces - 1, 0))}1`
})
const headerSummary = computed(() => {
  const period = filteredPeriods.value.find((item) => item.id === filters.academicPeriodId)?.name ?? 'Periodo'
  const course = filteredCourses.value.find((item) => item.id === filters.groupId)?.name ?? 'Curso'
  const subject = availableSubjects.value.find((item) => item.id === filters.subjectId)?.name ?? 'Materia'
  return `${course} · ${subject} · ${period}`
})

const selectedPeriod = computed(() => periods.value.find((item) => item.id === filters.academicPeriodId) ?? null)

const ensureGradebookContext = () => {
  if (!filters.academicYearId) {
    feedback.value = 'Selecciona el año lectivo para continuar.'
    return false
  }
  if (!filters.academicPeriodId) {
    feedback.value = 'Selecciona el periodo para cargar el libro de notas.'
    return false
  }
  if (!filters.groupId) {
    feedback.value = 'Selecciona el curso para cargar estudiantes.'
    return false
  }
  if (!filters.subjectId) {
    feedback.value = 'Selecciona la materia para abrir el libro de notas.'
    return false
  }
  if (selectedPeriod.value?.status === 'published' || selectedPeriod.value?.status === 'closed') {
    feedback.value = `El periodo ${selectedPeriod.value.name} está ${selectedPeriod.value.status === 'closed' ? 'cerrado' : 'publicado'} y no admite cambios en notas finales.`
    return false
  }
  return true
}

const invalidEntriesCount = computed(() =>
  entries.value.filter((entry) => {
    const score = Number(entry.score)
    const maxScore = Number(entry.maxScore)
    if (Number.isNaN(score) || Number.isNaN(maxScore)) return true
    const minValue = resolvedScale.value?.minValue ?? 0
    const maxValue = resolvedScale.value?.maxValue ?? 5
    if (score < minValue || score > maxValue) return true
    if (maxScore <= 0 || maxScore > maxValue) return true
    return false
  }).length,
)

const loadOptions = async () => {
  const [yearsResponse, periodsResponse, coursesResponse, assignmentsResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getAcademicPeriods({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
    api.getGradeSubjects({ page: 1, pageSize: 100 }),
  ])
  academicYears.value = yearsResponse.data.items
  periods.value = periodsResponse.data.items
  courses.value = coursesResponse.data.items
  gradeSubjects.value = assignmentsResponse.data.items
  filters.academicYearId ||= academicContext.activeYearId || academicYears.value[0]?.id || ''
}

const loadGradebook = async () => {
  if (!ensureGradebookContext()) return
  busy.value = true
  try {
    const response = await api.getGradebook({ ...filters })
    entries.value = response.data.items
    resolvedScale.value = response.data.scale
    feedback.value = entries.value.length ? 'Libro de notas cargado.' : 'No hay estudiantes activos para este curso.'
  } catch (error) {
    resolvedScale.value = null
    feedback.value = error instanceof Error ? error.message : 'No fue posible cargar el libro de notas.'
  } finally {
    busy.value = false
  }
}

const saveGradebook = async () => {
  if (!ensureGradebookContext()) return
  if (!entries.value.length) {
    feedback.value = 'Primero carga un libro con estudiantes antes de guardar.'
    return
  }
  if (invalidEntriesCount.value) {
    feedback.value = `Hay ${invalidEntriesCount.value} registros con notas o máximas fuera de rango. Revisa antes de guardar.`
    return
  }
  busy.value = true
  try {
    const response = await api.saveGradebook({
      ...filters,
      items: entries.value.map((entry) => ({
        studentId: entry.studentId,
        score: Number(entry.score ?? resolvedScale.value?.minValue ?? 0),
        maxScore: Number(entry.maxScore ?? resolvedScale.value?.maxValue ?? 5),
        notes: entry.notes || null,
      })),
    })
    feedback.value = `${response.data.updatedCount} notas guardadas correctamente.`
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar las notas.'
  } finally {
    busy.value = false
  }
}

const resetGradebook = () => {
  entries.value = []
  resolvedScale.value = null
  filters.academicPeriodId = ''
  filters.groupId = ''
  filters.subjectId = ''
  feedback.value = 'Filtros de notas reiniciados.'
}

const formatScore = (value: number) => value.toFixed(resolvedScale.value?.decimalPlaces ?? 2)

const resolveEntryDisplayValue = (entry: GradebookEntryDto) => {
  if (entry.score === null || entry.score === undefined || Number.isNaN(Number(entry.score))) return 'Pendiente'
  if (!resolvedScale.value) return entry.gradeValue ?? formatScore(Number(entry.score))
  if (resolvedScale.value.scaleType === 'numeric') return formatScore(Number(entry.score))
  const range = resolvedScale.value.ranges.find((item) => Number(entry.score) >= item.minScore && Number(entry.score) <= item.maxScore)
  return range?.institutionalLabel ?? entry.gradeValue ?? formatScore(Number(entry.score))
}

const applyVisibleSelection = (entry: GradebookEntryDto, label: string) => {
  if (!label) {
    entry.score = null
    entry.gradeValue = null
    return
  }
  const option = visibleScaleOptions.value.find((item) => item.label === label)
  if (!option) return
  entry.score = option.score
  entry.gradeValue = option.label
  if (resolvedScale.value) {
    entry.maxScore = resolvedScale.value.maxValue
  }
}

onMounted(loadOptions)
</script>
