<template>
  <div class="event-list">
    <article v-for="item in items" :key="item.title" class="event-list__item">
      <span class="event-list__mark">{{ item.shortLabel }}</span>
      <div>
        <strong>{{ item.title }}</strong>
        <p>{{ item.date }}</p>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{ title: string; date: string; shortLabel: string }>
}>()
</script>
