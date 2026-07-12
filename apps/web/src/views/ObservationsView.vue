<template>
  <section class="stack">
    <PageHeader eyebrow="Observador" title="Observaciones SIEE" subtitle="Registra observaciones académicas cualitativas (fortalezas, dificultades y recomendaciones) por estudiante.">
    </PageHeader>

    <!-- Filtros de selección -->
    <SurfaceCard>
      <div class="form-grid">
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
            <option v-for="period in filteredPeriods" :key="period.id" :value="period.id">
              {{ period.name }} {{ period.status === 'closed' ? '(Cerrado)' : period.status === 'published' ? '(Publicado)' : '' }}
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
        <label>
          Materia
          <select v-model="filters.subjectId" required>
            <option value="">Seleccione</option>
            <option v-for="subject in availableSubjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
          </select>
        </label>
      </div>
    </SurfaceCard>

    <!-- Alerta de periodo cerrado -->
    <div v-if="isPeriodLocked" class="alert alert--warning" style="margin-top: 1rem;">
      ⚠️ El periodo seleccionado está <strong>{{ periodStatusLabel }}</strong>. Las observaciones no pueden ser creadas, editadas ni eliminadas.
    </div>

    <!-- Lista de estudiantes y observaciones -->
    <SurfaceCard v-if="isFiltersSelected">
      <div class="card-headline">
        <div>
          <h3>Planilla de Observaciones</h3>
          <p class="text-xs text-gray-500 mt-1">
            Materia: <strong>{{ selectedSubjectName }}</strong> | Curso: <strong>{{ selectedGroupName }}</strong>
          </p>
        </div>
      </div>

      <div v-if="loading" class="empty-state">
        Cargando estudiantes...
      </div>

      <div v-else-if="students.length === 0" class="empty-state">
        No se encontraron estudiantes matriculados en este curso.
      </div>

      <div v-else class="list-view__table-wrap">
        <table class="list-view__table">
          <thead>
            <tr>
              <th width="30%">Estudiante</th>
              <th width="50%">Observación Registrada</th>
              <th width="20%" class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in studentsWithObs" :key="student.id">
              <td>
                <strong class="text-gray-900 block">{{ student.studentName }}</strong>
                <span class="text-xs text-gray-500 block">{{ student.documentNumber }}</span>
              </td>
              <td>
                <div v-if="student.observation" class="observation-display">
                  <span :class="['meta-badge', getObservationTypeBadge(student.observation.observationType)]">
                    {{ translateObservationType(student.observation.observationType) }}
                  </span>
                  <span v-if="student.observation.achievementCode" class="meta-badge meta-badge--green ml-2">
                    🎯 {{ student.observation.achievementCode }}
                  </span>
                  <p class="text-sm mt-2 text-gray-800 italic">
                    "{{ student.observation.text }}"
                  </p>
                </div>
                <span v-else class="text-gray-400 text-xs italic">Ninguna observación registrada para este periodo.</span>
              </td>
              <td>
                <div class="flex justify-end gap-2">
                  <button 
                    class="button button--brand button--sm" 
                    type="button"
                    @click="openObsModal(student)"
                  >
                    {{ student.observation ? '✏️ Editar' : '➕ Agregar' }}
                  </button>
                  <button 
                    v-if="student.observation" 
                    class="button button--ghost button--sm text-red" 
                    type="button" 
                    :disabled="isPeriodLocked"
                    @click="deleteObservation(student.observation.id)"
                  >
                    🗑️ Borrar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SurfaceCard>

    <SurfaceCard v-else variant="ghost" style="text-align: center; padding: 3rem 1rem;">
      <p class="text-gray-500">Selecciona el año lectivo, periodo, curso y materia para registrar o editar las observaciones SIEE.</p>
    </SurfaceCard>

    <!-- Modal Formulario de Observación -->
    <FormModal 
      :open="isModalOpen" 
      :title="`Observación para: ${selectedStudent?.studentName}`" 
      @close="closeModal"
    >
      <form class="form-grid" @submit.prevent="submitForm">
        <label>
          Tipo de Observación *
          <select v-model="form.observationType" required :disabled="isPeriodLocked">
            <option value="strength">Fortaleza</option>
            <option value="difficulty">Dificultad</option>
            <option value="recommendation">Recomendación</option>
            <option value="general">General / Comportamiento</option>
          </select>
        </label>

        <label>
          Logro Asociado (Opcional)
          <select v-model="form.achievementId" :disabled="isPeriodLocked">
            <option value="">-- Ninguno --</option>
            <option v-for="ach in achievements" :key="ach.id" :value="ach.id">
              [{{ ach.code }}] {{ ach.title }}
            </option>
          </select>
        </label>

        <!-- Banco de Observaciones (Wow Detail) -->
        <div class="form-grid__wide" v-if="!isPeriodLocked && bankObservations.length > 0">
          <label>
            Copiar del Banco de Observaciones
            <select @change="applyBankObservation($event)">
              <option value="">-- Selecciona una plantilla --</option>
              <option v-for="bank in bankObservations" :key="bank.id" :value="bank.text">
                [{{ translateObservationType(bank.observationType) }}] {{ truncateText(bank.text, 60) }}
              </option>
            </select>
          </label>
        </div>

        <label class="form-grid__wide">
          Texto de la observación *
          <textarea 
            v-model="form.text" 
            required 
            rows="4" 
            placeholder="Describe detalladamente el desempeño del estudiante en este periodo..." 
            :disabled="isPeriodLocked"
          />
        </label>

        <div class="modal-actions col-span-2">
          <button class="button button--ghost" type="button" :disabled="submitting" @click="closeModal">Cancelar</button>
          <button v-if="!isPeriodLocked" class="button button--brand" type="submit" :disabled="submitting">
            {{ submitting ? 'Guardando...' : 'Guardar Observación' }}
          </button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { 
  AcademicPeriodDto, 
  AcademicYearDto, 
  CourseDto, 
  CourseSubjectDto,
  GradeSubjectDto, 
  AcademicObservationDto,
  ObservationBankDto 
} from '@ofir/shared'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import FormModal from '../components/FormModal.vue'
import { api } from '../lib/api'
import { useAcademicContextStore } from '../stores/academic-context'

