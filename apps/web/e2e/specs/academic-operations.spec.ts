import { test, expect } from '../fixtures'
import { url } from '../helpers'

test.describe('Academic Operations - Smoke tests', () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@demo.ofirschool.com'
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123*'

  test.beforeEach(async ({ loginPage }) => {
    await loginPage.login(adminEmail, adminPassword)
  })

  test('Attendance - carga con titulo y filtros', async ({ attendancePage, page }) => {
    await attendancePage.goto()
    await expect(attendancePage.title).toContainText('Asistencia')
    await expect(attendancePage.yearSelect).toBeVisible()
    await expect(attendancePage.periodSelect).toBeVisible()
    await expect(attendancePage.groupSelect).toBeVisible()
    await expect(attendancePage.subjectSelect).toBeVisible()
    await expect(attendancePage.dateInput).toBeVisible()
    await expect(attendancePage.loadButton).toBeVisible()
    await expect(attendancePage.clearButton).toBeVisible()
  })

  test('Gradebook - carga con titulo y filtros', async ({ gradebookPage }) => {
    await gradebookPage.goto()
    await expect(gradebookPage.title).toContainText('Notas')
    await expect(gradebookPage.yearSelect).toBeVisible()
    await expect(gradebookPage.periodSelect).toBeVisible()
    await expect(gradebookPage.groupSelect).toBeVisible()
    await expect(gradebookPage.subjectSelect).toBeVisible()
    await expect(gradebookPage.loadButton).toBeVisible()
    await expect(gradebookPage.clearButton).toBeVisible()
  })

  test('Evaluation Activities - carga con titulo y filtros', async ({ evaluationActivitiesPage }) => {
    await evaluationActivitiesPage.goto()
    await expect(evaluationActivitiesPage.title).toContainText('Actividades Evaluativas')
    await expect(evaluationActivitiesPage.yearSelect).toBeVisible()
    await expect(evaluationActivitiesPage.periodSelect).toBeVisible()
    await expect(evaluationActivitiesPage.groupSelect).toBeVisible()
    await expect(evaluationActivitiesPage.subjectSelect).toBeVisible()
  })

  test('Observations - carga con titulo y filtros', async ({ observationsPage }) => {
    await observationsPage.goto()
    await expect(observationsPage.title).toContainText('Observaciones SIEE')
    await expect(observationsPage.yearSelect).toBeVisible()
    await expect(observationsPage.periodSelect).toBeVisible()
    await expect(observationsPage.groupSelect).toBeVisible()
    await expect(observationsPage.subjectSelect).toBeVisible()
  })

  test('Support Strategies - carga con titulo y filtros', async ({ supportStrategiesPage }) => {
    await supportStrategiesPage.goto()
    await expect(supportStrategiesPage.title).toContainText('Estrategias de Apoyo')
    await expect(supportStrategiesPage.yearSelect).toBeVisible()
    await expect(supportStrategiesPage.periodSelect).toBeVisible()
    await expect(supportStrategiesPage.groupSelect).toBeVisible()
    await expect(supportStrategiesPage.subjectSelect).toBeVisible()
  })

  test('Report Cards - carga con titulo y paneles', async ({ reportCardsPage }) => {
    await reportCardsPage.goto()
    await expect(reportCardsPage.title).toContainText('Boletines')
    await expect(reportCardsPage.focusCard).toBeVisible()
    await expect(reportCardsPage.contextCard).toBeVisible()
    await expect(reportCardsPage.workspaceModes).toBeVisible()
  })

})
