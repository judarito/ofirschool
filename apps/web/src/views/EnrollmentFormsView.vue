<template>
  <section class="stack">
    <PageHeader
      eyebrow="Inscripciones"
      title="Formulario de inscripción"
      subtitle="Crea y personaliza el formulario que los padres de familia llenarán para inscribir a sus hijos."
    >
      <template #actions>
        <button class="button button--ghost" type="button" :disabled="busy" @click="saveDraft">
          {{ busy ? 'Guardando...' : 'Guardar borrador' }}
        </button>
        <button class="button button--brand" type="button" :disabled="busy || !isActiveAcademicYearSelected" @click="publishVersion">Publicar formulario</button>
      </template>
    </PageHeader>

    <SurfaceCard class="form-builder-toolbar">
      <div class="form-builder-toolbar__main">
        <StatusBadge :status="versionStatus === 'published' ? 'publicado' : 'borrador'" />
        <div>
          <strong>{{ primaryTask.value }}</strong>
          <span>{{ primaryTask.helper }}</span>
        </div>
      </div>

      <div class="form-builder-metrics" aria-label="Resumen del formulario">
        <span><strong>{{ sections.length }}</strong> secciones</span>
        <span><strong>{{ totalFields }}</strong> preguntas</span>
        <span><strong>{{ documents.length }}</strong> documentos</span>
      </div>

      <div class="form-builder-public-link">
        <span>{{ publicLink }}</span>
        <button class="table-action" type="button" @click="copyLink">Copiar</button>
        <RouterLink class="table-action" :to="publicPath">Abrir</RouterLink>
      </div>
    </SurfaceCard>

    <div class="builder-tabs" role="tablist" aria-label="Secciones del formulario">
      <button
        v-for="step in builderSteps"
        :key="step.value"
        type="button"
        class="builder-tab"
        :class="{ 'builder-tab--active': builderStep === step.value }"
        @click="setBuilderStep(step.value)"
      >
        <strong>{{ step.label }}</strong>
        <span>{{ step.shortLabel }}</span>
      </button>
    </div>

    <div v-if="!isActiveAcademicYearSelected" class="form-builder-alert">
      Puedes editar borradores para {{ selectedAcademicYearName }}, pero solo el formulario de {{ activeAcademicYearName }} puede quedar publicado.
    </div>

    <section v-if="builderStep === 'setup'" class="form-setup-grid">
      <SurfaceCard>
        <div class="card-headline">
          <div>
            <h3>Información del formulario</h3>
            <p>Define el nombre, las fechas y el comportamiento del formulario.</p>
          </div>
          <StatusBadge :status="versionStatus === 'published' ? 'publicado' : 'borrador'" />
        </div>

        <form class="form-grid" @submit.prevent="saveDraft">
          <label>
            Nombre del formulario
            <input v-model="formConfig.name" required />
          </label>
          <label>
            Año lectivo
            <select v-model="formConfig.year">
              <option v-for="year in academicYears" :key="year.id" :value="String(year.year)">
                {{ year.name }}
              </option>
            </select>
          </label>
          <label>
            Fecha de apertura
            <input v-model="formConfig.startsOn" type="date" required />
          </label>
          <label>
            Fecha de cierre
            <input v-model="formConfig.endsOn" type="date" required />
          </label>
          <label class="switch-row form-grid__wide">
            <input v-model="formConfig.autosave" type="checkbox" />
            Guardar automáticamente mientras el padre llena el formulario
          </label>
          <label class="switch-row form-grid__wide">
            <input v-model="formConfig.progressBar" type="checkbox" />
            Mostrar barra de avance al padre de familia
          </label>
          <div class="modal-actions form-grid__wide">
            <button class="button button--ghost" type="button" @click="applyTemplate('balanced')">Usar plantilla sugerida</button>
            <button class="button button--brand" type="submit" :disabled="busy">Guardar</button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard>
        <div class="card-headline">
          <div>
            <h3>Resumen</h3>
            <p>Un vistazo rápido al estado actual del formulario.</p>
          </div>
        </div>

        <div class="summary-strip summary-strip--builder">
          <div><strong>{{ sections.length }}</strong><small>Secciones</small></div>
          <div><strong>{{ totalFields }}</strong><small>Campos</small></div>
          <div><strong>{{ requiredFields }}</strong><small>Obligatorios</small></div>
          <div><strong>{{ documents.length }}</strong><small>Documentos</small></div>
        </div>

        <div class="module-note-list">
          <article class="module-note-list__item">
            <span>Plantilla sugerida</span>
            <strong>{{ recommendedTemplate.label }}</strong>
            <p>{{ recommendedTemplate.helper }}</p>
          </article>
          <article class="module-note-list__item">
            <span>Estado</span>
            <strong>{{ versionStatus === 'published' ? 'Publicado y disponible' : 'En borrador' }}</strong>
            <p>{{ versionStatus === 'published' ? 'Los padres de familia pueden acceder al formulario.' : 'Guarde como borrador o publique cuando esté listo.' }}</p>
          </article>
        </div>
      </SurfaceCard>
    </section>

    <section v-else-if="builderStep === 'structure'" class="form-builder-list-layout">
      <SurfaceCard class="preset-panel">
        <div class="card-headline">
          <div>
            <h3>Preguntas listas para usar</h3>
            <p>Agrega un grupo completo cuando necesites avanzar rápido.</p>
          </div>
        </div>

        <div class="template-library">
          <button
            v-for="preset in sectionPresets"
            :key="preset.key"
            type="button"
            class="template-library__item"
            @click="addPresetSection(preset.key)"
          >
            <strong>{{ preset.title }}</strong>
            <span>{{ preset.description }}</span>
            <small>{{ preset.fields.length }} preguntas incluidas</small>
          </button>
        </div>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="openSectionModal">Crear sección vacía</button>
          <button class="button button--brand" type="button" @click="setBuilderStep('preview')">Vista previa</button>
        </div>
      </SurfaceCard>

      <ListView
        title="Secciones"
        subtitle="Selecciona una sección para ver y editar sus preguntas."
        :columns="sectionColumns"
        :fetcher="fetchSections"
        :reload-key="sectionsReloadKey"
        create-label="Nueva sección"
        search-placeholder="Buscar sección..."
        empty-title="Sin secciones"
        empty-description="Crea una sección o usa una plantilla para empezar."
        :initial-page-size="5"
        @create="openSectionModal"
      >
        <template #cell-title="{ row }">
          <div class="list-primary">
            <strong>{{ row.title }}</strong>
            <small>{{ row.description }}</small>
          </div>
        </template>
        <template #cell-state="{ row }">
          <StatusBadge :status="row.id === activeSectionId ? 'seleccionada' : 'disponible'" />
        </template>
        <template #row-actions="{ row }">
          <button class="table-action" type="button" @click="selectSection(String(row.id))">
            {{ row.id === activeSectionId ? 'Seleccionada' : 'Seleccionar' }}
          </button>
          <button class="table-action" type="button" @click="openFieldModal(String(row.id))">Agregar pregunta</button>
          <button class="table-action table-action--danger" type="button" @click="deleteSection(String(row.id))">Eliminar</button>
        </template>
      </ListView>

      <ListView
        title="Preguntas"
        :subtitle="activeSection ? `Sección: ${activeSection.title}` : 'Selecciona una sección para gestionar sus preguntas.'"
        :columns="fieldColumns"
        :fetcher="fetchActiveFields"
        :reload-key="fieldsReloadKey"
        create-label="Nueva pregunta"
        search-placeholder="Buscar pregunta..."
        empty-title="Sin preguntas"
        empty-description="Agrega preguntas manualmente o usa una sección lista para usar."
        :initial-page-size="5"
        :show-actions="Boolean(activeSection)"
        @create="activeSection && openFieldModal(activeSection.id)"
      >
        <template #cell-label="{ row }">
          <div class="list-primary list-primary--inline">
            <span class="field-row__icon">{{ row.icon }}</span>
            <div>
              <strong>{{ row.label }}</strong>
              <small>{{ row.optionsText }}</small>
            </div>
          </div>
        </template>
        <template #cell-requiredLabel="{ row }">
          <StatusBadge :status="String(row.requiredLabel)" />
        </template>
        <template #row-actions="{ row }">
          <button class="table-action" type="button" @click="toggleFieldRequired(String(row.id))">
            {{ row.required ? 'Hacer opcional' : 'Hacer obligatorio' }}
          </button>
          <button v-if="activeSection" class="table-action table-action--danger" type="button" @click="deleteField(activeSection.id, String(row.id))">Eliminar</button>
        </template>
      </ListView>
    </section>

    <section v-else-if="builderStep === 'documents'" class="form-builder-list-layout">
      <SurfaceCard class="preset-panel">
        <div class="card-headline">
          <div>
            <h3>Documentos comunes</h3>
            <p>Usa los documentos más frecuentes como punto de partida.</p>
          </div>
        </div>

        <div class="template-library">
          <button
            v-for="preset in documentPresets"
            :key="preset.key"
            type="button"
            class="template-library__item"
            @click="addPresetDocument(preset.key)"
          >
            <strong>{{ preset.name }}</strong>
            <span>{{ preset.helper }}</span>
            <small>{{ preset.required ? 'Obligatorio' : 'Opcional' }}</small>
          </button>
        </div>
      </SurfaceCard>

      <ListView
        title="Documentos solicitados"
        subtitle="Archivos que el acudiente debe subir durante la inscripción."
        :columns="documentColumns"
        :fetcher="fetchDocuments"
        :reload-key="documentsReloadKey"
        create-label="Agregar documento"
        search-placeholder="Buscar documento..."
        empty-title="Sin documentos"
        empty-description="Agrega los documentos que necesita revisar el colegio."
        :initial-page-size="8"
        @create="openDocumentModal"
      >
        <template #cell-name="{ row }">
          <div class="list-primary list-primary--inline">
            <span class="document-row__icon">DOC</span>
            <div>
              <strong>{{ row.name }}</strong>
              <small>{{ row.maxSizeMb }} MB máximo</small>
            </div>
          </div>
        </template>
        <template #cell-requiredLabel="{ row }">
          <StatusBadge :status="String(row.requiredLabel)" />
        </template>
        <template #row-actions="{ row }">
          <button class="table-action table-action--danger" type="button" @click="deleteDocument(String(row.id))">Eliminar</button>
        </template>
      </ListView>
    </section>

    <SurfaceCard v-else>
      <div class="card-headline">
        <div>
          <h3>Vista previa del formulario</h3>
          <p>Así verá el formulario el padre de familia cuando abra el link.</p>
        </div>
        <div class="summary-strip">
          <div><strong>{{ sections.length }}</strong><small>Secciones</small></div>
          <div><strong>{{ totalFields }}</strong><small>Campos</small></div>
          <div><strong>{{ requiredFields }}</strong><small>Obligatorios</small></div>
          <div><strong>{{ documents.length }}</strong><small>Documentos</small></div>
        </div>
      </div>

      <div class="public-form-preview">
        <section v-for="section in sections" :key="section.id" class="public-form-preview__section">
          <h4>{{ section.title }}</h4>
          <p class="public-form-preview__description">{{ section.description }}</p>
          <div class="form-grid">
            <label v-for="field in section.fields" :key="field.id">
              {{ field.label }} <strong v-if="field.required">*</strong>
              <select v-if="field.type === 'select'">
                <option>Seleccione...</option>
                <option v-for="option in field.options" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <textarea v-else-if="field.type === 'textarea'" />
              <input v-else-if="field.type === 'checkbox'" type="checkbox" />
              <input v-else :type="inputType(field.type)" />
            </label>
          </div>
        </section>
      </div>
    </SurfaceCard>

    <FormModal :open="activeModal === 'section'" title="Nueva sección" @close="closeModal">
      <form class="form-grid" @submit.prevent="createSection">
        <label>
          Nombre de la sección
          <input v-model="sectionForm.title" required placeholder="Ej: Información de salud" />
        </label>
        <label>
          Descripción (opcional)
          <input v-model="sectionForm.description" placeholder="Una breve explicación para el padre de familia" />
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Crear sección</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'field'" title="Nueva pregunta" size="lg" presentation="drawer" @close="closeModal">
      <form class="form-grid" @submit.prevent="createField">
        <label>
          ¿Qué quieres preguntar?
          <input v-model="fieldForm.label" required placeholder="Ej: EPS del estudiante" />
        </label>
        <label>
          Tipo de respuesta
          <select v-model="fieldForm.type">
            <option value="text">Texto corto</option>
            <option value="textarea">Texto largo</option>
            <option value="number">Número</option>
            <option value="date">Fecha</option>
            <option value="select">Lista desplegable</option>
            <option value="checkbox">Sí / No</option>
            <option value="email">Correo electrónico</option>
            <option value="phone">Teléfono</option>
            <option value="file">Archivo</option>
          </select>
        </label>
        <label class="switch-row form-grid__wide">
          <input v-model="fieldForm.required" type="checkbox" />
          El padre debe responder esto (obligatorio)
        </label>
        <label v-if="fieldForm.type === 'select'" class="form-grid__wide">
          Opciones disponibles
          <textarea v-model="fieldForm.optionsText" placeholder="Una opción por línea. Ej:&#10;O+&#10;A+&#10;B+" />
        </label>
        <p v-if="fieldForm.type === 'select'" class="form-note">Escribe cada opción en una línea separada.</p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Agregar pregunta</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'document'" title="Nuevo documento" @close="closeModal">
      <form class="form-grid" @submit.prevent="createDocument">
        <label>
          Nombre del documento
          <input v-model="documentForm.name" required placeholder="Ej: Certificado EPS" />
        </label>
        <label>
          Tamaño máximo (MB)
          <input v-model.number="documentForm.maxSizeMb" type="number" min="1" />
        </label>
        <label class="switch-row form-grid__wide">
          <input v-model="documentForm.required" type="checkbox" />
          El padre debe subir este documento (obligatorio)
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Agregar documento</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'publish'" title="Publicar formulario" @close="closeModal">
      <form class="form-grid" @submit.prevent="confirmPublish">
        <p class="form-note">Al publicar, el formulario estará disponible en el link para los padres de familia, siempre que esté dentro de las fechas configuradas.</p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Publicar</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'
