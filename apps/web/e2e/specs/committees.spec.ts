import { test, expect } from '../fixtures'

test.describe('Committees - CRUD y navegación', () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.ofirschool.com'
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123*'

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.login(adminEmail, adminPassword)
  })

  test('carga con título y botón crear visible', async ({ committeesPage }) => {
    await committeesPage.goto()
    await expect(committeesPage.title).toContainText('Comités académicos')
    await expect(committeesPage.createButton).toBeVisible()
    await expect(committeesPage.listView).toBeVisible()
  })

  test('abre modal de nuevo comité con campos requeridos', async ({ committeesPage }) => {
    await committeesPage.goto()
    await committeesPage.clickCreate()
    const dialog = committeesPage.getDialog()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('select')).toHaveCount(2)
    await expect(dialog.locator('input[required]').first()).toBeVisible()
    await expect(dialog.locator('input[type="date"]')).toBeVisible()
    await expect(dialog.getByRole('button', { name: /guardar/i })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /cancelar/i })).toBeVisible()
  })

  test('puede llenar formulario de creación', async ({ committeesPage }) => {
    await committeesPage.goto()
    await committeesPage.clickCreate()

    const today = new Date().toISOString().split('T')[0]
    await committeesPage.fillCreateForm({
      title: 'Comité de prueba E2E',
      meetingDate: today,
      objective: 'Evaluar resultados del periodo',
      attendeeName: 'Juan Pérez',
      attendeeRole: 'Docente',
    })

    await expect(committeesPage.getDialog().locator('input[required]').first()).toHaveValue('Comité de prueba E2E')
  })

  test('puede cerrar modal sin guardar', async ({ committeesPage }) => {
    await committeesPage.goto()
    await committeesPage.clickCreate()
    await expect(committeesPage.getDialog()).toBeVisible()
    await committeesPage.getDialog().getByRole('button', { name: /cancelar/i }).click()
    await expect(committeesPage.getDialog()).not.toBeVisible()
  })
})
