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

  console.log('Ejecutando migración para applicant_types en required_documents...')

  const client = postgres(databaseUrl)
  const db = drizzle(client)

  await db.execute(sql`
    ALTER TABLE "required_documents" 
    ADD COLUMN IF NOT EXISTS "applicant_types" jsonb DEFAULT '[]'::jsonb NOT NULL
  `)

  console.log('✓ Columna applicant_types agregada a required_documents')
  await client.end()
  process.exit(0)
}

migrate().catch(async (error) => {
  console.error('Error en migración:', error)
  process.exit(1)
})
