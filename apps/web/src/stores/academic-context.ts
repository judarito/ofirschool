import { defineStore } from 'pinia'
import { api } from '../lib/api'

type AcademicYearOption = {
  id: string
  name: string
  year: number
  startsOn: string
  endsOn: string
  status: string
}

const STORAGE_KEY = 'selectedAcademicYear'

export const useAcademicContextStore = defineStore('academic-context', {
  state: () => ({
    academicYears: [] as AcademicYearOption[],
    selectedYear: localStorage.getItem(STORAGE_KEY) ?? '',
    loading: false,
  }),
  getters: {
    activeYear: (state) =>
      state.academicYears.find((item) => String(item.year) === state.selectedYear) ??
      state.academicYears.find((item) => item.id === state.selectedYear) ??
      null,
    activeYearId(): string {
      return this.activeYear?.id ?? ''
    },
    selectedYearNumber(): number | null {
      if (typeof this.activeYear?.year === 'number') return this.activeYear.year

      const parsed = Number(this.selectedYear)
      return Number.isFinite(parsed) ? parsed : null
    },
    activeYearName(): string {
      return this.activeYear?.name ?? (this.selectedYear ? `Año lectivo ${this.selectedYear}` : 'Sin año activo')
    },
  },
  actions: {
    setSelectedYear(year: string) {
      this.selectedYear = year
      localStorage.setItem(STORAGE_KEY, year)
    },
    resolveBestYear() {
      if (!this.academicYears.length) return

      const current = this.academicYears.find((item) => String(item.year) === this.selectedYear)
      if (current) return

      const calendarYear = new Date().getFullYear()
      const bestMatch =
        this.academicYears.find((item) => item.year === calendarYear) ??
        [...this.academicYears].sort((left, right) => right.year - left.year)[0]

      if (bestMatch) {
        this.setSelectedYear(String(bestMatch.year))
      }
    },
    async loadAcademicYears() {
      this.loading = true
      try {
        const response = await api.getAcademicYears({ page: 1, pageSize: 100 })
        this.academicYears = response.data.items
        this.resolveBestYear()
      } finally {
        this.loading = false
      }
    },
  },
})
