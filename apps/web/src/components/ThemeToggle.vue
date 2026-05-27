<template>
  <button class="topbar-icon-button" type="button" @click="theme.toggleTheme()">
    {{ theme.mode === 'light' ? '☾' : '☀' }}
  </button>
</template>

<script setup lang="ts">
import { useTheme } from '../composables/useTheme'

const theme = useTheme()
</script>
