import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { contextMiddleware } from './middleware/context'
import { errorHandler } from './middleware/error-handler'
import { academicRoutes } from './routes/academic'
import { admissionRoutes } from './routes/admissions'
import { auditRoutes } from './routes/audit'
import { authRoutes } from './routes/auth'
import { automationRoutes } from './routes/automation'
import { catalogRoutes } from './routes/catalogs'
import { coexistenceRoutes } from './routes/coexistence'
import { committeeRoutes } from './routes/committees'
import { communicationRoutes } from './routes/communications'
import { consentRoutes } from './routes/consents'
import { dashboardRoutes } from './routes/dashboard'
import { enrollmentFormRoutes } from './routes/enrollment-forms'
import { enrollmentNoveltyRoutes } from './routes/enrollment-novelties'
import { enrollmentRoutes } from './routes/enrollments'
import { financeRoutes } from './routes/finance'
import { healthRoutes } from './routes/health'
import { navigationRoutes } from './routes/navigation'
import { officialDocumentRoutes } from './routes/official-documents'
import { officialReportRoutes } from './routes/official-reports'
import { piarRoutes } from './routes/piar'
import { portalRoutes } from './routes/portal'
import { publicAdmissionRoutes } from './routes/public-admissions'
import { reportCardPdfRoutes } from './routes/report-cards-pdf'
import { settingsRoutes } from './routes/settings'
import { studentGuardianRoutes } from './routes/student-guardians'
import { studentRoutes } from './routes/students'
import { userRoutes } from './routes/users'
import type { AppContextVariables, Bindings } from './types'

const app = new Hono<{
  Bindings: Bindings
  Variables: AppContextVariables
}>()

app.use('*', logger())
app.use('*', cors())
app.use('*', contextMiddleware)
app.onError(errorHandler)

app.route('/health', healthRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/audit', auditRoutes)
app.route('/api/automation', automationRoutes)
app.route('/api/public', publicAdmissionRoutes)
app.route('/api/academic', academicRoutes)
app.route('/api/admissions', admissionRoutes)
app.route('/api/catalogs', catalogRoutes)
app.route('/api/committees', committeeRoutes)
app.route('/api/coexistence', coexistenceRoutes)
app.route('/api/communications', communicationRoutes)
app.route('/api/consents', consentRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/enrollment-forms', enrollmentFormRoutes)
app.route('/api/enrollments', enrollmentRoutes)
app.route('/api/enrollments', enrollmentNoveltyRoutes)
app.route('/api/finance', financeRoutes)
app.route('/api/navigation', navigationRoutes)
app.route('/api/official-documents', officialDocumentRoutes)
app.route('/api/official-reports', officialReportRoutes)
app.route('/api/piar', piarRoutes)
app.route('/api/portal', portalRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/students', studentRoutes)
app.route('/api/students', studentGuardianRoutes)
app.route('/api/users', userRoutes)

export default app
