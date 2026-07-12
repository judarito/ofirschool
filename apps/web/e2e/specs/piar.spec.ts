import { test, expect } from '../fixtures'
import { url } from '../helpers'

test.describe('PIAR - Plan Individual de Ajustes Razonables', () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.ofirschool.com'
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123*'

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.login(adminEmail, adminPassword)
  })

  test('carga con título y botón crear visible', async ({ piarPage }) => {
    await piarPage.goto()
    await expect(piarPage.title).toContainText('PIAR / Inclusión')
    await expect(piarPage.createButton).toBeVisible()
    await expect(piarPage.listView).toBeVisible()
  })

  test('muestra aviso de confidencialidad', async ({ page }) => {
    await page.goto(url('/piar'))
    await expect(page.locator('.confidentiality-badge')).toBeVisible()
    await expect(page.locator('.confidentiality-notice')).toContainText('Protección de datos sensibles')
  })

  test('abre modal de nuevo registro con campos requeridos', async ({ piarPage }) => {
    await piarPage.goto()
    await piarPage.clickCreate()
    const dialog = piarPage.getDialog()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('select')).toHaveCount(3)
    await expect(dialog.locator('input')).toHaveCount(3)
    await expect(dialog.locator('textarea')).toHaveCount(2)
    await expect(dialog.getByRole('button', { name: /guardar/i })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /cancelar/i })).toBeVisible()
  })

  test('puede cerrar modal sin guardar', async ({ piarPage }) => {
    await piarPage.goto()
    await piarPage.clickCreate()
    await expect(piarPage.getDialog()).toBeVisible()
    await piarPage.getDialog().getByRole('button', { name: /cancelar/i }).click()
    await expect(piarPage.getDialog()).not.toBeVisible()
  })
})
