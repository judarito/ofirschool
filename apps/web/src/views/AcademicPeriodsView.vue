<template>
  <section class="stack">
    <PageHeader eyebrow="Academico" title="Periodos" subtitle="Gestiona el ciclo de apertura, publicación y cierre de cada periodo con más contexto operativo.">
      <template #actions>
        <button class="button button--ghost" type="button" @click="openCreate">Nuevo periodo</button>
        <button class="button button--brand" type="button" @click="runPrimaryAction">{{ primaryTask.actionLabel }}</button>
      </template>
    </PageHeader>

    <section class="module-grid module-grid--split periods-workboard">
      <SurfaceCard class="periods-focus-card">
        <div class="card-headline">
          <div>
            <h3>Qué conviene hacer ahora</h3>
            <p>{{ primaryTask.description }}</p>
          </div>
          <span :class="['meta-badge', badgeClass(primaryTask.status)]">{{ translateStatus(primaryTask.status) }}</span>
        </div>

        <div class="module-note-list">
          <article class="module-note-list__item">
            <span>{{ primaryTask.title }}</span>
            <strong>{{ primaryTask.value }}</strong>
            <p>{{ primaryTask.helper }}</p>
          </article>
        </div>

        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="openCreate">Crear periodo</button>
          <button class="button button--brand" type="button" @click="runPrimaryAction">{{ primaryTask.actionLabel }}</button>
        </div>
      </SurfaceCard>

      <section class="academic-rule-card">
        <span class="academic-rule-card__icon">%</span>
        <div>
          <strong>Total del año en edición: {{ selectedYearWeightTotal }}%</strong>
          <p>Para activar un año lectivo, la suma de sus periodos debe quedar exactamente en 100%.</p>
        </div>
      </section>
    </section>

    <section class="module-grid module-grid--split periods-guidance-grid">
      <SurfaceCard class="period-checklist-card">
        <div class="card-headline">
          <div>
            <h3>{{ transitionGuide.title }}</h3>
            <p>{{ transitionGuide.description }}</p>
          </div>
          <span :class="['meta-badge', badgeClass(transitionGuide.status)]">{{ translateStatus(transitionGuide.status) }}</span>
        </div>

        <div class="period-timeline" aria-label="Ciclo del periodo">
          <span :class="['period-timeline__step', timelineClass('open')]">Abierto</span>
          <span :class="['period-timeline__step', timelineClass('published')]">Publicado</span>
          <span :class="['period-timeline__step', timelineClass('closed')]">Cerrado</span>
        </div>

        <div class="module-note-list">
          <article v-for="item in transitionGuide.checklist" :key="item.label" class="module-note-list__item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <p>{{ item.helper }}</p>
          </article>
        </div>
      </SurfaceCard>

      <SurfaceCard class="period-checklist-card">
        <div class="card-headline">
          <div>
            <h3>Siguiente validación</h3>
            <p>{{ transitionGuide.confirmationLead }}</p>
          </div>
        </div>

        <div class="module-note-list">
          <article v-for="note in transitionGuide.confirmationPoints" :key="note.label" class="module-note-list__item">
            <span>{{ note.label }}</span>
            <strong>{{ note.value }}</strong>
            <p>{{ note.helper }}</p>
          </article>
        </div>
      </SurfaceCard>
    </section>

    <div class="metrics-grid metrics-grid--executive">
      <article class="surface-card period-metric">
        <span>Abiertos</span>
        <strong>{{ periodSummary.open }}</strong>
        <small>Períodos donde todavía se puede operar.</small>
      </article>
      <article class="surface-card period-metric">
        <span>Publicados</span>
        <strong>{{ periodSummary.published }}</strong>
        <small>Listos para boletines, pendientes de cierre final.</small>
      </article>
      <article class="surface-card period-metric">
        <span>Cerrados</span>
        <strong>{{ periodSummary.closed }}</strong>
        <small>Ya no admiten cambios académicos.</small>
      </article>
    </div>

    <ListView
      ref="listViewRef"
      title="Listado de periodos"
      subtitle="Cada periodo pertenece a un ano lectivo y desde aqui se publica, cierra o reabre segun el corte academico."
      :columns="columns"
      :fetcher="fetchRows"
      search-placeholder="Buscar periodo"
      create-label="Nuevo periodo"
      @create="openCreate"
      @edit="openEdit"
      @delete="openDelete"
    >
      <template #cell-status="{ value }">
        <span :class="['meta-badge', badgeClass(String(value))]">{{ translateStatus(String(value)) }}</span>
      </template>
      <template #cell-window="{ row }">
        <span class="date-range-cell">{{ row.window }}</span>
      </template>
      <template #row-actions="{ row }">
        <div class="period-actions">
          <button
            v-if="String(row.status) === 'open'"
            class="table-action"
            type="button"
            @click="changeStatus(row, 'published')"
          >
            Publicar periodo
          </button>
          <button
            v-else-if="String(row.status) === 'published'"
            class="table-action"
            type="button"
            @click="changeStatus(row, 'closed')"
          >
            Cerrar periodo
          </button>
          <button
            v-else
            class="table-action"
            type="button"
            @click="changeStatus(row, 'open')"
          >
            Reabrir periodo
          </button>
          <button class="table-action" type="button" :disabled="String(row.status) !== 'open'" @click="openEdit(row)">Editar</button>
          <button class="table-action table-action--danger" type="button" :disabled="String(row.status) !== 'open'" @click="openDelete(row)">Eliminar</button>
        </div>
      </template>
    </ListView>

    <FormModal :open="isModalOpen" :title="editingId ? 'Editar periodo' : 'Nuevo periodo'" @close="closeModal">
      <form class="form-grid" @submit.prevent="submitForm">
        <label>
          Ano lectivo
          <select v-model="form.academicYearId" required>
            <option v-for="year in academicYears" :key="year.id" :value="year.id">{{ year.name }}</option>
          </select>
        </label>
        <label>Nombre<input v-model="form.name" required placeholder="Primer periodo" /></label>
        <label>Codigo<input v-model="form.code" required placeholder="P1" /></label>
        <label>Peso %<input v-model.number="form.weight" type="number" required /></label>
        <label>Fecha inicio<input v-model="form.startsOn" type="date" required /></label>
        <label>Fecha fin<input v-model="form.endsOn" type="date" required /></label>
        <p class="form-note">Con este cambio, el total del año quedaría en {{ projectedYearWeightTotal }}%.</p>
        <div class="modal-actions">
          <button class="button button--ghost" type="button" @click="closeModal">Cancelar</button>
          <button class="button button--brand" type="submit">Guardar</button>
        </div>
      </form>
    </FormModal>

    <p v-if="feedback" class="action-feedback">{{ feedback }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AcademicPeriodDto, AcademicYearDto } from '@ofir/shared'
