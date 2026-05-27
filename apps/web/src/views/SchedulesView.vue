<template>
  <section class="stack">
    <PageHeader
      eyebrow="Academico"
      title="Horarios"
      subtitle="Configura jornadas, franjas y opciones por curso; luego genera el horario borrador con base en la intensidad horaria y la carga docente."
    >
      <template #actions>
        <button class="button button--ghost" type="button" @click="activeTab = 'journeys'">Configurar base</button>
        <button class="button button--brand" type="button" :disabled="isGenerating" @click="openGenerationModal">
          {{ isGenerating ? 'Generando...' : 'Generar horario' }}
        </button>
      </template>
    </PageHeader>

    <SurfaceCard class="module-inline-summary">
      <div class="module-inline-summary__copy">
        <strong>{{ primaryGuide.status }}</strong>
        <p>{{ primaryGuide.description }}</p>
      </div>
      <div class="module-inline-summary__meta">
        <span>{{ scheduleSummary.configuredGroups }} / {{ coursesForYear.length }} cursos</span>
        <small>{{ generationStatusLabel }}</small>
      </div>
      <div class="module-inline-summary__actions">
        <button class="button button--ghost" type="button" @click="activeTab = primaryGuide.secondaryTab">Ir a {{ primaryGuide.secondaryLabel }}</button>
        <button class="button button--ghost" type="button" @click="handlePrimaryGuideAction">{{ primaryGuide.actionLabel }}</button>
      </div>
    </SurfaceCard>

    <section class="schedule-tabs" aria-label="Flujo de horarios">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="schedule-tab"
        :class="{ 'schedule-tab--active': activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <strong>{{ tab.label }}</strong>
        <span>{{ tab.helper }}</span>
      </button>
    </section>

    <ListView
      v-if="activeTab === 'journeys'"
      ref="journeysListRef"
      title="Jornadas por año lectivo"
      subtitle="Define mañana, tarde, única u otras variantes dentro del año lectivo."
      :columns="journeyColumns"
      :fetcher="fetchJourneys"
      search-placeholder="Buscar jornada"
      create-label="Nueva jornada"
      :reload-key="journeyReloadKey"
      @create="openJourneyCreate"
      @edit="openJourneyEdit"
      @delete="openJourneyDelete"
    >
      <template #toolbar-actions>
        <select v-model="filters.academicYearId" class="toolbar-select">
          <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
        </select>
        <button class="button button--brand" type="button" @click="openJourneyCreate">Nueva jornada</button>
      </template>
      <template #cell-isActive="{ value }">
        <span :class="['meta-badge', value ? 'meta-badge--success' : 'meta-badge--muted']">{{ value ? 'Activa' : 'Inactiva' }}</span>
      </template>
      <template #cell-scopeLabel="{ row }">
        <div class="schedule-scope-cell">
          <span :class="['meta-badge', scopeBadgeClass(String(row.scopeType || 'global'))]">
            {{ row.scopeBadge }}
          </span>
          <small>{{ row.scopeLabel }}</small>
        </div>
      </template>
      <template #cell-window="{ row }">
        <span>{{ row.window }}</span>
      </template>
    </ListView>

    <ListView
      v-else-if="activeTab === 'slots'"
      ref="slotsListRef"
      title="Franjas de la jornada"
      subtitle="Arma los bloques reales por día. El generador solo usa las franjas de tipo clase."
      :columns="slotColumns"
      :fetcher="fetchJourneySlots"
      search-placeholder="Buscar franja o día"
      create-label="Nueva franja"
      :reload-key="slotReloadKey"
      @create="openSlotCreate"
      @edit="openSlotEdit"
      @delete="openSlotDelete"
    >
      <template #toolbar-actions>
        <select v-model="selectedJourneyId" class="toolbar-select">
          <option value="">{{ journeyOptions.length ? 'Selecciona jornada' : 'Sin jornadas creadas' }}</option>
          <option v-for="journey in journeyOptions" :key="journey.id" :value="journey.id">{{ journeyOptionLabel(journey) }}</option>
        </select>
        <button class="button button--brand" type="button" :disabled="!selectedJourneyId" @click="openSlotCreate">Nueva franja</button>
      </template>
      <template #cell-slotType="{ value }">
        <span :class="['meta-badge', slotTypeBadge(String(value))]">{{ translateSlotType(String(value)) }}</span>
      </template>
      <template #cell-window="{ row }">
        <span>{{ row.window }}</span>
      </template>
    </ListView>

    <ListView
      v-else-if="activeTab === 'groups'"
      ref="groupOptionsListRef"
      title="Jornadas posibles por curso"
      subtitle="Un mismo curso puede tener varias jornadas candidatas; marca una preferida para guiar el generador."
      :columns="groupOptionColumns"
      :fetcher="fetchGroupJourneyOptions"
      search-placeholder="Buscar curso o jornada"
      create-label="Nueva opción"
      :reload-key="groupOptionReloadKey"
      @create="openGroupOptionCreate"
      @edit="openGroupOptionEdit"
      @delete="openGroupOptionDelete"
    >
      <template #toolbar-actions>
        <select v-model="filters.academicYearId" class="toolbar-select">
          <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
        </select>
        <select v-model="timetableFilters.groupId" class="toolbar-select">
          <option value="">Todos los cursos</option>
          <option v-for="course in coursesForYear" :key="course.id" :value="course.id">{{ course.gradeName }} · {{ course.name }}</option>
        </select>
        <button class="button button--brand" type="button" @click="openGroupOptionCreate">Nueva opción</button>
      </template>
      <template #cell-journeyLabel="{ row }">
        <div class="schedule-scope-cell">
          <span :class="['meta-badge', scopeBadgeClass(String(row.scopeType || 'global'))]">
            {{ row.scopeBadge }}
          </span>
          <strong>{{ row.journeyLabel }}</strong>
          <small>{{ row.scopeLabel }}</small>
        </div>
      </template>
      <template #cell-isPreferred="{ value }">
        <span :class="['meta-badge', value ? 'meta-badge--success' : 'meta-badge--muted']">{{ value ? 'Preferida' : 'Alterna' }}</span>
      </template>
    </ListView>

    <section v-else class="stack">
      <SurfaceCard class="schedule-generation-card">
        <div class="card-headline">
          <div>
            <h3>Generación y revisión</h3>
            <p>Genera el borrador, revisa conflictos y vuelve a intentar cuando ajustes la base.</p>
          </div>
          <button class="button button--brand" type="button" :disabled="isGenerating" @click="openGenerationModal">
            {{ isGenerating ? 'Generando...' : 'Generar borrador' }}
          </button>
        </div>

        <div class="form-grid form-grid--compact">
          <label>
            Año lectivo
            <select v-model="filters.academicYearId">
              <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
            </select>
          </label>
          <label>
            Curso
            <select v-model="timetableFilters.groupId">
              <option value="">Todos los cursos</option>
              <option v-for="course in coursesForYear" :key="course.id" :value="course.id">{{ course.gradeName }} · {{ course.name }}</option>
            </select>
          </label>
          <label>
            Jornada
            <select v-model="timetableFilters.journeyId">
              <option value="">Todas las jornadas</option>
              <option v-for="journey in journeyOptions" :key="journey.id" :value="journey.id">{{ journeyOptionLabel(journey) }}</option>
            </select>
          </label>
          <label>
            Docente
            <select v-model="timetableFilters.teacherId">
              <option value="">Todos los docentes</option>
              <option v-for="teacher in activeTeachers" :key="teacher.id" :value="teacher.id">{{ teacher.fullName }}</option>
            </select>
          </label>
        </div>

        <div v-if="lastGenerationResult" class="schedule-generation-summary">
          <span>{{ lastGenerationResult.generatedGroups }} cursos generados</span>
          <span>{{ lastGenerationResult.generatedEntries }} bloques creados</span>
          <span>{{ lastGenerationResult.conflicts.length }} conflictos</span>
        </div>

        <div v-if="lastGenerationResult?.conflicts.length" class="schedule-conflicts">
          <article v-for="conflict in lastGenerationResult.conflicts" :key="conflict" class="schedule-conflict">
            {{ conflict }}
          </article>
        </div>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" :disabled="isUpdatingStatus" @click="changeTimetableStatus('draft')">
            Volver a borrador
          </button>
          <button class="button button--ghost" type="button" :disabled="isUpdatingStatus" @click="changeTimetableStatus('published')">
            Publicar horario
          </button>
          <button class="button button--brand" type="button" :disabled="isUpdatingStatus" @click="changeTimetableStatus('locked')">
            {{ isUpdatingStatus ? 'Actualizando...' : 'Bloquear horario' }}
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard class="schedule-scheduler-card">
        <div class="card-headline">
          <div>
            <h3>Vista semanal del horario</h3>
            <p>{{ schedulerDescription }}</p>
          </div>
          <span v-if="schedulerContextLabel" class="meta-badge meta-badge--info">{{ schedulerContextLabel }}</span>
        </div>

        <div v-if="!canRenderScheduler" class="schedule-scheduler-empty">
          <strong>Elige un curso o un docente para ver el horario en formato semanal.</strong>
          <p>La grilla tipo scheduler funciona mejor cuando se enfoca en una sola agenda operativa.</p>
        </div>

        <div v-else-if="!schedulerRows.length" class="schedule-scheduler-empty">
          <strong>No hay bloques para los filtros actuales.</strong>
          <p>Genera el borrador o ajusta curso, docente y jornada para cargar una agenda visible.</p>
        </div>

        <div v-else class="schedule-scheduler" :style="{ '--scheduler-days': String(Math.max(schedulerDays.length, 1)) }">
          <div class="schedule-scheduler__corner">Hora</div>
          <div v-for="day in schedulerDays" :key="day.value" class="schedule-scheduler__day">{{ day.label }}</div>

          <template v-for="row in schedulerRows" :key="row.key">
            <div class="schedule-scheduler__time">
              <strong>Bloque {{ row.slotOrder }}</strong>
              <small>{{ row.window }}</small>
            </div>
            <div
              v-for="day in schedulerDays"
              :key="`${row.key}-${day.value}`"
              class="schedule-scheduler__cell"
            >
              <article
                v-for="entry in schedulerEntriesByCell[`${day.value}-${row.key}`] ?? []"
                :key="entry.id"
                class="schedule-scheduler-entry"
                :class="`schedule-scheduler-entry--${entry.status}`"
              >
                <div class="schedule-scheduler-entry__header">
                  <strong>{{ entry.subjectName }}</strong>
                  <span>{{ entry.startsAt }} - {{ entry.endsAt }}</span>
                </div>
                <p>{{ entry.teacherName || 'Sin docente' }}</p>
                <small v-if="!timetableFilters.groupId">{{ entry.gradeName }} · {{ entry.groupName }}</small>
                <small v-else-if="!timetableFilters.teacherId">{{ entry.teacherName || 'Sin docente' }}</small>
                <button
                  class="table-action"
                  type="button"
                  :disabled="entry.status === 'locked'"
                  @click="openEntryEdit(entry as unknown as Record<string, unknown>)"
                >
                  Mover
                </button>
              </article>
            </div>
          </template>
        </div>
      </SurfaceCard>

      <ListView
        ref="timetableListRef"
        title="Horario generado"
        subtitle="Consulta el borrador actual por curso, jornada y bloque."
        :columns="timetableColumns"
        :fetcher="fetchTimetable"
        search-placeholder="Buscar curso, materia o docente"
        :reload-key="timetableReloadKey"
        @edit="openEntryEdit"
      >
        <template #toolbar-actions>
          <button class="button button--ghost" type="button" @click="reloadTimetable">Recargar</button>
        </template>
        <template #cell-window="{ row }">
          <span>{{ row.window }}</span>
        </template>
        <template #cell-groupLabel="{ row }">
          <div class="schedule-scope-cell">
            <strong>{{ row.groupLabel }}</strong>
            <small>{{ row.journeyScopeLabel || row.journeyName }}</small>
          </div>
        </template>
        <template #cell-status="{ value }">
          <span :class="['meta-badge', value === 'draft' ? 'meta-badge--warning' : 'meta-badge--info']">{{ value }}</span>
        </template>
        <template #row-actions="{ row }">
          <button class="table-action" type="button" :disabled="String(row.status) === 'locked'" @click="openEntryEdit(row)">Mover bloque</button>
        </template>
      </ListView>
    </section>

    <FormModal :open="activeModal === 'journey'" :title="editingJourneyId ? 'Editar jornada' : 'Nueva jornada'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitJourney">
        <label>
          Año lectivo
          <select v-model="journeyForm.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Nivel
          <select v-model="journeyForm.targetLevelName">
            <option value="">Todos los niveles</option>
            <option value="preschool">Preescolar</option>
            <option value="primary">Primaria</option>
            <option value="secondary">Secundaria</option>
            <option value="middle">Media / bachillerato</option>
          </select>
        </label>
        <label>
          Grado específico
          <select v-model="journeyForm.targetGradeId">
            <option value="">{{ journeyForm.targetLevelName ? 'Todos los grados del nivel' : 'Todos los grados' }}</option>
            <option v-for="grade in availableTargetGrades" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>
        <label>Nombre<input v-model="journeyForm.name" required placeholder="Jornada mañana" /></label>
        <label>Código<input v-model="journeyForm.code" required placeholder="MAN" /></label>
        <label>Hora inicio<input v-model="journeyForm.startsAt" type="time" required /></label>
        <label>Hora fin<input v-model="journeyForm.endsAt" type="time" required /></label>
        <label class="checkbox-field">
          <input v-model="journeyForm.isActive" type="checkbox" />
          <span>Jornada activa</span>
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="isSavingJourney">
            {{ isSavingJourney ? 'Guardando...' : 'Guardar jornada' }}
          </button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'slot'" :title="editingSlotId ? 'Editar franja' : 'Nueva franja'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitSlot">
        <label>
          Jornada
          <select v-model="slotForm.journeyId" required>
            <option v-for="journey in journeyOptions" :key="journey.id" :value="journey.id">{{ journeyOptionLabel(journey) }}</option>
          </select>
        </label>
        <label>
          Día
          <select v-model="slotForm.dayOfWeek" required>
            <option v-for="day in weekdays" :key="day.value" :value="day.value">{{ day.label }}</option>
          </select>
        </label>
        <label>Orden del bloque<input v-model.number="slotForm.slotOrder" type="number" min="1" max="20" required /></label>
        <label>Hora inicio<input v-model="slotForm.startsAt" type="time" required /></label>
        <label>Hora fin<input v-model="slotForm.endsAt" type="time" required /></label>
        <label>
          Tipo
          <select v-model="slotForm.slotType" required>
            <option value="class">Clase</option>
            <option value="break">Descanso</option>
            <option value="homeroom">Dirección de grupo</option>
            <option value="lunch">Almuerzo</option>
            <option value="institutional">Institucional</option>
          </select>
        </label>
        <label>Etiqueta<input v-model="slotForm.label" placeholder="Bloque 1" /></label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="isSavingSlot">
            {{ isSavingSlot ? 'Guardando...' : 'Guardar franja' }}
          </button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'group-option'" :title="editingGroupOptionId ? 'Editar opción de jornada' : 'Nueva opción de jornada'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitGroupOption">
        <label>
          Año lectivo
          <select v-model="groupOptionForm.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Curso
          <select v-model="groupOptionForm.groupId" required>
            <option v-for="course in coursesForYear" :key="course.id" :value="course.id">{{ course.gradeName }} · {{ course.name }}</option>
          </select>
        </label>
        <label>
          Jornada
          <select v-model="groupOptionForm.journeyId" required>
            <option v-for="journey in eligibleJourneysForSelectedCourse" :key="journey.id" :value="journey.id">{{ journeyOptionLabel(journey) }}</option>
          </select>
        </label>
        <label>Prioridad<input v-model.number="groupOptionForm.priority" type="number" min="0" max="100" required /></label>
        <label class="checkbox-field">
          <input v-model="groupOptionForm.isPreferred" type="checkbox" />
          <span>Marcar como preferida</span>
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="isSavingGroupOption">
            {{ isSavingGroupOption ? 'Guardando...' : 'Guardar opción' }}
          </button>
        </div>
      </form>
    </FormModal>

    <FormModal
      :open="activeModal === 'generate'"
      title="Generar horario borrador"
      description="Usa las jornadas preferidas por curso y respeta la carga docente ya configurada."
      @close="closeModal"
    >
      <form class="form-grid" @submit.prevent="submitGeneration">
        <label>
          Año lectivo
          <select v-model="generationForm.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Curso
          <select v-model="generationForm.groupId">
            <option value="">Todos los cursos configurados</option>
            <option v-for="course in coursesForYear" :key="course.id" :value="course.id">{{ course.gradeName }} · {{ course.name }}</option>
          </select>
        </label>
        <label class="checkbox-field checkbox-field--full">
          <input v-model="generationForm.overwriteExisting" type="checkbox" />
          <span>Reemplazar borradores anteriores del curso o cohorte seleccionada</span>
        </label>
        <p class="form-note">
          Si faltan docentes, bloques de clase o jornadas para algún curso, el sistema no lo deja pasar en silencio: lo devuelve como conflicto.
        </p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="isGenerating">
            {{ isGenerating ? 'Generando...' : 'Generar ahora' }}
          </button>
        </div>
      </form>
    </FormModal>

    <FormModal
      :open="activeModal === 'entry'"
      :title="editingEntryId ? 'Ajustar bloque del horario' : 'Bloque del horario'"
      description="Mueve el bloque a otra jornada o franja válida del mismo curso."
      @close="closeModal"
    >
      <form class="form-grid" @submit.prevent="submitEntryUpdate">
        <label>
          Jornada destino
          <select v-model="entryForm.journeyId" required>
            <option v-for="journey in entryJourneyOptions" :key="journey.id" :value="journey.id">{{ journeyOptionLabel(journey) }}</option>
          </select>
        </label>
        <label>
          Franja destino
          <select v-model="entryForm.journeySlotId" required>
            <option v-for="slot in entrySlotOptions" :key="slot.id" :value="slot.id">
              {{ slotDayLabel(slot.dayOfWeek) }} · Bloque {{ slot.slotOrder }} · {{ slot.startsAt }} - {{ slot.endsAt }}
            </option>
          </select>
        </label>
        <label class="form-grid__full">
          Observaciones
          <textarea v-model="entryForm.notes" rows="3" placeholder="Motivo del ajuste o nota operativa"></textarea>
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit" :disabled="isSavingEntry">
            {{ isSavingEntry ? 'Guardando...' : 'Guardar ajuste' }}
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
  AcademicGradeDto,
  AcademicYearDto,
  AcademicYearJourneyDto,
  AcademicYearJourneySlotDto,
  CourseDto,
  GroupJourneyOptionDto,
  GroupTimetableEntryDto,
  TeacherDto,
  TimetableGenerationResultDto,
} from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'
import { useAcademicContextStore } from '../stores/academic-context'

