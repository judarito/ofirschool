<template>
  <div v-if="open" class="modal-backdrop">
    <div class="modal">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
      <div class="modal-actions">
        <button class="button button--ghost" type="button" @click="$emit('cancel')">{{ cancelLabel }}</button>
        <button class="button" :class="confirmClass" type="button" @click="$emit('confirm')">{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'brand' | 'danger'
}>(), {
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  variant: 'danger',
})

const confirmClass = computed(() => (props.variant === 'brand' ? 'button--brand' : 'button--danger'))

defineEmits<{
  cancel: []
  confirm: []
}>()
</script>
