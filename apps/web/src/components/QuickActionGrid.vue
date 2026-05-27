<template>
  <div class="quick-grid">
    <button v-for="item in items" :key="item.label" class="quick-grid__item" type="button">
      <span class="quick-grid__icon">{{ item.shortLabel }}</span>
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{ label: string; shortLabel: string }>
}>()
</script>