import { loadPublicFormDraft, savePublicFormDraft, type DraftDocument, type DraftField, type DraftSection } from '../lib/publicFormDraft'
import { useAcademicContextStore } from '../stores/academic-context'
import {
  builderSteps,
  documentColumns,
  documentPresets,
  fieldColumns,
  fieldTypeIcon,
  fieldTypeLabel,
  initialDocuments,
  initialSections,
  inputType,
  mapEditorResponse,
  paginateRows,
  parseSelectOptions,
  sectionColumns,
  sectionPresets,
  type BuilderStep,
  type FormVersionStatus,
} from './enrollment-forms/enrollmentFormsBuilder'
import './enrollment-forms/EnrollmentFormsView.css'

const activeModal = ref<'section' | 'field' | 'document' | 'publish' | null>(null)
const activeSectionId = ref('health')
const builderStep = ref<BuilderStep>('setup')
const feedback = ref('')
const busy = ref(false)
const versionStatus = ref<FormVersionStatus>('draft')
const targetSectionId = ref('health')
const academicContext = useAcademicContextStore()

const formConfig = reactive({
  name: 'Formulario de inscripcion 2026',
  year: '2026',
  tenantSlug: 'colegio-demo-ofir',
  startsOn: '2025-10-01',
  endsOn: '2026-02-15',
  autosave: true,
  progressBar: true,
})

