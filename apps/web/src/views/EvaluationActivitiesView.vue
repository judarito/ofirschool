<template>
  <section class="stack">
    <PageHeader eyebrow="Evaluación" title="Actividades Evaluativas" subtitle="Gestiona tareas, talleres, exámenes y proyectos asociados a los logros del periodo.">
      <template #actions>
        <button 
          v-if="canManage" 
          class="button button--brand" 
          type="button" 
          :disabled="submitting" 
          @click="openCreateModal"
        >
          Nueva actividad
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
      ⚠️ El periodo seleccionado está <strong>{{ periodStatusLabel }}</strong>. Las actividades y calificaciones se encuentran bloqueadas para modificaciones.
    </div>

    <!-- Contenido principal / Lista de actividades -->
    <SurfaceCard v-if="isFiltersSelected">
      <div class="card-headline">
        <div>
          <h3>Actividades Programadas</h3>
          <p class="text-xs text-gray-500 mt-1">
            Materia: <strong>{{ selectedSubjectName }}</strong> | Grupo: <strong>{{ selectedGroupName }}</strong> | Peso Total: <strong>{{ totalWeight }}% / 100%</strong>
          </p>
        </div>
        <button 
          v-if="canManage"
          class="button button--brand" 
          type="button" 
          :disabled="submitting" 
          @click="openCreateModal"
        >
          Nueva actividad
        </button>
      </div>

      <div v-if="loading" class="empty-state">
        Cargando actividades evaluativas...
      </div>

      <div v-else-if="activities.length === 0" class="empty-state">
        <p>No se han registrado actividades evaluativas para esta asignatura en este periodo.</p>
        <button 
          v-if="!isPeriodLocked" 
          class="button button--ghost button--sm mt-4" 
          type="button" 
          @click="openCreateModal"
        >
          Crear la primera actividad
        </button>
      </div>

      <div v-else class="list-view__table-wrap">
        <table class="list-view__table">
          <thead>
            <tr>
              <th>Nombre / Descripción</th>
              <th>Tipo</th>
              <th>Logro Asociado</th>
              <th>Peso</th>
              <th>Nota Máx.</th>
              <th>Fecha Límite</th>
              <th>Estado</th>
              <th class="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="act in activities" :key="act.id">
              <td>
                <strong class="text-gray-900 block">{{ act.name }}</strong>
                <span class="text-xs text-gray-500 block max-w-xs truncate">{{ act.description || 'Sin descripción' }}</span>
              </td>
              <td>
                <span class="meta-badge meta-badge--blue">{{ translateActivityType(act.activityType) }}</span>
              </td>
              <td>
                <span class="meta-badge meta-badge--green" :title="act.achievementTitle">
                  🎯 [{{ act.achievementCode }}] {{ act.achievementTitle }}
                </span>
              </td>
              <td>
                <strong>{{ act.weightPercentage }}%</strong>
              </td>
              <td>{{ act.maxScore }}</td>
              <td>{{ act.dueDate ? formatDate(act.dueDate) : 'No definida' }}</td>
              <td>
                <span :class="['meta-badge', act.isPublished ? 'meta-badge--green' : 'meta-badge--gray']">
                  {{ act.isPublished ? 'Publicada' : 'Borrador' }}
                </span>
              </td>
              <td>
                <div class="flex justify-end gap-2">
                  <router-link 
                    :to="`/academic/evaluation-activities/${act.id}/scores`" 
                    class="button button--ghost button--sm"
                  >
                    ✏️ Calificar
                  </router-link>
                  <button 
                    class="button button--ghost button--sm" 
                    type="button" 
                    :disabled="isPeriodLocked"
                    @click="openEditModal(act)"
                  >
                    ✏️ Editar
                  </button>
                  <button 
                    class="button button--ghost button--sm text-red" 
                    type="button" 
                    :disabled="isPeriodLocked"
                    @click="deleteActivity(act)"
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
      <p class="text-gray-500">Selecciona el año lectivo, periodo, curso y materia para visualizar o gestionar las actividades evaluativas.</p>
    </SurfaceCard>

    <!-- Modal Formulario Creación/Edición -->
    <FormModal :open="isModalOpen" :title="editingId ? 'Editar Actividad Evaluativa' : 'Nueva Actividad Evaluativa'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label class="form-grid__wide">
          Nombre de la actividad *
          <input v-model="form.name" required placeholder="Ej. Taller de ecuaciones, Examen parcial..." />
        </label>

        <label class="form-grid__wide">
          Descripción
          <textarea v-model="form.description" placeholder="Describe brevemente la actividad, instrucciones o rúbrica..." />
        </label>

        <label>
          Tipo de actividad *
          <select v-model="form.activityType" required>
            <option value="workshop">Taller</option>
            <option value="exam">Examen</option>
            <option value="quiz">Quiz</option>
            <option value="homework">Tarea</option>
            <option value="project">Proyecto</option>
            <option value="participation">Participación</option>
            <option value="autoevaluation">Autoevaluación</option>
            <option value="coevaluation">Coevaluación</option>
            <option value="other">Otro</option>
          </select>
        </label>

        <label>
          Logro Académico Asociado *
          <select v-model="form.achievementId" required>
            <option value="" disabled>Seleccione un logro</option>
            <option v-for="ach in achievements" :key="ach.id" :value="ach.id">
              [{{ ach.code }}] {{ ach.title }}
            </option>
          </select>
        </label>

        <label>
          Peso porcentual (%) *
          <input v-model.number="form.weightPercentage" type="number" min="1" max="100" required />
        </label>

        <label>
          Calificación Máxima *
          <input v-model.number="form.maxScore" type="number" min="1" max="100" required />
        </label>

        <label>
          Fecha Límite / Entrega
          <input v-model="form.dueDate" type="date" />
        </label>

        <div class="form-grid__wide flex items-center gap-2 mt-2">
          <input id="isPublished" v-model="form.isPublished" type="checkbox" />
          <label for="isPublished" style="margin: 0; cursor: pointer;">
            Publicar inmediatamente (los estudiantes podrán ver sus calificaciones)
          </label>
        </div>

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
  EvaluationActivityDto
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
const activities = ref<EvaluationActivityDto[]>([])
const achievements = ref<any[]>([]) // achievements database

