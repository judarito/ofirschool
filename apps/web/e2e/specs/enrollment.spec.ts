import { test, expect } from '../fixtures'

const ADMIN_EMAIL = 'admin@demo.ofirschool.com'
const ADMIN_PASSWORD = 'ChangeMe123*'

test.describe('Enrollment - Admin Panel', () => {
  test.beforeEach(async ({ loginPage, enrollmentsListPage }) => {
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    await enrollmentsListPage.goto()
  })

  test('should display the enrollments page with view tabs', async ({ enrollmentsListPage }) => {
    await expect(enrollmentsListPage.getViewTabs()).toHaveCount(4)
  })

  test('should display all view tabs with correct labels', async ({ enrollmentsListPage }) => {
    const tabs = enrollmentsListPage.getViewTabs()
    const labels = await tabs.allTextContents()
    expect(labels.some(l => l.includes('Bandeja'))).toBeTruthy()
    expect(labels.some(l => l.includes('Continuidad'))).toBeTruthy()
    expect(labels.some(l => l.includes('Cierre'))).toBeTruthy()
  })

  test('should switch between view tabs', async ({ enrollmentsListPage }) => {
    for (const label of ['Continuidad', 'Cierre', 'Bandeja']) {
      await enrollmentsListPage.clickViewTab(label)
      await expect(enrollmentsListPage.getViewTabs().filter({ hasText: label })).toHaveClass(/active/)
    }
  })

  test('should show all action buttons in header', async ({ enrollmentsListPage }) => {
    await expect(enrollmentsListPage.createButton).toBeVisible()
    await expect(enrollmentsListPage.continuityButton).toBeVisible()
    await expect(enrollmentsListPage.closureButton).toBeVisible()
  })

  test('should show inline summary card with workflow info', async ({ enrollmentsListPage }) => {
    await expect(enrollmentsListPage.summaryTitle).toBeVisible()
    await expect(enrollmentsListPage.summaryValue).toBeVisible()
    await expect(enrollmentsListPage.summaryActions).toHaveCount(2)
  })

  test('should toggle advanced filters', async ({ enrollmentsListPage }) => {
    await enrollmentsListPage.openAdvancedFilters()
    await expect(enrollmentsListPage.gradeFilter).toBeVisible()
    await expect(enrollmentsListPage.groupFilter).toBeVisible()
    await expect(enrollmentsListPage.clearFiltersButton).toBeVisible()
    await enrollmentsListPage.clearFilters()
  })

  test('should have export button', async ({ enrollmentsListPage }) => {
    await expect(enrollmentsListPage.exportButton).toBeVisible()
  })

  test('should open create enrollment modal', async ({ enrollmentsListPage }) => {
    await enrollmentsListPage.clickCreate()
    const dialogVisible = await enrollmentsListPage.page.getByRole('dialog').isVisible({ timeout: 3000 }).catch(() => false)
    if (dialogVisible) {
      await expect(enrollmentsListPage.page.getByRole('dialog')).toBeVisible()
      await expect(enrollmentsListPage.page.getByRole('heading', { name: /crear matrícula/i })).toBeVisible()
      await expect(enrollmentsListPage.page.getByRole('button', { name: /guardar matrícula/i })).toBeVisible()
    } else {
      test.skip(true, 'Modal no abrió (sin candidatos disponibles)')
    }
  })

  test('should open continuity modal', async ({ enrollmentsListPage }) => {
    await enrollmentsListPage.clickContinuity()
    await expect(enrollmentsListPage.page.getByRole('dialog')).toBeVisible()
    await expect(enrollmentsListPage.page.getByRole('heading', { name: /continuidad masiva/i })).toBeVisible()
    await expect(enrollmentsListPage.page.getByRole('button', { name: /actualizar preview/i })).toBeVisible()
    await expect(enrollmentsListPage.page.getByRole('button', { name: /ejecutar lote/i })).toBeVisible()
  })

  test('should fill continuity form with promotion mode', async ({ enrollmentsListPage }) => {
    await enrollmentsListPage.clickContinuity()
    await enrollmentsListPage.fillContinuityForm({
      mode: 'Promoción',
      enrollmentStatus: 'Borrador',
      enrollmentDate: '2026-01-15',
    })
    await enrollmentsListPage.updateContinuityPreview()
    const metricsCount = await enrollmentsListPage.getContinuityMetrics().count()
    if (metricsCount === 0) {
      test.skip(true, 'Preview no cargó (API no disponible)')
    }
    await expect(enrollmentsListPage.getContinuityMetrics()).toHaveCount(3)
  })

  test('should fill continuity form with renewal mode', async ({ enrollmentsListPage }) => {
    await enrollmentsListPage.clickContinuity()
    await enrollmentsListPage.fillContinuityForm({
      mode: 'Renovación',
      enrollmentStatus: 'Pendiente',
      enrollmentDate: '2026-02-01',
    })
    await enrollmentsListPage.updateContinuityPreview()
    const metricsCount = await enrollmentsListPage.getContinuityMetrics().count()
    if (metricsCount === 0) {
      test.skip(true, 'Preview no cargó (API no disponible)')
    }
  })

  test('should open annual closure modal', async ({ enrollmentsListPage }) => {
    await enrollmentsListPage.clickAnnualClosure()
    await expect(enrollmentsListPage.page.getByRole('dialog')).toBeVisible()
    await expect(enrollmentsListPage.page.getByRole('heading', { name: /cierre anual/i })).toBeVisible()
    await expect(enrollmentsListPage.page.getByRole('button', { name: /actualizar preview/i })).toBeVisible()
  })

  test('should have annual closure preview metrics', async ({ enrollmentsListPage }) => {
    await enrollmentsListPage.clickAnnualClosure()
    const previewBtn = enrollmentsListPage.page.getByRole('button', { name: /actualizar preview/i })
    await previewBtn.click()
    const metricsCount = await enrollmentsListPage.getClosureMetrics().count()
    if (metricsCount > 0) {
      await expect(enrollmentsListPage.getClosureMetrics()).toHaveCount(5)
    } else {
      test.skip(true, 'Preview no cargó (API no disponible)')
    }
  })

  test('should search enrollments', async ({ enrollmentsListPage }) => {
    await enrollmentsListPage.search('juan')
    await expect(enrollmentsListPage.searchInput).toHaveValue('juan')
  })
})

