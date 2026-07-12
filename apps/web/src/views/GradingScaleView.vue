<template>
  <section class="stack">
    <PageHeader eyebrow="SIEE Académico" title="Escalas y Desempeños" subtitle="Configura la escala de valoración institucional (numérica o cualitativa) y su equivalencia con la escala nacional colombiana.">
      <template #actions>
        <button class="button button--brand" type="button" @click="openCreateScale">Nueva escala de calificación</button>
      </template>
    </PageHeader>

    <div class="split-layout">
      <!-- Left Column: Grading Scales List -->
      <div class="layout-card">
        <div class="card-header">
          <h3>Escalas del Colegio</h3>
          <p>Solo puede haber una escala activa que regirá el año académico actual.</p>
        </div>

        <div v-if="loadingScales" class="loading-state">Cargando escalas...</div>
        
        <div v-else-if="scales.length === 0" class="empty-state">
          <p>No se han configurado escalas de calificación.</p>
          <button class="button button--ghost" type="button" @click="openCreateScale">Crear primera escala</button>
        </div>

        <ul v-else class="scales-list">
          <li 
            v-for="scale in scales" 
            :key="scale.id"
            :class="['scale-item', { 'scale-item--selected': selectedScale?.id === scale.id }]"
            @click="selectScale(scale)"
          >
            <div class="scale-item__main">
              <span class="scale-item__title">{{ scale.name }}</span>
              <div class="scale-item__meta">
                <span>Rango: {{ scale.minValue }} - {{ scale.maxValue }}</span>
                <span>•</span>
                <span>Mín. Aprobatoria: {{ scale.passingValue }}</span>
              </div>
            </div>
            
            <div class="scale-item__actions">
              <span class="status-badge" :data-status="scale.isActive ? 'active' : 'inactive'">
                {{ scale.isActive ? 'Activa' : 'Inactiva' }}
              </span>
              <div class="action-buttons-row">
                <button class="icon-button" type="button" title="Editar Escala" @click.stop="openEditScale(scale)">✏️</button>
                <button class="icon-button icon-button--danger" type="button" title="Eliminar Escala" @click.stop="deleteScale(scale)">🗑️</button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Right Column: Performance Ranges for Selected Scale -->
      <div class="layout-card">
        <div v-if="!selectedScale" class="empty-state-card">
          <div class="empty-state">
            <h3>Ninguna escala seleccionada</h3>
            <p>Selecciona una escala de calificación de la lista de la izquierda para ver y configurar sus rangos de desempeño.</p>
          </div>
        </div>

        <div v-else>
          <div class="card-header flex-header">
            <div>
              <h3>Rangos de Desempeño: {{ selectedScale.name }}</h3>
              <p>Mapeo requerido por el Decreto 1290 para la escala nacional.</p>
            </div>
            <div class="range-header-actions">
              <button class="button button--ghost button--sm" type="button" @click="openTemplatePicker">Aplicar plantilla</button>
              <button class="button button--brand button--sm" type="button" @click="openCreateRange">Agregar rango</button>
            </div>
          </div>

          <!-- Selected Scale Details Strip -->
          <div class="scale-details-strip">
            <div class="detail-pill">
              <span>Tipo:</span>
              <strong>{{ selectedScale.scaleType === 'numeric' ? 'Numérica' : 'Cualitativa' }}</strong>
            </div>
            <div class="detail-pill">
              <span>Decimales:</span>
              <strong>{{ selectedScale.decimalPlaces }}</strong>
            </div>
            <div class="detail-pill">
              <span>Nota Mínima:</span>
              <strong>{{ selectedScale.minValue }}</strong>
            </div>
            <div class="detail-pill">
              <span>Aprobatoria:</span>
              <strong style="color: var(--brand-amber);">{{ selectedScale.passingValue }}</strong>
            </div>
            <div class="detail-pill">
              <span>Nota Máxima:</span>
              <strong style="color: var(--brand-green);">{{ selectedScale.maxValue }}</strong>
            </div>
          </div>

          <div v-if="!selectedScale.ranges || selectedScale.ranges.length === 0" class="empty-ranges-state">
            <p>Aún no has configurado rangos de desempeño para esta escala. Debes mapear los niveles nacionales (Bajo, Básico, Alto, Superior).</p>
            <button class="button button--ghost button--sm" type="button" @click="openCreateRange">Crear primer rango</button>
          </div>

          <div v-else class="ranges-table-wrap">
            <table class="ranges-table">
              <thead>
                <tr>
                  <th>Color / Etiqueta</th>
                  <th>Equivalencia Nacional</th>
                  <th>Rango de Notas</th>
                  <th>¿Aprueba?</th>
                  <th style="text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="range in selectedScale.ranges" :key="range.id">
                  <td>
                    <div class="label-cell">
                      <span :style="{ backgroundColor: range.color || '#6366f1' }" class="color-dot"></span>
                      <strong>{{ range.institutionalLabel }}</strong>
                    </div>
                  </td>
                  <td>
                    <span :class="['national-badge', `national-badge--${range.nationalLevel.toLowerCase()}`]">
                      {{ translateNationalLevel(range.nationalLevel) }}
                    </span>
                  </td>
                  <td>
                    <code class="range-code">{{ range.minScore }} - {{ range.maxScore }}</code>
                  </td>
                  <td>
                    <span :class="['passing-dot', range.isPassing ? 'passing-dot--yes' : 'passing-dot--no']">
                      {{ range.isPassing ? 'Sí' : 'No' }}
                    </span>
                  </td>
                  <td>
                    <div class="range-actions">
                      <button class="icon-button" type="button" title="Editar Rango" @click="openEditRange(range)">✏️</button>
                      <button class="icon-button icon-button--danger" type="button" title="Eliminar Rango" @click="deleteRange(range)">🗑️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="layout-card">
      <div class="card-header flex-header">
        <div>
          <h3>Asignación de escalas por nivel o grado</h3>
          <p>Define si preescolar, primaria o un grado puntual usan una escala diferente.</p>
        </div>
        <button class="button button--brand button--sm" type="button" @click="openCreateAssignment">Nueva asignación</button>
      </div>

      <div class="assignment-toolbar">
        <select v-model="assignmentFilters.academicYearId">
          <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
        </select>
      </div>

      <div v-if="assignments.length === 0" class="empty-ranges-state">
        <p>No hay asignaciones configuradas para este año lectivo.</p>
      </div>

      <div v-else class="ranges-table-wrap">
        <table class="ranges-table">
          <thead>
            <tr>
              <th>Año lectivo</th>
              <th>Escala</th>
              <th>Alcance</th>
              <th>Etiqueta</th>
              <th>Estado</th>
              <th style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="assignment in assignments" :key="assignment.id">
              <td>{{ assignment.academicYearName }}</td>
              <td>{{ assignment.gradingScaleName }}</td>
              <td>{{ assignmentScopeLabel(assignment) }}</td>
              <td>{{ assignment.title || 'Sin etiqueta' }}</td>
              <td>
                <span class="status-badge" :data-status="assignment.isActive ? 'active' : 'inactive'">
                  {{ assignment.isActive ? 'Activa' : 'Inactiva' }}
                </span>
              </td>
              <td>
                <div class="range-actions">
                  <button class="icon-button" type="button" title="Editar asignación" @click="openEditAssignment(assignment)">✏️</button>
                  <button class="icon-button icon-button--danger" type="button" title="Eliminar asignación" @click="deleteAssignment(assignment)">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal for Scale -->
    <FormModal :open="isScaleModalOpen" :title="editingScaleId ? 'Editar Escala' : 'Nueva Escala'" @close="closeScaleModal">
      <form class="form-grid" @submit.prevent="submitScaleForm">
        <label class="col-span-2">
          Nombre de la escala
          <input v-model="scaleForm.name" required placeholder="Ej. Escala General de Evaluación" />
        </label>
        
        <label>
          Tipo de Escala
          <select v-model="scaleForm.scaleType" required>
            <option value="numeric">Numérica</option>
            <option value="qualitative">Cualitativa / Descriptiva</option>
            <option value="mixed">Mixta</option>
          </select>
        </label>

        <label>
          Plantilla sugerida
          <select v-model="scaleForm.templateKey">
            <option value="">Ninguna</option>
            <option value="numeric_colombia">Numérica Colombia 1.0 - 5.0</option>
            <option value="letters_abcd">Letras A - D</option>
            <option value="preschool_binary">Preescolar logrado / no logrado</option>
          </select>
        </label>

        <label>
          Lugares Decimales
          <input v-model.number="scaleForm.decimalPlaces" type="number" min="0" max="3" required placeholder="Ej. 1" />
        </label>

        <label>
          Nota Mínima
          <input v-model="scaleForm.minValue" required placeholder="Ej. 1.0" />
        </label>

        <label>
          Nota Aprobatoria Mínima
          <input v-model="scaleForm.passingValue" required placeholder="Ej. 3.0" />
        </label>

        <label>
          Nota Máxima
          <input v-model="scaleForm.maxValue" required placeholder="Ej. 5.0" />
        </label>

        <label style="display: flex; flex-direction: row; align-items: center; gap: 10px; margin-top: 24px;">
          <input v-model="scaleForm.isActive" type="checkbox" />
          <span>Establecer como activa</span>
        </label>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeScaleModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar Escala</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="isTemplateModalOpen" title="Aplicar plantilla de catálogo" @close="closeTemplateModal">
      <form class="form-grid" @submit.prevent="submitTemplateApplication">
        <label class="col-span-2">
          Plantilla
          <select v-model="selectedTemplateKey" required>
            <option value="numeric_colombia">Numérica Colombia 1.0 - 5.0</option>
            <option value="letters_abcd">Letras A - D</option>
            <option value="preschool_binary">Preescolar logrado / no logrado</option>
          </select>
        </label>
        <div class="template-preview col-span-2">
          <strong>{{ selectedTemplateMeta.title }}</strong>
          <p>{{ selectedTemplateMeta.description }}</p>
        </div>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeTemplateModal">Cancelar</button>
          <button class="button button--brand" type="submit">Aplicar plantilla</button>
        </div>
      </form>
    </FormModal>

    <!-- Modal for Performance Range -->
    <FormModal :open="isRangeModalOpen" :title="editingRangeId ? 'Editar Rango de Desempeño' : 'Nuevo Rango de Desempeño'" @close="closeRangeModal">
      <form class="form-grid" @submit.prevent="submitRangeForm">
        <label>
          Equivalencia Nacional (Decreto 1290)
          <select v-model="rangeForm.nationalLevel" required>
            <option value="SUPERIOR">Superior</option>
            <option value="HIGH">Alto</option>
            <option value="BASIC">Básico</option>
            <option value="LOW">Bajo</option>
          </select>
        </label>

        <label>
          Etiqueta Institucional
          <input v-model="rangeForm.institutionalLabel" required placeholder="Ej. Alto, Sobresaliente, A" />
        </label>

        <label>
          Nota Mínima del Rango
          <input v-model="rangeForm.minScore" required placeholder="Ej. 4.0" />
        </label>

        <label>
          Nota Máxima del Rango
          <input v-model="rangeForm.maxScore" required placeholder="Ej. 4.5" />
        </label>

        <label>
          Color de Visualización
          <div style="display: flex; gap: 8px; align-items: center;">
            <input v-model="rangeForm.color" type="color" style="width: 44px; height: 38px; padding: 2px; cursor: pointer;" />
            <input v-model="rangeForm.color" placeholder="#10b981" required style="flex: 1;" />
          </div>
        </label>

        <label style="display: flex; flex-direction: row; align-items: center; gap: 10px; margin-top: 24px;">
          <input v-model="rangeForm.isPassing" type="checkbox" />
          <span>Es nota aprobatoria</span>
        </label>

        <label class="col-span-2">
          Descripción del Desempeño
          <textarea v-model="rangeForm.description" placeholder="Opcional. Ej. El estudiante demuestra dominio de los conceptos esenciales." rows="3"></textarea>
        </label>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeRangeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar Rango</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="isAssignmentModalOpen" :title="editingAssignmentId ? 'Editar asignación' : 'Nueva asignación'" @close="closeAssignmentModal">
      <form class="form-grid" @submit.prevent="submitAssignmentForm">
        <label>
          Año lectivo
          <select v-model="assignmentForm.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>
          Escala
          <select v-model="assignmentForm.gradingScaleId" required>
            <option v-for="scale in scales" :key="scale.id" :value="scale.id">{{ scale.name }}</option>
          </select>
        </label>
        <label>
          Alcance
          <select v-model="assignmentForm.scopeType" required>
            <option value="level">Nivel</option>
            <option value="grade">Grado</option>
          </select>
        </label>
        <label v-if="assignmentForm.scopeType === 'level'">
          Nivel
          <select v-model="assignmentForm.levelName" required>
            <option value="" disabled>Seleccione</option>
            <option value="preschool">Preescolar</option>
            <option value="primary">Primaria</option>
            <option value="secondary">Secundaria</option>
            <option value="middle">Media / bachillerato</option>
          </select>
        </label>
        <label v-else>
          Grado
          <select v-model="assignmentForm.gradeId" required>
            <option value="" disabled>Seleccione</option>
            <option v-for="grade in grades" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
          </select>
        </label>
        <label class="col-span-2">
          Etiqueta interna
          <input v-model="assignmentForm.title" placeholder="Ej. Escala preescolar 2026" />
        </label>
        <label style="display: flex; flex-direction: row; align-items: center; gap: 10px; margin-top: 24px;">
          <input v-model="assignmentForm.isActive" type="checkbox" />
          <span>Asignación activa</span>
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeAssignmentModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar asignación</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { AcademicGradeDto, AcademicYearDto, GradingScaleAssignmentDto, GradingScaleDto, PerformanceRangeDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import PageHeader from '../components/PageHeader.vue'
import { api } from '../lib/api'
import { useAcademicContextStore } from '../stores/academic-context'

const academicContext = useAcademicContextStore()
const scales = ref<GradingScaleDto[]>([])
const academicYears = ref<AcademicYearDto[]>([])
const grades = ref<AcademicGradeDto[]>([])
const assignments = ref<GradingScaleAssignmentDto[]>([])
const selectedScale = ref<GradingScaleDto | null>(null)
const loadingScales = ref(false)
const feedback = ref('')
const isTemplateModalOpen = ref(false)
const selectedTemplateKey = ref<'numeric_colombia' | 'letters_abcd' | 'preschool_binary'>('numeric_colombia')

// Scale Modal State
const isScaleModalOpen = ref(false)
const editingScaleId = ref('')
const scaleForm = reactive({
  name: '',
  scaleType: 'numeric' as 'numeric' | 'qualitative' | 'mixed',
  decimalPlaces: 1,
  minValue: '',
  maxValue: '',
  passingValue: '',
  isActive: true,
  templateKey: '' as '' | 'numeric_colombia' | 'letters_abcd' | 'preschool_binary',
})

// Range Modal State
const isRangeModalOpen = ref(false)
const editingRangeId = ref('')
const rangeForm = reactive({
  nationalLevel: 'BASIC' as 'SUPERIOR' | 'HIGH' | 'BASIC' | 'LOW',
  institutionalLabel: '',
  minScore: '',
  maxScore: '',
  isPassing: true,
  color: '#6366f1',
  description: '',
})

const isAssignmentModalOpen = ref(false)
const editingAssignmentId = ref('')
const assignmentFilters = reactive({
  academicYearId: '',
})
const assignmentForm = reactive({
  academicYearId: '',
  gradingScaleId: '',
  scopeType: 'level' as 'level' | 'grade',
  levelName: '',
  gradeId: '',
  title: '',
  isActive: true,
})

const translateLevelName = (value: string | null | undefined) => {
  if (value === 'preschool') return 'Preescolar'
  if (value === 'primary') return 'Primaria'
  if (value === 'secondary') return 'Secundaria'
  if (value === 'middle') return 'Media / bachillerato'
  return 'Sin nivel'
}

const assignmentScopeLabel = (assignment: GradingScaleAssignmentDto) =>
  assignment.scopeType === 'level'
    ? translateLevelName(assignment.levelName)
    : assignment.gradeName || 'Grado'

const translateNationalLevel = (lvl: string) => {
  const map: Record<string, string> = {
    SUPERIOR: 'Superior 🏆',
    HIGH: 'Alto 📈',
    BASIC: 'Básico ⚖️',
    LOW: 'Bajo ⚠️',
  }
  return map[lvl] || lvl
}

const catalogTemplates = {
  numeric_colombia: {
    title: 'Numérica Colombia 1.0 - 5.0',
    description: 'Crea la escala clásica colombiana con Bajo, Básico, Alto y Superior.',
    scale: { scaleType: 'numeric' as const, decimalPlaces: 1, minValue: '1.0', maxValue: '5.0', passingValue: '3.0' },
    ranges: [
      { nationalLevel: 'LOW' as const, institutionalLabel: 'Bajo', minScore: 1.0, maxScore: 2.9, isPassing: false, color: '#ef4444', description: 'Desempeño por debajo de lo esperado.' },
      { nationalLevel: 'BASIC' as const, institutionalLabel: 'Básico', minScore: 3.0, maxScore: 3.9, isPassing: true, color: '#f59e0b', description: 'Cumple lo esencial del logro.' },
      { nationalLevel: 'HIGH' as const, institutionalLabel: 'Alto', minScore: 4.0, maxScore: 4.5, isPassing: true, color: '#10b981', description: 'Desempeño sólido y consistente.' },
      { nationalLevel: 'SUPERIOR' as const, institutionalLabel: 'Superior', minScore: 4.6, maxScore: 5.0, isPassing: true, color: '#3b82f6', description: 'Desempeño sobresaliente.' },
    ],
  },
  letters_abcd: {
    title: 'Letras A - D',
    description: 'Catálogo visible por letras, útil para primaria o instituciones que comunican el resultado con A, B, C y D.',
    scale: { scaleType: 'qualitative' as const, decimalPlaces: 0, minValue: '1', maxValue: '4', passingValue: '2' },
    ranges: [
      { nationalLevel: 'LOW' as const, institutionalLabel: 'D', minScore: 1, maxScore: 1, isPassing: false, color: '#ef4444', description: 'No alcanza el desempeño esperado.' },
      { nationalLevel: 'BASIC' as const, institutionalLabel: 'C', minScore: 2, maxScore: 2, isPassing: true, color: '#f59e0b', description: 'Desempeño básico.' },
      { nationalLevel: 'HIGH' as const, institutionalLabel: 'B', minScore: 3, maxScore: 3, isPassing: true, color: '#10b981', description: 'Buen desempeño.' },
      { nationalLevel: 'SUPERIOR' as const, institutionalLabel: 'A', minScore: 4, maxScore: 4, isPassing: true, color: '#3b82f6', description: 'Desempeño destacado.' },
    ],
  },
  preschool_binary: {
    title: 'Preescolar logrado / no logrado',
    description: 'Catálogo simplificado para preescolar con salida visible de logrado o no logrado, manteniendo base interna para cálculos.',
    scale: { scaleType: 'qualitative' as const, decimalPlaces: 0, minValue: '1', maxValue: '2', passingValue: '2' },
    ranges: [
      { nationalLevel: 'LOW' as const, institutionalLabel: 'No logrado', minScore: 1, maxScore: 1, isPassing: false, color: '#ef4444', description: 'Todavía no alcanza el logro esperado.' },
      { nationalLevel: 'HIGH' as const, institutionalLabel: 'Logrado', minScore: 2, maxScore: 2, isPassing: true, color: '#10b981', description: 'Alcanzó el logro esperado.' },
    ],
  },
} satisfies Record<string, {
  title: string
  description: string
  scale: { scaleType: 'numeric' | 'qualitative' | 'mixed'; decimalPlaces: number; minValue: string; maxValue: string; passingValue: string }
  ranges: Array<{
    nationalLevel: 'SUPERIOR' | 'HIGH' | 'BASIC' | 'LOW'
    institutionalLabel: string
    minScore: number
    maxScore: number
    isPassing: boolean
    color: string
    description: string
  }>
}>

const selectedTemplateMeta = computed(() => catalogTemplates[selectedTemplateKey.value])

const loadScales = async (keepSelection = false) => {
  loadingScales.value = true
  try {
    const response = await api.getGradingScales({ page: 1, pageSize: 50 })
    scales.value = response.data.items
    if (scales.value.length > 0) {
      if (keepSelection && selectedScale.value) {
        const found = scales.value.find((s) => s.id === selectedScale.value?.id)
        selectedScale.value = found || scales.value[0]
      } else {
        selectedScale.value = scales.value.find((s) => s.isActive) || scales.value[0]
      }
    } else {
      selectedScale.value = null
    }
  } catch (error) {
    showFeedback('Error al cargar escalas de calificación.')
  } finally {
    loadingScales.value = false
  }
}

const loadAssignmentOptions = async () => {
  const [yearsResponse, gradesResponse] = await Promise.all([
    api.getAcademicYears({ page: 1, pageSize: 100 }),
    api.getAcademicGrades({ page: 1, pageSize: 100 }),
  ])
  academicYears.value = yearsResponse.data.items
  grades.value = gradesResponse.data.items
  assignmentFilters.academicYearId ||= academicContext.activeYearId || academicYears.value[0]?.id || ''
}

const loadAssignments = async () => {
  const response = await api.getGradingScaleAssignments(assignmentFilters.academicYearId)
  assignments.value = response.data.items
}

const applyTemplateToScaleForm = (templateKey: '' | 'numeric_colombia' | 'letters_abcd' | 'preschool_binary') => {
  if (!templateKey) return
  const template = catalogTemplates[templateKey]
  scaleForm.scaleType = template.scale.scaleType
  scaleForm.decimalPlaces = template.scale.decimalPlaces
  scaleForm.minValue = template.scale.minValue
  scaleForm.maxValue = template.scale.maxValue
  scaleForm.passingValue = template.scale.passingValue
}

const syncTemplateRanges = async (scaleId: string, templateKey: 'numeric_colombia' | 'letters_abcd' | 'preschool_binary') => {
  const template = catalogTemplates[templateKey]
  const currentScale = scales.value.find((item) => item.id === scaleId)
  const currentRanges = currentScale?.ranges ?? []

  for (const range of currentRanges) {
    await api.deletePerformanceRange(range.id)
  }

  for (const range of template.ranges) {
    await api.createPerformanceRange({
      gradingScaleId: scaleId,
      nationalLevel: range.nationalLevel,
      institutionalLabel: range.institutionalLabel,
      minScore: range.minScore,
      maxScore: range.maxScore,
      isPassing: range.isPassing,
      color: range.color,
      description: range.description,
    })
  }
}

const selectScale = (scale: GradingScaleDto) => {
  selectedScale.value = scale
}

const showFeedback = (msg: string) => {
  feedback.value = msg
  setTimeout(() => {
    if (feedback.value === msg) feedback.value = ''
  }, 4000)
}

// Scale Actions
const openCreateScale = () => {
  editingScaleId.value = ''
  Object.assign(scaleForm, {
    name: '',
    scaleType: 'numeric',
    decimalPlaces: 1,
    minValue: '1.0',
    maxValue: '5.0',
    passingValue: '3.0',
    isActive: true,
    templateKey: '',
  })
  isScaleModalOpen.value = true
}

const openEditScale = (scale: GradingScaleDto) => {
  editingScaleId.value = scale.id
  Object.assign(scaleForm, {
    name: scale.name,
    scaleType: scale.scaleType,
    decimalPlaces: scale.decimalPlaces,
    minValue: String(scale.minValue),
    maxValue: String(scale.maxValue),
    passingValue: String(scale.passingValue),
    isActive: scale.isActive,
    templateKey: '',
  })
  isScaleModalOpen.value = true
}

const deleteScale = async (scale: GradingScaleDto) => {
  if (!confirm(`¿Estás seguro de que deseas eliminar la escala "${scale.name}" y todos sus rangos de desempeño asociados?`)) return
  try {
    await api.deleteGradingScale(scale.id)
    showFeedback('Escala eliminada correctamente.')
    await loadScales()
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'Error al eliminar escala.')
  }
}

