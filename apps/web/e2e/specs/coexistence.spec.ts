import { test, expect } from '../fixtures'

test.describe('Coexistence - Casos de convivencia', () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.ofirschool.com'
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123*'

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.login(adminEmail, adminPassword)
  })

  test('carga con título y botón crear visible', async ({ coexistencePage }) => {
    await coexistencePage.goto()
    await expect(coexistencePage.title).toContainText('Convivencia escolar')
    await expect(coexistencePage.createButton).toBeVisible()
    await expect(coexistencePage.listView).toBeVisible()
  })

  test('abre modal de nuevo caso con campos requeridos', async ({ coexistencePage }) => {
    await coexistencePage.goto()
    await coexistencePage.clickCreate()
    const dialog = coexistencePage.getDialog()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('select')).toHaveCount(5)
    await expect(dialog.locator('input[required]')).toHaveCount(2)
    await expect(dialog.locator('textarea')).toHaveCount(3)
    await expect(dialog.getByRole('button', { name: /guardar/i })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /cancelar/i })).toBeVisible()
  })

  test('puede cerrar modal sin guardar', async ({ coexistencePage }) => {
    await coexistencePage.goto()
    await coexistencePage.clickCreate()
    await expect(coexistencePage.getDialog()).toBeVisible()
    await coexistencePage.getDialog().getByRole('button', { name: /cancelar/i }).click()
    await expect(coexistencePage.getDialog()).not.toBeVisible()
  })
})
