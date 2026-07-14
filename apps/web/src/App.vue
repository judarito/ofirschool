<template>
  <RouterView />
  <GlobalActivityIndicator />
  <GlobalFeedbackAutoDismiss />
</template>

<script setup lang="ts">
import GlobalActivityIndicator from './components/GlobalActivityIndicator.vue'
import GlobalFeedbackAutoDismiss from './components/GlobalFeedbackAutoDismiss.vue'
</script>
