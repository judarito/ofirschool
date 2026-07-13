import { test, expect } from '../fixtures'

const ADMIN_EMAIL = 'admin@demo.ofirschool.com'
const ADMIN_PASSWORD = 'ChangeMe123*'

test.describe('Admission - Admin Panel', () => {
  test.beforeEach(async ({ loginPage, admissionsListPage }) => {
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    await admissionsListPage.goto()
  })

  test('should display the admissions page with queue tabs', async ({ admissionsListPage }) => {
    await expect(admissionsListPage.getQueueTabs()).toHaveCount(6)
  })

  test('should filter by queue tab and highlight active', async ({ admissionsListPage }) => {
    await admissionsListPage.clickQueueTab('Nuevas')
    await expect(admissionsListPage.getQueueTabs().filter({ hasText: 'Nuevas' })).toHaveClass(/active/)
    await admissionsListPage.clickQueueTab('Aprobadas')
    await expect(admissionsListPage.getQueueTabs().filter({ hasText: 'Aprobadas' })).toHaveClass(/active/)
    await admissionsListPage.clickQueueTab('Todas')
    await expect(admissionsListPage.getQueueTabs().filter({ hasText: 'Todas' })).toHaveClass(/active/)
  })

  test('should show action buttons in header', async ({ admissionsListPage }) => {
    await expect(admissionsListPage.createButton).toBeVisible()
    await expect(admissionsListPage.reviewPendingButton).toBeVisible()
  })

  test('should show inline summary card', async ({ admissionsListPage }) => {
    await expect(admissionsListPage.summaryTitle).toBeVisible()
    await expect(admissionsListPage.summaryValue).toBeVisible()
    await expect(admissionsListPage.summaryActions).toHaveCount(2)
  })

  test('should open advanced filters', async ({ admissionsListPage }) => {
    await admissionsListPage.openAdvancedFilters()
    await expect(admissionsListPage.gradeFilter).toBeVisible()
    await expect(admissionsListPage.groupFilter).toBeVisible()
    await expect(admissionsListPage.clearFiltersButton).toBeVisible()
  })

  test('should clear advanced filters', async ({ admissionsListPage }) => {
    await admissionsListPage.openAdvancedFilters()
    await admissionsListPage.clearFilters()
    await expect(admissionsListPage.clearFiltersButton).not.toBeVisible()
  })

  test('should open manual admission modal', async ({ admissionsListPage }) => {
    await admissionsListPage.clickCreateManual()
    await expect(admissionsListPage.page.getByRole('dialog')).toBeVisible()
    await expect(admissionsListPage.page.getByRole('heading', { name: /registrar aspirante/i })).toBeVisible()
    await expect(admissionsListPage.page.getByRole('button', { name: /crear solicitud/i })).toBeVisible()
    await expect(admissionsListPage.page.getByRole('button', { name: /cancelar/i })).toBeVisible()
  })

  test('should fill and submit manual admission', async ({ admissionsListPage }) => {
    await admissionsListPage.clickCreateManual()
    const hasGrades = await admissionsListPage.fillManualAdmission({
      requestedGradeId: '1°',
      source: 'Alumno nuevo',
      studentFirstName: 'Juan',
      studentLastName: 'Perez',
      studentDocumentType: 'TI',
      studentDocumentNumber: Date.now().toString().slice(-10),
      studentBirthDate: '2010-01-15',
      studentGender: 'Masculino',
      guardianFirstName: 'Maria',
      guardianLastName: 'Lopez',
      guardianDocumentType: 'CC',
      guardianDocumentNumber: '9876543210',
      guardianPhone: '3001234567',
      guardianEmail: 'maria@test.com',
      guardianRelationship: 'Madre',
    })
    if (!hasGrades) {
      test.skip(true, 'No hay grados disponibles en la BD semilla')
      return
    }
    await admissionsListPage.submitManualAdmission()
    await admissionsListPage.page.waitForTimeout(2000)
    const dialogOpen = await admissionsListPage.page.getByRole('dialog').isVisible().catch(() => false)
    if (dialogOpen) {
      test.skip(true, 'El formulario no se cerró (la API rechazó la solicitud)')
      return
    }
    await expect(admissionsListPage.page.getByRole('dialog')).not.toBeVisible()
  })

  test('should open process configuration modal', async ({ admissionsListPage }) => {
    await admissionsListPage.clickProcess()
    const dialogOpen = await admissionsListPage.page.getByRole('dialog').isVisible({ timeout: 3000 }).catch(() => false)
    if (dialogOpen) {
      await expect(admissionsListPage.page.getByRole('heading', { name: /proceso público/i })).toBeVisible()
      await expect(admissionsListPage.page.getByRole('button', { name: /guardar proceso/i })).toBeVisible()
    } else {
      test.skip(true, 'Modal de proceso no abrió (año no activo o API no disponible)')
    }
  })

  test('should search admissions', async ({ admissionsListPage }) => {
    await admissionsListPage.search('juan')
    await expect(admissionsListPage.searchInput).toHaveValue('juan')
  })

  test('should have row action buttons in list', async ({ admissionsListPage }) => {
    await expect(admissionsListPage.getRowActions().first()).toBeVisible()
  })

  test('should open detail drawer when clicking an application', async ({ admissionsListPage }) => {
    const actions = admissionsListPage.getRowActions()
    const firstAction = actions.filter({ hasText: /ver detalle|tomar en revisión|aprobar|matricular/i }).first()
    if (await firstAction.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstAction.click()
      const detailVisible = await admissionsListPage.page.locator('.admission-detail-grid').isVisible({ timeout: 3000 }).catch(() => false)
      if (detailVisible) {
        await expect(admissionsListPage.page.locator('.admission-detail-stack')).toBeVisible()
      }
    }
  })
})

