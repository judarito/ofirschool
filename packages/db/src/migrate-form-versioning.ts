import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está definida')
  }

  console.log('Ejecutando migración para formularios versionados por grado y sede...')

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  await db.execute(sql`
    ALTER TABLE "form_templates" 
    ADD COLUMN IF NOT EXISTS "grade_id" uuid,
    ADD COLUMN IF NOT EXISTS "branch_id" uuid
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_form_templates_tenant_grade" 
    ON "form_templates" USING btree ("tenant_id", "grade_id", "is_deleted")
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_form_templates_tenant_branch" 
    ON "form_templates" USING btree ("tenant_id", "branch_id", "is_deleted")
  `)

  console.log('✓ Campos grade_id y branch_id agregados a form_templates')
  await client.end()
  process.exit(0)
}

migrate().catch(async (error) => {
  console.error('Error en migración:', error)
  process.exit(1)
})
