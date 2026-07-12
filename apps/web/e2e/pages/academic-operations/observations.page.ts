import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export class ObservationsPage {
  readonly page: Page
  readonly pageHeader: Locator
  readonly title: Locator
  readonly yearSelect: Locator
  readonly periodSelect: Locator
  readonly groupSelect: Locator
  readonly subjectSelect: Locator
  readonly periodLockedAlert: Locator

  constructor(page: Page) {
    this.page = page
    this.pageHeader = page.locator('.page-header')
    this.title = page.locator('.page-header h1')
    this.yearSelect = page.locator('.form-grid select').nth(0)
    this.periodSelect = page.locator('.form-grid select').nth(1)
    this.groupSelect = page.locator('.form-grid select').nth(2)
    this.subjectSelect = page.locator('.form-grid select').nth(3)
    this.periodLockedAlert = page.locator('.alert.alert--warning')
  }

  async goto() {
    await this.page.goto(url('/academic-observations'))
    await this.page.waitForSelector('.page-header')
  }
}