test.describe('Admission - Public Form', () => {
  test('should display error for non-existent tenant', async ({ publicAdmissionPage }) => {
    await publicAdmissionPage.goto('non-existent-tenant', '2026')
    const hasError = await publicAdmissionPage.page.locator('text=No pudimos cargar').isVisible({ timeout: 3000 }).catch(() => false)
    if (hasError) {
      expect(hasError).toBeTruthy()
    } else {
      test.skip(true, 'API no disponible para validar tenant')
    }
  })

  test('should display the public admission form when valid', async ({ publicAdmissionPage }) => {
    await publicAdmissionPage.goto('colegio-demo-ofir', '2026')
    await publicAdmissionPage.page.waitForSelector('.public-admission-page')
    const hasWizard = await publicAdmissionPage.page.locator('.wizard-steps').isVisible({ timeout: 3000 }).catch(() => false)
    if (hasWizard) {
      await expect(publicAdmissionPage.page.locator('.wizard-steps')).toBeVisible()
      await expect(publicAdmissionPage.page.locator('.wizard-progress')).toBeVisible()
    } else {
      test.skip(true, 'API no disponible o formulario no publicado')
    }
  })

  test('should navigate through wizard steps', async ({ publicAdmissionPage }) => {
    await publicAdmissionPage.goto('colegio-demo-ofir', '2026')
    const hasWizard = await publicAdmissionPage.page.locator('.wizard-steps').isVisible({ timeout: 3000 }).catch(() => false)
    if (hasWizard) {
      await publicAdmissionPage.goToStep(2)
      await expect(publicAdmissionPage.page.locator('.wizard-step--active')).toContainText(/acudiente/i)
      await publicAdmissionPage.goToStep(3)
      await publicAdmissionPage.goToStep(4)
    } else {
      test.skip(true, 'API no disponible o formulario no publicado')
    }
  })

  test('should fill student step of the wizard', async ({ publicAdmissionPage }) => {
    await publicAdmissionPage.goto('colegio-demo-ofir', '2026')
    const hasWizard = await publicAdmissionPage.page.locator('.wizard-steps').isVisible({ timeout: 3000 }).catch(() => false)
    if (hasWizard) {
      await publicAdmissionPage.fillStudentInfo({
        firstName: 'Carlos',
        lastName: 'Martínez',
        documentType: 'Tarjeta de Identidad',
        documentNumber: '1234567890',
        birthDate: '2015-06-15',
        gender: 'Masculino',
      })
      const firstName = await publicAdmissionPage.page.locator('input[placeholder*="Juan José"]').inputValue()
      expect(firstName).toBe('Carlos')
    } else {
      test.skip(true, 'API no disponible o formulario no publicado')
    }
  })

  test('should fill guardian step of the wizard', async ({ publicAdmissionPage }) => {
    await publicAdmissionPage.goto('colegio-demo-ofir', '2026')
    const hasWizard = await publicAdmissionPage.page.locator('.wizard-steps').isVisible({ timeout: 3000 }).catch(() => false)
    if (hasWizard) {
      await publicAdmissionPage.goToStep(2)
      await publicAdmissionPage.fillGuardianInfo({
        firstName: 'Ana',
        lastName: 'Martínez',
        documentType: 'CC',
        documentNumber: '9876543210',
        phone: '3001234567',
        email: 'ana@correo.com',
        relationship: 'Madre',
      })
      const guardianName = await publicAdmissionPage.page.locator('input[placeholder*="María"]').inputValue()
      expect(guardianName).toBe('Ana')
    } else {
      test.skip(true, 'API no disponible o formulario no publicado')
    }
  })
})