type TabId = 'journeys' | 'slots' | 'groups' | 'generate'
type Row = { id: string } & Record<string, unknown>

const academicContext = useAcademicContextStore()

const weekdays = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
]

const tabs = [
  { id: 'journeys' as TabId, label: '1. Jornadas', helper: 'Mañana, tarde, única y similares.' },
  { id: 'slots' as TabId, label: '2. Franjas', helper: 'Bloques por día dentro de cada jornada.' },
  { id: 'groups' as TabId, label: '3. Cursos', helper: 'Jornadas posibles por curso.' },
  { id: 'generate' as TabId, label: '4. Generar', helper: 'Borrador y conflictos del horario.' },
]

const journeyColumns = [
  { key: 'academicYearName', label: 'Año lectivo' },
  { key: 'name', label: 'Jornada' },
  { key: 'scopeLabel', label: 'Aplica a' },
  { key: 'code', label: 'Código' },
  { key: 'window', label: 'Horario base' },
  { key: 'isActive', label: 'Estado' },
]

const slotColumns = [
  { key: 'journeyName', label: 'Jornada' },
  { key: 'dayLabel', label: 'Día' },
  { key: 'slotOrder', label: 'Bloque' },
  { key: 'window', label: 'Hora' },
  { key: 'slotType', label: 'Tipo' },
]

