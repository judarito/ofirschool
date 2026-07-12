<template>
  <section class="dashboard">
    <PageHeader
      :eyebrow="isTeacher ? 'Portal docente' : 'Panel institucional'"
      :title="`Hola, ${firstName}!`"
      :subtitle="isTeacher ? 'Estas son tus tareas academicas del dia.' : 'Aqui tienes un resumen de lo que esta pasando en tu institucion.'"
    >
      <template #actions>
        <button v-if="!isTeacher" class="button button--ghost" type="button">Personalizar</button>
      </template>
    </PageHeader>

    <SurfaceCard class="mobile-summary">
      <div class="mobile-summary__profile">
        <div class="mobile-summary__avatar">{{ profileInitials }}</div>
        <div>
          <strong>{{ session.userName }}</strong>
          <p>{{ session.primaryRoleLabel }}</p>
        </div>
      </div>
      <QuickActionGrid :items="visibleQuickActions" />
    </SurfaceCard>

    <div class="metrics-grid">
      <MetricCard
        v-for="metric in visibleMetrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :subtitle="metric.subtitle"
        :trend="metric.trend"
        :trend-positive="metric.trendPositive"
        :short-label="metric.shortLabel"
        :variant="metric.variant"
      />
    </div>

    <div class="dashboard-grid dashboard-grid--top">
      <LineChartCard
        title="Asistencia semanal"
        :subtitle="isTeacher ? 'Tus grupos asignados' : 'Seguimiento general'"
        period-label="Esta semana"
        :labels="['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']"
        :values="[72, 68, 71, 84, 66, 79]"
      />

      <DonutChartCard
        v-if="!isTeacher"
        title="Mora por antiguedad"
        subtitle="Cartera pendiente"
        center-value="$24.85M"
        center-label="Total"
        :segments="portfolioSegments"
      />

      <SurfaceCard>
        <div class="card-headline">
          <h3>{{ isTeacher ? 'Accesos de trabajo' : 'Proximos eventos' }}</h3>
          <p>{{ isTeacher ? 'Entradas frecuentes del docente' : 'Agenda institucional' }}</p>
        </div>
        <EventList :items="visibleEvents" />
      </SurfaceCard>
    </div>

    <div class="dashboard-grid dashboard-grid--bottom">
      <SurfaceCard>
        <div class="card-headline">
          <h3>{{ isTeacher ? 'Seguimiento pendiente' : 'Estudiantes con riesgo academico' }}</h3>
          <p>Prioridad de seguimiento</p>
        </div>
        <div class="mini-table">
          <div class="mini-table__row mini-table__row--head">
            <span>Estudiante</span>
            <span>Grado</span>
            <span>Riesgo</span>
            <span>Asignaturas</span>
          </div>
          <div v-for="row in riskRows" :key="row.student" class="mini-table__row">
            <strong>{{ row.student }}</strong>
            <span>{{ row.grade }}</span>
            <StatusBadge :status="row.risk" />
            <span>{{ row.subjects }}</span>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div class="card-headline">
          <h3>{{ isTeacher ? 'Comunicaciones para docentes' : 'Comunicaciones recientes' }}</h3>
          <p>Mensajes enviados y pendientes</p>
        </div>
        <div v-if="announcements.length" class="announcement-list">
          <article v-for="item in announcements" :key="item.id" class="announcement-item announcement-item--compact">
            <span class="announcement-item__bullet">CM</span>
            <div>
              <strong>{{ item.title }}</strong>
              <small>{{ item.publishedAt ?? 'Hoy, 9:30 AM' }}</small>
            </div>
          </article>
        </div>
        <EmptyState
          v-else
          title="Sin comunicados todavia"
          description="Puedes usar este bloque para noticias institucionales, avisos y alertas."
        />
      </SurfaceCard>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../lib/api'
import DonutChartCard from '../components/DonutChartCard.vue'
import EmptyState from '../components/EmptyState.vue'
import EventList from '../components/EventList.vue'
import LineChartCard from '../components/LineChartCard.vue'
import MetricCard from '../components/MetricCard.vue'
import PageHeader from '../components/PageHeader.vue'
import QuickActionGrid from '../components/QuickActionGrid.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SurfaceCard from '../components/SurfaceCard.vue'
import { useSessionStore } from '../stores/session'

const announcements = ref<{ id: string; title: string; publishedAt: string | null }[]>([])
const session = useSessionStore()
const isTeacher = computed(() => session.roleCodes.includes('teacher'))
const firstName = computed(() => session.userName.split(' ')[0] || 'Usuario')
const profileInitials = computed(() =>
  session.userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'US',
)