const sectionForm = reactive({ title: '', description: '' })
const fieldForm = reactive({ label: '', type: 'text', required: false, optionsText: '' })
const documentForm = reactive({ name: '', required: true, maxSizeMb: 10 })

const sections = ref<DraftSection[]>(initialSections.map((section) => ({ ...section, fields: section.fields.map((field) => ({ ...field, options: field.options.map((option) => ({ ...option })) })) })))
const documents = ref<DraftDocument[]>(initialDocuments.map((document) => ({ ...document })))

const academicYears = computed(() => academicContext.academicYears)
const activeAcademicYear = computed(() => academicYears.value.find((year) => year.status === 'activo') ?? null)
const activeAcademicYearName = computed(() => activeAcademicYear.value?.name ?? 'el año lectivo activo')
const selectedAcademicYear = computed(() => academicYears.value.find((year) => String(year.year) === formConfig.year) ?? null)
const selectedAcademicYearName = computed(() => selectedAcademicYear.value?.name ?? `Año lectivo ${formConfig.year}`)
const isActiveAcademicYearSelected = computed(() => selectedAcademicYear.value?.id === activeAcademicYear.value?.id)
const publicPath = computed(() => `/inscripcion/${formConfig.tenantSlug}/${formConfig.year}`)
const publicLink = computed(() => {
  const origin = typeof window === 'undefined' ? 'https://app.ofirschool.com' : window.location.origin
  return `${origin}${publicPath.value}`
})
const totalFields = computed(() => sections.value.reduce((total, section) => total + section.fields.length, 0))
const requiredFields = computed(() => sections.value.reduce((total, section) => total + section.fields.filter((field) => field.required).length, 0))
const activeSection = computed(() => sections.value.find((section) => section.id === activeSectionId.value) ?? null)
const sectionsReloadKey = computed(() =>
  sections.value.map((section) => `${section.id}:${section.title}:${section.fields.length}:${section.fields.filter((field) => field.required).length}`).join('|'),
)
const fieldsReloadKey = computed(() =>
  `${activeSectionId.value}:${activeSection.value?.fields.map((field) => `${field.id}:${field.label}:${field.type}:${field.required}:${field.options.length}`).join('|') ?? ''}`,
)
const documentsReloadKey = computed(() =>
  documents.value.map((document) => `${document.id}:${document.name}:${document.required}:${document.maxSizeMb}`).join('|'),
)
const recommendedTemplate = computed(() =>
  formConfig.progressBar && formConfig.autosave
    ? { label: 'Formulario completo', helper: 'Incluye barra de avance y guardado automático. Ideal para formularios largos.' }
    : { label: 'Formulario simple', helper: 'Más directo y sin pasos adicionales. Ideal para formularios cortos.' },
)
const primaryTask = computed(() => {
  if (!formConfig.name || !formConfig.startsOn || !formConfig.endsOn) {
    return {
      title: 'Primer paso',
      value: 'Completar información básica',
      helper: 'Sin nombre ni fechas, el formulario no se puede compartir.',
      description: 'Empieza por definir el nombre y las fechas del formulario.',
      actionLabel: 'Ir a información básica',
      secondaryStep: 'setup' as BuilderStep,
    }
  }

  if (sections.value.length === 0) {
    return {
      title: 'Siguiente paso',
      value: 'Agregar preguntas',
      helper: 'Puedes usar las plantillas listas o crear preguntas desde cero.',
      description: 'Define qué información pedirá el formulario a los padres.',
      actionLabel: 'Agregar preguntas',
      secondaryStep: 'structure' as BuilderStep,
    }
  }

  if (documents.value.length === 0) {
    return {
      title: 'Documentos pendientes',
      value: 'Agregar documentos',
      helper: 'La mayoría de colegios piden al menos el documento de identidad.',
      description: 'Define qué archivos deben subir los padres durante la inscripción.',
      actionLabel: 'Ir a documentos',
      secondaryStep: 'documents' as BuilderStep,
    }
  }

  return {
    title: 'Listo para revisar',
    value: `${sections.value.length} secciones · ${documents.value.length} documentos`,
    helper: 'Ya tienes todo lo necesario. Revisa cómo quedó el formulario.',
    description: 'Haz una última revisión y luego publícalo para los padres.',
    actionLabel: 'Ver vista previa',
    secondaryStep: 'preview' as BuilderStep,
  }
})

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const fetchSections = async (params: { page: number; pageSize: number; query: string }) =>
  paginateRows(
    sections.value.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      fieldsCount: section.fields.length,
      requiredCount: section.fields.filter((field) => field.required).length,
      state: section.id === activeSectionId.value ? 'Seleccionada' : 'Disponible',
    })),
    params,
  )