const academicContext = useAcademicContextStore()
const loading = ref(false)
const submitting = ref(false)
const isModalOpen = ref(false)
const feedback = ref('')

const academicYears = ref<AcademicYearDto[]>([])
const periods = ref<AcademicPeriodDto[]>([])
const courses = ref<CourseDto[]>([])
const gradeSubjects = ref<GradeSubjectDto[]>([])
const courseSubjects = ref<CourseSubjectDto[]>([])
const students = ref<any[]>([])
const observations = ref<AcademicObservationDto[]>([])
const achievements = ref<any[]>([])
const bankObservations = ref<ObservationBankDto[]>([])

const selectedStudent = ref<any | null>(null)

const filters = reactive({
  academicYearId: '',
  academicPeriodId: '',
  groupId: '',
  subjectId: '',
})

const form = reactive({
  observationType: 'strength',
  achievementId: '',
  text: '',
})

const selectedPeriodObj = computed(() => 
  periods.value.find(p => p.id === filters.academicPeriodId)
)

const isPeriodLocked = computed(() => {
  const status = selectedPeriodObj.value?.status
  return status === 'closed' || status === 'published'
})

const periodStatusLabel = computed(() => {
  const status = selectedPeriodObj.value?.status
  if (status === 'closed') return 'cerrado'
  if (status === 'published') return 'publicado'
  return ''
})

const filteredPeriods = computed(() => 
  periods.value.filter((period) => period.academicYearId === filters.academicYearId)
)

const filteredCourses = computed(() => 
  courses.value.filter((course) => course.academicYearId === filters.academicYearId)
)

const selectedGroupObj = computed(() => 
  courses.value.find(c => c.id === filters.groupId)
)
const selectedAcademicYearNumber = computed(() =>
  academicYears.value.find((year) => year.id === filters.academicYearId)?.year ??
  academicContext.selectedYearNumber,
)

const availableSubjects = computed(() => {
  const assignedMatches = courseSubjects.value.filter((item) =>
    item.academicYearId === filters.academicYearId &&
    (!filters.groupId || item.groupId === filters.groupId),
  )
  const matches = assignedMatches.length
    ? assignedMatches.map((item) => ({ subjectId: item.subjectId, subjectName: item.subjectName || 'Materia sin nombre' }))
    : gradeSubjects.value.filter((item) =>
      item.academicYearId === filters.academicYearId &&
      (!filters.groupId || selectedGroupObj.value?.gradeId === item.gradeId),
    )
  const seen = new Set<string>()
  return matches.filter((item) => {
    if (seen.has(item.subjectId)) return false
    seen.add(item.subjectId)
    return true
  }).map((item) => ({ id: item.subjectId, name: item.subjectName }))
})

const selectedSubjectName = computed(() => 
  availableSubjects.value.find(s => s.id === filters.subjectId)?.name ?? ''
)

const selectedGroupName = computed(() => 
  selectedGroupObj.value ? `${selectedGroupObj.value.gradeName} · ${selectedGroupObj.value.name}` : ''
)

const isFiltersSelected = computed(() => 
  Boolean(filters.academicYearId && filters.academicPeriodId && filters.groupId && filters.subjectId)
)

const studentsWithObs = computed(() => {
  return students.value.map(student => {
    const obs = observations.value.find(o => o.studentId === student.id)
    return {
      ...student,
      observation: obs || null
    }
  })
})

const translateObservationType = (type: string) => {
  const map: Record<string, string> = {
    strength: 'Fortaleza',
    difficulty: 'Dificultad',
    recommendation: 'Recomendación',
    general: 'General',
  }
  return map[type] || type
}

const getObservationTypeBadge = (type: string) => {
  const map: Record<string, string> = {
    strength: 'meta-badge--blue',
    difficulty: 'meta-badge--red',
    recommendation: 'meta-badge--yellow',
    general: 'meta-badge--gray',
  }
  return map[type] || 'meta-badge--gray'
}



