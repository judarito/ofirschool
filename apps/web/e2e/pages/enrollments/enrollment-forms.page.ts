import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export class EnrollmentFormsPage {
  readonly page: Page
  readonly saveDraftButton: Locator
  readonly publishButton: Locator
  readonly formNameInput: Locator
  readonly yearSelect: Locator
  readonly startDateInput: Locator
  readonly endDateInput: Locator
  readonly autosaveCheckbox: Locator
  readonly progressBarCheckbox: Locator
  readonly useTemplateButton: Locator
  readonly saveConfigButton: Locator

  constructor(page: Page) {
    this.page = page
    this.saveDraftButton = page.getByRole('button', { name: /guardar borrador/i })
    this.publishButton = page.getByRole('button', { name: /publicar formulario/i })
    this.formNameInput = page.locator('input[required]').first()
    this.yearSelect = page.locator('select').first()
    this.startDateInput = page.locator('input[type="date"]').first()
    this.endDateInput = page.locator('input[type="date"]').nth(1)
    this.autosaveCheckbox = page.locator('input[type="checkbox"]').first()
    this.progressBarCheckbox = page.locator('input[type="checkbox"]').nth(1)
    this.useTemplateButton = page.getByRole('button', { name: /usar plantilla sugerida/i })
    this.saveConfigButton = page.getByRole('button', { name: /guardar/i }).last()
  }

  async goto() {
    await this.page.goto(url('/enrollment-forms'))
    await this.page.waitForSelector('.form-builder-toolbar')
  }

  async clickBuilderTab(label: string) {
    await this.page.getByRole('tablist').getByRole('button').filter({ hasText: label }).click()
  }

  async fillFormName(name: string) {
    await this.formNameInput.fill(name)
  }

  async selectYear(yearLabel: string) {
    await this.yearSelect.selectOption({ label: yearLabel })
  }

  async fillStartDate(date: string) {
    await this.startDateInput.fill(date)
  }

  async fillEndDate(date: string) {
    await this.endDateInput.fill(date)
  }

  async toggleAutosave(checked: boolean) {
    if (checked !== (await this.autosaveCheckbox.isChecked())) {
      await this.autosaveCheckbox.click()
    }
  }

  async toggleProgressBar(checked: boolean) {
    if (checked !== (await this.progressBarCheckbox.isChecked())) {
      await this.progressBarCheckbox.click()
    }
  }

  async clickUseTemplate() {
    await this.useTemplateButton.click()
  }

  async clickSaveConfig() {
    await this.saveConfigButton.click()
  }

  async clickSaveDraft() {
    await this.saveDraftButton.click()
  }

  async clickPublish() {
    await this.publishButton.click()
  }

  getStatusBadge() {
    return this.page.locator('.status-badge')
  }

  getMetrics() {
    return {
      sections: this.page.locator('.form-builder-metrics').locator('strong').nth(0),
      fields: this.page.locator('.form-builder-metrics').locator('strong').nth(1),
      documents: this.page.locator('.form-builder-metrics').locator('strong').nth(2),
    }
  }

  getPublicLink() {
    return this.page.locator('.form-builder-public-link span')
  }
}
