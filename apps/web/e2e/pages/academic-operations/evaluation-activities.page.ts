import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export class EvaluationActivitiesPage {
  readonly page: Page
  readonly pageHeader: Locator
  readonly title: Locator
  readonly yearSelect: Locator
  readonly periodSelect: Locator
  readonly groupSelect: Locator
  readonly subjectSelect: Locator
  readonly newActivityButton: Locator
  readonly periodLockedAlert: Locator

  constructor(page: Page) {
    this.page = page
    this.pageHeader = page.locator('.page-header')
    this.title = page.locator('.page-header h1')
    this.yearSelect = page.locator('.form-grid select').nth(0)
    this.periodSelect = page.locator('.form-grid select').nth(1)
    this.groupSelect = page.locator('.form-grid select').nth(2)
    this.subjectSelect = page.locator('.form-grid select').nth(3)
    this.newActivityButton = page.getByRole('button', { name: /nueva actividad/i })
    this.periodLockedAlert = page.locator('.alert.alert--warning')
  }

  async goto() {
    await this.page.goto(url('/evaluation-activities'))
    await this.page.waitForSelector('.page-header')
  }

  async selectContext({ yearId, periodId, groupId, subjectId }: { yearId: string; periodId: string; groupId: string; subjectId: string }) {
    await this.yearSelect.selectOption(yearId)
    await this.periodSelect.selectOption(periodId)
    await this.groupSelect.selectOption(groupId)
    await this.subjectSelect.selectOption(subjectId)
  }

  activityRow(name: string) {
    return this.page.locator('.list-view__table tbody tr').filter({ hasText: name })
  }
}