const closeScaleModal = () => {
  isScaleModalOpen.value = false
}

const submitScaleForm = async () => {
  try {
    const payload = {
      name: scaleForm.name,
      scaleType: scaleForm.scaleType,
      decimalPlaces: scaleForm.decimalPlaces,
      minValue: Number(scaleForm.minValue),
      maxValue: Number(scaleForm.maxValue),
      passingValue: Number(scaleForm.passingValue),
      isActive: scaleForm.isActive,
    }
    let scaleId = editingScaleId.value
    if (editingScaleId.value) {
      await api.updateGradingScale(editingScaleId.value, payload)
    } else {
      const created = await api.createGradingScale(payload)
      scaleId = created.data.id
    }
    if (scaleId && scaleForm.templateKey) {
      await loadScales(true)
      await syncTemplateRanges(scaleId, scaleForm.templateKey)
    }
    closeScaleModal()
    showFeedback('Escala de calificación guardada.')
    await loadScales(true)
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'Error al guardar escala.')
  }
}

// Range Actions
const openCreateRange = () => {
  if (!selectedScale.value) return
  editingRangeId.value = ''
  Object.assign(rangeForm, {
    nationalLevel: 'BASIC',
    institutionalLabel: '',
    minScore: '',
    maxScore: '',
    isPassing: true,
    color: '#6366f1',
    description: '',
  })
  isRangeModalOpen.value = true
}

