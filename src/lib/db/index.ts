// src/lib/db/index.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import '@/lib/server-init';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️ [DB] DATABASE_URL is not set in environment variables. Using a dummy URL to allow Next.js build. The application will not be able to connect to the database.');
}

const safeDatabaseUrl = DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';

// Configuração de connection pooling (Otimizado para Performance)
const connectionConfig = {
  max: 30, // Aumentado de 15 para 30 para suportar carga simultânea do App Router
  idle_timeout: 20, // 20s — evita reconexão excessiva sem segurar conexões ociosas
  connect_timeout: 15,
  prepare: false,
};

declare global {
  // eslint-disable-next-line no-var -- É necessário usar var para a declaração global
  var conn: ReturnType<typeof postgres> | undefined;
}

let conn: ReturnType<typeof postgres>;

if (process.env.NODE_ENV === 'production') {
  conn = postgres(safeDatabaseUrl, connectionConfig);
} else {
  if (!globalThis.conn) {
    globalThis.conn = postgres(safeDatabaseUrl, connectionConfig);
  }
  conn = globalThis.conn;
}

const db: PostgresJsDatabase<typeof schema> = drizzle(conn, { schema });

// Exporta a instância do DB e a conexão
export { db, conn };

// Exporta explicitamente todas as tabelas e tipos do schema para garantir a resolução de módulos
export * from './schema';