import FormModal from '../components/FormModal.vue'
import ListView from '../components/ListView.vue'
import PageHeader from '../components/PageHeader.vue'
import { api } from '../lib/api'

type Row = AcademicPeriodDto & { window: string }
type TableRow = { id: string } & Record<string, unknown>
const listViewRef = ref<{ reload: () => Promise<void> } | null>(null)
const isModalOpen = ref(false)
const editingId = ref('')
const academicYears = ref<AcademicYearDto[]>([])
const periods = ref<Row[]>([])
const feedback = ref('')
const columns = [
  { key: 'academicYearName', label: 'Ano lectivo' },
  { key: 'name', label: 'Periodo' },
  { key: 'code', label: 'Codigo' },
  { key: 'window', label: 'Vigencia' },
  { key: 'weight', label: 'Peso %' },
  { key: 'status', label: 'Estado' },
]
const form = reactive({ academicYearId: '', name: '', code: '', weight: 25, startsOn: '2026-01-20', endsOn: '2026-03-31' })
const toRow = (item: AcademicPeriodDto): Row => ({ ...item, window: `${item.startsOn} - ${item.endsOn}` })
const periodSummary = computed(() => ({
  open: periods.value.filter((item) => item.status === 'open').length,
  published: periods.value.filter((item) => item.status === 'published').length,
  closed: periods.value.filter((item) => item.status === 'closed').length,
}))
const selectedYearWeightTotal = computed(() =>
  periods.value
    .filter((item) => item.academicYearId === form.academicYearId)
    .reduce((total, item) => total + item.weight, 0),
)
const projectedYearWeightTotal = computed(() => {
  const currentTotal = periods.value
    .filter((item) => item.academicYearId === form.academicYearId && item.id !== editingId.value)
    .reduce((total, item) => total + item.weight, 0)
  return currentTotal + Number(form.weight || 0)
})
const primaryTask = computed(() => {
  const publishedPeriod = periods.value.find((item) => item.status === 'published')
  if (publishedPeriod) {
    return {
      title: 'Cierre pendiente',
      value: publishedPeriod.name,
      helper: 'Este periodo ya fue publicado. El siguiente paso natural es cerrarlo cuando el colegio termine la revisión final.',
      description: 'Hay un periodo publicado que ya está listo para pasar al cierre definitivo.',
      actionLabel: 'Cerrar periodo publicado',
      status: 'published',
      targetId: publishedPeriod.id,
      nextStatus: 'closed' as 'open' | 'published' | 'closed',
    }
  }

  const openPeriod = periods.value.find((item) => item.status === 'open')
  if (openPeriod) {
    return {
      title: 'Publicación pendiente',
      value: openPeriod.name,
      helper: 'Este periodo sigue abierto. Si ya terminaste notas y seguimiento, conviene publicarlo.',
      description: 'El siguiente paso es publicar el periodo activo para congelar la operación y preparar boletines.',
      actionLabel: 'Publicar periodo abierto',
      status: 'open',
      targetId: openPeriod.id,
      nextStatus: 'published' as 'open' | 'published' | 'closed',
    }
  }

  return {
    title: 'Nuevo ciclo',
    value: `${periodSummary.value.closed} periodos cerrados`,
    helper: 'No hay periodos abiertos ni publicados. Si hace falta, puedes crear uno nuevo o reabrir un cierre.',
    description: 'La operación está cerrada; el siguiente paso es crear el siguiente corte o reabrir uno ya cerrado si hubo novedades.',
    actionLabel: 'Crear nuevo periodo',
    status: 'closed',
    targetId: null,
    nextStatus: null,
  }
})
const transitionGuide = computed(() => {
  if (primaryTask.value.status === 'published') {
    return {
      title: 'Checklist antes de cerrar',
      description: 'Usa este corte para confirmar que el periodo ya quedó listo para bloquear edición.',
      status: 'published',
      checklist: [
        { label: 'Boletines disponibles', value: 'Sí', helper: 'El periodo ya fue publicado y quedó listo para salida académica.' },
        { label: 'Periodo en revisión final', value: primaryTask.value.value, helper: 'Conviene cerrar solo después de resolver ajustes de coordinación.' },
        { label: 'Cambios posteriores', value: 'Bloqueados al cerrar', helper: 'Al cerrar no se podrán editar notas ni observaciones del corte.' },
      ],
      confirmationLead: 'La confirmación debe ayudar a coordinación a entender el impacto del cierre antes de ejecutarlo.',
      confirmationPoints: [
        { label: 'Qué cambia', value: 'Se bloquea el periodo', helper: 'El libro de notas y el seguimiento quedan congelados para este corte.' },
        { label: 'Qué revisar', value: 'Boletines y apoyos', helper: 'Verifica que boletines, observaciones y apoyos ya estén revisados.' },
      ],
    }
  }

  if (primaryTask.value.status === 'open') {
    return {
      title: 'Checklist antes de publicar',
      description: 'Estas son las validaciones mínimas para pasar de operación diaria a corte publicado.',
      status: 'open',
      checklist: [
        { label: 'Periodo activo', value: primaryTask.value.value, helper: 'Este es el corte que hoy sigue abierto para registrar operación.' },
        { label: 'Notas finales', value: 'Se recalculan al publicar', helper: 'La publicación dispara el recálculo automático por curso y materia.' },
        { label: 'Salida esperada', value: 'Boletines por periodo', helper: 'Después de publicar ya puedes preparar boletines y revisión final.' },
      ],
      confirmationLead: 'La publicación debe sentirse como una transición controlada, no como un simple cambio de estado.',
      confirmationPoints: [
        { label: 'Qué cambia', value: 'Se congela la operación diaria', helper: 'El periodo pasa a corte publicado y prepara el boletín.' },
        { label: 'Qué revisar', value: 'Notas y observaciones', helper: 'Asegúrate de que docentes y coordinación ya cerraron el seguimiento.' },
      ],
    }
  }

  return {
    title: 'Operación cerrada',
    description: 'No hay un periodo activo para trabajar. Desde aquí puedes iniciar un nuevo corte o reabrir uno cerrado.',
    status: 'closed',
    checklist: [
      { label: 'Periodos cerrados', value: String(periodSummary.value.closed), helper: 'La operación del año quedó sin cortes pendientes en este momento.' },
      { label: 'Siguiente acción', value: 'Crear o reabrir', helper: 'Crea el siguiente periodo si el calendario continúa o reabre uno si hubo novedades.' },
      { label: 'Riesgo operativo', value: 'Bajo', helper: 'No hay transición pendiente que bloquee la continuidad del cierre.' },
    ],
    confirmationLead: 'Cuando no hay periodo abierto, la UI debe ayudar a iniciar el siguiente ciclo sin obligar a leer toda la tabla.',
    confirmationPoints: [
      { label: 'Qué cambia', value: 'Se habilita un nuevo corte', helper: 'Un nuevo periodo reabre la operación académica del siguiente tramo.' },
      { label: 'Qué revisar', value: 'Fechas y peso', helper: 'Define vigencia y porcentaje antes de guardarlo.' },
    ],
  }
})
const loadYears = async () => {
  const response = await api.getAcademicYears({ page: 1, pageSize: 100 })
  academicYears.value = response.data.items
  if (!form.academicYearId && academicYears.value[0]) form.academicYearId = academicYears.value[0].id
}
const fetchRows = async ({ page, pageSize, query }: { page: number; pageSize: number; query: string }) => {
  const response = await api.getAcademicPeriods({ page, pageSize, query })
  periods.value = response.data.items.map(toRow)
  return { ...response.data, items: periods.value as unknown as TableRow[] }
}
const openCreate = async () => {
  feedback.value = ''
  await loadYears()
  editingId.value = ''
  Object.assign(form, { academicYearId: academicYears.value[0]?.id ?? '', name: '', code: '', weight: 25, startsOn: '2026-01-20', endsOn: '2026-03-31' })
  isModalOpen.value = true
}
const openEdit = async (row: Record<string, unknown>) => {
  feedback.value = ''
  await loadYears()
  const item = row as unknown as Row
  editingId.value = item.id
  Object.assign(form, { academicYearId: item.academicYearId, name: item.name, code: item.code, weight: item.weight, startsOn: item.startsOn, endsOn: item.endsOn })
  isModalOpen.value = true
}
const openDelete = async (row: Record<string, unknown>) => {
  try {
    await api.deleteAcademicPeriod(String(row.id))
    await listViewRef.value?.reload()
    feedback.value = 'Periodo eliminado.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible eliminar el periodo.'
  }
}
const closeModal = () => {
  isModalOpen.value = false
}
const submitForm = async () => {
  try {
    if (editingId.value) await api.updateAcademicPeriod(editingId.value, { ...form })
    else await api.createAcademicPeriod({ ...form })
    closeModal()
    await listViewRef.value?.reload()
    feedback.value = 'Periodo guardado correctamente.'
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible guardar el periodo.'
  }
}