const groupOptionColumns = [
  { key: 'groupLabel', label: 'Curso' },
  { key: 'journeyLabel', label: 'Jornada' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'isPreferred', label: 'Preferida' },
]

const timetableColumns = [
  { key: 'groupLabel', label: 'Curso' },
  { key: 'dayLabel', label: 'Día' },
  { key: 'slotOrder', label: 'Bloque' },
  { key: 'window', label: 'Hora' },
  { key: 'subjectName', label: 'Materia' },
  { key: 'teacherName', label: 'Docente' },
  { key: 'status', label: 'Estado' },
]

const activeTab = ref<TabId>('journeys')
const activeModal = ref<'' | 'journey' | 'slot' | 'group-option' | 'generate' | 'entry'>('')
const feedback = ref('')

const academicYears = ref<AcademicYearDto[]>([])
const grades = ref<AcademicGradeDto[]>([])
const courses = ref<CourseDto[]>([])
const teachers = ref<TeacherDto[]>([])
const journeyOptions = ref<AcademicYearJourneyDto[]>([])
const journeyCache = ref<AcademicYearJourneyDto[]>([])
const slotCache = ref<AcademicYearJourneySlotDto[]>([])
const groupOptionCache = ref<GroupJourneyOptionDto[]>([])
const timetableCache = ref<GroupTimetableEntryDto[]>([])
const lastGenerationResult = ref<TimetableGenerationResultDto | null>(null)

