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

  console.log('Ejecutando migración para campos colombianos...')

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  await db.execute(sql`
    ALTER TABLE "students" 
    ADD COLUMN IF NOT EXISTS "document_expedition_place" varchar(100),
    ADD COLUMN IF NOT EXISTS "eps" varchar(100),
    ADD COLUMN IF NOT EXISTS "sisben_level" varchar(20),
    ADD COLUMN IF NOT EXISTS "address" varchar(200),
    ADD COLUMN IF NOT EXISTS "city" varchar(100),
    ADD COLUMN IF NOT EXISTS "department" varchar(100)
  `)

  await db.execute(sql`
    ALTER TABLE "guardians" 
    ADD COLUMN IF NOT EXISTS "document_expedition_place" varchar(100),
    ADD COLUMN IF NOT EXISTS "address" varchar(200),
    ADD COLUMN IF NOT EXISTS "city" varchar(100),
    ADD COLUMN IF NOT EXISTS "department" varchar(100),
    ADD COLUMN IF NOT EXISTS "occupation" varchar(100)
  `)

  console.log('✓ Campos colombianos agregados correctamente')
  await client.end()
  process.exit(0)
}

migrate().catch(async (error) => {
  console.error('Error en migración:', error)
  process.exit(1)
})
