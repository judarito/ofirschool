import { defineStore } from 'pinia'

type ThemeMode = 'light' | 'dark'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: (localStorage.getItem('theme') as ThemeMode | null) ?? 'light',
  }),
  actions: {
    applyTheme() {
      document.documentElement.dataset.theme = this.mode
      localStorage.setItem('theme', this.mode)
    },
    toggleTheme() {
      this.mode = this.mode === 'light' ? 'dark' : 'light'
      this.applyTheme()
    },
  },
})
