<template>
  <section class="student-portal">
    <header class="portal-header">
      <div class="portal-header__brand">
        <span class="brand-mark">OF</span>
        <div>
          <strong>OfirSchool</strong>
          <small>Portal estudiante</small>
        </div>
      </div>
      <div v-if="loading" class="portal-loading">Cargando...</div>
    </header>

    <div v-if="error" class="portal-error">
      <p>{{ error }}</p>
      <button @click="loadData">Reintentar</button>
    </div>

    <div v-else-if="data" class="portal-content">
      <section class="portal-card enrollment-card">
        <h2>Matrícula actual</h2>
        <div class="info-grid">
          <div class="info-item">
            <label>Año lectivo</label>
            <span>{{ data.enrollment.academicYearName }}</span>
          </div>
          <div class="info-item">
            <label>Grado</label>
            <span>{{ data.enrollment.gradeName }}</span>
          </div>
          <div class="info-item">
            <label>Grupo</label>
            <span>{{ data.enrollment.groupName || 'Sin asignar' }}</span>
          </div>
          <div class="info-item">
            <label>Sede</label>
            <span>{{ data.enrollment.branchName || 'Principal' }}</span>
          </div>
        </div>
      </section>

      <section class="portal-card">
        <h2>Boletines</h2>
        <p class="portal-hint">Descarga tus boletines de calificaciones desde aquí.</p>
        <a :href="data.reportCardUrl" class="btn btn-primary" target="_blank">
          Descargar boletín
        </a>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<any>(null)

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787/api'

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const studentId = route.params.studentId || 'demo'
    const res = await fetch(`${API_BASE}/portal/student/${studentId}`)
    if (!res.ok) throw new Error('No se pudo cargar la información del estudiante')
    const json = await res.json()
    data.value = json.data
  } catch (e: any) {
    error.value = e.message || 'Error al cargar datos'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.student-portal {
  min-height: 100vh;
  background: #f8fafc;
  font-family: system-ui, -apple-system, sans-serif;
}
.portal-header {
  background: #0f766e;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.portal-header__brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.brand-mark {
  background: white;
  color: #0f766e;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
}
.portal-content {
  max-width: 720px;
  margin: 2rem auto;
  padding: 0 1rem;
}
.portal-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.portal-card h2 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  color: #1e293b;
}
.portal-hint {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0 0 1rem;
}
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.info-item label {
  display: block;
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 0.25rem;
}
.info-item span {
  font-size: 1rem;
  color: #1e293b;
  font-weight: 500;
}
.btn-primary {
  display: inline-block;
  background: #0f766e;
  color: white;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
}
.portal-error {
  max-width: 720px;
  margin: 2rem auto;
  padding: 2rem;
  text-align: center;
  color: #dc2626;
}
.portal-loading {
  font-size: 0.9rem;
  opacity: 0.8;
}
</style>