const cardMetrics = ref([
  { label: 'Estudiantes', value: '1.248', subtitle: 'Activos', trend: '+ 5.2% vs mes anterior', trendPositive: true, shortLabel: 'ES', variant: 'blue' as const },
  { label: 'Asistencia hoy', value: '92%', subtitle: 'Promedio general', trend: '+ 3% vs ayer', trendPositive: true, shortLabel: 'AS', variant: 'green' as const },
  { label: 'Mora total', value: '$24.850.000', subtitle: 'Total cartera', trend: '- 7% vs mes anterior', trendPositive: false, shortLabel: 'FI', variant: 'purple' as const },
  { label: 'Comunicaciones', value: '8', subtitle: 'Pendientes por enviar', trend: 'Ver mas', trendPositive: true, shortLabel: 'CM', variant: 'amber' as const },
])

const quickActions = [
  { label: 'Notas', shortLabel: 'NT' },
  { label: 'Asistencia', shortLabel: 'AS' },
  { label: 'Tareas', shortLabel: 'TR' },
  { label: 'Comunicados', shortLabel: 'CM' },
]

const teacherMetrics = [
  { label: 'Cursos asignados', value: 'Mis cursos', subtitle: 'Filtrados por tu carga docente', trend: 'Ver asistencia', trendPositive: true, shortLabel: 'CU', variant: 'blue' as const },
  { label: 'Actividades', value: 'Evaluacion', subtitle: 'Tareas, talleres y examenes', trend: 'Crear o calificar', trendPositive: true, shortLabel: 'AE', variant: 'green' as const },
  { label: 'Notas', value: 'Periodo', subtitle: 'Libro de notas por materia', trend: 'Cargar estudiantes', trendPositive: true, shortLabel: 'NO', variant: 'purple' as const },
  { label: 'Apoyo SIEE', value: 'Seguimiento', subtitle: 'Planes y observaciones', trend: 'Revisar pendientes', trendPositive: true, shortLabel: 'PA', variant: 'amber' as const },
]

const teacherQuickActions = [
  { label: 'Asistencia', shortLabel: 'AS' },
  { label: 'Actividades', shortLabel: 'AE' },
  { label: 'Notas', shortLabel: 'NO' },
  { label: 'Planes', shortLabel: 'PA' },
]

const visibleMetrics = computed(() => (isTeacher.value ? teacherMetrics : cardMetrics.value))
const visibleQuickActions = computed(() => (isTeacher.value ? teacherQuickActions : quickActions))

const portfolioSegments = [
  { label: '1 a 30 dias', value: '$8.500.000', percent: 34, color: '#3b82f6' },
  { label: '31 a 60 dias', value: '$6.100.000', percent: 25, color: '#22c55e' },
  { label: '61 a 90 dias', value: '$5.200.000', percent: 21, color: '#f59e0b' },
  { label: '+ 90 dias', value: '$5.000.000', percent: 20, color: '#ec4899' },
]

const upcomingEvents = [
  { title: 'Reunion de padres', date: '15 Mayo - 7:00 AM', shortLabel: 'RP' },
  { title: 'Entrega de boletines', date: '20 Mayo - Todo el dia', shortLabel: 'EB' },
  { title: 'Izada de bandera', date: '24 Mayo - 8:00 AM', shortLabel: 'IB' },
  { title: 'Dia del estudiante', date: '30 Mayo - Todo el dia', shortLabel: 'DE' },
]

const teacherEvents = [
  { title: 'Tomar asistencia', date: 'Asistencia por curso y fecha', shortLabel: 'AS' },
  { title: 'Calificar actividades', date: 'Actividades evaluativas', shortLabel: 'AE' },
  { title: 'Actualizar notas finales', date: 'Libro de notas del periodo', shortLabel: 'NO' },
  { title: 'Registrar observaciones', date: 'Seguimiento academico SIEE', shortLabel: 'OB' },
]

const visibleEvents = computed(() => (isTeacher.value ? teacherEvents : upcomingEvents))

const riskRows = [
  { student: 'Juan Jose Morales', grade: '9°A', risk: 'alto', subjects: 'Matematicas, Fisica' },
  { student: 'Maria Camila Lopez', grade: '8°B', risk: 'medio', subjects: 'Ingles, Quimica' },
  { student: 'Santiago Perez', grade: '10°A', risk: 'alto', subjects: 'Matematicas' },
  { student: 'Valentina Torres', grade: '7°A', risk: 'medio', subjects: 'Lengua Castellana' },
]

onMounted(async () => {
  if (isTeacher.value) return
  try {
    const response = await api.getDashboard()
    announcements.value = response.data.announcements
    cardMetrics.value = cardMetrics.value.map((metric, index) => ({
      ...metric,
      value: String(response.data.metrics[index]?.value ?? metric.value),
    }))
  } catch (error) {
    console.error(error)
  }
})
</script>