const fetchActiveFields = async (params: { page: number; pageSize: number; query: string }) =>
  paginateRows(
    (activeSection.value?.fields ?? []).map((field) => ({
      id: field.id,
      label: field.label,
      icon: fieldTypeIcon(field.type),
      typeLabel: fieldTypeLabel(field.type),
      required: field.required,
      requiredLabel: field.required ? 'obligatorio' : 'opcional',
      optionsText: field.type === 'select' ? `${field.options.length} opciones` : 'Respuesta del acudiente',
    })),
    params,
  )

const fetchDocuments = async (params: { page: number; pageSize: number; query: string }) =>
  paginateRows(
    documents.value.map((document) => ({
      id: document.id,
      name: document.name,
      required: document.required,
      requiredLabel: document.required ? 'obligatorio' : 'opcional',
      maxSizeMb: document.maxSizeMb,
      maxSizeLabel: `${document.maxSizeMb} MB`,
    })),
    params,
  )

const selectSection = (sectionId: string) => {
  activeSectionId.value = sectionId
}

const toggleFieldRequired = (fieldId: string) => {
  const field = activeSection.value?.fields.find((item) => item.id === fieldId)
  if (field) toggleRequired(field)
}

const markDraft = (message: string) => {
  versionStatus.value = 'draft'
  feedback.value = message
}