const journeysListRef = ref<{ reload: () => Promise<void> } | null>(null)
const slotsListRef = ref<{ reload: () => Promise<void> } | null>(null)
const groupOptionsListRef = ref<{ reload: () => Promise<void> } | null>(null)
const timetableListRef = ref<{ reload: () => Promise<void> } | null>(null)

const journeyReloadKey = ref(0)
const slotReloadKey = ref(0)
const groupOptionReloadKey = ref(0)
const timetableReloadKey = ref(0)

const selectedJourneyId = ref('')
const filters = reactive({
  academicYearId: '',
})
const timetableFilters = reactive({
  groupId: '',
  journeyId: '',
  teacherId: '',
})

const editingJourneyId = ref('')
const editingSlotId = ref('')
const editingGroupOptionId = ref('')
const editingEntryId = ref('')
const isSavingJourney = ref(false)
const isSavingSlot = ref(false)
const isSavingGroupOption = ref(false)
const isSavingEntry = ref(false)
const isGenerating = ref(false)
const isUpdatingStatus = ref(false)

const journeyForm = reactive({
  academicYearId: '',
  branchId: '',
  targetLevelName: '',
  targetGradeId: '',
  name: '',
  code: '',
  startsAt: '06:30',
  endsAt: '12:30',
  isActive: true,
})

const slotForm = reactive({
  journeyId: '',
  dayOfWeek: 'monday',
  slotOrder: 1,
  startsAt: '06:30',
  endsAt: '07:20',
  slotType: 'class',
  label: '',
})

const groupOptionForm = reactive({
  academicYearId: '',
  groupId: '',
  journeyId: '',
  priority: 0,
  isPreferred: false,
})

const generationForm = reactive({
  academicYearId: '',
  groupId: '',
  overwriteExisting: true,
})

const entryForm = reactive({
  journeyId: '',
  journeySlotId: '',
  notes: '',
})

const resolvedAcademicYearId = computed(() =>
  filters.academicYearId || academicContext.activeYearId || academicYears.value[0]?.id || '',
)
const availableTargetGrades = computed(() => {
  if (!journeyForm.targetLevelName) return grades.value
  return grades.value.filter((grade) => grade.levelName === journeyForm.targetLevelName)
})

const coursesForYear = computed(() => courses.value.filter((course) => course.academicYearId === filters.academicYearId))
const activeTeachers = computed(() => teachers.value.filter((teacher) => teacher.status === 'active'))
const selectedTimetableCourse = computed(() =>
  courses.value.find((course) => course.id === timetableFilters.groupId) ?? null,
)
const selectedTimetableTeacher = computed(() =>
  teachers.value.find((teacher) => teacher.id === timetableFilters.teacherId) ?? null,
)
const eligibleJourneysForSelectedCourse = computed(() => {
  const selectedCourse = courses.value.find((course) => course.id === groupOptionForm.groupId)
  if (!selectedCourse) return journeyOptions.value

  return journeyOptions.value.filter((journey) => {
    if (journey.targetGradeId) return journey.targetGradeId === selectedCourse.gradeId
    if (journey.targetLevelName) {
      const selectedGrade = grades.value.find((grade) => grade.id === selectedCourse.gradeId)
      return selectedGrade?.levelName === journey.targetLevelName
    }
    return true
  })
})
const entryJourneyOptions = computed(() => {
  if (!editingEntryId.value) return journeyOptions.value
  const entry = timetableCache.value.find((item) => item.id === editingEntryId.value)
  if (!entry) return journeyOptions.value
  const allowedIds = new Set(
    groupOptionCache.value
      .filter((item) => item.groupId === entry.groupId)
      .map((item) => item.journeyId),
  )
  return journeyOptions.value.filter((journey) => allowedIds.has(journey.id))
})
const entrySlotOptions = computed(() =>
  slotCache.value
    .filter((slot) => slot.journeyId === entryForm.journeyId && slot.slotType === 'class')
    .sort((left, right) => {
      const leftDay = weekdays.findIndex((day) => day.value === left.dayOfWeek)
      const rightDay = weekdays.findIndex((day) => day.value === right.dayOfWeek)
      if (leftDay !== rightDay) return leftDay - rightDay
      return left.slotOrder - right.slotOrder
    }),
)
const selectedJourneyLabel = computed(() => {
  const journey = journeyOptions.value.find((item) => item.id === selectedJourneyId.value)
  return journey ? `${journey.name} · ${journey.code}` : 'Selecciona una jornada'
})
const generationStatusLabel = computed(() => {
  if (!lastGenerationResult.value) return 'Aún no se ha generado borrador'
  if (lastGenerationResult.value.conflicts.length) return `${lastGenerationResult.value.conflicts.length} conflictos reportados`
  return 'Último intento sin conflictos'
})
const canRenderScheduler = computed(() => Boolean(timetableFilters.groupId || timetableFilters.teacherId))
const schedulerDescription = computed(() => {
  if (selectedTimetableCourse.value) return 'Agenda semanal del curso seleccionado, ideal para revisar huecos, cruces y distribución por día.'
  if (selectedTimetableTeacher.value) return 'Agenda semanal del docente seleccionado, útil para revisar carga, traslados y disponibilidad real.'
  return 'Selecciona un curso o un docente para ver la agenda en formato semanal.'
})
const schedulerContextLabel = computed(() => {
  if (selectedTimetableCourse.value) return `${selectedTimetableCourse.value.gradeName} · ${selectedTimetableCourse.value.name}`
  if (selectedTimetableTeacher.value) return selectedTimetableTeacher.value.fullName
  return ''
})
const schedulerDays = computed(() =>
  weekdays.filter((day) =>
    timetableCache.value.some((entry) => entry.dayOfWeek === day.value),
  ),
)
const schedulerRows = computed(() => {
  const rows = new Map<string, { key: string; slotOrder: number; window: string; startsAt: string; endsAt: string }>()
  for (const entry of timetableCache.value) {
    const key = `${entry.slotOrder}-${entry.startsAt}-${entry.endsAt}`
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        slotOrder: entry.slotOrder,
        window: `${entry.startsAt || '--'} - ${entry.endsAt || '--'}`,
        startsAt: entry.startsAt || '',
        endsAt: entry.endsAt || '',
      })
    }
  }
  return [...rows.values()].sort((left, right) => {
    if (left.slotOrder !== right.slotOrder) return left.slotOrder - right.slotOrder
    return left.startsAt.localeCompare(right.startsAt)
  })
})
const schedulerEntriesByCell = computed(() =>
  timetableCache.value.reduce<Record<string, GroupTimetableEntryDto[]>>((acc, entry) => {
    const rowKey = `${entry.slotOrder}-${entry.startsAt || ''}-${entry.endsAt || ''}`
    const key = `${entry.dayOfWeek}-${rowKey}`
    const bucket = acc[key] ?? (acc[key] = [])
    bucket.push(entry)
    bucket.sort((left, right) => {
      const leftStart = left.startsAt || ''
      const rightStart = right.startsAt || ''
      if (leftStart !== rightStart) return leftStart.localeCompare(rightStart)
      return (left.groupName || '').localeCompare(right.groupName || '')
    })
    return acc
  }, {}),
)

