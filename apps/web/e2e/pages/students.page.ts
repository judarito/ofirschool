import type { Page, Locator } from '@playwright/test'
import { url } from '../helpers'

export class StudentsPage {
  readonly page: Page
  readonly searchInput: Locator
  readonly createButton: Locator
  readonly importButton: Locator
  readonly gradeFilter: Locator
  readonly groupFilter: Locator

  constructor(page: Page) {
    this.page = page
    this.searchInput = page.getByPlaceholder('Buscar por nombre o documento')
    this.createButton = page.getByRole('button', { name: /registrar aspirante/i }).first()
    this.importButton = page.getByRole('button', { name: /importar/i }).first()
    this.gradeFilter = page.locator('select').filter({ hasText: /todos los grados/i })
    this.groupFilter = page.locator('select').filter({ hasText: /todos los cursos/i })
  }

  async goto() {
    await this.page.goto(url('/students'))
    await this.page.waitForSelector('.domain-flow-card')
  }

  async search(query: string) {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(500)
  }

  async clickCreate() {
    await this.createButton.click()
  }

  async clickImport() {
    await this.importButton.click()
  }

  async fillStudentForm(data: {
    firstName: string
    middleName?: string
    lastName: string
    documentType: string
    documentNumber: string
    birthDate: string
    gender?: string
    bloodType?: string
    status?: string
  }) {
    const dialog = this.page.getByRole('dialog')
    await dialog.locator('select').first().waitFor({ state: 'attached', timeout: 5000 })
    const inputs = dialog.locator('input:not([disabled])')
    const selects = dialog.locator('select:not([disabled])')

    let si = 0
    await inputs.nth(0).fill(data.firstName)
    if (data.middleName) {
      await inputs.nth(1).fill(data.middleName)
    }
    await inputs.nth(2).fill(data.lastName)
    await selects.nth(si++).selectOption(data.documentType)
    await inputs.nth(3).fill(data.documentNumber)
    await inputs.nth(4).fill(data.birthDate)
    if (data.gender) {
      await selects.nth(si++).selectOption({ label: data.gender })
    }
    if (data.bloodType) {
      await selects.nth(si++).selectOption(data.bloodType)
    }
    if (data.status) {
      await selects.nth(si++).selectOption(data.status)
    }
  }

  async fillAdmissionForm(data: {
    requestedGradeId?: string
    guardianFirstName: string
    guardianLastName: string
    guardianDocumentType: string
    guardianDocumentNumber: string
    guardianPhone: string
    guardianEmail: string
    guardianRelationship: string
  }) {
    const dialog = this.page.getByRole('dialog')
    await dialog.locator('input:not([disabled])').nth(5).waitFor({ state: 'attached', timeout: 5000 }).catch(() => {})
    const selects = dialog.locator('select:not([disabled])')
    const inputs = dialog.locator('input:not([disabled])')

    // select indices: 0=TipoDoc,1=Genero,2=GrupoSang,3=Estado
    // 4=source, 5=grade, 6=group
    // Fill grade (select 5) with first available option
    const gradeSelect = selects.nth(5)
    const gradeOptions = await gradeSelect.locator('option').allTextContents()
    const firstGrade = gradeOptions.find(o => o.trim() && !o.includes('Selecciona'))
    if (firstGrade) {
      await gradeSelect.selectOption(firstGrade.trim())
    }

    // input indices: 0=Nombres,1=Segundo,2=Apellidos,3=NumDoc,4=Fecha
    // guardian inputs start at 5
    let ii = 5
    // guardian selects start at 7 (after student selects 0-3, admission selects 4-6)
    let si = 7

    await inputs.nth(ii++).fill(data.guardianFirstName)
    await inputs.nth(ii++).fill(data.guardianLastName)
    await selects.nth(si++).selectOption(data.guardianDocumentType)
    await inputs.nth(ii++).fill(data.guardianDocumentNumber)
    await inputs.nth(ii++).fill(data.guardianPhone)
    await inputs.nth(ii++).fill(data.guardianEmail)
    await selects.nth(si).selectOption(data.guardianRelationship)
  }

  async submitForm() {
    await this.page.getByRole('dialog').getByRole('button', { name: /guardar/i }).click({ force: true, timeout: 2000 }).catch(() => {})
  }

  getFlowSteps() {
    return this.page.locator('.domain-flow-card__step')
  }

  getFlowStepTitle(step: number) {
    return this.page.locator('.domain-flow-card').locator('strong').nth(step - 1)
  }
}
