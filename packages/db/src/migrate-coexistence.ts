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

  console.log('Ejecutando migración para convivencia escolar...')

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "coexistence_cases" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_by" uuid,
      "updated_by" uuid,
      "is_deleted" boolean DEFAULT false NOT NULL,
      "academic_year_id" uuid NOT NULL,
      "student_id" uuid NOT NULL,
      "reporter_user_id" uuid,
      "reporter_name" varchar(160),
      "incident_date" date NOT NULL,
      "reported_at" timestamp with time zone DEFAULT now() NOT NULL,
      "classification" varchar(20) NOT NULL,
      "category" varchar(100) NOT NULL,
      "description" text NOT NULL,
      "evidence" text,
      "immediate_actions" text,
      "status" varchar(30) DEFAULT 'open' NOT NULL,
      "priority" varchar(20) DEFAULT 'medium' NOT NULL,
      "assigned_to" uuid,
      "resolved_at" timestamp with time zone,
      "resolution_notes" text,
      "is_confidential" boolean DEFAULT false NOT NULL
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_coexistence_cases_tenant_year" ON "coexistence_cases" ("tenant_id","academic_year_id","incident_date","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_coexistence_cases_student" ON "coexistence_cases" ("tenant_id","student_id","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_coexistence_cases_status" ON "coexistence_cases" ("tenant_id","status","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_coexistence_cases_classification" ON "coexistence_cases" ("tenant_id","classification","is_deleted")`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "coexistence_involved_persons" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_by" uuid,
      "updated_by" uuid,
      "is_deleted" boolean DEFAULT false NOT NULL,
      "coexistence_case_id" uuid NOT NULL,
      "student_id" uuid,
      "person_name" varchar(160) NOT NULL,
      "role" varchar(40) NOT NULL,
      "grade_id" uuid,
      "group_id" uuid,
      "notes" text
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_coexistence_involved_case" ON "coexistence_involved_persons" ("tenant_id","coexistence_case_id","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_coexistence_involved_student" ON "coexistence_involved_persons" ("tenant_id","student_id","is_deleted")`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "coexistence_interventions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_by" uuid,
      "updated_by" uuid,
      "is_deleted" boolean DEFAULT false NOT NULL,
      "coexistence_case_id" uuid NOT NULL,
      "intervention_type" varchar(60) NOT NULL,
      "description" text NOT NULL,
      "performed_by" uuid,
      "performed_by_name" varchar(160),
      "intervention_date" date NOT NULL,
      "follow_up_date" date,
      "outcome" text,
      "status" varchar(30) DEFAULT 'completed' NOT NULL
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_coexistence_interventions_case" ON "coexistence_interventions" ("tenant_id","coexistence_case_id","is_deleted")`)

  console.log('✓ Tablas de convivencia creadas correctamente')
  await client.end()
  process.exit(0)
}

migrate().catch(async (error) => {
  console.error('Error en migración:', error)
  process.exit(1)
})
