<template>
  <SurfaceCard>
    <div class="chart-card__header">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
      <button class="chip-button" type="button">{{ periodLabel }}</button>
    </div>

    <div class="line-chart">
      <svg viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
        <polyline fill="none" stroke="var(--brand-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" :points="polylinePoints" />
      </svg>
      <div class="line-chart__labels">
        <span v-for="label in labels" :key="label">{{ label }}</span>
      </div>
    </div>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SurfaceCard from './SurfaceCard.vue'

const props = defineProps<{
  title: string
  subtitle: string
  periodLabel: string
  labels: string[]
  values: number[]
}>()

const polylinePoints = computed(() => {
  if (!props.values.length) return ''

  const max = Math.max(...props.values)
  const min = Math.min(...props.values)
  const range = Math.max(max - min, 1)

  return props.values
    .map((value, index) => {
      const x = (index / Math.max(props.values.length - 1, 1)) * 300
      const y = 100 - ((value - min) / range) * 60
      return `${x},${y + 10}`
    })
    .join(' ')
})
</script>