const filters = reactive({
  academicYearId: '',
  academicPeriodId: '',
  groupId: '',
  subjectId: '',
})

const form = reactive({
  name: '',
  description: '',
  activityType: 'workshop',
  achievementId: '',
  weightPercentage: 20,
  maxScore: 5,
  dueDate: '',
  isPublished: true,
})

// Permissions/Lock status
const canManage = ref(true) // Can be extended with actual user roles if needed

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

const totalWeight = computed(() => 
  activities.value.reduce((acc, act) => acc + act.weightPercentage, 0)
)

const translateActivityType = (type: string) => {
  const map: Record<string, string> = {
    workshop: 'Taller',
    exam: 'Examen',
    quiz: 'Quiz',
    homework: 'Tarea',
    project: 'Proyecto',
    participation: 'Participación',
    autoevaluation: 'Autoevaluación',
    coevaluation: 'Coevaluación',
    other: 'Otro',
  }
  return map[type] || type
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

// Watch filters to reload evaluation activities
watch(
  () => [filters.academicPeriodId, filters.groupId, filters.subjectId],
  async ([periodId, groupId, subjectId]) => {
    if (periodId && groupId && subjectId) {
      await loadActivities()
      await loadAchievements()
    } else {
      activities.value = []
      achievements.value = []
    }
  }
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

const loadActivities = async () => {
  if (!isFiltersSelected.value) {
    feedback.value = 'Selecciona año, periodo, curso y materia para cargar actividades.'
    return
  }
  loading.value = true
  feedback.value = ''
  try {
    const res = await api.getEvaluationActivities({
      academicYearId: filters.academicYearId,
      academicPeriodId: filters.academicPeriodId,
      groupId: filters.groupId,
      subjectId: filters.subjectId,
    })
    activities.value = res.data.items
  } catch (err: any) {
    feedback.value = err.message || 'Error al cargar las actividades.'
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
    feedback.value = err.message || 'No fue posible cargar los logros asociados a la materia.'
  }
}

const openCreateModal = () => {
  if (!isFiltersSelected.value) {
    feedback.value = 'Antes de crear una actividad selecciona año, periodo, curso y materia.'
    return
  }
  if (isPeriodLocked.value) {
    feedback.value = `El periodo seleccionado está ${periodStatusLabel.value}. No puedes crear actividades en este corte.`
    return
  }
  if (!achievements.value.length) {
    feedback.value = 'No hay logros configurados para esta materia y periodo. Crea primero al menos un logro.'
    return
  }
  feedback.value = ''
  editingId.value = ''
  Object.assign(form, {
    name: '',
    description: '',
    activityType: 'workshop',
    achievementId: achievements.value[0]?.id || '',
    weightPercentage: 20,
    maxScore: 5,
    dueDate: '',
    isPublished: true,
  })
  isModalOpen.value = true
}

const openEditModal = (act: EvaluationActivityDto) => {
  if (isPeriodLocked.value) {
    feedback.value = `El periodo seleccionado está ${periodStatusLabel.value}. No puedes editar actividades en este corte.`
    return
  }
  feedback.value = ''
  editingId.value = act.id
  Object.assign(form, {
    name: act.name,
    description: act.description || '',
    activityType: act.activityType,
    achievementId: act.achievementId,
    weightPercentage: act.weightPercentage,
    maxScore: act.maxScore,
    dueDate: act.dueDate ? act.dueDate.split('T')[0] : '',
    isPublished: act.isPublished,
  })
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const submitForm = async () => {
  if (!isFiltersSelected.value) {
    feedback.value = 'Antes de guardar, define año, periodo, curso y materia.'
    return
  }
  if (isPeriodLocked.value) {
    feedback.value = `El periodo seleccionado está ${periodStatusLabel.value}. No puedes guardar cambios en actividades.`
    return
  }
  submitting.value = true
  feedback.value = ''
  try {
    const payload = {
      academicYearId: filters.academicYearId,
      academicPeriodId: filters.academicPeriodId,
      groupId: filters.groupId,
      subjectId: filters.subjectId,
      ...form,
    }

    if (editingId.value) {
      await api.updateEvaluationActivity(editingId.value, payload)
      feedback.value = 'Actividad actualizada con éxito.'
    } else {
      await api.createEvaluationActivity(payload)
      feedback.value = 'Actividad creada con éxito.'
    }
    
    closeModal()
    await loadActivities()
  } catch (err: any) {
    feedback.value = err.message || 'Error al guardar la actividad.'
  } finally {
    submitting.value = false
  }
}

const deleteActivity = async (act: EvaluationActivityDto) => {
  if (isPeriodLocked.value) {
    feedback.value = `El periodo seleccionado está ${periodStatusLabel.value}. No puedes borrar actividades en este corte.`
    return
  }
  if (!confirm(`¿Estás seguro de que deseas eliminar la actividad "${act.name}"? Se borrarán también todas las calificaciones asociadas.`)) {
    return
  }
  
  try {
    await api.deleteEvaluationActivity(act.id)
    feedback.value = 'Actividad eliminada con éxito.'
    await loadActivities()
  } catch (err: any) {
    feedback.value = err.message || 'Error al eliminar la actividad.'
  }
}

onMounted(() => {
  loadOptions()
})
</script>
