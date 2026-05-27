<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Asistencia" subtitle="Registra asistencia por curso, materia y fecha.">
      <template #actions>
        <button class="button button--brand" type="button" :disabled="busy || !canLoadAttendance" @click="loadAttendance">
          {{ busy ? 'Cargando...' : 'Cargar asistencia' }}
        </button>
      </template>
    </PageHeader>

    <SurfaceCard>
      <form class="form-grid" @submit.prevent="loadAttendance">
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
        <label>
          Fecha
          <input v-model="filters.attendanceDate" type="date" required />
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="resetAttendance">Limpiar</button>
          <button class="button button--brand" type="submit" :disabled="busy || !canLoadAttendance">Cargar estudiantes</button>
        </div>
      </form>
    </SurfaceCard>

    <SurfaceCard v-if="entries.length">
      <div class="card-headline">
        <div>
          <h3>Control diario</h3>
          <p>{{ headerSummary }}</p>
        </div>
        <div class="toolbar-cluster">
          <button class="button button--ghost" type="button" :disabled="busy" @click="markAll('present')">Todos presentes</button>
          <button class="button button--brand" type="button" :disabled="busy" @click="saveAttendance">Guardar asistencia</button>
        </div>
      </div>

      <div class="list-view__table-wrap">
        <table class="list-view__table">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Documento</th>
              <th>Estado</th>
              <th>Justificada</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in entries" :key="entry.studentId">
              <td>{{ entry.studentName }}</td>
              <td>{{ entry.studentDocument }}</td>
              <td>
                <select v-model="entry.status">
                  <option value="present">Presente</option>
                  <option value="absent">Ausente</option>
                  <option value="late">Tarde</option>
                  <option value="excused">Excusado</option>
                </select>
              </td>
              <td>
                <input v-model="entry.justified" type="checkbox" />
              </td>
              <td>
                <input v-model="entry.notes" placeholder="Observación breve" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SurfaceCard>

    <SurfaceCard v-else variant="ghost">
      <p>No hay estudiantes cargados todavía para esta combinación de curso, materia y fecha.</p>
    </SurfaceCard>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AcademicPeriodDto, AcademicYearDto, AttendanceEntryDto, CourseDto, GradeSubjectDto } from '@ofir/shared'
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
const entries = ref<AttendanceEntryDto[]>([])
const filters = reactive({
  academicYearId: '',
  academicPeriodId: '',
  groupId: '',
  subjectId: '',
  attendanceDate: new Date().toISOString().slice(0, 10),
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

const canLoadAttendance = computed(() =>
  Boolean(filters.academicYearId && filters.academicPeriodId && filters.groupId && filters.subjectId && filters.attendanceDate),
)

const headerSummary = computed(() => {
  const period = filteredPeriods.value.find((item) => item.id === filters.academicPeriodId)?.name ?? 'Periodo'
  const course = filteredCourses.value.find((item) => item.id === filters.groupId)?.name ?? 'Curso'
  const subject = availableSubjects.value.find((item) => item.id === filters.subjectId)?.name ?? 'Materia'
  return `${course} · ${subject} · ${period} · ${filters.attendanceDate}`
})

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

const loadAttendance = async () => {
  if (!canLoadAttendance.value) return
  busy.value = true
  try {
    const response = await api.getAttendance({ ...filters })
    entries.value = response.data.items
    feedback.value = entries.value.length ? 'Asistencia cargada.' : 'No hay estudiantes activos para este curso.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible cargar la asistencia.'
  } finally {
    busy.value = false
  }
}

const saveAttendance = async () => {
  busy.value = true
  try {
    const response = await api.saveAttendance({
      ...filters,
      items: entries.value.map((entry) => ({
        studentId: entry.studentId,
        status: entry.status,
        justified: entry.justified,
        notes: entry.notes || null,
      })),
    })
    feedback.value = `${response.data.updatedCount} registros de asistencia guardados.`
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar la asistencia.'
  } finally {
    busy.value = false
  }
}

const markAll = (status: AttendanceEntryDto['status']) => {
  entries.value = entries.value.map((entry) => ({
    ...entry,
    status,
    justified: status === 'excused' ? true : entry.justified,
  }))
}

const resetAttendance = () => {
  entries.value = []
  filters.academicPeriodId = ''
  filters.groupId = ''
  filters.subjectId = ''
  filters.attendanceDate = new Date().toISOString().slice(0, 10)
  feedback.value = ''
}

onMounted(loadOptions)
</script>

<style scoped>
.toolbar-cluster {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}
</style>