const scheduleSummary = computed(() => ({
  journeys: journeyCache.value.length,
  activeJourneys: journeyCache.value.filter((item) => item.isActive).length,
  slots: slotCache.value.length,
  configuredGroups: new Set(groupOptionCache.value.map((item) => item.groupId)).size,
  timetableEntries: timetableCache.value.length,
}))

const primaryGuide = computed(() => {
  if (!journeyCache.value.length) {
    return {
      status: 'Base vacía',
      description: 'Antes de pensar en generación, primero debemos crear al menos una jornada para el año lectivo.',
      actionLabel: 'Crear primera jornada',
      secondaryTab: 'journeys' as TabId,
      secondaryLabel: 'jornadas',
      items: [
        { label: 'Jornadas configuradas', value: '0', helper: 'Sin jornada no existe una plantilla horaria sobre la cual repartir materias.' },
      ],
    }
  }

  if (!slotCache.value.length) {
    return {
      status: 'Faltan franjas',
      description: 'Ya hay jornadas, pero aún no hay bloques reales para que el generador reparta la intensidad horaria.',
      actionLabel: 'Crear franjas',
      secondaryTab: 'slots' as TabId,
      secondaryLabel: 'franjas',
      items: [
        { label: 'Jornada seleccionada', value: selectedJourneyLabel.value, helper: 'Elige una jornada y define bloques tipo clase, descanso o institucionales.' },
      ],
    }
  }

  if (scheduleSummary.value.configuredGroups < coursesForYear.value.length) {
    return {
      status: 'Faltan cursos',
      description: 'La base temporal está lista, pero todavía faltan cursos por asociar a una o más jornadas candidatas.',
      actionLabel: 'Asignar jornadas a cursos',
      secondaryTab: 'groups' as TabId,
      secondaryLabel: 'cursos',
      items: [
        { label: 'Cursos con opción', value: String(scheduleSummary.value.configuredGroups), helper: `Hay ${coursesForYear.value.length} cursos en el año seleccionado.` },
      ],
    }
  }

  return {
    status: 'Listo para generar',
    description: 'La base mínima ya existe. El siguiente paso es generar el borrador y revisar conflictos de docentes o bloques.',
    actionLabel: 'Generar borrador',
    secondaryTab: 'generate' as TabId,
    secondaryLabel: 'revisión',
    items: [
      { label: 'Bloques listos', value: String(scheduleSummary.value.slots), helper: 'Se usarán solo las franjas de tipo clase para construir el horario.' },
      { label: 'Cursos configurados', value: String(scheduleSummary.value.configuredGroups), helper: 'Cada curso tomará su jornada preferida o la de menor prioridad disponible.' },
    ],
  }
})

const loadBaseOptions = async () => {
  const [yearsResponse, gradesResponse, coursesResponse, teachersResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getAcademicGrades({ page: 1, pageSize: 100 }),
    api.getCourses({ page: 1, pageSize: 100 }),
    api.getTeachers({ page: 1, pageSize: 100 }),
  ])

  academicYears.value = yearsResponse.data.items
  grades.value = gradesResponse.data.items
  courses.value = coursesResponse.data.items
  teachers.value = teachersResponse.data.items
  const defaultAcademicYearId = resolvedAcademicYearId.value || academicYears.value[0]?.id || ''
  filters.academicYearId = defaultAcademicYearId
  generationForm.academicYearId = defaultAcademicYearId
  journeyForm.academicYearId = defaultAcademicYearId
  groupOptionForm.academicYearId = defaultAcademicYearId
}

const ensureAcademicYearsLoaded = async () => {
  if (!academicYears.value.length) {
    await loadBaseOptions()
  }

  const defaultAcademicYearId = resolvedAcademicYearId.value || academicYears.value[0]?.id || ''
  if (!defaultAcademicYearId) {
    feedback.value = 'Primero debes crear o activar un año lectivo para configurar jornadas.'
    return ''
  }

  filters.academicYearId = defaultAcademicYearId
  return defaultAcademicYearId
}

const refreshJourneyOptions = async () => {
  if (!filters.academicYearId) {
    journeyOptions.value = []
    journeyCache.value = []
    selectedJourneyId.value = ''
    return
  }

  const response = await api.getJourneys({ academicYearId: filters.academicYearId })
  journeyOptions.value = response.data.items
  journeyCache.value = response.data.items

  if (!selectedJourneyId.value || !journeyOptions.value.some((item) => item.id === selectedJourneyId.value)) {
    selectedJourneyId.value = journeyOptions.value[0]?.id || ''
  }
}

const toPaginatedRows = <T extends Row>(items: T[], page: number, pageSize: number) => {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  }
}

const normalizeText = (value: unknown) => String(value ?? '').toLowerCase()
const translateLevelName = (levelName: string | null | undefined) => {
  switch (levelName) {
    case 'preschool':
      return 'Preescolar'
    case 'primary':
      return 'Primaria'
    case 'secondary':
      return 'Secundaria'
    case 'middle':
      return 'Media / bachillerato'
    default:
      return ''
  }
}
const journeyScopeLabel = (journey: Pick<AcademicYearJourneyDto, 'targetGradeName' | 'targetLevelName'>) =>
  journey.targetGradeName || translateLevelName(journey.targetLevelName) || 'Todo el colegio'
const journeyScopeType = (journey: Pick<AcademicYearJourneyDto, 'targetGradeName' | 'targetLevelName'>) =>
  journey.targetGradeName ? 'grade' : journey.targetLevelName ? 'level' : 'global'
const journeyScopeBadge = (journey: Pick<AcademicYearJourneyDto, 'targetGradeName' | 'targetLevelName'>) =>
  journey.targetGradeName ? 'Grado' : journey.targetLevelName ? 'Nivel' : 'Global'
const journeyOptionLabel = (journey: Pick<AcademicYearJourneyDto, 'name' | 'code' | 'targetGradeName' | 'targetLevelName'>) =>
  `${journey.name} · ${journey.code} · ${journeyScopeLabel(journey)}`

