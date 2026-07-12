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
  if (!databaseUrl) throw new Error('DATABASE_URL no está definida')

  console.log('Ejecutando migración para bandeja administrativa...')

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  await db.execute(sql`
    ALTER TABLE "admission_applications" 
    ADD COLUMN IF NOT EXISTS "assigned_to" uuid
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_admission_applications_assigned_to" 
    ON "admission_applications" USING btree ("tenant_id", "assigned_to", "status", "is_deleted")
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "admission_comments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_by" uuid,
      "updated_by" uuid,
      "is_deleted" boolean DEFAULT false NOT NULL,
      "admission_application_id" uuid NOT NULL,
      "author_id" uuid,
      "content" text NOT NULL,
      "is_internal_only" boolean DEFAULT true NOT NULL
    )
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_admission_comments_application" 
    ON "admission_comments" USING btree ("tenant_id", "admission_application_id", "created_at")
  `)

  console.log('✓ Columnas y tablas creadas correctamente')
  await client.end()
  process.exit(0)
}

migrate().catch(async (error) => {
  console.error('Error en migración:', error)
  process.exit(1)
})
