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
  console.log('Ejecutando migración para documentos oficiales...')
  const client = postgres(databaseUrl)
  const db = drizzle(client)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "issued_documents" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"document_type" varchar(40) NOT NULL,"academic_year_id" uuid NOT NULL,"student_id" uuid,"enrollment_id" uuid,"consecutive_number" integer NOT NULL,"verification_code" varchar(40) NOT NULL,"file_name" varchar(255),"file_key" text,"issued_by_name" varchar(160) NOT NULL,"issued_at" timestamp with time zone DEFAULT now() NOT NULL,"valid_until" date,"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL)`)
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "uq_issued_documents_consecutive" ON "issued_documents" ("tenant_id","academic_year_id","document_type","consecutive_number")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_issued_documents_tenant_type" ON "issued_documents" ("tenant_id","document_type","academic_year_id","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_issued_documents_student" ON "issued_documents" ("tenant_id","student_id","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_issued_documents_verification" ON "issued_documents" ("tenant_id","verification_code","is_deleted")`)

  console.log('✓ Tabla issued_documents creada')
  await client.end()
  process.exit(0)
}

migrate().catch(async (error) => {
  console.error('Error en migración:', error)
  process.exit(1)
})
