<template>
  <label class="search-input">
    <svg class="search-input__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
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

<style scoped>
.search-input {
  position: relative;
  display: block;
}

.search-input__icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-faint);
  pointer-events: none;
  transition: color var(--transition-fast);
}

.search-input input {
  padding-left: 40px;
  height: 40px;
}

.search-input:hover .search-input__icon {
  color: var(--text-soft);
}

.search-input:focus-within .search-input__icon {
  color: var(--brand-primary);
}
</style>
