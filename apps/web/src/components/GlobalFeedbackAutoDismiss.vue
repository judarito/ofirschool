<template></template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>()
let observer: MutationObserver | null = null

const dismiss = (element: Element) => {
  element.classList.remove('action-feedback--visible')
  element.classList.add('action-feedback--dismissed')
}

const trackFeedback = (element: Element) => {
  const text = element.textContent?.trim()
  if (!text) return

  const previousTimer = timers.get(element)
  if (previousTimer) clearTimeout(previousTimer)

  element.classList.remove('action-feedback--dismissed')
  element.classList.add('action-feedback--visible')

  const timer = setTimeout(() => dismiss(element), 5200)
  timers.set(element, timer)
}

const scanFeedback = () => {
  document.querySelectorAll('.action-feedback').forEach(trackFeedback)
}

onMounted(() => {
  scanFeedback()
  observer = new MutationObserver(() => scanFeedback())
  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>
