<template>
  <section class="stack">
    <PageHeader
      eyebrow="Formulario publico"
      title="Formulario de inscripcion"
      subtitle="Configura el formulario publico con una experiencia mas guiada para secretaría y admisiones."
    >
      <template #actions>
        <button class="button button--ghost" type="button" :disabled="busy" @click="saveDraft">
          {{ busy ? 'Guardando...' : 'Guardar borrador' }}
        </button>
        <button class="button button--brand" type="button" :disabled="busy || !isActiveAcademicYearSelected" @click="publishVersion">Publicar formulario</button>
      </template>
    </PageHeader>

    <section class="module-grid module-grid--split form-builder-workboard">
      <SurfaceCard class="form-builder-focus-card">
        <div class="card-headline">
          <div>
            <h3>Que conviene hacer ahora</h3>
            <p>{{ primaryTask.description }}</p>
          </div>
          <StatusBadge :status="versionStatus === 'published' ? 'publicado' : 'borrador'" />
        </div>

        <div class="module-note-list">
          <article class="module-note-list__item">
            <span>{{ primaryTask.title }}</span>
            <strong>{{ primaryTask.value }}</strong>
            <p>{{ primaryTask.helper }}</p>
          </article>
        </div>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="setBuilderStep(primaryTask.secondaryStep)">Ver bloque</button>
          <button class="button button--brand" type="button" @click="runPrimaryAction">{{ primaryTask.actionLabel }}</button>
        </div>
      </SurfaceCard>

      <SurfaceCard class="form-builder-link-card" variant="accent">
        <div class="card-headline">
          <div>
            <h3>Link publico</h3>
            <p>Este link se comparte con acudientes. No requiere inicio de sesion.</p>
          </div>
        </div>
        <div class="public-link-box public-link-box--compact">
          <div>
            <span class="window-strip__label">URL</span>
            <strong>{{ publicLink }}</strong>
          </div>
          <div class="date-chip-list">
            <button class="table-action" type="button" @click="copyLink">Copiar</button>
            <RouterLink class="table-action" :to="publicPath">Abrir</RouterLink>
          </div>
        </div>
        <p class="form-note">
          {{ isActiveAcademicYearSelected
            ? 'Este es el año lectivo activo. Puedes publicar este formulario y quedará como el único vigente.'
            : `Puedes editar borradores para ${selectedAcademicYearName}, pero solo el formulario de ${activeAcademicYearName} puede quedar publicado.` }}
        </p>
      </SurfaceCard>
    </section>

    <SurfaceCard>
      <div class="builder-steps" role="tablist" aria-label="Pasos del constructor">
        <button
          v-for="step in builderSteps"
          :key="step.value"
          type="button"
          class="builder-step"
          :class="{ 'builder-step--active': builderStep === step.value }"
          @click="setBuilderStep(step.value)"
        >
          <strong>{{ step.label }}</strong>
          <span>{{ step.helper }}</span>
        </button>
      </div>
    </SurfaceCard>

    <section v-if="builderStep === 'setup'" class="form-setup-grid">
      <SurfaceCard>
        <div class="card-headline">
          <div>
            <h3>Datos del formulario</h3>
            <p>Primero define vigencia y comportamiento general del proceso publico.</p>
          </div>
          <StatusBadge :status="versionStatus === 'published' ? 'publicado' : 'borrador'" />
        </div>

        <form class="form-grid" @submit.prevent="saveDraft">
          <label>
            Nombre publico
            <input v-model="formConfig.name" required />
          </label>
          <label>
            Ano lectivo
            <select v-model="formConfig.year">
              <option v-for="year in academicYears" :key="year.id" :value="String(year.year)">
                {{ year.name }}
              </option>
            </select>
          </label>
          <label>
            Fecha apertura
            <input v-model="formConfig.startsOn" type="date" required />
          </label>
          <label>
            Fecha cierre
            <input v-model="formConfig.endsOn" type="date" required />
          </label>
          <label class="switch-row form-grid__wide">
            <input v-model="formConfig.autosave" type="checkbox" />
            Permitir autoguardado del acudiente
          </label>
          <label class="switch-row form-grid__wide">
            <input v-model="formConfig.progressBar" type="checkbox" />
            Mostrar barra de progreso
          </label>
          <div class="modal-actions form-grid__wide">
            <button class="button button--ghost" type="button" @click="applyTemplate('balanced')">Usar plantilla base</button>
            <button class="button button--brand" type="submit" :disabled="busy">Guardar configuracion</button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard>
        <div class="card-headline">
          <div>
            <h3>Resumen del constructor</h3>
            <p>Una vista rapida para saber si el formulario ya esta listo para operar.</p>
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
            <span>Estado de publicacion</span>
            <strong>{{ versionStatus === 'published' ? 'Disponible al publico' : 'En borrador' }}</strong>
            <p>Guarda borrador para seguir editando. Publica cuando el año lectivo activo esté listo.</p>
          </article>
        </div>
      </SurfaceCard>
    </section>

    <section v-else-if="builderStep === 'structure'" class="form-manager-grid">
      <SurfaceCard>
        <div class="card-headline">
          <div>
            <h3>Biblioteca de bloques</h3>
            <p>Agrega secciones frecuentes sin empezar desde cero.</p>
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
            <small>{{ preset.fields.length }} campos sugeridos</small>
          </button>
        </div>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="openSectionModal">Crear seccion vacia</button>
          <button class="button button--brand" type="button" @click="setBuilderStep('preview')">Ir a vista previa</button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div class="card-headline">
          <div>
            <h3>Secciones del formulario</h3>
            <p>Elige una seccion y agrega solo los datos dinamicos que realmente necesite el colegio.</p>
          </div>
          <button class="button button--brand" type="button" @click="openSectionModal">Nueva seccion</button>
        </div>

        <div class="simple-section-list">
          <article v-for="section in sections" :key="section.id" class="simple-section-card">
            <div class="simple-section-card__head">
              <div>
                <strong>{{ section.title }}</strong>
                <small>{{ section.description }}</small>
              </div>
              <div class="row-actions">
                <button class="table-action" type="button" @click="activeSectionId = section.id">
                  {{ activeSectionId === section.id ? 'Abierta' : 'Editar' }}
                </button>
                <button class="table-action table-action--danger" type="button" @click="deleteSection(section.id)">Eliminar</button>
              </div>
            </div>

            <div v-if="activeSectionId === section.id" class="section-fields">
              <div class="section-fields__toolbar">
                <p>{{ section.fields.length }} campos en esta seccion</p>
                <button class="table-action" type="button" @click="openFieldModal(section.id)">Agregar campo</button>
              </div>

              <div v-if="section.fields.length === 0" class="tracking-empty">Esta seccion aun no tiene campos. Usa la biblioteca o agrega uno nuevo.</div>

              <div
                v-for="field in section.fields"
                :key="field.id"
                class="field-row field-row--editor"
              >
                <span class="field-row__icon">{{ fieldTypeIcon(field.type) }}</span>
                <div>
                  <strong>{{ field.label }}</strong>
                  <small>
                    {{ fieldTypeLabel(field.type) }}
                    <template v-if="field.type === 'select'"> · {{ field.options.length }} opciones</template>
                  </small>
                </div>
                <StatusBadge :status="field.required ? 'obligatorio' : 'opcional'" />
                <div class="row-actions">
                  <button class="table-action" type="button" @click="toggleRequired(field)">
                    {{ field.required ? 'Hacer opcional' : 'Hacer obligatorio' }}
                  </button>
                  <button class="table-action table-action--danger" type="button" @click="deleteField(section.id, field.id)">Eliminar</button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </SurfaceCard>
    </section>

    <section v-else-if="builderStep === 'documents'" class="form-manager-grid">
      <SurfaceCard>
        <div class="card-headline">
          <div>
            <h3>Documentos sugeridos</h3>
            <p>Agrega rápidamente los soportes más comunes en colegios de Colombia.</p>
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

      <SurfaceCard>
        <div class="card-headline">
          <div>
            <h3>Documentos requeridos</h3>
            <p>Define archivos que el acudiente debe cargar durante la inscripcion.</p>
          </div>
          <button class="button button--ghost" type="button" @click="openDocumentModal">Agregar documento</button>
        </div>

        <div class="document-list">
          <div v-for="document in documents" :key="document.id" class="document-row">
            <span class="document-row__icon">DOC</span>
            <div>
              <strong>{{ document.name }}</strong>
              <small>{{ document.required ? 'Obligatorio' : 'Opcional' }} · {{ document.maxSizeMb }} MB</small>
            </div>
            <StatusBadge :status="document.required ? 'obligatorio' : 'opcional'" />
            <button class="table-action table-action--danger" type="button" @click="deleteDocument(document.id)">Eliminar</button>
          </div>
        </div>
      </SurfaceCard>
    </section>

    <SurfaceCard v-else>
      <div class="card-headline">
        <div>
          <h3>Vista previa guiada</h3>
          <p>Asi se vera la estructura general del formulario publico antes de compartirlo.</p>
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

    <FormModal :open="activeModal === 'section'" title="Nueva seccion" @close="closeModal">
      <form class="form-grid" @submit.prevent="createSection">
        <label>
          Nombre
          <input v-model="sectionForm.title" required placeholder="Ej. Informacion de salud" />
        </label>
        <label>
          Descripcion
          <input v-model="sectionForm.description" placeholder="Texto de ayuda para el acudiente" />
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Crear seccion</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'field'" title="Nuevo campo" size="lg" presentation="drawer" @close="closeModal">
      <form class="form-grid" @submit.prevent="createField">
        <label>
          Etiqueta
          <input v-model="fieldForm.label" required placeholder="Ej. EPS" />
        </label>
        <label>
          Tipo de campo
          <select v-model="fieldForm.type">
            <option value="text">Texto corto</option>
            <option value="textarea">Texto largo</option>
            <option value="number">Numero</option>
            <option value="date">Fecha</option>
            <option value="select">Seleccion</option>
            <option value="checkbox">Si / No</option>
            <option value="email">Correo</option>
            <option value="phone">Telefono</option>
            <option value="file">Archivo</option>
          </select>
        </label>
        <label class="switch-row form-grid__wide">
          <input v-model="fieldForm.required" type="checkbox" />
          Campo obligatorio
        </label>
        <label v-if="fieldForm.type === 'select'" class="form-grid__wide">
          Opciones del select
          <textarea v-model="fieldForm.optionsText" placeholder="Una opcion por linea. Ej:&#10;O+&#10;A+&#10;B+" />
        </label>
        <p v-if="fieldForm.type === 'select'" class="form-note">Cada linea se guarda como una opcion { label, value }.</p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Agregar campo</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'document'" title="Nuevo documento" @close="closeModal">
      <form class="form-grid" @submit.prevent="createDocument">
        <label>
          Nombre
          <input v-model="documentForm.name" required placeholder="Ej. Certificado EPS" />
        </label>
        <label>
          Tamano maximo MB
          <input v-model.number="documentForm.maxSizeMb" type="number" min="1" />
        </label>
        <label class="switch-row form-grid__wide">
          <input v-model="documentForm.required" type="checkbox" />
          Documento obligatorio
        </label>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Agregar documento</button>
        </div>
      </form>
    </FormModal>

    <FormModal :open="activeModal === 'publish'" title="Publicar formulario" @close="closeModal">
      <form class="form-grid" @submit.prevent="confirmPublish">
        <p class="form-note">Al publicar, esta version queda disponible en el link publico si el proceso esta dentro de fechas.</p>
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
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { api } from '../lib/api'
import { loadPublicFormDraft, savePublicFormDraft, type DraftDocument, type DraftField, type DraftSection } from '../lib/publicFormDraft'
import { useAcademicContextStore } from '../stores/academic-context'

