<template>
  <header class="topbar">
    <div class="topbar__brand-mobile">
      <button class="topbar-icon-button" type="button">☰</button>
      <div class="brand">
        <span class="brand-mark brand-mark--small">O</span>
        <strong>OfirSchool</strong>
      </div>
    </div>

    <div class="topbar__search">
      <slot name="search" />
    </div>

    <div class="topbar-actions">
      <ThemeToggle />
      <button class="topbar-icon-button" type="button">?</button>
      <button class="topbar-icon-button topbar-icon-button--notify" type="button">8</button>
      <select v-model="selectedYear" class="topbar__period-select">
        <option v-for="year in academic.academicYears" :key="year.id" :value="String(year.year)">
          {{ year.name }}
        </option>
      </select>
      <button class="button button--ghost topbar__logout" type="button" @click="session.logout()">Salir</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import ThemeToggle from './ThemeToggle.vue'
import { useAcademicContextStore } from '../stores/academic-context'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const academic = useAcademicContextStore()
const selectedYear = computed({
  get: () => academic.selectedYear,
  set: (value: string) => academic.setSelectedYear(value),
})

onMounted(async () => {
  if (session.isAuthenticated && !academic.academicYears.length) {
    await academic.loadAcademicYears()
  }
})
</script>
