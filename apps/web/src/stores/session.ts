import { defineStore } from 'pinia'
import type { NavigationItemDto, NavigationSectionDto, SessionUser } from '@ofir/shared'
import { api } from '../lib/api'

const USER_KEY = 'sessionUser'

export const useSessionStore = defineStore('session', {
  state: () => ({
    token: localStorage.getItem('token') ?? '',
    tenantId: localStorage.getItem('tenantId') ?? '11111111-1111-1111-1111-111111111111',
    userName: localStorage.getItem('userName') ?? 'Super Admin Demo',
    user: (() => {
      const saved = localStorage.getItem(USER_KEY)
      if (!saved) return null
      try {
        return JSON.parse(saved) as SessionUser
      } catch {
        return null
      }
    })() as SessionUser | null,
    navigationSections: [] as NavigationSectionDto[],
    mobileNavigation: [] as NavigationItemDto[],
    loading: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.token),
    roleCodes: (state) => state.user?.roleCodes ?? [],
    primaryRoleLabel: (state) => {
      const roleCode = state.user?.roleCodes[0] ?? ''
      if (roleCode === 'super_admin') return 'Superadmin'
      if (roleCode === 'admin') return 'Administrador'
      if (roleCode === 'coordinator') return 'Coordinación'
      if (roleCode === 'teacher') return 'Docente'
      if (roleCode === 'cashier') return 'Cartera'
      return 'Usuario'
    },
  },
  actions: {
    async loadNavigation() {
      if (!this.token) {
        this.navigationSections = []
        this.mobileNavigation = []
        return
      }

      const response = await api.getNavigation()
      this.navigationSections = response.data.sections
      this.mobileNavigation = response.data.mobileItems
    },
    async login(email: string, password: string) {
      this.loading = true
      try {
        const response = await api.login(email, password)
        this.token = response.data.token
        this.user = response.data.user
        this.userName = String(response.data.user.fullName ?? 'Usuario')
        localStorage.setItem('token', this.token)
        localStorage.setItem('tenantId', this.tenantId)
        localStorage.setItem('userName', this.userName)
        localStorage.setItem(USER_KEY, JSON.stringify(this.user))
        await this.loadNavigation()
      } finally {
        this.loading = false
      }
    },
    logout() {
      this.token = ''
      this.user = null
      this.navigationSections = []
      this.mobileNavigation = []
      localStorage.removeItem('token')
      localStorage.removeItem('userName')
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem('selectedAcademicYear')
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login')
      }
    },
  },
})
