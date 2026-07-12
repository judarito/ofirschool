import type { Page, Locator } from '@playwright/test'
import { url } from '../helpers'

export class StudentsPage {
  readonly page: Page
  readonly searchInput: Locator
  readonly createButton: Locator
  readonly importButton: Locator
  readonly gradeFilter: Locator
  readonly groupFilter: Locator

  constructor(page: Page) {
    this.page = page
    this.searchInput = page.getByPlaceholder('Buscar por nombre o documento')
    this.createButton = page.getByRole('button', { name: /nuevo estudiante/i }).first()
    this.importButton = page.getByRole('button', { name: /importar/i }).first()
    this.gradeFilter = page.locator('select').filter({ hasText: /todos los grados/i })
    this.groupFilter = page.locator('select').filter({ hasText: /todos los cursos/i })
  }

  async goto() {
    await this.page.goto(url('/students'))
    await this.page.waitForSelector('.domain-flow-card')
  }

  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(500)
  }

  async clickCreate() {
    await this.createButton.click()
  }

  async clickImport() {
    await this.importButton.click()
  }

  async fillStudentForm(data: {
    firstName: string
    middleName?: string
    lastName: string
    documentType: string
    documentNumber: string
    birthDate: string
    gender?: string
    bloodType?: string
    status?: string
  }) {
    const dialog = this.page.getByRole('dialog')
    const form = dialog.locator('form.form-grid')
    const inputs = form.locator('input')
    const selects = form.locator('select')

    await inputs.nth(0).fill(data.firstName)
    if (data.middleName) {
      await inputs.nth(1).fill(data.middleName)
    }
    await inputs.nth(2).fill(data.lastName)
    await selects.nth(0).selectOption(data.documentType)
    await inputs.nth(3).fill(data.documentNumber)
    await form.locator('input[type="date"]').fill(data.birthDate)
    if (data.gender) {
      await selects.nth(1).selectOption({ label: data.gender })
    }
    if (data.bloodType) {
      await selects.nth(2).selectOption({ label: data.bloodType })
    }
    if (data.status) {
      await selects.nth(3).selectOption({ label: data.status })
    }
  }

  async submitForm() {
    await this.page.getByRole('dialog').getByRole('button', { name: /guardar/i }).click()
  }

  getFlowSteps() {
    return this.page.locator('.domain-flow-card__step')
  }

  getFlowStepTitle(step: number) {
    return this.page.locator('.domain-flow-card').locator('strong').nth(step - 1)
  }
}