const openEditRange = (range: PerformanceRangeDto) => {
  editingRangeId.value = range.id
  Object.assign(rangeForm, {
    nationalLevel: range.nationalLevel,
    institutionalLabel: range.institutionalLabel,
    minScore: String(range.minScore),
    maxScore: String(range.maxScore),
    isPassing: range.isPassing,
    color: range.color ?? '#6366f1',
    description: range.description ?? '',
  })
  isRangeModalOpen.value = true
}

const deleteRange = async (range: PerformanceRangeDto) => {
  if (!confirm(`¿Estás seguro de deseas eliminar el rango de desempeño "${range.institutionalLabel}"?`)) return
  try {
    await api.deletePerformanceRange(range.id)
    showFeedback('Rango de desempeño eliminado.')
    await loadScales(true)
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'Error al eliminar rango.')
  }
}

const closeRangeModal = () => {
  isRangeModalOpen.value = false
}

const openTemplatePicker = () => {
  if (!selectedScale.value) return
  selectedTemplateKey.value = selectedScale.value.scaleType === 'numeric' ? 'numeric_colombia' : 'letters_abcd'
  isTemplateModalOpen.value = true
}

const closeTemplateModal = () => {
  isTemplateModalOpen.value = false
}

const submitTemplateApplication = async () => {
  if (!selectedScale.value) return
  if (!confirm(`Esto reemplazará los rangos actuales de "${selectedScale.value.name}". ¿Deseas continuar?`)) return

  try {
    await syncTemplateRanges(selectedScale.value.id, selectedTemplateKey.value)
    closeTemplateModal()
    showFeedback('Plantilla aplicada correctamente.')
    await loadScales(true)
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'No fue posible aplicar la plantilla.')
  }
}

