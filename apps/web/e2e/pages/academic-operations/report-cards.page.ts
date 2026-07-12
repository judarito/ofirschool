import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export class ReportCardsPage {
  readonly page: Page
  readonly pageHeader: Locator
  readonly title: Locator
  readonly printButton: Locator
  readonly focusCard: Locator
  readonly contextCard: Locator
  readonly workspaceModes: Locator
  readonly primaryActionButton: Locator

  constructor(page: Page) {
    this.page = page
    this.pageHeader = page.locator('.page-header')
    this.title = page.locator('.page-header h1')
    this.printButton = page.getByRole('button', { name: /imprimir/i })
    this.focusCard = page.locator('.report-cards-focus-card')
    this.contextCard = page.locator('.report-cards-context-card')
    this.workspaceModes = page.locator('.report-cards-modes')
    this.primaryActionButton = page.locator('.report-cards-focus-card .button--brand')
  }

  async goto() {
    await this.page.goto(url('/report-cards'))
    await this.page.waitForSelector('.page-header')
  }
}
