<template>
  <section class="stack">
    <PageHeader eyebrow="Modulo base" :title="title" subtitle="Este espacio ya usa la misma base visual para web y mobile." />
    <SurfaceCard>
      <h3>Componentes reutilizables listos</h3>
      <p>Este modulo puede montar `ListView`, `PageHeader`, `SurfaceCard`, `SearchInput`, `QuickActionGrid` y `MobileBottomNav` sin rehacer estructura.</p>
    </SurfaceCard>
  </section>
</template>

<script setup lang="ts">
import PageHeader from '../components/PageHeader.vue'
import SurfaceCard from '../components/SurfaceCard.vue'

defineProps<{
  title: string
}>()
</script>