const fetchJourneys = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getJourneys({ academicYearId: filters.academicYearId })
  const normalizedQuery = query.trim().toLowerCase()
  const rows = response.data.items
    .map((item) => ({
      ...item,
      scopeType: journeyScopeType(item),
      scopeBadge: journeyScopeBadge(item),
      scopeLabel: journeyScopeLabel(item),
      window: `${item.startsAt} - ${item.endsAt}`,
    }))
    .filter((item) =>
      !normalizedQuery ||
      [item.name, item.code, item.academicYearName, item.branchName, item.scopeLabel]
        .some((value) => normalizeText(value).includes(normalizedQuery)),
    )
  journeyCache.value = response.data.items
  journeyOptions.value = response.data.items
  if (!selectedJourneyId.value || !journeyOptions.value.some((item) => item.id === selectedJourneyId.value)) {
    selectedJourneyId.value = journeyOptions.value[0]?.id || ''
  }
  return toPaginatedRows(rows as Row[], page, pageSize)
}

const fetchJourneySlots = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  if (!selectedJourneyId.value) {
    slotCache.value = []
    return toPaginatedRows([], page, pageSize)
  }

  const response = await api.getJourneySlots(selectedJourneyId.value)
  const normalizedQuery = query.trim().toLowerCase()
  const rows = response.data.items
    .map((item) => ({
      ...item,
      dayLabel: weekdays.find((day) => day.value === item.dayOfWeek)?.label ?? item.dayOfWeek,
      window: `${item.startsAt} - ${item.endsAt}`,
    }))
    .filter((item) =>
      !normalizedQuery ||
      [item.journeyName, item.label, item.dayLabel, item.slotType]
        .some((value) => normalizeText(value).includes(normalizedQuery)),
    )
  slotCache.value = response.data.items
  return toPaginatedRows(rows as Row[], page, pageSize)
}

const fetchGroupJourneyOptions = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getGroupJourneyOptions({
    academicYearId: filters.academicYearId,
    groupId: timetableFilters.groupId,
  })
  const normalizedQuery = query.trim().toLowerCase()
  const rows = response.data.items
    .map((item) => ({
      ...item,
      groupLabel: `${item.gradeName || ''} · ${item.groupName || ''}`,
      journeyLabel: `${item.journeyName || ''} · ${item.journeyCode || ''}`,
      scopeType: journeyScopeType(item),
      scopeBadge: journeyScopeBadge(item),
      scopeLabel: journeyScopeLabel(item),
    }))
    .filter((item) =>
      !normalizedQuery ||
      [item.groupLabel, item.journeyLabel, item.branchName]
        .some((value) => normalizeText(value).includes(normalizedQuery)),
    )
  groupOptionCache.value = response.data.items
  return toPaginatedRows(rows as Row[], page, pageSize)
}

const fetchTimetable = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  if (!filters.academicYearId) return toPaginatedRows([], page, pageSize)

  const response = await api.getTimetable({
    academicYearId: filters.academicYearId,
    groupId: timetableFilters.groupId,
    journeyId: timetableFilters.journeyId,
    teacherId: timetableFilters.teacherId,
  })
  const normalizedQuery = query.trim().toLowerCase()
  const rows = response.data.items
    .map((item) => ({
      ...item,
      groupLabel: `${item.gradeName || ''} · ${item.groupName || ''}`,
      dayLabel: weekdays.find((day) => day.value === item.dayOfWeek)?.label ?? item.dayOfWeek,
      teacherName: item.teacherName || 'Sin docente',
      journeyScopeLabel: journeyScopeLabel(item),
      window: `${item.startsAt || ''} - ${item.endsAt || ''}`,
    }))
    .filter((item) =>
      !normalizedQuery ||
      [item.groupLabel, item.dayLabel, item.subjectName, item.teacherName]
        .some((value) => normalizeText(value).includes(normalizedQuery)),
    )
  timetableCache.value = response.data.items
  return toPaginatedRows(rows as Row[], page, pageSize)
}

const bumpReloadKey = (key: typeof journeyReloadKey | typeof slotReloadKey | typeof groupOptionReloadKey | typeof timetableReloadKey) => {
  key.value += 1
}

const reloadTimetable = async () => {
  bumpReloadKey(timetableReloadKey)
}

const closeModal = () => {
  activeModal.value = ''
}

const slotTypeBadge = (slotType: string) => {
  if (slotType === 'class') return 'meta-badge--success'
  if (slotType === 'break' || slotType === 'lunch') return 'meta-badge--warning'
  return 'meta-badge--info'
}

const scopeBadgeClass = (scopeType: string) => {
  switch (scopeType) {
    case 'grade':
      return 'meta-badge--warning'
    case 'level':
      return 'meta-badge--info'
    default:
      return 'meta-badge--success'
  }
}

const slotDayLabel = (dayOfWeek: string) => weekdays.find((day) => day.value === dayOfWeek)?.label ?? dayOfWeek

const translateSlotType = (slotType: string) => {
  switch (slotType) {
    case 'class':
      return 'Clase'
    case 'break':
      return 'Descanso'
    case 'homeroom':
      return 'Dir. grupo'
    case 'lunch':
      return 'Almuerzo'
    case 'institutional':
      return 'Institucional'
    default:
      return slotType
  }
}

const handlePrimaryGuideAction = () => {
  if (!journeyCache.value.length) {
    activeTab.value = 'journeys'
    openJourneyCreate()
    return
  }

  if (!slotCache.value.length) {
    activeTab.value = 'slots'
    openSlotCreate()
    return
  }

  if (scheduleSummary.value.configuredGroups < coursesForYear.value.length) {
    activeTab.value = 'groups'
    openGroupOptionCreate()
    return
  }

  openGenerationModal()
}

const openJourneyCreate = async () => {
  const defaultAcademicYearId = await ensureAcademicYearsLoaded()
  if (!defaultAcademicYearId) return
  feedback.value = ''
  editingJourneyId.value = ''
  Object.assign(journeyForm, {
    academicYearId: defaultAcademicYearId,
    branchId: '',
    targetLevelName: '',
    targetGradeId: '',
    name: '',
    code: '',
    startsAt: '06:30',
    endsAt: '12:30',
    isActive: true,
  })
  activeModal.value = 'journey'
}

const openJourneyEdit = (row: Record<string, unknown>) => {
  const item = row as unknown as AcademicYearJourneyDto
  feedback.value = ''
  editingJourneyId.value = item.id
  Object.assign(journeyForm, {
    academicYearId: item.academicYearId,
    branchId: item.branchId || '',
    targetLevelName: item.targetLevelName || '',
    targetGradeId: item.targetGradeId || '',
    name: item.name,
    code: item.code,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    isActive: item.isActive,
  })
  activeModal.value = 'journey'
}

const openJourneyDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteJourney(String(row.id))
    feedback.value = 'Jornada eliminada.'
    await refreshJourneyOptions()
    bumpReloadKey(journeyReloadKey)
    bumpReloadKey(slotReloadKey)
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar la jornada.'
  }
}