const truncateText = (text: string, limit: number) => {
  if (!text) return ''
  return text.length > limit ? text.substring(0, limit) + '...' : text
}

// Watch filters to reload students & observations
watch(
  () => [filters.academicPeriodId, filters.groupId, filters.subjectId],
  async ([periodId, groupId, subjectId]) => {
    if (periodId && groupId && subjectId) {
      await loadStudentsAndObservations()
      await loadAchievements()
      await loadBankObservations()
    } else {
      students.value = []
      observations.value = []
      achievements.value = []
      bankObservations.value = []
    }
  }
)

const loadOptions = async () => {
  const [yearsResponse, periodsResponse, coursesResponse, assignmentsResponse, courseSubjectsResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getAcademicPeriods({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
    api.getGradeSubjects({ page: 1, pageSize: 100 }),
    api.getCourseSubjects({}),
  ])
  academicYears.value = yearsResponse.data.items
  periods.value = periodsResponse.data.items
  courses.value = coursesResponse.data.items
  gradeSubjects.value = assignmentsResponse.data.items
  courseSubjects.value = courseSubjectsResponse.data.items
  filters.academicYearId ||= academicContext.activeYearId || academicYears.value[0]?.id || ''
}

const loadStudentsAndObservations = async () => {
  if (!isFiltersSelected.value) return
  loading.value = true
  try {
    // Load students in group
    const studentsRes = await api.getStudents({
      year: selectedAcademicYearNumber.value ?? undefined,
      groupId: filters.groupId,
      page: 1,
      pageSize: 100,
    })
    students.value = studentsRes.data.items.map((s: any) => ({
      id: s.id,
      studentName: `${s.firstName} ${s.lastName}`,
      documentNumber: `${s.documentType} ${s.documentNumber}`,
    }))

    // Load observations for this subject/period
    const obsRes = await api.getAcademicObservations({
      academicYearId: filters.academicYearId,
      academicPeriodId: filters.academicPeriodId,
      subjectId: filters.subjectId,
    })
    observations.value = obsRes.data.items
  } catch (err: any) {
    feedback.value = err.message || 'Error al cargar planilla.'
  } finally {
    loading.value = false
  }
}

const loadAchievements = async () => {
  if (!isFiltersSelected.value || !selectedGroupObj.value) return
  try {
    const res = await api.getLearningAchievements({
      page: 1,
      pageSize: 100,
      academicYearId: filters.academicYearId,
      academicPeriodId: filters.academicPeriodId,
      gradeId: selectedGroupObj.value.gradeId,
      subjectId: filters.subjectId,
    })
    achievements.value = res.data.items.map((it: any) => ({
      id: it.id,
      code: it.code,
      title: it.title,
    }))
  } catch (err: any) {
    console.error('Error loading achievements:', err)
  }
}

const loadBankObservations = async () => {
  if (!isFiltersSelected.value || !selectedGroupObj.value) return
  try {
    const res = await api.getObservationBank({
      subjectId: filters.subjectId,
      gradeId: selectedGroupObj.value.gradeId,
    })
    bankObservations.value = res.data.items
  } catch (err: any) {
    console.error('Error loading bank observations:', err)
  }
}

const openObsModal = (student: any) => {
  feedback.value = ''
  selectedStudent.value = student
  const existing = student.observation

  if (existing) {
    Object.assign(form, {
      observationType: existing.observationType,
      achievementId: existing.achievementId || '',
      text: existing.text,
    })
  } else {
    Object.assign(form, {
      observationType: 'strength',
      achievementId: '',
      text: '',
    })
  }
  isModalOpen.value = true
}

const applyBankObservation = (event: Event) => {
  const select = event.target as HTMLSelectElement
  if (select.value) {
    form.text = select.value
  }
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitForm = async () => {
  if (isPeriodLocked.value || !selectedStudent.value) return
  submitting.value = true
  feedback.value = ''
  try {
    const existing = selectedStudent.value.observation
    const payload = {
      academicYearId: filters.academicYearId,
      academicPeriodId: filters.academicPeriodId,
      studentId: selectedStudent.value.id,
      subjectId: filters.subjectId,
      ...form,
    }

    if (existing) {
      await api.updateAcademicObservation(existing.id, payload)
      feedback.value = 'Observación académica actualizada.'
    } else {
      await api.createAcademicObservation(payload)
      feedback.value = 'Observación académica guardada.'
    }

    closeModal()
    await loadStudentsAndObservations()
  } catch (err: any) {
    feedback.value = err.message || 'Error al guardar observación.'
  } finally {
    submitting.value = false
  }
}

const deleteObservation = async (obsId: string) => {
  if (isPeriodLocked.value) return
  if (!confirm('¿Estás seguro de que deseas eliminar esta observación académica?')) return
  try {
    await api.deleteAcademicObservation(obsId)
    feedback.value = 'Observación eliminada.'
    await loadStudentsAndObservations()
  } catch (err: any) {
    feedback.value = err.message || 'Error al eliminar observación.'
  }
}

onMounted(() => {
  loadOptions()
})
</script>
