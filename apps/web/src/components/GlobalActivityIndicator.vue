<template>
  <Transition name="global-activity">
    <div v-if="visible" class="global-activity" role="status" aria-live="polite">
      <span class="global-activity__spinner" aria-hidden="true"></span>
      <span>Procesando...</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useAppActivity } from '../stores/app-activity'

const { isBusy } = useAppActivity()
const visible = ref(false)
let showTimer: ReturnType<typeof setTimeout> | null = null

const setDocumentBusy = (busy: boolean) => {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('app-is-busy', busy)
  document.body.setAttribute('aria-busy', String(busy))
}

watch(
  isBusy,
  (busy) => {
    if (showTimer) {
      clearTimeout(showTimer)
      showTimer = null
    }

    setDocumentBusy(busy)

    if (busy) {
      showTimer = setTimeout(() => {
        visible.value = true
      }, 180)
      return
    }

    visible.value = false
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (showTimer) clearTimeout(showTimer)
  setDocumentBusy(false)
})
</script>
