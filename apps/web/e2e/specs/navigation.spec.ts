import { test, expect } from '../fixtures'

test.describe('Navigation - Estructura reorganizada', () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.ofirschool.com'
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123*'

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.login(adminEmail, adminPassword)
  })

  test('sección Operacion academica tiene los items correctos', async ({ page }) => {
    const section = page.locator('.nav-section').filter({ hasText: 'Operación académica' })
    await expect(section).toBeVisible()

    const items = section.locator('.nav-link')
    const labels = await items.allTextContents()

    expect(labels.join(' ')).toContain('Asistencia')
    expect(labels.join(' ')).toContain('Actividades evaluativas')
    expect(labels.join(' ')).toContain('Notas finales')
    expect(labels.join(' ')).toContain('Observaciones SIEE')
    expect(labels.join(' ')).toContain('Planes de apoyo')
    expect(labels.join(' ')).toContain('Comités académicos')
    expect(labels.join(' ')).toContain('Boletines')
  })

  test('sección Cierres tiene los items correctos sin duplicado de boletines', async ({ page }) => {
    const section = page.locator('.nav-section').filter({ hasText: 'Cierres' })
    await expect(section).toBeVisible()

    const items = section.locator('.nav-link')
    const labels = await items.allTextContents()

    expect(labels.join(' ')).toContain('Periodos')
    expect(labels.join(' ')).toContain('Años lectivos')
    expect(labels.join(' ')).not.toContain('Boletines')
  })

  test('sección Convivencia e inclusion tiene los items correctos', async ({ page }) => {
    const section = page.locator('.nav-section').filter({ hasText: 'Convivencia e inclusión' })
    await expect(section).toBeVisible()

    const items = section.locator('.nav-link')
    const labels = await items.allTextContents()

    expect(labels.join(' ')).toContain('Convivencia escolar')
    expect(labels.join(' ')).toContain('PIAR / Inclusión')
  })

  test('Convivencia ya no aparece en Institucional', async ({ page }) => {
    const section = page.locator('.nav-section').filter({ hasText: 'Institucional' })
    await expect(section).toBeVisible()

    const items = section.locator('.nav-link')
    const labels = await items.allTextContents()

    expect(labels.join(' ')).not.toContain('Convivencia')
  })

  test('secciones principales existen en orden', async ({ page }) => {
    const sectionTitles = page.locator('.nav-section__title')
    const titles = await sectionTitles.allTextContents()

    const fullText = titles.join(' | ')
    expect(fullText).toContain('Inicio')
    expect(fullText).toContain('Admisión y matrícula')
    expect(fullText).toContain('Operación académica')
    expect(fullText).toContain('Cierres')
    expect(fullText).toContain('Convivencia e inclusión')
    expect(fullText).toContain('Configuración')
    expect(fullText).toContain('Institucional')
  })
})
