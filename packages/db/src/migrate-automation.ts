import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

async function migrate() {
  const dbUrl = process.env.DATABASE_URL; if (!dbUrl) throw new Error('DATABASE_URL no definida')
  const client = postgres(dbUrl); const db = drizzle(client)
  console.log('Migrando triggers y alertas...')

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "notification_triggers" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"code" varchar(60) NOT NULL,"name" varchar(160) NOT NULL,"event_type" varchar(60) NOT NULL,"template_code" varchar(80),"channel" varchar(30) DEFAULT 'email' NOT NULL,"recipients" varchar(40) DEFAULT 'family' NOT NULL,"is_automatic" boolean DEFAULT true NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,"delay_minutes" integer DEFAULT 0)`)
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "uq_notification_triggers_tenant_code" ON "notification_triggers" ("tenant_id","code","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_notification_triggers_tenant_event" ON "notification_triggers" ("tenant_id","event_type","is_active","is_deleted")`)

  await db.execute(sql`CREATE TABLE IF NOT EXISTS "auto_alerts" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"tenant_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"created_by" uuid,"updated_by" uuid,"is_deleted" boolean DEFAULT false NOT NULL,"academic_year_id" uuid,"alert_type" varchar(60) NOT NULL,"name" varchar(160) NOT NULL,"entity_type" varchar(40) NOT NULL,"due_days_before" integer DEFAULT 7 NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"last_run_at" timestamp with time zone,"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL)`)
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "uq_auto_alerts_tenant_type" ON "auto_alerts" ("tenant_id","alert_type","academic_year_id","is_deleted")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_auto_alerts_tenant_active" ON "auto_alerts" ("tenant_id","is_active","is_deleted")`)

  console.log('✓ Tablas de automatización creadas'); await client.end(); process.exit(0)
}
migrate().catch(async (e) => { console.error(e); process.exit(1) })