const submitJourney = async () => {
  isSavingJourney.value = true
  feedback.value = ''
  try {
    const selectedGrade = grades.value.find((grade) => grade.id === journeyForm.targetGradeId)
    const payload = {
      ...journeyForm,
      branchId: null,
      targetLevelName: journeyForm.targetLevelName || selectedGrade?.levelName || null,
      targetGradeId: journeyForm.targetGradeId || null,
    }
    if (editingJourneyId.value) await api.updateJourney(editingJourneyId.value, payload)
    else await api.createJourney(payload)
    await refreshJourneyOptions()
    closeModal()
    bumpReloadKey(journeyReloadKey)
    feedback.value = 'Jornada guardada correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar la jornada.'
  } finally {
    isSavingJourney.value = false
  }
}

const openSlotCreate = () => {
  feedback.value = ''
  editingSlotId.value = ''
  Object.assign(slotForm, {
    journeyId: selectedJourneyId.value || journeyOptions.value[0]?.id || '',
    dayOfWeek: 'monday',
    slotOrder: slotCache.value.length + 1,
    startsAt: '06:30',
    endsAt: '07:20',
    slotType: 'class',
    label: '',
  })
  activeModal.value = 'slot'
}

const openSlotEdit = (row: Record<string, unknown>) => {
  const item = row as unknown as AcademicYearJourneySlotDto
  feedback.value = ''
  editingSlotId.value = item.id
  Object.assign(slotForm, {
    journeyId: item.journeyId,
    dayOfWeek: item.dayOfWeek,
    slotOrder: item.slotOrder,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    slotType: item.slotType,
    label: item.label || '',
  })
  activeModal.value = 'slot'
}

const openSlotDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteJourneySlot(String(row.id))
    feedback.value = 'Franja eliminada.'
    bumpReloadKey(slotReloadKey)
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar la franja.'
  }
}

const submitSlot = async () => {
  isSavingSlot.value = true
  feedback.value = ''
  try {
    const payload = { ...slotForm }
    if (editingSlotId.value) await api.updateJourneySlot(editingSlotId.value, payload)
    else await api.createJourneySlot(payload)
    selectedJourneyId.value = slotForm.journeyId
    closeModal()
    bumpReloadKey(slotReloadKey)
    feedback.value = 'Franja guardada correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar la franja.'
  } finally {
    isSavingSlot.value = false
  }
}

const openGroupOptionCreate = async () => {
  const defaultAcademicYearId = await ensureAcademicYearsLoaded()
  if (!defaultAcademicYearId) return
  feedback.value = ''
  editingGroupOptionId.value = ''
  Object.assign(groupOptionForm, {
    academicYearId: defaultAcademicYearId,
    groupId: timetableFilters.groupId || coursesForYear.value[0]?.id || '',
    journeyId: journeyOptions.value[0]?.id || '',
    priority: 0,
    isPreferred: false,
  })
  activeModal.value = 'group-option'
}

const openGroupOptionEdit = (row: Record<string, unknown>) => {
  const item = row as unknown as GroupJourneyOptionDto
  feedback.value = ''
  editingGroupOptionId.value = item.id
  Object.assign(groupOptionForm, {
    academicYearId: item.academicYearId,
    groupId: item.groupId,
    journeyId: item.journeyId,
    priority: item.priority,
    isPreferred: item.isPreferred,
  })
  activeModal.value = 'group-option'
}

const openGroupOptionDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteGroupJourneyOption(String(row.id))
    feedback.value = 'Opción de jornada eliminada.'
    bumpReloadKey(groupOptionReloadKey)
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar la opción.'
  }
}

const submitGroupOption = async () => {
  isSavingGroupOption.value = true
  feedback.value = ''
  try {
    const payload = { ...groupOptionForm }
    if (editingGroupOptionId.value) await api.updateGroupJourneyOption(editingGroupOptionId.value, payload)
    else await api.createGroupJourneyOption(payload)
    closeModal()
    bumpReloadKey(groupOptionReloadKey)
    feedback.value = 'Opción de jornada guardada correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar la opción.'
  } finally {
    isSavingGroupOption.value = false
  }
}

const openGenerationModal = () => {
  feedback.value = ''
  const defaultAcademicYearId = resolvedAcademicYearId.value
  Object.assign(generationForm, {
    academicYearId: defaultAcademicYearId,
    groupId: timetableFilters.groupId,
    overwriteExisting: true,
  })
  activeModal.value = 'generate'
}

const openEntryEdit = async (row: Record<string, unknown>) => {
  const item = row as unknown as GroupTimetableEntryDto
  feedback.value = ''
  editingEntryId.value = item.id
  if (!groupOptionCache.value.length) {
    const groupOptionsResponse = await api.getGroupJourneyOptions({ academicYearId: filters.academicYearId, groupId: item.groupId })
    groupOptionCache.value = groupOptionsResponse.data.items
  }
  if (!slotCache.value.length || !slotCache.value.some((slot) => slot.journeyId === item.journeyId)) {
    const slotResponse = await api.getJourneySlots(item.journeyId)
    slotCache.value = slotResponse.data.items
  }
  Object.assign(entryForm, {
    journeyId: item.journeyId,
    journeySlotId: item.journeySlotId,
    notes: item.notes || '',
  })
  activeModal.value = 'entry'
}

const submitEntryUpdate = async () => {
  if (!editingEntryId.value) return
  isSavingEntry.value = true
  feedback.value = ''
  try {
    await api.updateTimetableEntry(editingEntryId.value, {
      journeyId: entryForm.journeyId,
      journeySlotId: entryForm.journeySlotId,
      notes: entryForm.notes || null,
    })
    closeModal()
    bumpReloadKey(timetableReloadKey)
    feedback.value = 'Bloque de horario ajustado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible ajustar el bloque.'
  } finally {
    isSavingEntry.value = false
  }
}

const changeTimetableStatus = async (status: 'draft' | 'published' | 'locked') => {
  isUpdatingStatus.value = true
  feedback.value = ''
  try {
    const response = await api.updateTimetableStatus({
      academicYearId: filters.academicYearId,
      groupId: timetableFilters.groupId || null,
      journeyId: timetableFilters.journeyId || null,
      status,
    })
    bumpReloadKey(timetableReloadKey)
    feedback.value = `Se actualizaron ${response.data.affectedEntries} bloque(s) a estado ${status}.`
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible cambiar el estado del horario.'
  } finally {
    isUpdatingStatus.value = false
  }
}

const submitGeneration = async () => {
  isGenerating.value = true
  feedback.value = ''
  try {
    const response = await api.generateTimetable({
      academicYearId: generationForm.academicYearId,
      groupIds: generationForm.groupId ? [generationForm.groupId] : [],
      overwriteExisting: generationForm.overwriteExisting,
    })
    lastGenerationResult.value = response.data
    filters.academicYearId = generationForm.academicYearId
    timetableFilters.groupId = generationForm.groupId
    closeModal()
    activeTab.value = 'generate'
    bumpReloadKey(timetableReloadKey)
    feedback.value = response.data.conflicts.length
      ? `Horario generado con ${response.data.conflicts.length} conflicto(s) por revisar.`
      : 'Horario generado sin conflictos.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible generar el horario.'
  } finally {
    isGenerating.value = false
  }
}

