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

  console.log('Ejecutando migración para PIAR e inclusión...')

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "piar_records" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"academic_year_id" uuid NOT NULL,"student_id" uuid NOT NULL,"enrollment_id" uuid,"diagnostic_info" text,"health_conditions" text,"disability_type" varchar(100),"disability_category" varchar(60),"has_piar" boolean DEFAULT true NOT NULL,"approval_date" date,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"status" varchar(30) DEFAULT 'active' NOT NULL,"is_confidential" boolean DEFAULT true NOT NULL)
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_piar_records_tenant_year" ON "piar_records" ("tenant_id","academic_year_id","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_piar_records_student" ON "piar_records" ("tenant_id","student_id","is_deleted")`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "piar_barriers" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"piar_record_id" uuid NOT NULL,"barrier_type" varchar(60) NOT NULL,"category" varchar(60) NOT NULL,"description" text NOT NULL,"severity" varchar(20) DEFAULT 'moderate' NOT NULL,"subject_id" uuid,"supports_provided" text,"supports_needed" text)
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_piar_barriers_record" ON "piar_barriers" ("tenant_id","piar_record_id","is_deleted")`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "piar_adjustments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"piar_record_id" uuid NOT NULL,"subject_id" uuid,"adjustment_type" varchar(60) NOT NULL,"description" text NOT NULL,"responsible_name" varchar(160),"start_date" date,"end_date" date,"evaluation_criteria" text,"status" varchar(30) DEFAULT 'active' NOT NULL,"effectiveness" varchar(20))
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_piar_adjustments_record" ON "piar_adjustments" ("tenant_id","piar_record_id","is_deleted")`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "piar_follow_ups" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"piar_record_id" uuid NOT NULL,"follow_up_date" date NOT NULL,"period_id" uuid,"progress" text NOT NULL,"difficulties" text,"adjustments_status" varchar(30) DEFAULT 'ongoing' NOT NULL,"recommendations" text,"performed_by" uuid,"performed_by_name" varchar(160),"agreements_with_family" text)
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_piar_follow_ups_record" ON "piar_follow_ups" ("tenant_id","piar_record_id","is_deleted")`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "piar_annual_reports" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"piar_record_id" uuid NOT NULL,"report_year" integer NOT NULL,"competencies_summary" text,"progress_description" text,"transition_recommendations" text,"next_grade_id" uuid,"next_academic_year_id" uuid,"submitted_by" uuid,"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,"status" varchar(30) DEFAULT 'draft' NOT NULL)
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_piar_annual_reports_record" ON "piar_annual_reports" ("tenant_id","piar_record_id","is_deleted")`)

  console.log('✓ Tablas PIAR creadas correctamente')
  await client.end()
  process.exit(0)
}

migrate().catch(async (error) => {
  console.error('Error en migración:', error)
  process.exit(1)
})
