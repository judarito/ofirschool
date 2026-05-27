<template>
  <section class="login-page">
    <div class="login-shell">
      <section class="login-showcase">
        <div class="login-showcase__brand">
          <span class="brand-mark">OF</span>
          <div>
            <strong>OfirSchool</strong>
            <small>SaaS escolar multi-tenant</small>
          </div>
        </div>

        <div class="login-showcase__copy">
          <small class="eyebrow">Administración escolar</small>
          <h1>Un solo panel para admisiones, matrículas y operación académica.</h1>
          <p>
            Gestiona procesos públicos de inscripción, seguimiento interno y matrícula anual
            sin salir del mismo flujo.
          </p>
        </div>

        <div class="login-showcase__grid">
          <article class="login-note-card">
            <span>AD</span>
            <div>
              <strong>Admisiones</strong>
              <p>Publica formularios por año lectivo y convierte solicitudes a matrícula.</p>
            </div>
          </article>
          <article class="login-note-card">
            <span>AC</span>
            <div>
              <strong>Académico</strong>
              <p>Grados, cursos, periodos y seguimiento anual desde la misma base de datos.</p>
            </div>
          </article>
          <article class="login-note-card">
            <span>FI</span>
            <div>
              <strong>Financiero</strong>
              <p>La matrícula se vuelve el origen para cartera, pagos y reportes posteriores.</p>
            </div>
          </article>
        </div>
      </section>

      <form class="login-card" @submit.prevent="submit">
        <div class="login-card__header">
          <div>
            <small class="eyebrow">Acceso seguro</small>
            <h2>Ingreso al panel</h2>
            <p>Usa el tenant demo para probar el flujo completo del sistema.</p>
          </div>
          <span class="login-status-pill">Tenant demo</span>
        </div>

        <div class="login-demo-box">
          <strong>Cuentas de prueba</strong>
          <div class="login-demo-box__row">
            <span>Correo</span>
            <code>{{ seedEmail }}</code>
          </div>
          <div class="login-demo-box__row">
            <span>Contraseña</span>
            <code>{{ seedPassword }}</code>
          </div>
        </div>

        <label class="login-field">
          <span>Correo</span>
          <input v-model="email" type="email" required autocomplete="email" />
        </label>

        <label class="login-field">
          <span>Contraseña</span>
          <input v-model="password" type="password" required autocomplete="current-password" />
        </label>

        <p v-if="error" class="login-error">{{ error }}</p>

        <button class="button button--brand login-submit" type="submit" :disabled="session.loading">
          {{ session.loading ? 'Ingresando...' : 'Ingresar al panel' }}
        </button>

        <div class="login-card__footer">
          <span>Cloudflare Workers</span>
          <span>Neon PostgreSQL</span>
          <span>Vue 3 + Hono</span>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const session = useSessionStore()
const seedEmail = 'admin@demo.ofirschool.com'
const seedPassword = 'ChangeMe123*'
const email = ref(seedEmail)
const password = ref(seedPassword)
const error = ref('')

const submit = async () => {
  error.value = ''
  try {
    await session.login(email.value, password.value)
    await router.push('/')
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No pudimos iniciar sesión.'
  }
}
</script>
