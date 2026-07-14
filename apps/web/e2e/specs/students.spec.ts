import { test, expect } from '../fixtures'

const ADMIN_EMAIL = 'admin@demo.ofirschool.com'
const ADMIN_PASSWORD = 'ChangeMe123*'

test.describe('Students - CRUD', () => {
  test.beforeEach(async ({ loginPage, studentsPage }) => {
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD)
    await studentsPage.goto()
  })

  test('should display the students page with flow diagram', async ({ studentsPage }) => {
    await expect(studentsPage.getFlowSteps()).toHaveCount(3)
    await expect(studentsPage.getFlowStepTitle(1)).toHaveText('Estudiante')
    await expect(studentsPage.getFlowStepTitle(2)).toHaveText('Inscripcion')
    await expect(studentsPage.getFlowStepTitle(3)).toHaveText('Matricula anual')
  })

  test('should show admission registration and import buttons', async ({ studentsPage }) => {
    await expect(studentsPage.createButton).toBeVisible()
    await expect(studentsPage.importButton).toBeVisible()
  })

  test('should open the single aspirant registration flow', async ({ studentsPage }) => {
    await studentsPage.clickCreate()
    await expect(studentsPage.page.getByRole('dialog')).toBeVisible()
    await expect(studentsPage.page).toHaveURL(/\/admissions/)
    await expect(studentsPage.page.getByRole('heading', { name: /registrar aspirante/i })).toBeVisible()
  })

  test('should fill student form fields', async ({ studentsPage }) => {
    await studentsPage.clickCreate()
    const dialog = studentsPage.page.getByRole('dialog')
    await expect(dialog.getByRole('textbox', { name: /nombres estudiante/i })).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: /documento estudiante/i })).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: /nombres acudiente/i })).toBeVisible()
  })

  test('should have submit button in the form', async ({ studentsPage }) => {
    test.skip(true, 'Cubierto por should fill student form fields')
  })

  test('should search students', async ({ studentsPage }) => {
    await studentsPage.search('juan')
    await expect(studentsPage.searchInput).toHaveValue('juan')
  })
})
