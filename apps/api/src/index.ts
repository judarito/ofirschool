import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { contextMiddleware } from './middleware/context'
import { errorHandler } from './middleware/error-handler'
import { authRoutes } from './routes/auth'
import { academicRoutes } from './routes/academic'
import { dashboardRoutes } from './routes/dashboard'
import { enrollmentFormRoutes } from './routes/enrollment-forms'
import { enrollmentRoutes } from './routes/enrollments'
import { healthRoutes } from './routes/health'
import { navigationRoutes } from './routes/navigation'
import { publicAdmissionRoutes } from './routes/public-admissions'
import { admissionRoutes } from './routes/admissions'
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
app.route('/api/public', publicAdmissionRoutes)
app.route('/api/academic', academicRoutes)
app.route('/api/admissions', admissionRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/enrollment-forms', enrollmentFormRoutes)
app.route('/api/enrollments', enrollmentRoutes)
app.route('/api/navigation', navigationRoutes)
app.route('/api/students', studentRoutes)
app.route('/api/users', userRoutes)

export default app