const submitRangeForm = async () => {
  if (!selectedScale.value) return
  try {
    const payload = {
      ...rangeForm,
      minScore: Number(rangeForm.minScore),
      maxScore: Number(rangeForm.maxScore),
      gradingScaleId: selectedScale.value.id,
    }
    if (editingRangeId.value) {
      await api.updatePerformanceRange(editingRangeId.value, payload)
    } else {
      await api.createPerformanceRange(payload)
    }
    closeRangeModal()
    showFeedback('Rango de desempeño guardado.')
    await loadScales(true)
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'Error al guardar rango.')
  }
}

const openCreateAssignment = () => {
  editingAssignmentId.value = ''
  Object.assign(assignmentForm, {
    academicYearId: assignmentFilters.academicYearId || academicContext.activeYearId || academicYears.value[0]?.id || '',
    gradingScaleId: selectedScale.value?.id || scales.value[0]?.id || '',
    scopeType: 'level',
    levelName: 'preschool',
    gradeId: '',
    title: '',
    isActive: true,
  })
  isAssignmentModalOpen.value = true
}

const openEditAssignment = (assignment: GradingScaleAssignmentDto) => {
  editingAssignmentId.value = assignment.id
  Object.assign(assignmentForm, {
    academicYearId: assignment.academicYearId,
    gradingScaleId: assignment.gradingScaleId,
    scopeType: assignment.scopeType,
    levelName: assignment.levelName || '',
    gradeId: assignment.gradeId || '',
    title: assignment.title || '',
    isActive: assignment.isActive,
  })
  isAssignmentModalOpen.value = true
}

