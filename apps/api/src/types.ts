import type { SessionUser } from '@ofir/shared'
import type { Database } from '@ofir/db'

export type Bindings = {
  DATABASE_URL: string
  JWT_SECRET: string
  ADMISSIONS_BUCKET: R2Bucket
  SUPERADMIN_EMAIL?: string
  SUPERADMIN_PASSWORD?: string
  DEFAULT_TENANT_ID?: string
}

export type AppContextVariables = {
  db: Database
  requestId: string
  tenantId: string
  user: SessionUser
}
