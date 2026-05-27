<template>
  <aside class="sidebar">
    <div class="brand brand--sidebar">
      <span class="brand-mark">O</span>
      <div>
        <strong>OfirSchool</strong>
        <small>Gestion escolar</small>
      </div>
    </div>

    <div class="sidebar__scroll">
      <button class="tenant-switcher" type="button">
        <span class="tenant-switcher__icon">⌂</span>
        <span>Colegio Demo</span>
        <span>⌄</span>
      </button>

      <nav class="nav" aria-label="Navegacion principal">
        <section v-for="section in items" :key="section.id" class="nav-section">
          <div class="nav-section__header">
            <p class="nav-section__title">{{ section.title }}</p>
          </div>
          <div class="nav-section__items">
            <RouterLink v-for="item in section.items" :key="item.id" :to="item.to" class="nav-link">
              <span class="nav-link__icon">{{ item.shortLabel }}</span>
              <span>{{ item.label }}</span>
              <span v-if="item.badge" class="nav-link__badge">{{ item.badge }}</span>
            </RouterLink>
          </div>
        </section>
      </nav>
    </div>

    <div class="sidebar-user">
      <div class="sidebar-user__avatar">MG</div>
      <div>
        <strong>{{ session.userName }}</strong>
        <small>{{ session.primaryRoleLabel }}</small>
      </div>
      <button class="topbar-icon-button" type="button">›</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const items = computed(() => session.navigationSections)

onMounted(async () => {
  if (session.isAuthenticated && !session.navigationSections.length) {
    await session.loadNavigation()
  }
})
</script>

<style scoped>
.nav-section {
  display: grid;
  gap: 0.5rem;
}

.nav-section__title {
  margin: 0;
}
</style>
