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

  console.log('Ejecutando migración manual para data_processors...')

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "data_processors" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "tenant_id" uuid NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_by" uuid,
      "updated_by" uuid,
      "is_deleted" boolean DEFAULT false NOT NULL,
      "name" varchar(200) NOT NULL,
      "business_name" varchar(200),
      "nit" varchar(20),
      "country" varchar(100) NOT NULL,
      "purpose" text NOT NULL,
      "data_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
      "contact_email" varchar(200),
      "contact_phone" varchar(40),
      "has_data_processing_agreement" boolean DEFAULT false NOT NULL,
      "agreement_signed_at" timestamp with time zone,
      "agreement_document_url" varchar(500),
      "notes" text,
      "is_active" boolean DEFAULT true NOT NULL
    )
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_data_processors_tenant" 
    ON "data_processors" USING btree ("tenant_id","is_deleted")
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_data_processors_active" 
    ON "data_processors" USING btree ("tenant_id","is_active","is_deleted")
  `)

  console.log('✓ Tabla data_processors creada correctamente')
  await client.end()
  process.exit(0)
}

migrate().catch(async (error) => {
  console.error('Error en migración:', error)
  process.exit(1)
})
