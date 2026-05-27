import { onMounted } from 'vue'
import { useThemeStore } from '../stores/theme'

export const useTheme = () => {
  const store = useThemeStore()

  onMounted(() => {
    store.applyTheme()
  })

  return store
}