const buildPayload = () => ({
  name: formConfig.name,
  year: Number(formConfig.year),
  startsOn: formConfig.startsOn,
  endsOn: formConfig.endsOn,
  autosave: formConfig.autosave,
  progressBar: formConfig.progressBar,
  sections: sections.value,
  documents: documents.value,
})

const persistDraft = () => {
  savePublicFormDraft({
    config: { ...formConfig },
    sections: sections.value,
    documents: documents.value,
    versionStatus: versionStatus.value,
    updatedAt: new Date().toISOString(),
  })
}

const setBuilderStep = (step: BuilderStep) => {
  builderStep.value = step
}

const applyTemplate = (template: 'balanced') => {
  if (template === 'balanced') {
    const starterSections = ['health', 'guardians', 'transport'] as const
    for (const key of starterSections) addPresetSection(key, true)
    addPresetDocument('student-document', true)
    addPresetDocument('guardian-document', true)
    addPresetDocument('eps-certificate', true)
    markDraft('Plantilla base aplicada al formulario.')
    persistDraft()
  }
}

const closeModal = () => {
  activeModal.value = null
}

const openSectionModal = () => {
  sectionForm.title = ''
  sectionForm.description = ''
  activeModal.value = 'section'
}

const openFieldModal = (sectionId: string) => {
  targetSectionId.value = sectionId
  fieldForm.label = ''
  fieldForm.type = 'text'
  fieldForm.required = false
  fieldForm.optionsText = ''
  activeModal.value = 'field'
}

