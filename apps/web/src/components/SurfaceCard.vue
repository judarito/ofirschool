<template>
  <section class="surface-card" :class="variant ? `surface-card--${variant}` : ''">
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'accent' | 'ghost'
}>()
</script>
