<template>
  <div
    v-if="open"
    class="modal-backdrop"
    :class="{ 'modal-backdrop--drawer': presentation === 'drawer' }"
    @click.self="handleBackdropClose"
  >
    <div
      class="modal"
      :class="[
        `modal--${size}`,
        `modal--${presentation}`,
        { 'modal--sticky-footer': stickyFooter },
      ]"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <div class="modal-header">
        <slot name="header">
          <div class="modal-header__copy">
            <h3>{{ title }}</h3>
            <p v-if="description">{{ description }}</p>
          </div>
          <button class="topbar-icon-button" type="button" @click="$emit('close')">Cerrar</button>
        </slot>
      </div>
      <div class="modal-content">
        <slot />
      </div>
      <div v-if="$slots.footer" class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'full'
  presentation?: 'modal' | 'drawer'
  closeOnBackdrop?: boolean
  stickyFooter?: boolean
}>(), {
  description: '',
  size: 'md',
  presentation: 'modal',
  closeOnBackdrop: true,
  stickyFooter: false,
})

const emit = defineEmits<{
  close: []
}>()

const handleBackdropClose = () => {
  if (props.closeOnBackdrop) emit('close')
}
</script>
