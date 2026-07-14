import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export class AdmissionsListPage {
  readonly page: Page
  readonly searchInput: Locator
  readonly createButton: Locator
  readonly reviewPendingButton: Locator
  readonly processButton: Locator
  readonly advancedFiltersToggle: Locator
  readonly gradeFilter: Locator
  readonly groupFilter: Locator
  readonly clearFiltersButton: Locator
  readonly summaryTitle: Locator
  readonly summaryValue: Locator
  readonly summaryActions: Locator
  readonly listView: Locator

  constructor(page: Page) {
    this.page = page
    this.searchInput = page.getByPlaceholder('Buscar por estudiante, documento o acudiente')
    this.createButton = page.getByRole('button', { name: /registrar aspirante/i }).first()
    this.reviewPendingButton = page.getByRole('button', { name: /revisar pendientes/i }).first()
    this.processButton = page.getByRole('button', { name: /configurar proceso/i }).first()
    this.advancedFiltersToggle = page.getByRole('button', { name: /más filtros|ocultar filtros/i }).first()
    this.gradeFilter = page.locator('select').filter({ hasText: /todos los grados/i })
    this.groupFilter = page.locator('select').filter({ hasText: /todos los cursos/i })
    this.clearFiltersButton = page.getByRole('button', { name: /limpiar filtros/i })
    this.summaryTitle = page.locator('.module-inline-summary__copy strong')
    this.summaryValue = page.locator('.module-inline-summary__meta span')
    this.summaryActions = page.locator('.module-inline-summary__actions button')
    this.listView = page.locator('.list-view')
  }

  async goto() {
    await this.page.goto(url('/admissions'))
    await this.page.waitForSelector('.module-page--admissions')
  }

  async clickQueueTab(label: string) {
    await this.page.getByRole('tablist').first().getByRole('button').filter({ hasText: label }).click()
  }

  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(500)
  }

  async openAdvancedFilters() {
    const isOpen = await this.advancedFiltersToggle.textContent()
    if (isOpen?.includes('Más filtros')) {
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

  async clickProcess() {
    await this.processButton.click()
  }

  async clickCreateManual() {
    await this.createButton.click()
  }

  async clickReviewPending() {
    await this.reviewPendingButton.click()
  }

  async fillManualAdmission(data: {
    requestedGradeId: string
    source?: string
    studentFirstName: string
    studentMiddleName?: string
    studentLastName: string
    studentDocumentType: string
    studentDocumentNumber: string
    studentBirthDate: string
    studentGender: string
    studentBloodType?: string
    guardianFirstName: string
    guardianLastName: string
    guardianDocumentType: string
    guardianDocumentNumber: string
    guardianPhone: string
    guardianEmail: string
    guardianRelationship: string
  }) {
    const dialog = this.page.getByRole('dialog')
    const form = dialog.locator('form.form-grid')
    const gradeSelect = form.getByRole('combobox', { name: /grado solicitado/i })
    const gradeOptions = await gradeSelect.locator('option').allTextContents()
    const availableGrade = gradeOptions.find(g => g && g.trim() !== '')
    if (!availableGrade) return false

    await gradeSelect.selectOption({ label: availableGrade })
    if (data.source) {
      await form.getByRole('combobox', { name: /tipo de ingreso/i }).selectOption({ label: data.source })
    }
    await form.getByRole('textbox', { name: /nombres estudiante/i }).fill(data.studentFirstName)
    if (data.studentMiddleName) {
      await form.getByRole('textbox', { name: /segundo nombre/i }).fill(data.studentMiddleName)
    }
    await form.getByRole('textbox', { name: /apellidos estudiante/i }).fill(data.studentLastName)
    await form.getByRole('combobox', { name: /tipo documento estudiante/i }).selectOption(data.studentDocumentType)
    await form.getByRole('textbox', { name: /documento estudiante/i }).fill(data.studentDocumentNumber)
    await form.locator('input[type="date"]').fill(data.studentBirthDate)
    await form.getByRole('combobox', { name: /género/i }).selectOption({ label: data.studentGender })
    if (data.studentBloodType) {
      await form.getByRole('combobox', { name: /grupo sanguíneo/i }).selectOption(data.studentBloodType)
    }
    await form.getByRole('textbox', { name: /nombres acudiente/i }).fill(data.guardianFirstName)
    await form.getByRole('textbox', { name: /apellidos acudiente/i }).fill(data.guardianLastName)
    await form.getByRole('combobox', { name: /tipo documento acudiente/i }).selectOption(data.guardianDocumentType)
    await form.getByRole('textbox', { name: /documento acudiente/i }).fill(data.guardianDocumentNumber)
    await form.getByRole('textbox', { name: /teléfono acudiente/i }).fill(data.guardianPhone)
    await form.getByRole('textbox', { name: /correo acudiente/i }).fill(data.guardianEmail)
    await form.getByRole('combobox', { name: /parentesco/i }).selectOption({ label: data.guardianRelationship })
    return true
  }

  async submitManualAdmission() {
    await this.page.getByRole('dialog').getByRole('button', { name: /crear solicitud/i }).click()
  }

  getQueueTabs() {
    return this.page.getByRole('tablist').first().getByRole('button')
  }

  getQueueTabCount(label: string) {
    return this.page.getByRole('tablist').first().getByRole('button').filter({ hasText: label }).locator('span')
  }

  getRowActions() {
    return this.page.locator('.table-action')
  }
}