const closeAssignmentModal = () => {
  isAssignmentModalOpen.value = false
}

const submitAssignmentForm = async () => {
  try {
    const payload = {
      academicYearId: assignmentForm.academicYearId,
      gradingScaleId: assignmentForm.gradingScaleId,
      scopeType: assignmentForm.scopeType,
      levelName: assignmentForm.scopeType === 'level' ? assignmentForm.levelName || null : null,
      gradeId: assignmentForm.scopeType === 'grade' ? assignmentForm.gradeId || null : null,
      title: assignmentForm.title || null,
      isActive: assignmentForm.isActive,
    }
    if (editingAssignmentId.value) {
      await api.updateGradingScaleAssignment(editingAssignmentId.value, payload)
    } else {
      await api.createGradingScaleAssignment(payload)
    }
    closeAssignmentModal()
    showFeedback('Asignación de escala guardada.')
    await loadAssignments()
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'Error al guardar asignación.')
  }
}

const deleteAssignment = async (assignment: GradingScaleAssignmentDto) => {
  if (!confirm(`¿Eliminar la asignación "${assignmentScopeLabel(assignment)}"?`)) return
  try {
    await api.deleteGradingScaleAssignment(assignment.id)
    showFeedback('Asignación de escala eliminada.')
    await loadAssignments()
  } catch (error) {
    showFeedback(error instanceof Error ? error.message : 'Error al eliminar asignación.')
  }
}

watch(() => assignmentFilters.academicYearId, () => {
  void loadAssignments()
})

watch(() => scaleForm.templateKey, (templateKey) => {
  applyTemplateToScaleForm(templateKey)
})

watch(() => assignmentForm.scopeType, (scopeType) => {
  if (scopeType === 'level') {
    assignmentForm.gradeId = ''
    assignmentForm.levelName ||= 'preschool'
    return
  }
  assignmentForm.levelName = ''
})

onMounted(() => {
  void loadScales()
  void loadAssignmentOptions()
  void loadAssignments()
})
</script>

<style src="./grading-scale/GradingScaleView.css" scoped></style>
