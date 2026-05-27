<template>
  <div v-if="open" class="modal-backdrop">
    <div class="modal">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
      <div class="modal-actions">
        <button class="button button--ghost" type="button" @click="$emit('cancel')">Cancelar</button>
        <button class="button button--danger" type="button" @click="$emit('confirm')">Confirmar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
  description: string
}>()

defineEmits<{
  cancel: []
  confirm: []
}>()
</script>
