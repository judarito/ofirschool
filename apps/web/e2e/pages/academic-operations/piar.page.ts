import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export class PiarPage {
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
    this.createButton = page.getByRole('button', { name: /nuevo registro/i }).first()
    this.listView = page.getByRole('heading', { name: 'Registros PIAR' })
    this.searchInput = page.getByPlaceholder(/buscar por estudiante/i)
  }

  async goto() {
    await this.page.goto(url('/piar'))
    await this.page.waitForSelector('.page-header')
  }

  async clickCreate() {
    await this.createButton.click()
  }

  async fillCreateForm(data: {
    disabilityType?: string
    disabilityCategory?: string
  }) {
    const dialog = this.page.getByRole('dialog')
    if (data.disabilityType) {
      await dialog.locator('input').nth(2).fill(data.disabilityType)
    }
    if (data.disabilityCategory) {
      await dialog.locator('input').nth(3).fill(data.disabilityCategory)
    }
  }

  async submitCreate() {
    await this.page.getByRole('dialog').getByRole('button', { name: /guardar/i }).click()
  }

  getDialog() {
    return this.page.getByRole('dialog')
  }
}
