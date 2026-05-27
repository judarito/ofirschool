import { defineStore } from 'pinia'
import type { StudentDto } from '@ofir/shared'
import { api } from '../lib/api'

export const useStudentsStore = defineStore('students', {
  state: () => ({
    items: [] as StudentDto[],
    total: 0,
    loading: false,
    query: '',
  }),
  actions: {
    async fetchStudents(query?: string) {
      this.loading = true
      const nextQuery = query ?? this.query
      this.query = nextQuery
      try {
        const response = await api.getStudents({ query: nextQuery })
        this.items = response.data.items
        this.total = response.data.total
      } finally {
        this.loading = false
      }
    },
    async createStudent(payload: Record<string, unknown>) {
      await api.createStudent(payload)
      await this.fetchStudents()
    },
    async updateStudent(id: string, payload: Record<string, unknown>) {
      await api.updateStudent(id, payload)
      await this.fetchStudents()
    },
    async deleteStudent(id: string) {
      await api.deleteStudent(id)
      await this.fetchStudents()
    },
  },
})