const translateStatus = (value: string) => {
  if (value === 'published') return 'Publicado'
  if (value === 'closed') return 'Cerrado'
  return 'Abierto'
}

const badgeClass = (value: string) => {
  if (value === 'published') return 'meta-badge--amber'
  if (value === 'closed') return 'meta-badge--red'
  return 'meta-badge--green'
}

const timelineClass = (value: 'open' | 'published' | 'closed') => {
  const activeStatus = transitionGuide.value.status
  if (value === activeStatus) return 'period-timeline__step--active'
  if (activeStatus === 'closed') return 'period-timeline__step--done'
  if (activeStatus === 'published' && value === 'open') return 'period-timeline__step--done'
  return ''
}

const changeStatus = async (row: Record<string, unknown>, status: 'open' | 'published' | 'closed') => {
  const item = row as unknown as Row
  const message =
    status === 'published'
      ? `Vas a publicar el periodo ${item.name}. Esto recalculará notas finales y dejará el corte listo para boletines.`
      : status === 'closed'
        ? `Vas a cerrar el periodo ${item.name}. Después de esto no se podrán editar notas ni observaciones del corte.`
        : `Vas a reabrir el periodo ${item.name}. El corte volverá a permitir ajustes académicos.`
  if (!confirm(`${message} ¿Deseas continuar?`)) return

  try {
    const response = await api.updateAcademicPeriodStatus(item.id, { status })
    await listViewRef.value?.reload()
    const summary = response.data.summary
    feedback.value =
      `${translateStatus(response.data.status)}: ${response.data.recalculatedGradeRecords} notas recalculadas, ` +
      `${summary.gradeRecords} notas finales, ${summary.attendanceRecords} asistencias, ${summary.observations} observaciones y ${summary.supportStrategies} planes de apoyo en el periodo.`
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'No fue posible actualizar el estado del periodo.'
  }
}
const runPrimaryAction = async () => {
  if (!primaryTask.value.targetId || !primaryTask.value.nextStatus) {
    await openCreate()
    return
  }
  const item = periods.value.find((period) => period.id === primaryTask.value.targetId)
  if (!item) return
  await changeStatus(item, primaryTask.value.nextStatus)
}
onMounted(loadYears)
</script>

<style scoped>
.periods-workboard {
  align-items: stretch;
}

.periods-focus-card {
  display: grid;
  gap: 1rem;
}

.period-metric {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
}

.period-metric span,
.period-metric small {
  color: var(--text-soft);
}

.period-metric strong {
  font-size: 1.45rem;
}

.periods-guidance-grid {
  align-items: stretch;
}

.period-checklist-card {
  display: grid;
  gap: 1rem;
}

.period-timeline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.period-timeline__step {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-soft);
  padding: 0.45rem 0.8rem;
}

.period-timeline__step--active {
  background: color-mix(in srgb, var(--brand, #0f766e) 14%, white);
  border-color: color-mix(in srgb, var(--brand, #0f766e) 34%, var(--border-color));
  color: var(--text-main);
}

.period-timeline__step--done {
  background: color-mix(in srgb, #16a34a 12%, white);
  border-color: color-mix(in srgb, #16a34a 30%, var(--border-color));
  color: var(--text-main);
}

.period-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
</style>