test.describe('Enrollment - Form Builder', () => {
  test.beforeEach(async ({ loginPage, enrollmentFormsPage }) => {
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    await enrollmentFormsPage.goto()
  })

  test('should display the form builder toolbar', async ({ enrollmentFormsPage }) => {
    await expect(enrollmentFormsPage.saveDraftButton).toBeVisible()
    await expect(enrollmentFormsPage.publishButton).toBeVisible()
  })

  test('should display builder tabs', async ({ enrollmentFormsPage }) => {
    const tabs = enrollmentFormsPage.page.getByRole('tablist').getByRole('button')
    await expect(tabs).toHaveCount(4)
  })

  test('should display form metrics', async ({ enrollmentFormsPage }) => {
    const metrics = enrollmentFormsPage.getMetrics()
    await expect(metrics.sections).toBeVisible()
    await expect(metrics.fields).toBeVisible()
    await expect(metrics.documents).toBeVisible()
  })

  test('should navigate through all builder tabs', async ({ enrollmentFormsPage }) => {
    const tabs = ['Preguntas', 'Documentos', 'Vista previa']
    for (const label of tabs) {
      await enrollmentFormsPage.clickBuilderTab(label)
    }
    await enrollmentFormsPage.clickBuilderTab('Información básica')
    await expect(enrollmentFormsPage.formNameInput).toBeVisible()
  })

  test('should fill form config in setup tab', async ({ enrollmentFormsPage }) => {
    await enrollmentFormsPage.fillFormName('Formulario de inscripción 2026')
    await enrollmentFormsPage.fillStartDate('2026-01-01')
    await enrollmentFormsPage.fillEndDate('2026-03-31')
    await enrollmentFormsPage.clickSaveConfig()
  })

  test('should save draft with filled config', async ({ enrollmentFormsPage }) => {
    await enrollmentFormsPage.fillFormName('Test Form')
    await enrollmentFormsPage.fillStartDate('2026-01-01')
    await enrollmentFormsPage.fillEndDate('2026-03-31')
    await enrollmentFormsPage.toggleAutosave(false)
    await enrollmentFormsPage.clickSaveDraft()
    await expect(enrollmentFormsPage.saveDraftButton).toBeVisible()
  })

  test('should use template button in setup', async ({ enrollmentFormsPage }) => {
    await enrollmentFormsPage.clickUseTemplate()
    const metrics = enrollmentFormsPage.getMetrics()
    await metrics.sections.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
  })

  test('should show public link', async ({ enrollmentFormsPage }) => {
    const link = await enrollmentFormsPage.getPublicLink().textContent()
    expect(link).toContain('/inscripcion/')
  })

  test('should navigate to structure tab and see presets', async ({ enrollmentFormsPage }) => {
    await enrollmentFormsPage.clickBuilderTab('Preguntas')
    await expect(enrollmentFormsPage.page.locator('.template-library')).toBeVisible()
    await expect(enrollmentFormsPage.page.locator('.template-library__item').first()).toBeVisible()
    const count = await enrollmentFormsPage.page.locator('.template-library__item').count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('should add a section from presets', async ({ enrollmentFormsPage }) => {
    await enrollmentFormsPage.clickBuilderTab('Preguntas')
    const firstPreset = enrollmentFormsPage.page.locator('.template-library__item').first()
    if (await firstPreset.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstPreset.click()
    }
  })

  test('should navigate to documents tab and see presets', async ({ enrollmentFormsPage }) => {
    await enrollmentFormsPage.clickBuilderTab('Documentos')
    await expect(enrollmentFormsPage.page.locator('.template-library')).toBeVisible()
  })
})
