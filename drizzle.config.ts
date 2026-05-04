
import { defineConfig } from 'drizzle-kit';

// No ambiente de build do Firebase (CI), as variáveis de ambiente do Secret Manager não estão disponíveis.
// Esta verificação evita que o processo de build falhe ao tentar aceder a process.env.DATABASE_URL.
// A conexão com o banco só é necessária para gerar e aplicar migrações, não para o build do Next.js.
if (process.env.NODE_ENV !== 'production' && !process.env.FIREBASE_APP_HOSTING_BUILD && !process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL não está definida. A geração de migrações será ignorada se esta variável for necessária.');
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle', 
  dialect: 'postgresql',
  dbCredentials: {
    // A URL pode estar indefinida durante o build em CI, e isso é aceitável.
    url: process.env.DATABASE_URL || '',
  },
  verbose: true,
  strict: true,
});
