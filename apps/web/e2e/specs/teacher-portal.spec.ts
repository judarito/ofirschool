import { test, expect } from '../fixtures'
import { installTeacherPortalMocks } from '../fixtures/teacher-portal'

const teacherContext = {
  yearId: 'year-2026',
  periodId: 'period-1',
  groupId: 'group-8a',
  subjectId: 'subject-math',
}

test.describe('Portal docente', () => {
  test.beforeEach(async ({ page }) => {
    await installTeacherPortalMocks(page)
  })

  test('muestra una portada docente sin informacion financiera institucional', async ({ dashboardPage }) => {
    await dashboardPage.goto()

    await expect(dashboardPage.title).toContainText('Hola, Docente')
    await expect(dashboardPage.page.getByText('Portal docente')).toBeVisible()
    await expect(dashboardPage.page.getByText('Cursos asignados')).toBeVisible()
    await expect(dashboardPage.page.getByText('Apoyo SIEE')).toBeVisible()
    await expect(dashboardPage.page.getByText('Mora total')).not.toBeVisible()
    await expect(dashboardPage.page.getByText('Cartera pendiente')).not.toBeVisible()
  })

  test('limita la navegacion docente a operacion academica y entradas permitidas', async ({ dashboardPage }) => {
    await dashboardPage.goto()

    const academicSection = dashboardPage.navSection('Operación académica')
    await expect(academicSection).toBeVisible()
    await expect(academicSection).toContainText('Asistencia')
    await expect(academicSection).toContainText('Actividades evaluativas')
    await expect(academicSection).toContainText('Notas finales')
    await expect(academicSection).toContainText('Observaciones SIEE')
    await expect(academicSection).toContainText('Planes de apoyo')
    await expect(dashboardPage.sidebar).not.toContainText('Matrículas')
    await expect(dashboardPage.sidebar).not.toContainText('Usuarios')
    await expect(dashboardPage.sidebar).not.toContainText('Financiero')
  })

  test('asistencia muestra solo materias asignadas al docente para el curso', async ({ attendancePage }) => {
    await attendancePage.goto()
    await attendancePage.selectContext(teacherContext)

    const subjectLabels = (await attendancePage.subjectOptionLabels()).join(' ')
    expect(subjectLabels).toContain('Matemáticas')
    expect(subjectLabels).not.toContain('Química')
  })

  test('notas finales muestran solo materias asignadas al docente para el curso', async ({ gradebookPage }) => {
    await gradebookPage.goto()
    await gradebookPage.selectContext(teacherContext)

    const subjectLabels = (await gradebookPage.subjectOptionLabels()).join(' ')
    expect(subjectLabels).toContain('Matemáticas')
    expect(subjectLabels).not.toContain('Química')
  })

  test('actividades evaluativas enlazan a la planilla real de calificacion', async ({ evaluationActivitiesPage }) => {
    await evaluationActivitiesPage.goto()
    await evaluationActivitiesPage.selectContext(teacherContext)

    const row = evaluationActivitiesPage.activityRow('Taller de fracciones')
    await expect(row).toBeVisible()

    const scoreLink = row.getByRole('link', { name: /calificar/i })
    await expect(scoreLink).toHaveAttribute('href', '/evaluation-activities/activity-1/scores')
  })
})
