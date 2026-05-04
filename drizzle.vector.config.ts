
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

if (!process.env.VECTOR_DB_URL) {
  console.warn('⚠️  VECTOR_DB_URL não está definida. A geração de migração para o banco vetorial será ignorada.');
}

export default defineConfig({
  schema: './src/lib/db/vector-schema.ts',
  out: './drizzle/vector', // Pasta dedicada para migrações do schema vetorial
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.VECTOR_DB_URL || '',
  },
  verbose: true,
  strict: true,
});
