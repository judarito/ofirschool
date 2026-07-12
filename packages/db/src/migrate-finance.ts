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
  console.log('Ejecutando migración para finanzas privadas...')
  const client = postgres(databaseUrl)
  const db = drizzle(client)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "fee_resolutions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"academic_year_id" uuid NOT NULL,"resolution_number" varchar(60) NOT NULL,"resolution_date" date NOT NULL,"issuing_entity" varchar(120) DEFAULT 'Secretaría de Educación' NOT NULL,"annual_fee" numeric(12,2) NOT NULL,"registration_fee_percentage" numeric(5,2) DEFAULT '10.00' NOT NULL,"max_installments" integer DEFAULT 10 NOT NULL,"notes" text,"status" varchar(30) DEFAULT 'active' NOT NULL,"approved_by" uuid,"approved_at" timestamp with time zone)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_fee_resolutions_tenant_year" ON "fee_resolutions" ("tenant_id","academic_year_id","is_deleted")`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "fee_items" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"fee_resolution_id" uuid NOT NULL,"item_type" varchar(30) NOT NULL,"name" varchar(160) NOT NULL,"amount" numeric(12,2) NOT NULL,"due_day" integer DEFAULT 5,"frequency" varchar(20) DEFAULT 'monthly' NOT NULL,"is_mandatory" boolean DEFAULT true NOT NULL,"sort_order" integer DEFAULT 0 NOT NULL,"description" text)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_fee_items_tenant_resolution" ON "fee_items" ("tenant_id","fee_resolution_id","is_deleted")`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "student_fee_assignments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"enrollment_id" uuid NOT NULL,"fee_item_id" uuid NOT NULL,"custom_amount" numeric(12,2),"discount_percentage" numeric(5,2),"discount_reason" varchar(200),"is_exempt" boolean DEFAULT false NOT NULL,"status" varchar(30) DEFAULT 'active' NOT NULL)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_student_fee_assignments_enrollment" ON "student_fee_assignments" ("tenant_id","enrollment_id","is_deleted")`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "payment_agreements" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"enrollment_id" uuid NOT NULL,"agreement_number" varchar(60) NOT NULL,"start_date" date NOT NULL,"end_date" date NOT NULL,"total_amount" numeric(12,2) NOT NULL,"installment_count" integer DEFAULT 1 NOT NULL,"installment_amount" numeric(12,2) NOT NULL,"status" varchar(30) DEFAULT 'active' NOT NULL,"notes" text,"authorized_by" uuid,"authorized_at" timestamp with time zone)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_payment_agreements_tenant_enrollment" ON "payment_agreements" ("tenant_id","enrollment_id","is_deleted")`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "financial_clearances" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"enrollment_id" uuid NOT NULL,"is_cleared" boolean DEFAULT false NOT NULL,"clearance_date" timestamp with time zone,"clearance_type" varchar(30) DEFAULT 'annual' NOT NULL,"observations" text,"authorized_by" uuid,"pending_amount" numeric(12,2) DEFAULT '0' NOT NULL)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_financial_clearances_tenant_enrollment" ON "financial_clearances" ("tenant_id","enrollment_id","is_deleted")`)

  console.log('✓ Tablas financieras creadas correctamente')
  await client.end()
  process.exit(0)
}

migrate().catch(async (error) => {
  console.error('Error en migración:', error)
  process.exit(1)
})