type DynamicField = DraftField
type DynamicSection = DraftSection
type RequiredDocument = DraftDocument
type SelectOption = {
  label: string
  value: string
}

type BuilderStep = 'setup' | 'structure' | 'documents' | 'preview'

const activeModal = ref<'section' | 'field' | 'document' | 'publish' | null>(null)
const activeSectionId = ref('health')
const builderStep = ref<BuilderStep>('setup')
const feedback = ref('')
const busy = ref(false)
const versionStatus = ref<'draft' | 'published'>('draft')
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

const sectionPresets = [
  {
    key: 'health',
    title: 'Salud',
    description: 'Datos medicos, EPS y alertas importantes.',
    fields: [
      { label: 'EPS', type: 'text', required: true, options: [] },
      { label: 'Alergias conocidas', type: 'textarea', required: false, options: [] },
      {
        label: 'Grupo sanguineo',
        type: 'select',
        required: true,
        options: [
          { label: 'O+', value: 'o-positive' },
          { label: 'A+', value: 'a-positive' },
          { label: 'B+', value: 'b-positive' },
        ],
      },
    ],
  },
  {
    key: 'guardians',
    title: 'Acudientes y autorizados',
    description: 'Personas responsables y contactos de emergencia.',
    fields: [
      { label: 'Persona autorizada adicional', type: 'text', required: false, options: [] },
      { label: 'Telefono de emergencia', type: 'phone', required: true, options: [] },
      { label: 'Parentesco del autorizado', type: 'text', required: false, options: [] },
    ],
  },
  {
    key: 'transport',
    title: 'Transporte',
    description: 'Informacion sobre movilidad y recogida del estudiante.',
    fields: [
      { label: 'Usa ruta escolar', type: 'checkbox', required: false, options: [] },
      { label: 'Direccion de recogida', type: 'text', required: false, options: [] },
      { label: 'Responsable de recogerlo', type: 'text', required: false, options: [] },
    ],
  },
  {
    key: 'coexistence',
    title: 'Convivencia y apoyos',
    description: 'Alertas de convivencia, apoyos o acompanamientos especiales.',
    fields: [
      { label: 'Requiere acompanamiento especial', type: 'checkbox', required: false, options: [] },
      { label: 'Observaciones institucionales', type: 'textarea', required: false, options: [] },
    ],
  },
]

