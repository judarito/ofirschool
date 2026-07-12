import type { Locator, Page } from '@playwright/test'
import { url } from '../helpers'

export class DashboardPage {
  readonly page: Page
  readonly title: Locator
  readonly eyebrow: Locator
  readonly metricCards: Locator
  readonly quickActions: Locator
  readonly sidebar: Locator

  constructor(page: Page) {
    this.page = page
    this.title = page.locator('.page-header h1')
    this.eyebrow = page.locator('.page-header').locator('text=Portal docente')
    this.metricCards = page.locator('.metric-card')
    this.quickActions = page.locator('.quick-grid__item')
    this.sidebar = page.locator('.sidebar')
  }

  async goto() {
    await this.page.goto(url('/'))
    await this.page.waitForSelector('.page-header')
  }

  navSection(name: string) {
    return this.page.locator('.nav-section').filter({ hasText: name })
  }
}
