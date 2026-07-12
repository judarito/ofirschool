import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export class AttendancePage {
  readonly page: Page
  readonly pageHeader: Locator
  readonly title: Locator
  readonly yearSelect: Locator
  readonly periodSelect: Locator
  readonly groupSelect: Locator
  readonly subjectSelect: Locator
  readonly dateInput: Locator
  readonly loadButton: Locator
  readonly clearButton: Locator
  readonly saveButton: Locator
  readonly markAllPresentButton: Locator
  readonly entriesTable: Locator

  constructor(page: Page) {
    this.page = page
    this.pageHeader = page.locator('.page-header')
    this.title = page.locator('.page-header h1')
    this.yearSelect = page.locator('.form-grid select').nth(0)
    this.periodSelect = page.locator('.form-grid select').nth(1)
    this.groupSelect = page.locator('.form-grid select').nth(2)
    this.subjectSelect = page.locator('.form-grid select').nth(3)
    this.dateInput = page.locator('.form-grid input[type="date"]')
    this.loadButton = page.getByRole('button', { name: /cargar (asistencia|estudiantes)/i }).first()
    this.clearButton = page.getByRole('button', { name: /limpiar/i })
    this.saveButton = page.getByRole('button', { name: /guardar asistencia/i })
    this.markAllPresentButton = page.getByRole('button', { name: /todos presentes/i })
    this.entriesTable = page.locator('.list-view__table')
  }

  async goto() {
    await this.page.goto(url('/attendance'))
    await this.page.waitForSelector('.page-header')
  }

  async selectContext({ yearId, periodId, groupId }: { yearId: string; periodId: string; groupId: string }) {
    await this.yearSelect.selectOption(yearId)
    await this.periodSelect.selectOption(periodId)
    await this.groupSelect.selectOption(groupId)
  }

  async subjectOptionLabels() {
    return this.subjectSelect.locator('option').allTextContents()
  }
}
