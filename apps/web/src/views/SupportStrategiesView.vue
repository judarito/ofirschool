<template>
  <section class="stack">
    <PageHeader eyebrow="Recuperaciones" title="Estrategias de Apoyo SIEE" subtitle="Registra planes de mejoramiento y recuperaciones para estudiantes con desempeños bajos.">
      <template #actions>
        <button 
          v-if="canManage"
          class="button button--brand" 
          type="button" 
          :disabled="!isFiltersSelected || isPeriodLocked" 
          @click="openCreateModal"
        >
          Registrar estrategia
        </button>
      </template>
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
      ⚠️ El periodo seleccionado está <strong>{{ periodStatusLabel }}</strong>. Las estrategias de apoyo y notas recuperadas se encuentran bloqueadas para modificaciones.
    </div>

    <!-- Lista de estrategias -->
    <SurfaceCard v-if="isFiltersSelected">
      <div class="card-headline">
        <div>
          <h3>Planes de Apoyo Registrados</h3>
          <p class="text-xs text-gray-500 mt-1">
            Materia: <strong>{{ selectedSubjectName }}</strong> | Curso: <strong>{{ selectedGroupName }}</strong>
          </p>
        </div>
        <button 
          v-if="canManage"
          class="button button--brand" 
          type="button" 
          :disabled="!isFiltersSelected || isPeriodLocked" 
          @click="openCreateModal"
        >
          Registrar estrategia
        </button>
      </div>

      <div v-if="loading" class="empty-state">
        Cargando estrategias de apoyo...
      </div>

      <div v-else-if="strategies.length === 0" class="empty-state">
        <p>No hay estrategias de apoyo registradas para este periodo y materia.</p>
        <button 
          v-if="!isPeriodLocked"
          class="button button--ghost button--sm mt-4" 
          type="button" 
          @click="openCreateModal"
        >
          Registrar la primera
        </button>
      </div>

      <div v-else class="list-view__table-wrap">
        <table class="list-view__table">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Descripción del Plan</th>
              <th>Logro Asociado</th>
              <th>Fecha Límite</th>
              <th>Estado</th>
              <th>Calificación de Recuperación</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="strat in strategies" :key="strat.id">
              <td>
                <strong class="text-gray-900 block">{{ strat.studentName }}</strong>
              </td>
              <td>
                <p class="text-xs text-gray-600 max-w-sm truncate" :title="strat.description">
                  {{ strat.description }}
                </p>
              </td>
              <td>
                <span v-if="strat.achievementCode" class="meta-badge meta-badge--green">
                  🎯 {{ strat.achievementCode }}
                </span>
                <span v-else class="text-gray-400 text-xs">-</span>
              </td>
              <td>{{ strat.dueDate ? formatDate(strat.dueDate) : 'No definida' }}</td>
              <td>
                <span :class="['meta-badge', getStatusBadgeClass(strat.status)]">
                  {{ translateStatus(strat.status) }}
                </span>
              </td>
              <td>
                <strong v-if="strat.status === 'approved'">{{ strat.resultScore }}</strong>
                <span v-else class="text-gray-400 text-xs">N/A</span>
              </td>
              <td>
                <div class="flex justify-end gap-2">
                  <button 
                    class="button button--ghost button--sm" 
                    type="button"
                    @click="openEditModal(strat)"
                  >
                    ✏️ Editar / Evaluar
                  </button>
                  <button 
                    class="button button--ghost button--sm text-red" 
                    type="button" 
                    :disabled="isPeriodLocked"
                    @click="deleteStrategy(strat.id)"
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
      <p class="text-gray-500">Selecciona el año lectivo, periodo, curso y materia para visualizar o gestionar los planes de apoyo académico.</p>
    </SurfaceCard>

    <!-- Modal Formulario -->
    <FormModal :open="isModalOpen" :title="editingId ? 'Editar Plan de Apoyo / Calificar' : 'Registrar Plan de Apoyo'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>
          Estudiante *
          <select v-model="form.studentId" required :disabled="Boolean(editingId) || isPeriodLocked">
            <option value="" disabled>Seleccione un estudiante</option>
            <option v-for="student in students" :key="student.id" :value="student.id">
              {{ student.studentName }}
            </option>
          </select>
        </label>

        <label>
          Logro a Recuperar (Opcional)
          <select v-model="form.achievementId" :disabled="isPeriodLocked">
            <option value="">-- Ninguno --</option>
            <option v-for="ach in achievements" :key="ach.id" :value="ach.id">
              [{{ ach.code }}] {{ ach.title }}
            </option>
          </select>
        </label>

        <label class="form-grid__wide">
          Descripción del Plan de Apoyo *
          <textarea 
            v-model="form.description" 
            required 
            rows="3" 
            placeholder="Describe las actividades, talleres o evaluaciones que el estudiante debe presentar..." 
            :disabled="isPeriodLocked"
          />
        </label>

        <label>
          Fecha Límite de Presentación
          <input v-model="form.dueDate" type="date" :disabled="isPeriodLocked" />
        </label>

        <label>
          Docente Tutor (Opcional)
          <select v-model="form.teacherId" :disabled="isPeriodLocked">
            <option value="">-- Sin docente tutor --</option>
            <option v-for="teacher in activeTeachers" :key="teacher.id" :value="teacher.id">{{ teacher.fullName }}</option>
          </select>
        </label>

        <hr class="form-grid__wide my-4" />
        <h4 class="form-grid__wide text-xs font-bold uppercase tracking-wider text-gray-400">Seguimiento / Calificación</h4>

        <label>
          Estado del Plan *
          <select v-model="form.status" required :disabled="isPeriodLocked">
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobado / Nota Aplicada</option>
            <option value="rejected">No Aprobado</option>
          </select>
        </label>

        <label>
          Calificación Obtenida (Solo si es Aprobado)
          <input 
            v-model.number="form.resultScore" 
            type="number" 
            min="0" 
            max="100" 
            step="0.1" 
            placeholder="Ej. 3.0, 3.5..."
            :disabled="form.status !== 'approved' || isPeriodLocked" 
          />
        </label>

        <div class="modal-actions col-span-2">
          <button class="button button--ghost" type="button" :disabled="submitting" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="submitting">
            {{ submitting ? 'Guardando...' : 'Guardar' }}
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
  GradeSubjectDto, 
  SupportStrategyDto,
  TeacherDto,
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
const editingId = ref('')
const feedback = ref('')

