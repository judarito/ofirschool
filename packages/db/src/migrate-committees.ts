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

  console.log('Ejecutando migración para comités...')

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "committee_meetings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_by" uuid,
      "updated_by" uuid,
      "is_deleted" boolean DEFAULT false NOT NULL,
      "academic_year_id" uuid NOT NULL,
      "committee_type" varchar(40) NOT NULL,
      "meeting_date" date NOT NULL,
      "title" varchar(200) NOT NULL,
      "objective" text,
      "call_to" text,
      "development" text,
      "conclusions" text,
      "meeting_number" integer NOT NULL,
      "status" varchar(30) DEFAULT 'draft' NOT NULL,
      "approved_at" timestamp with time zone,
      "approved_by" uuid
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_committee_meetings_tenant_year" ON "committee_meetings" ("tenant_id","academic_year_id","meeting_date","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_committee_meetings_type" ON "committee_meetings" ("tenant_id","committee_type","is_deleted")`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "committee_attendees" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_by" uuid,
      "updated_by" uuid,
      "is_deleted" boolean DEFAULT false NOT NULL,
      "committee_meeting_id" uuid NOT NULL,
      "user_id" uuid,
      "full_name" varchar(160) NOT NULL,
      "role" varchar(80) NOT NULL,
      "attended" boolean DEFAULT true NOT NULL,
      "signature" text
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_committee_attendees_meeting" ON "committee_attendees" ("tenant_id","committee_meeting_id","is_deleted")`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "committee_decisions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_by" uuid,
      "updated_by" uuid,
      "is_deleted" boolean DEFAULT false NOT NULL,
      "committee_meeting_id" uuid NOT NULL,
      "student_id" uuid,
      "enrollment_id" uuid,
      "decision_type" varchar(40) NOT NULL,
      "description" text NOT NULL,
      "decision" varchar(30) NOT NULL,
      "justification" text,
      "voted_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "result_score" numeric(5, 2)
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_committee_decisions_meeting" ON "committee_decisions" ("tenant_id","committee_meeting_id","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_committee_decisions_student" ON "committee_decisions" ("tenant_id","student_id","is_deleted")`)

  console.log('✓ Tablas de comités creadas correctamente')
  await client.end()
  process.exit(0)
}

migrate().catch(async (error) => {
  console.error('Error en migración:', error)
  process.exit(1)
})