const documentPresets = [
  { key: 'student-document', name: 'Documento de identidad del estudiante', required: true, maxSizeMb: 10, helper: 'Soporte basico de identificacion.' },
  { key: 'guardian-document', name: 'Documento de identidad del acudiente', required: true, maxSizeMb: 10, helper: 'Necesario para trazabilidad del responsable.' },
  { key: 'eps-certificate', name: 'Certificado EPS', required: false, maxSizeMb: 10, helper: 'Muy comun en admisiones y renovaciones.' },
  { key: 'vaccination-card', name: 'Carnet de vacunacion', required: false, maxSizeMb: 10, helper: 'Frecuente en grados iniciales.' },
]

const sections = ref<DynamicSection[]>([
  {
    id: 'health',
    title: 'Informacion de salud',
    description: 'Datos medicos importantes para la institucion.',
    fields: [
      { id: 'eps', label: 'EPS', type: 'text', required: true, options: [] },
      { id: 'allergies', label: 'Alergias conocidas', type: 'textarea', required: false, options: [] },
      {
        id: 'blood-type',
        label: 'Grupo sanguineo',
        type: 'select',
        required: true,
        options: [
          { label: 'O+', value: 'o-positive' },
          { label: 'A+', value: 'a-positive' },
          { label: 'B+', value: 'b-positive' },
        ],
      },
    ],
  },
  {
    id: 'transport',
    title: 'Transporte',
    description: 'Informacion sobre movilidad del estudiante.',
    fields: [
      { id: 'route', label: 'Usa ruta escolar', type: 'checkbox', required: false, options: [] },
      { id: 'address', label: 'Direccion de recogida', type: 'text', required: false, options: [] },
    ],
  },
])

