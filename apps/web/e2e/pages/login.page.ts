import type { Page, Locator } from '@playwright/test'
import { url } from '../helpers'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('input[type="email"]')
    this.passwordInput = page.locator('input[type="password"]')
    this.submitButton = page.locator('button[type="submit"]')
  }

  async goto() {
    await this.page.goto(url('/login'))
  }

  async fillEmail(email: string) {
    await this.emailInput.fill(email)
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password)
  }

  async clickSubmit() {
    await this.submitButton.click()
  }

  async login(email: string, password: string) {
    await this.goto()
    await this.fillEmail(email)
    await this.fillPassword(password)
    await this.clickSubmit()
    await this.page.waitForURL(url('/'))
  }
}