const academicYears = ref<AcademicYearDto[]>([])
const periods = ref<AcademicPeriodDto[]>([])
const courses = ref<CourseDto[]>([])
const gradeSubjects = ref<GradeSubjectDto[]>([])
const teachers = ref<TeacherDto[]>([])
const students = ref<any[]>([])
const strategies = ref<SupportStrategyDto[]>([])
const achievements = ref<any[]>([])

const filters = reactive({
  academicYearId: '',
  academicPeriodId: '',
  groupId: '',
  subjectId: '',
})

const form = reactive({
  studentId: '',
  achievementId: '',
  description: '',
  dueDate: '',
  teacherId: '',
  status: 'pending',
  resultScore: null as number | null,
})

const canManage = ref(true)

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

const activeTeachers = computed(() =>
  teachers.value.filter((teacher) => teacher.status === 'active'),
)

const selectedGroupObj = computed(() => 
  courses.value.find(c => c.id === filters.groupId)
)
const selectedAcademicYearNumber = computed(() =>
  academicYears.value.find((year) => year.id === filters.academicYearId)?.year ??
  academicContext.selectedYearNumber,
)

const availableSubjects = computed(() => {
  const matches = gradeSubjects.value.filter((item) =>
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

const translateStatus = (status: string) => {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'No Aprobado',
  }
  return map[status] || status
}

const getStatusBadgeClass = (status: string) => {
  const map: Record<string, string> = {
    pending: 'meta-badge--yellow',
    approved: 'meta-badge--green',
    rejected: 'meta-badge--red',
  }
  return map[status] || 'meta-badge--gray'
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
  } catch (e) {
    return dateStr
  }
}

watch(
  () => [filters.academicPeriodId, filters.groupId, filters.subjectId],
  async ([periodId, groupId, subjectId]) => {
    if (periodId && groupId && subjectId) {
      await loadStrategies()
      await loadStudents()
      await loadAchievements()
    } else {
      strategies.value = []
      students.value = []
      achievements.value = []
    }
  }
)

const loadOptions = async () => {
  const [yearsResponse, periodsResponse, coursesResponse, assignmentsResponse, teachersResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getAcademicPeriods({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
    api.getGradeSubjects({ page: 1, pageSize: 100 }),
    api.getTeachers({ page: 1, pageSize: 100 }),
  ])
  academicYears.value = yearsResponse.data.items
  periods.value = periodsResponse.data.items
  courses.value = coursesResponse.data.items
  gradeSubjects.value = assignmentsResponse.data.items
  teachers.value = teachersResponse.data.items
  filters.academicYearId ||= academicContext.activeYearId || academicYears.value[0]?.id || ''
}

const loadStrategies = async () => {
  if (!isFiltersSelected.value) return
  loading.value = true
  try {
    const res = await api.getSupportStrategies({
      academicYearId: filters.academicYearId,
      academicPeriodId: filters.academicPeriodId,
      subjectId: filters.subjectId,
    })
    strategies.value = res.data.items
  } catch (err: any) {
    feedback.value = err.message || 'Error al cargar estrategias.'
  } finally {
    loading.value = false
  }
}

const loadStudents = async () => {
  if (!isFiltersSelected.value) return
  try {
    const res = await api.getStudents({
      year: selectedAcademicYearNumber.value ?? undefined,
      groupId: filters.groupId,
      page: 1,
      pageSize: 100,
    })
    students.value = res.data.items.map((s: any) => ({
      id: s.id,
      studentName: `${s.firstName} ${s.lastName}`,
    }))
  } catch (err: any) {
    console.error('Error loading students:', err)
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

const openCreateModal = () => {
  if (isPeriodLocked.value) return
  feedback.value = ''
  editingId.value = ''
  Object.assign(form, {
    studentId: students.value[0]?.id || '',
    achievementId: '',
    description: '',
    dueDate: '',
    teacherId: '',
    status: 'pending',
    resultScore: null,
  })
  isModalOpen.value = true
}

const openEditModal = (strat: SupportStrategyDto) => {
  feedback.value = ''
  editingId.value = strat.id
  Object.assign(form, {
    studentId: strat.studentId,
    achievementId: strat.achievementId || '',
    description: strat.description,
    dueDate: strat.dueDate ? strat.dueDate.split('T')[0] : '',
    teacherId: strat.teacherId || '',
    status: strat.status,
    resultScore: strat.resultScore !== null ? Number(strat.resultScore) : null,
  })
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitForm = async () => {
  if (isPeriodLocked.value) return
  submitting.value = true
  feedback.value = ''
  try {
    const payload = {
      academicYearId: filters.academicYearId,
      academicPeriodId: filters.academicPeriodId,
      subjectId: filters.subjectId,
      ...form,
    }

    if (editingId.value) {
      await api.updateSupportStrategy(editingId.value, payload)
      feedback.value = 'Estrategia de apoyo actualizada.'
    } else {
      await api.createSupportStrategy(payload)
      feedback.value = 'Estrategia de apoyo registrada.'
    }

    closeModal()
    await loadStrategies()
  } catch (err: any) {
    feedback.value = err.message || 'Error al guardar.'
  } finally {
    submitting.value = false
  }
}

const deleteStrategy = async (id: string) => {
  if (isPeriodLocked.value) return
  if (!confirm('¿Estás seguro de que deseas eliminar este plan de apoyo?')) return
  try {
    await api.deleteSupportStrategy(id)
    feedback.value = 'Estrategia eliminada con éxito.'
    await loadStrategies()
  } catch (err: any) {
    feedback.value = err.message || 'Error al eliminar.'
  }
}

onMounted(() => {
  loadOptions()
})
</script>
