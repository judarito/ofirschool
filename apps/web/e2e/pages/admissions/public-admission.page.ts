import type { Page, Locator } from '@playwright/test'
import { url } from '../../helpers'

export type StudentInfo = {
  firstName: string
  middleName?: string
  lastName: string
  documentType: string
  documentNumber: string
  birthDate: string
  gender: string
  bloodType?: string
}

export type GuardianInfo = {
  firstName: string
  lastName: string
  documentType: string
  documentNumber: string
  phone: string
  email: string
  relationship: string
}

export class PublicAdmissionPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto(tenantSlug: string, year: string) {
    await this.page.goto(url(`/inscripcion/${tenantSlug}/${year}`))
    await this.page.waitForSelector('.public-admission-page')
  }

  async fillStudentInfo(data: StudentInfo) {
    await this.page.fill('input[placeholder*="Juan José"]', data.firstName)
    if (data.middleName) {
      await this.page.fill('input[placeholder="Opcional"]', data.middleName)
    }
    await this.page.fill('input[placeholder*="Morales Pérez"]', data.lastName)
    await this.page.selectOption('select', { label: data.documentType })
    await this.page.fill('input[placeholder*="Sin puntos"]', data.documentNumber)
    await this.page.fill('input[type="date"]', data.birthDate)
    await this.page.selectOption('select', { label: data.gender })
    if (data.bloodType) {
      await this.page.selectOption('select', { label: data.bloodType })
    }
  }

  async fillGuardianInfo(data: GuardianInfo) {
    await this.page.fill('input[placeholder*="María"]', data.firstName)
    await this.page.fill('input[placeholder*="López"]', data.lastName)
    await this.page.selectOption('select', { label: data.documentType })
    await this.page.fill('input[placeholder*="Sin puntos"]', data.documentNumber)
    await this.page.fill('input[type="tel"]', data.phone)
    await this.page.fill('input[type="email"]', data.email)
    await this.page.selectOption('select', { label: data.relationship })
  }

  async selectGrade(gradeName: string) {
    await this.page.selectOption('select', { label: gradeName })
  }

  async goToStep(step: number) {
    await this.page.locator('.wizard-step').nth(step - 1).click()
  }

  async submit() {
    await this.page.locator('form.public-form').press('Enter')
  }

  async isLoading() {
    return this.page.locator('text=Cargando formulario').isVisible()
  }

  async getError() {
    return this.page.locator('.empty-state p').textContent()
  }
}
