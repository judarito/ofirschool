import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export class EnrollmentsListPage {
  readonly page: Page
  readonly searchInput: Locator
  readonly createButton: Locator
  readonly continuityButton: Locator
  readonly closureButton: Locator
  readonly advancedFiltersToggle: Locator
  readonly gradeFilter: Locator
  readonly groupFilter: Locator
  readonly clearFiltersButton: Locator
  readonly summaryTitle: Locator
  readonly summaryValue: Locator
  readonly summaryActions: Locator

  constructor(page: Page) {
    this.page = page
    this.searchInput = page.getByPlaceholder('Buscar por identificación o nombre')
    this.createButton = page.getByRole('button', { name: /matricular estudiante/i }).first()
    this.continuityButton = page.getByRole('button', { name: /renovar o promover curso/i }).first()
    this.closureButton = page.getByRole('button', { name: /registrar promoción final/i }).first()
    this.advancedFiltersToggle = page.getByRole('button', { name: /más filtros|ocultar filtros/i }).first()
    this.gradeFilter = page.locator('select').filter({ hasText: /todos los grados/i })
    this.groupFilter = page.locator('select').filter({ hasText: /todos los cursos/i })
    this.clearFiltersButton = page.getByRole('button', { name: /limpiar filtros/i })
    this.summaryTitle = page.locator('.module-inline-summary__copy strong')
    this.summaryValue = page.locator('.module-inline-summary__meta span')
    this.summaryActions = page.locator('.module-inline-summary__actions button')
  }

  async goto() {
    await this.page.goto(url('/enrollments'))
    await this.page.waitForSelector('.module-page--enrollments')
  }

  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(500)
  }

  async openAdvancedFilters() {
    const text = await this.advancedFiltersToggle.textContent()
    if (text?.includes('Más filtros')) {
      await this.advancedFiltersToggle.click()
    }
  }

  async filterByGrade(gradeName: string) {
    await this.openAdvancedFilters()
    await this.gradeFilter.selectOption({ label: gradeName })
  }

  async filterByGroup(groupName: string) {
    await this.openAdvancedFilters()
    await this.groupFilter.selectOption({ label: groupName })
  }

  async clearFilters() {
    await this.openAdvancedFilters()
    await this.clearFiltersButton.click()
  }

  async clickCreate() {
    await this.createButton.click()
  }

  async clickContinuity() {
    await this.continuityButton.click()
  }

  async clickAnnualClosure() {
    await this.closureButton.click()
  }

  async fillEnrollmentForm(data: {
    gradeId: string
    groupId?: string
    enrollmentType?: string
    enrollmentStatus?: string
    enrollmentDate: string
  }) {
    const dialog = this.page.getByRole('dialog')
    const form = dialog.locator('form.form-grid')
    const selects = form.locator('select')
    await selects.nth(0).selectOption({ label: data.gradeId })
    if (data.groupId) {
      await selects.nth(1).selectOption({ label: data.groupId })
    }
    if (data.enrollmentType) {
      await selects.nth(2).selectOption({ label: data.enrollmentType })
    }
    if (data.enrollmentStatus) {
      await selects.nth(3).selectOption({ label: data.enrollmentStatus })
    }
    await form.locator('input[type="date"]').fill(data.enrollmentDate)
  }

  async submitEnrollment() {
    await this.page.getByRole('dialog').getByRole('button', { name: /guardar matrícula/i }).click()
  }

  async fillContinuityForm(data: {
    mode: string
    sourceGradeId?: string
    query?: string
    enrollmentStatus?: string
    enrollmentDate: string
  }) {
    const dialog = this.page.getByRole('dialog')
    const form = dialog.locator('form.form-grid')
    const selects = form.locator('select')
    await selects.nth(0).selectOption({ label: data.mode })
    if (data.sourceGradeId) {
      await selects.nth(1).selectOption({ label: data.sourceGradeId })
    }
    if (data.query) {
      await form.locator('input[placeholder*="Nombre"]').fill(data.query)
    }
    if (data.enrollmentStatus) {
      await selects.nth(2).selectOption({ label: data.enrollmentStatus })
    }
    await form.locator('input[type="date"]').fill(data.enrollmentDate)
  }

  async updateContinuityPreview() {
    await this.page.getByRole('dialog').getByRole('button', { name: /actualizar preview/i }).click()
  }

  async executeContinuityBatch() {
    await this.page.getByRole('dialog').getByRole('button', { name: /ejecutar lote/i }).click()
  }

  getViewTabs() {
    return this.page.locator('.enrollment-action-card')
  }

  getContinuityMetrics() {
    return this.page.locator('.module-note-list__item strong')
  }

  getClosureMetrics() {
    return this.page.locator('.module-note-list__item strong')
  }
}