const documents = ref<RequiredDocument[]>([
  { id: 'student-document', name: 'Documento de identidad del estudiante', required: true, maxSizeMb: 10 },
  { id: 'guardian-document', name: 'Documento de identidad del acudiente', required: true, maxSizeMb: 10 },
  { id: 'eps-certificate', name: 'Certificado EPS', required: false, maxSizeMb: 10 },
])

const builderSteps = [
  { value: 'setup' as const, label: '1. Datos base', helper: 'Nombre, vigencia y reglas generales.' },
  { value: 'structure' as const, label: '2. Secciones', helper: 'Bloques y campos dinamicos.' },
  { value: 'documents' as const, label: '3. Documentos', helper: 'Soportes requeridos al acudiente.' },
  { value: 'preview' as const, label: '4. Vista previa', helper: 'Revision final antes de publicar.' },
]

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
const recommendedTemplate = computed(() =>
  formConfig.progressBar && formConfig.autosave
    ? { label: 'Admisiones balanceada', helper: 'Buena para colegios que quieren equilibrio entre captura y claridad.' }
    : { label: 'Admisiones simple', helper: 'Mejor cuando el colegio prefiere un formulario corto y directo.' },
)
const primaryTask = computed(() => {
  if (!formConfig.name || !formConfig.startsOn || !formConfig.endsOn) {
    return {
      title: 'Paso inicial',
      value: 'Completar datos base',
      helper: 'Sin vigencia ni nombre, el formulario no queda listo para compartirse.',
      description: 'Conviene empezar por los datos base para que el resto del constructor tenga contexto claro.',
      actionLabel: 'Ir a datos base',
      secondaryStep: 'setup' as BuilderStep,
    }
  }

  if (sections.value.length === 0) {
    return {
      title: 'Siguiente bloque',
      value: 'Agregar primera seccion',
      helper: 'Puedes partir desde una biblioteca de bloques frecuentes o crear una seccion vacia.',
      description: 'El siguiente paso natural es definir la estructura del formulario que vera el acudiente.',
      actionLabel: 'Agregar bloque',
      secondaryStep: 'structure' as BuilderStep,
    }
  }

  if (documents.value.length === 0) {
    return {
      title: 'Soportes pendientes',
      value: 'Agregar documentos',
      helper: 'La mayoria de procesos necesita al menos identificacion del estudiante y del acudiente.',
      description: 'Antes de publicar, conviene definir los soportes documentales que pedira el colegio.',
      actionLabel: 'Ir a documentos',
      secondaryStep: 'documents' as BuilderStep,
    }
  }

  return {
    title: 'Formulario listo para revisar',
    value: `${sections.value.length} secciones · ${documents.value.length} documentos`,
    helper: 'Ya tienes estructura suficiente para revisar la experiencia y publicar cuando corresponda.',
    description: 'Conviene hacer una última revisión visual y luego guardar o publicar.',
    actionLabel: 'Ver vista previa',
    secondaryStep: 'preview' as BuilderStep,
  }
})

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const parseSelectOptions = (optionsText: string): SelectOption[] =>
  optionsText
    .split('\n')
    .map((option) => option.trim())
    .filter(Boolean)
    .map((option) => ({
      label: option,
      value: option
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    }))

