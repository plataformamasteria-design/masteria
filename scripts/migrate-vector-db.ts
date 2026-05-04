import fs from 'fs'
import path from 'path'
import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const ENV_FILES = ['.env.local', '.env']

function ensureEnv() {
  for (const file of ENV_FILES) {
    const resolved = path.resolve(process.cwd(), file)
    if (fs.existsSync(resolved)) {
      loadEnv({ path: resolved })
    }
  }
}

async function migrateVectorDb() {
  ensureEnv()

  const vectorDbUrl = process.env.VECTOR_DB_URL

  if (!vectorDbUrl) {
    throw new Error('VECTOR_DB_URL is not defined. Cannot run vector migrations.')
  }

  const migrationsFolder = path.resolve(process.cwd(), 'drizzle', 'vector')

  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(`Vector migrations folder not found at: ${migrationsFolder}`)
  }

  const client = postgres(vectorDbUrl, {
    max: 1,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false,
  })

  try {
    const db = drizzle(client)
    await migrate(db, { migrationsFolder })
    console.log('✅ Vector database migrations applied successfully.')
  } finally {
    await client.end()
  }
}

migrateVectorDb().catch((error) => {
  console.error('❌ Failed to run vector database migrations:', error)
  process.exit(1)
})