watch(
  () => filters.academicYearId,
  async (value, previousValue) => {
    if (!value || value === previousValue) return
    journeyForm.academicYearId = value
    groupOptionForm.academicYearId = value
    generationForm.academicYearId = value
    timetableFilters.groupId = ''
    timetableFilters.journeyId = ''
    await refreshJourneyOptions()
    bumpReloadKey(journeyReloadKey)
    bumpReloadKey(slotReloadKey)
    bumpReloadKey(groupOptionReloadKey)
    bumpReloadKey(timetableReloadKey)
  },
)

watch(selectedJourneyId, () => {
  bumpReloadKey(slotReloadKey)
})

watch(
  () => journeyForm.targetLevelName,
  (levelName) => {
    if (!levelName) return
    const selectedGrade = grades.value.find((grade) => grade.id === journeyForm.targetGradeId)
    if (selectedGrade && selectedGrade.levelName !== levelName) {
      journeyForm.targetGradeId = ''
    }
  },
)

watch(
  () => entryForm.journeyId,
  async (journeyId) => {
    if (!journeyId || activeModal.value !== 'entry') return
    const response = await api.getJourneySlots(journeyId)
    slotCache.value = response.data.items
    if (!entrySlotOptions.value.some((slot) => slot.id === entryForm.journeySlotId)) {
      entryForm.journeySlotId = entrySlotOptions.value[0]?.id || ''
    }
  },
)

watch(
  () => [timetableFilters.groupId, timetableFilters.journeyId, timetableFilters.teacherId].join('-'),
  () => {
    if (activeTab === 'generate') bumpReloadKey(timetableReloadKey)
    if (activeTab === 'groups') bumpReloadKey(groupOptionReloadKey)
  },
)

onMounted(async () => {
  await loadBaseOptions()
  await refreshJourneyOptions()
})
</script>

<style scoped>
.module-inline-summary,
.schedule-generation-card {
  display: grid;
  gap: 1rem;
}

.schedule-scheduler-card {
  display: grid;
  gap: 1rem;
}

.module-inline-summary {
  grid-template-columns: minmax(0, 1.7fr) auto auto;
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

.schedule-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.schedule-tab {
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  padding: 0.9rem 1rem;
  text-align: left;
  display: grid;
  gap: 0.35rem;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.schedule-tab strong {
  font-size: 0.95rem;
}

.schedule-tab span {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.schedule-tab:hover {
  transform: translateY(-1px);
  border-color: rgba(31, 70, 144, 0.35);
}

.schedule-tab--active {
  border-color: rgba(31, 70, 144, 0.5);
  box-shadow: 0 16px 32px rgba(31, 70, 144, 0.12);
  background: linear-gradient(135deg, rgba(235, 244, 255, 0.95), rgba(255, 255, 255, 0.95));
}

.schedule-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.85rem;
}

.schedule-metric {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  padding: 0.9rem;
  display: grid;
  gap: 0.25rem;
  background: rgba(248, 250, 252, 0.9);
}

.schedule-metric span,
.schedule-metric small {
  color: var(--text-muted);
}

.schedule-metric strong {
  font-size: 1.45rem;
}

.schedule-conflicts {
  display: grid;
  gap: 0.65rem;
}

.schedule-generation-summary {
  display: flex;
  gap: 0.85rem;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 0.92rem;
}

.schedule-scheduler-empty {
  border: 1px dashed var(--border-color);
  border-radius: 18px;
  padding: 1rem 1.1rem;
  background: color-mix(in srgb, var(--surface-2, #f8fafc) 92%, white);
}

.schedule-scheduler-empty p {
  color: var(--text-muted);
  margin: 0.35rem 0 0;
}

.schedule-scheduler {
  display: grid;
  grid-template-columns: 150px repeat(var(--scheduler-days, 5), minmax(180px, 1fr));
  gap: 0.65rem;
  align-items: stretch;
  overflow-x: auto;
}

.schedule-scheduler__corner,
.schedule-scheduler__day,
.schedule-scheduler__time,
.schedule-scheduler__cell {
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: var(--surface-color);
  min-height: 90px;
  padding: 0.85rem;
}

.schedule-scheduler__corner,
.schedule-scheduler__day {
  min-height: auto;
  font-weight: 700;
  background: color-mix(in srgb, var(--surface-2, #f8fafc) 92%, white);
}

.schedule-scheduler__time {
  display: grid;
  gap: 0.2rem;
}

.schedule-scheduler__time small {
  color: var(--text-muted);
}

.schedule-scheduler__cell {
  display: grid;
  gap: 0.55rem;
  align-content: start;
}

.schedule-scheduler-entry {
  display: grid;
  gap: 0.35rem;
  padding: 0.75rem;
  border-radius: 14px;
  background: color-mix(in srgb, var(--brand-primary-soft) 55%, white);
  border: 1px solid color-mix(in srgb, var(--brand-primary) 16%, var(--border-color));
}

.schedule-scheduler-entry--draft {
  background: rgba(255, 247, 237, 0.95);
  border-color: rgba(245, 158, 11, 0.26);
}

.schedule-scheduler-entry--published {
  background: rgba(239, 246, 255, 0.95);
  border-color: rgba(59, 130, 246, 0.24);
}

.schedule-scheduler-entry--locked {
  background: rgba(241, 245, 249, 0.96);
  border-color: rgba(100, 116, 139, 0.24);
}

.schedule-scheduler-entry__header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
}

.schedule-scheduler-entry__header span,
.schedule-scheduler-entry p,
.schedule-scheduler-entry small {
  color: var(--text-muted);
}

.schedule-scheduler-entry p,
.schedule-scheduler-entry small {
  margin: 0;
}

.schedule-conflict {
  border-left: 4px solid rgba(198, 73, 73, 0.65);
  background: rgba(255, 245, 245, 0.92);
  border-radius: 14px;
  padding: 0.85rem 0.95rem;
  color: #7f1d1d;
  font-size: 0.92rem;
}

.schedule-scope-cell {
  display: grid;
  gap: 0.3rem;
}

.schedule-scope-cell small {
  color: var(--text-muted);
  font-size: 0.78rem;
}

.form-grid--compact {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 100%;
}

.checkbox-field input {
  width: auto;
}

.checkbox-field--full {
  grid-column: 1 / -1;
}

@media (max-width: 768px) {
  .module-inline-summary,
  .schedule-tabs,
  .schedule-metrics {
    grid-template-columns: 1fr;
  }

  .schedule-scheduler {
    grid-template-columns: 120px repeat(var(--scheduler-days, 5), minmax(160px, 1fr));
  }

  .module-inline-summary__meta {
    justify-items: start;
    text-align: left;
  }
}
</style>
