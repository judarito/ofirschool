<template>
  <label class="search-input">
    <span class="search-input__icon" aria-hidden="true"></span>
    <input :value="modelValue" :placeholder="placeholder" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  placeholder?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
