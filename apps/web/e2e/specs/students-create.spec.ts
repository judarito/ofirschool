import { test } from '../fixtures'

test.describe('Students - Create student', () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.ofirschool.com'
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123*'

  test.beforeEach(async ({ loginPage, studentsPage }) => {
    await loginPage.login(adminEmail, adminPassword)
    await studentsPage.goto()
  })

  test('should fill the form and verify submit button', async () => {
    test.skip(true, 'Cubierto por students CRUD should fill student form fields')
  })
})
