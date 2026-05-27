import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import '@fontsource-variable/manrope/index.css'
import App from './App.vue'
import { routes } from './router'
import './styles.css'

const app = createApp(App)
const pinia = createPinia()
const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  const isPublicRoute = to.path === '/login' || to.name === 'public-admission'

  if (!token && !isPublicRoute) {
    return '/login'
  }

  if (token && to.path === '/login') {
    return '/'
  }

  return true
})

app.use(pinia)
app.use(router)
app.mount('#app')
