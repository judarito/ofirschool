<template>
  <div class="shell">
    <Sidebar />
    <div class="shell__main">
      <Topbar>
        <template #search>
          <SearchInput v-model="search" placeholder="Buscar estudiantes, inscripciones, cierres o boletines..." />
        </template>
      </Topbar>
      <main class="page">
        <RouterView />
      </main>
      <MobileBottomNav />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import MobileBottomNav from '../components/MobileBottomNav.vue'
import SearchInput from '../components/SearchInput.vue'
import Sidebar from '../components/Sidebar.vue'
import Topbar from '../components/Topbar.vue'
import { useTheme } from '../composables/useTheme'
import { useAcademicContextStore } from '../stores/academic-context'

useTheme()
const search = ref('')
const academic = useAcademicContextStore()

onMounted(async () => {
  if (!academic.academicYears.length) {
    await academic.loadAcademicYears()
  }
})
</script>