const inputType = (fieldType: string) => {
  if (fieldType === 'email') return 'email'
  if (fieldType === 'date') return 'date'
  if (fieldType === 'number') return 'number'
  if (fieldType === 'phone') return 'tel'
  if (fieldType === 'file') return 'file'
  return 'text'
}

const fieldTypeIcon = (fieldType: string) => {
  const icons: Record<string, string> = {
    text: 'Aa',
    textarea: 'Tx',
    number: '#',
    date: 'Fe',
    select: 'Se',
    checkbox: 'Si',
    email: '@',
    phone: 'Tel',
    file: 'Doc',
  }

  return icons[fieldType] ?? 'Ca'
}

const fieldTypeLabel = (fieldType: string) => {
  const labels: Record<string, string> = {
    text: 'Texto corto',
    textarea: 'Texto largo',
    number: 'Numero',
    date: 'Fecha',
    select: 'Seleccion',
    checkbox: 'Si / No',
    email: 'Correo',
    phone: 'Telefono',
    file: 'Archivo',
  }
  return labels[fieldType] ?? fieldType
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

const runPrimaryAction = () => {
  setBuilderStep(primaryTask.value.secondaryStep)
  if (primaryTask.value.secondaryStep === 'structure' && sections.value.length === 0) {
    addPresetSection('health')
  }
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

  const section: DynamicSection = {
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
  const section: DynamicSection = {
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

const toggleRequired = (field: DynamicField) => {
  field.required = !field.required
  markDraft(`${field.label} ahora es ${field.required ? 'obligatorio' : 'opcional'}.`)
  persistDraft()
}

const publishVersion = () => {
  activeModal.value = 'publish'
}

const applyEditorResponse = (data: Record<string, unknown>) => {
  const config = (data.formConfig ?? {}) as Record<string, unknown>
  const apiSections = ((data.sections ?? []) as Array<Record<string, unknown>>).map((section) => ({
    id: String(section.id ?? crypto.randomUUID()),
    title: String(section.title ?? 'Seccion'),
    description: String(section.description ?? ''),
    fields: (((section.fields ?? []) as Array<Record<string, unknown>>).map((field) => ({
      id: String(field.id ?? crypto.randomUUID()),
      label: String(field.label ?? 'Campo'),
      type: String(field.type ?? 'text'),
      required: Boolean(field.required),
      options: Array.isArray(field.options)
        ? field.options.map((option) => {
            if (typeof option === 'string') return { label: option, value: option }
            const item = option as Record<string, unknown>
            return {
              label: String(item.label ?? item.value ?? ''),
              value: String(item.value ?? item.label ?? ''),
            }
          })
        : [],
    }))),
  }))
  const apiDocuments = ((data.documents ?? []) as Array<Record<string, unknown>>).map((document) => ({
    id: String(document.id ?? crypto.randomUUID()),
    name: String(document.name ?? 'Documento'),
    required: Boolean(document.required),
    maxSizeMb: Number(document.maxSizeMb ?? 10),
  }))

  Object.assign(formConfig, {
    name: String(config.name ?? formConfig.name),
    year: String(config.year ?? formConfig.year),
    tenantSlug: String(config.tenantSlug ?? formConfig.tenantSlug),
    startsOn: String(config.startsOn ?? formConfig.startsOn),
    endsOn: String(config.endsOn ?? formConfig.endsOn),
    autosave: Boolean(config.autosave ?? formConfig.autosave),
    progressBar: Boolean(config.progressBar ?? formConfig.progressBar),
  })

  sections.value = apiSections
  documents.value = apiDocuments
  versionStatus.value = String(data.versionStatus ?? 'draft') === 'published' ? 'published' : 'draft'
  activeSectionId.value = apiSections[0]?.id ?? ''
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

<style scoped>
.form-builder-workboard,
.form-setup-grid,
.form-manager-grid {
  align-items: stretch;
}

.form-builder-focus-card,
.form-builder-link-card {
  display: grid;
  gap: 1rem;
}

.builder-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.builder-step {
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: transparent;
  display: grid;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  text-align: left;
}

.builder-step span {
  color: var(--muted-foreground, #667085);
  font-size: 0.82rem;
}

.builder-step--active {
  background: color-mix(in srgb, var(--brand, #0f766e) 12%, white);
  border-color: color-mix(in srgb, var(--brand, #0f766e) 34%, var(--border-color));
}

.summary-strip--builder {
  margin-bottom: 1rem;
}

.template-library {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.template-library__item {
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--surface-2, #f8fafc) 96%, white);
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem 1rem;
  text-align: left;
}

.template-library__item span,
.template-library__item small,
.section-fields__toolbar p,
.public-form-preview__description {
  color: var(--muted-foreground, #667085);
}

.section-fields {
  display: grid;
  gap: 0.85rem;
}

.section-fields__toolbar {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.section-fields__toolbar p {
  margin: 0;
}

.public-form-preview__section {
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 1rem;
}

.public-form-preview__description {
  margin-top: -0.35rem;
  margin-bottom: 1rem;
}
</style>
