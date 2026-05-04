// src/lib/db/index.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import '@/lib/server-init';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // Lança um erro claro se a variável de ambiente não estiver definida em runtime.
  throw new Error('DATABASE_URL is not set in environment variables. The application cannot connect to the database.');
}

// Configuração de connection pooling (Otimizado para Performance)
const connectionConfig = {
  max: 15, // Reduzido de 50 para 15 para evitar estouro de limite no Neon Free Tier
  idle_timeout: 20, // 20s — evita reconexão excessiva sem segurar conexões ociosas
  connect_timeout: 5,
  prepare: false,
};

declare global {
  // eslint-disable-next-line no-var -- É necessário usar var para a declaração global
  var conn: ReturnType<typeof postgres> | undefined;
}

let conn: ReturnType<typeof postgres>;

if (process.env.NODE_ENV === 'production') {
  conn = postgres(DATABASE_URL, connectionConfig);
} else {
  if (!globalThis.conn) {
    globalThis.conn = postgres(DATABASE_URL, connectionConfig);
  }
  conn = globalThis.conn;
}

const db: PostgresJsDatabase<typeof schema> = drizzle(conn, { schema });

// Exporta a instância do DB e a conexão
export { db, conn };

// Exporta explicitamente todas as tabelas e tipos do schema para garantir a resolução de módulos
export * from './schema';
