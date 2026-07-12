import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export class CoexistencePage {
  readonly page: Page
  readonly pageHeader: Locator
  readonly title: Locator
  readonly createButton: Locator
  readonly listView: Locator
  readonly searchInput: Locator

  constructor(page: Page) {
    this.page = page
    this.pageHeader = page.locator('.page-header')
    this.title = page.locator('.page-header h1')
    this.createButton = page.getByRole('button', { name: /nuevo caso/i }).first()
    this.listView = page.getByRole('heading', { name: 'Casos de convivencia' })
    this.searchInput = page.getByPlaceholder(/buscar por estudiante/i)
  }

  async goto() {
    await this.page.goto(url('/coexistence'))
    await this.page.waitForSelector('.page-header')
  }

  async clickCreate() {
    await this.createButton.click()
  }

  async fillCreateForm(data: {
    category: string
    description: string
    incidentDate?: string
  }) {
    const dialog = this.page.getByRole('dialog')
    await dialog.locator('input[required]').nth(1).fill(data.category)
    await dialog.locator('input[type="date"]').first().fill(data.incidentDate ?? new Date().toISOString().split('T')[0])
    await dialog.locator('textarea').first().fill(data.description)
  }

  async submitCreate() {
    await this.page.getByRole('dialog').getByRole('button', { name: /guardar/i }).click()
  }

  getDialog() {
    return this.page.getByRole('dialog')
  }
}
