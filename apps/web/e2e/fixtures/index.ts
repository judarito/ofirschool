import { test as base } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { DashboardPage } from '../pages/dashboard.page'
import { StudentsPage } from '../pages/students.page'
import { AdmissionsListPage } from '../pages/admissions/admissions-list.page'
import { PublicAdmissionPage } from '../pages/admissions/public-admission.page'
import { EnrollmentsListPage } from '../pages/enrollments/enrollments-list.page'
import { EnrollmentFormsPage } from '../pages/enrollments/enrollment-forms.page'
import { AttendancePage } from '../pages/academic-operations/attendance.page'
import { CommitteesPage } from '../pages/academic-operations/committees.page'
import { CoexistencePage } from '../pages/academic-operations/coexistence.page'
import { PiarPage } from '../pages/academic-operations/piar.page'
import { GradebookPage } from '../pages/academic-operations/gradebook.page'
import { EvaluationActivitiesPage } from '../pages/academic-operations/evaluation-activities.page'
import { ObservationsPage } from '../pages/academic-operations/observations.page'
import { SupportStrategiesPage } from '../pages/academic-operations/support-strategies.page'
import { ReportCardsPage } from '../pages/academic-operations/report-cards.page'

type Fixtures = {
  loginPage: LoginPage
  dashboardPage: DashboardPage
  studentsPage: StudentsPage
  admissionsListPage: AdmissionsListPage
  publicAdmissionPage: PublicAdmissionPage
  enrollmentsListPage: EnrollmentsListPage
  enrollmentFormsPage: EnrollmentFormsPage
  attendancePage: AttendancePage
  gradebookPage: GradebookPage
  evaluationActivitiesPage: EvaluationActivitiesPage
  observationsPage: ObservationsPage
  supportStrategiesPage: SupportStrategiesPage
  reportCardsPage: ReportCardsPage
  committeesPage: CommitteesPage
  coexistencePage: CoexistencePage
  piarPage: PiarPage
}

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page))
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page))
  },
  studentsPage: async ({ page }, use) => {
    await use(new StudentsPage(page))
  },
  admissionsListPage: async ({ page }, use) => {
    await use(new AdmissionsListPage(page))
  },
  publicAdmissionPage: async ({ page }, use) => {
    await use(new PublicAdmissionPage(page))
  },
  enrollmentsListPage: async ({ page }, use) => {
    await use(new EnrollmentsListPage(page))
  },
  enrollmentFormsPage: async ({ page }, use) => {
    await use(new EnrollmentFormsPage(page))
  },
  attendancePage: async ({ page }, use) => {
    await use(new AttendancePage(page))
  },
  gradebookPage: async ({ page }, use) => {
    await use(new GradebookPage(page))
  },
  evaluationActivitiesPage: async ({ page }, use) => {
    await use(new EvaluationActivitiesPage(page))
  },
  observationsPage: async ({ page }, use) => {
    await use(new ObservationsPage(page))
  },
  supportStrategiesPage: async ({ page }, use) => {
    await use(new SupportStrategiesPage(page))
  },
  reportCardsPage: async ({ page }, use) => {
    await use(new ReportCardsPage(page))
  },
  committeesPage: async ({ page }, use) => {
    await use(new CommitteesPage(page))
  },
  coexistencePage: async ({ page }, use) => {
    await use(new CoexistencePage(page))
  },
  piarPage: async ({ page }, use) => {
    await use(new PiarPage(page))
  },
})

export { expect } from '@playwright/test'
