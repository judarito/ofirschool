<template>
  <nav class="mobile-nav">
    <RouterLink v-for="item in items" :key="item.id" :to="item.to" class="mobile-nav__item">
      <span class="mobile-nav__icon">{{ item.shortLabel.slice(0, 1) }}</span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const items = computed(() => session.mobileNavigation)

onMounted(async () => {
  if (session.isAuthenticated && !session.mobileNavigation.length) {
    await session.loadNavigation()
  }
})
</script>
