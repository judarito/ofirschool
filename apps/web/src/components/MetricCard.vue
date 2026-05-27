<template>
  <article class="metric-card" :class="variant ? `metric-card--${variant}` : ''">
    <div class="metric-card__header">
      <p>{{ label }}</p>
      <span class="metric-card__icon">{{ shortLabel }}</span>
    </div>
    <strong>{{ value }}</strong>
    <span class="metric-card__subtitle">{{ subtitle }}</span>
    <small :class="trendPositive ? 'metric-card__trend metric-card__trend--up' : 'metric-card__trend metric-card__trend--down'">
      {{ trend }}
    </small>
  </article>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  subtitle: string
  trend: string
  shortLabel: string
  trendPositive?: boolean
  variant?: 'blue' | 'green' | 'purple' | 'amber' | 'slate'
}>()
</script>
