<template>
  <SurfaceCard>
    <div class="chart-card__header">
      <div>
        <h3>{{ title }}</h3>
        <p>{{ subtitle }}</p>
      </div>
    </div>

    <div class="donut-layout">
      <div class="donut-chart" :style="{ background: gradient }">
        <div class="donut-chart__center">
          <strong>{{ centerValue }}</strong>
          <span>{{ centerLabel }}</span>
        </div>
      </div>
      <div class="legend-list">
        <div v-for="segment in segments" :key="segment.label" class="legend-list__item">
          <span class="legend-list__dot" :style="{ background: segment.color }"></span>
          <div>
            <strong>{{ segment.label }}</strong>
            <p>{{ segment.value }}</p>
          </div>
        </div>
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
  centerValue: string
  centerLabel: string
  segments: Array<{ label: string; value: string; percent: number; color: string }>
}>()

const gradient = computed(() => {
  let offset = 0
  const stops = props.segments.map((segment) => {
    const start = offset
    offset += segment.percent
    return `${segment.color} ${start}% ${offset}%`
  })

  return `conic-gradient(${stops.join(', ')})`
})
</script>
