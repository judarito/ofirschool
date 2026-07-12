import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export class CommitteesPage {
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
    this.createButton = page.getByRole('button', { name: /nuevo comité/i }).first()
    this.listView = page.getByRole('heading', { name: 'Reuniones de comité' })
    this.searchInput = page.getByPlaceholder(/buscar por título/i)
  }

  async goto() {
    await this.page.goto(url('/committees'))
    await this.page.waitForSelector('.page-header')
  }

  async clickCreate() {
    await this.createButton.click()
  }

  async fillCreateForm(data: {
    title: string
    meetingDate: string
    objective?: string
    attendeeName?: string
    attendeeRole?: string
  }) {
    const dialog = this.page.getByRole('dialog')
    await dialog.locator('input[required]').first().fill(data.title)
    await dialog.locator('input[type="date"]').fill(data.meetingDate)
    if (data.objective) {
      await dialog.locator('textarea').first().fill(data.objective)
    }
    if (data.attendeeName && data.attendeeRole) {
      await dialog.getByRole('button', { name: /agregar asistente/i }).click()
      const inputs = dialog.locator('.form-row input')
      await inputs.nth(0).fill(data.attendeeName)
      await inputs.nth(1).fill(data.attendeeRole)
    }
  }

  async submitCreate() {
    await this.page.getByRole('dialog').getByRole('button', { name: /guardar/i }).click()
  }

  getDialog() {
    return this.page.getByRole('dialog')
  }

  getRowByText(text: string) {
    return this.page.locator('.list-view__table tbody tr').filter({ hasText: text })
  }

  async clickViewOnRow(text: string) {
    await this.getRowByText(text).getByRole('button', { name: /ver/i }).click()
  }
}
