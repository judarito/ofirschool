import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { getEnv } from './env'

const databaseUrl = getEnv('DATABASE_URL')

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required')
}

const sql = postgres(databaseUrl, { ssl: 'require' })

async function migrate() {
  const migrationsDir = resolve(process.cwd(), 'drizzle')
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))

  // Create tracking table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `

  // Fetch already applied migrations
  const appliedRows = await sql`
    SELECT name FROM _migrations
  ` as { name: string }[]
  
  const appliedNames = new Set(appliedRows.map((r) => r.name))

  // If the tracking table was just created/empty, seed it with old migrations (0000 to 0007)
  // which are already in the database to prevent failing on column renames / missing columns
  if (appliedNames.size === 0) {
    for (const file of migrationFiles) {
      if (file < '0008_') {
        await sql`
          INSERT INTO _migrations (name) VALUES (${file})
        `
        appliedNames.add(file)
        console.log(`Marcada como ya aplicada (semilla): ${file}`)
      }
    }
  }

  for (const file of migrationFiles) {
    if (appliedNames.has(file)) {
      console.log(`Saltando migracion ya aplicada: ${file}`)
      continue
    }

    const migrationPath = resolve(migrationsDir, file)
    const migrationSql = await readFile(migrationPath, 'utf8')
    
    // Execute migration statements
    await sql.unsafe(migrationSql)
    
    // Record migration
    await sql`
      INSERT INTO _migrations (name) VALUES (${file})
    `
    console.log(`Migracion aplicada: ${file}`)
  }

  await sql.end()
}

migrate().catch(async (error) => {
  console.error(error)
  await sql.end()
  process.exit(1)
})