const openDocumentModal = () => {
  documentForm.name = ''
  documentForm.required = true
  documentForm.maxSizeMb = 10
  activeModal.value = 'document'
}

const addPresetSection = (presetKey: string, silent = false) => {
  const preset = sectionPresets.find((item) => item.key === presetKey)
  if (!preset) return
  const alreadyExists = sections.value.some((section) => section.title === preset.title)
  if (alreadyExists) {
    if (!silent) feedback.value = `${preset.title} ya existe en el formulario.`
    return
  }

  const section: DraftSection = {
    id: makeId('section'),
    title: preset.title,
    description: preset.description,
    fields: preset.fields.map((field, index) => ({
      id: makeId(`field-${index + 1}`),
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options.map((option) => ({ ...option })),
    })),
  }

  sections.value.push(section)
  activeSectionId.value = section.id
  if (!silent) {
    markDraft(`${preset.title} agregada desde la biblioteca.`)
    persistDraft()
  }
}

const addPresetDocument = (presetKey: string, silent = false) => {
  const preset = documentPresets.find((item) => item.key === presetKey)
  if (!preset) return
  const alreadyExists = documents.value.some((document) => document.name === preset.name)
  if (alreadyExists) {
    if (!silent) feedback.value = `${preset.name} ya existe en documentos requeridos.`
    return
  }

  documents.value.push({
    id: makeId('document'),
    name: preset.name,
    required: preset.required,
    maxSizeMb: preset.maxSizeMb,
  })

  if (!silent) {
    markDraft(`${preset.name} agregado desde sugeridos.`)
    persistDraft()
  }
}

const createSection = () => {
  const section: DraftSection = {
    id: makeId('section'),
    title: sectionForm.title,
    description: sectionForm.description || 'Nueva seccion del formulario publico.',
    fields: [],
  }

  sections.value.push(section)
  activeSectionId.value = section.id
  builderStep.value = 'structure'
  markDraft(`${section.title} agregada.`)
  persistDraft()
  closeModal()
}

const createField = () => {
  const section = sections.value.find((item) => item.id === targetSectionId.value)
  if (!section) return

  section.fields.push({
    id: makeId('field'),
    label: fieldForm.label,
    type: fieldForm.type,
    required: fieldForm.required,
    options: fieldForm.type === 'select' ? parseSelectOptions(fieldForm.optionsText) : [],
  })
  activeSectionId.value = section.id
  markDraft(`${fieldForm.label} agregado a ${section.title}.`)
  persistDraft()
  closeModal()
}

const createDocument = () => {
  documents.value.push({
    id: makeId('document'),
    name: documentForm.name,
    required: documentForm.required,
    maxSizeMb: documentForm.maxSizeMb,
  })
  builderStep.value = 'documents'
  markDraft(`${documentForm.name} agregado a documentos requeridos.`)
  persistDraft()
  closeModal()
}

const deleteSection = (sectionId: string) => {
  const section = sections.value.find((item) => item.id === sectionId)
  if (!section) return
  const confirmed = window.confirm(`Eliminar la seccion "${section.title}" y sus ${section.fields.length} campos?`)
  if (!confirmed) return

  sections.value = sections.value.filter((item) => item.id !== sectionId)
  activeSectionId.value = sections.value[0]?.id ?? ''
  markDraft(`${section.title} eliminada.`)
  persistDraft()
}

const deleteField = (sectionId: string, fieldId: string) => {
  const section = sections.value.find((item) => item.id === sectionId)
  const field = section?.fields.find((item) => item.id === fieldId)
  if (!section || !field) return
  const confirmed = window.confirm(`Eliminar el campo "${field.label}"?`)
  if (!confirmed) return

  section.fields = section.fields.filter((item) => item.id !== fieldId)
  markDraft(`${field.label} eliminado de ${section.title}.`)
  persistDraft()
}

const deleteDocument = (documentId: string) => {
  const document = documents.value.find((item) => item.id === documentId)
  if (!document) return
  const confirmed = window.confirm(`Eliminar el documento "${document.name}"?`)
  if (!confirmed) return

  documents.value = documents.value.filter((item) => item.id !== documentId)
  markDraft(`${document.name} eliminado de documentos requeridos.`)
  persistDraft()
}

const toggleRequired = (field: DraftField) => {
  field.required = !field.required
  markDraft(`${field.label} ahora es ${field.required ? 'obligatorio' : 'opcional'}.`)
  persistDraft()
}

const publishVersion = () => {
  activeModal.value = 'publish'
}

const applyEditorResponse = (data: Record<string, unknown>) => {
  const mapped = mapEditorResponse(data, formConfig)
  Object.assign(formConfig, mapped.config)
  sections.value = mapped.sections
  documents.value = mapped.documents
  versionStatus.value = mapped.versionStatus
  activeSectionId.value = mapped.sections[0]?.id ?? ''
}

const saveDraft = async () => {
  busy.value = true
  try {
    const response = await api.saveEnrollmentFormDraft(formConfig.year, buildPayload())
    applyEditorResponse(response.data)
    feedback.value = response.message
    persistDraft()
  } catch (caught) {
    markDraft(caught instanceof Error ? caught.message : 'No pudimos guardar el borrador.')
    persistDraft()
  } finally {
    busy.value = false
  }
}

const confirmPublish = async () => {
  busy.value = true
  try {
    const response = await api.publishEnrollmentForm(formConfig.year, buildPayload())
    applyEditorResponse(response.data)
    versionStatus.value = 'published'
    feedback.value = `${response.message}. Link: ${publicLink.value}`
    persistDraft()
    closeModal()
  } catch (caught) {
    feedback.value = caught instanceof Error ? caught.message : 'No pudimos publicar el formulario.'
  } finally {
    busy.value = false
  }
}

const copyLink = async () => {
  await navigator.clipboard?.writeText(publicLink.value)
  feedback.value = `Link copiado: ${publicLink.value}`
}

watch(
  () => formConfig.year,
  async (year, previousYear) => {
    if (year === previousYear) return
    try {
      busy.value = true
      const response = await api.getEnrollmentFormEditor(year)
      applyEditorResponse(response.data)
    } catch (caught) {
      feedback.value = caught instanceof Error ? caught.message : 'No pudimos cambiar de año lectivo.'
    } finally {
      busy.value = false
    }
  },
)

onMounted(async () => {
  try {
    busy.value = true
    if (!academicContext.academicYears.length) {
      await academicContext.loadAcademicYears()
    }
    if (activeAcademicYear.value) {
      formConfig.year = String(activeAcademicYear.value.year)
    }
    const response = await api.getEnrollmentFormEditor(formConfig.year)
    applyEditorResponse(response.data)
    persistDraft()
  } catch {
    const savedDraft = loadPublicFormDraft(formConfig.tenantSlug, formConfig.year)
    if (savedDraft) {
      Object.assign(formConfig, savedDraft.config)
      sections.value = savedDraft.sections
      documents.value = savedDraft.documents
      versionStatus.value = savedDraft.versionStatus
      activeSectionId.value = savedDraft.sections[0]?.id ?? ''
    }
  } finally {
    busy.value = false
  }
})
</script>

<style src="./enrollment-forms/EnrollmentFormsView.css" scoped></style>
