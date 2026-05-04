/**
 * PostgreSQL-backed Auth State for Baileys.
 * Implements the AuthenticationState interface using the existing Neon database.
 * Survives server restarts, deploys, and container recreation.
 *
 * Table: baileys_auth_store (created automatically on first use)
 * Schema: connection_id TEXT, data_type TEXT, data_id TEXT, data_value JSONB
 */

import { Pool } from 'pg';
import type { AuthenticationCreds, AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { proto } from '@whiskeysockets/baileys';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import { logger } from './utils/logger';

let pool: Pool;

export function initAuthPool(databaseUrl: string): void {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon') ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30000,
  });
}

/**
 * Ensure the auth store table exists.
 */
export async function ensureAuthTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS baileys_auth_store (
      connection_id TEXT NOT NULL,
      data_type TEXT NOT NULL,
      data_id TEXT NOT NULL DEFAULT '',
      data_value JSONB,
      PRIMARY KEY (connection_id, data_type, data_id)
    )
  `);
  logger.info('✅ baileys_auth_store table ensured');
}

/**
 * Read a single value from the store.
 */
async function readData(connectionId: string, type: string, id: string = ''): Promise<any | null> {
  const result = await pool.query(
    'SELECT data_value FROM baileys_auth_store WHERE connection_id = $1 AND data_type = $2 AND data_id = $3',
    [connectionId, type, id]
  );
  if (result.rows.length === 0) return null;
  return JSON.parse(JSON.stringify(result.rows[0].data_value), BufferJSON.reviver);
}

/**
 * Write a single value to the store.
 */
async function writeData(connectionId: string, type: string, id: string, value: any): Promise<void> {
  const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
  await pool.query(
    `INSERT INTO baileys_auth_store (connection_id, data_type, data_id, data_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (connection_id, data_type, data_id)
     DO UPDATE SET data_value = EXCLUDED.data_value`,
    [connectionId, type, id, serialized]
  );
}

/**
 * Delete value(s) from the store.
 */
async function removeData(connectionId: string, type: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map((_, i) => `$${i + 3}`).join(', ');
  await pool.query(
    `DELETE FROM baileys_auth_store WHERE connection_id = $1 AND data_type = $2 AND data_id IN (${placeholders})`,
    [connectionId, type, ...ids]
  );
}

/**
 * Delete ALL auth data for a connection.
 */
export async function clearAuthState(connectionId: string): Promise<void> {
  await pool.query('DELETE FROM baileys_auth_store WHERE connection_id = $1', [connectionId]);
  logger.info({ connectionId }, '🧹 Auth state cleared from PostgreSQL');
}

/**
 * Check if auth state exists for a connection.
 */
export async function hasAuthState(connectionId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM baileys_auth_store WHERE connection_id = $1 AND data_type = 'creds' LIMIT 1",
    [connectionId]
  );
  return result.rows.length > 0;
}

/**
 * Create a PostgreSQL-backed AuthenticationState for Baileys.
 * This is the equivalent of useMultiFileAuthState() but using the database.
 */
export async function usePostgresAuthState(connectionId: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  // Load or create credentials
  let creds: AuthenticationCreds = await readData(connectionId, 'creds');
  if (!creds) {
    creds = initAuthCreds();
    await writeData(connectionId, 'creds', '', creds);
    logger.info({ connectionId }, '🆕 New auth credentials created');
  }

  const saveCreds = async () => {
    await writeData(connectionId, 'creds', '', creds);
  };

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const data: { [id: string]: SignalDataTypeMap[T] } = {};
        for (const id of ids) {
          const value = await readData(connectionId, type, id);
          if (value) {
            // Handle proto deserialization for specific types
            if (type === 'app-state-sync-key' && value) {
              data[id] = proto.Message.AppStateSyncKeyData.fromObject(value) as any;
            } else {
              data[id] = value;
            }
          }
        }
        return data;
      },
      set: async (data: any) => {
        const tasks: Promise<void>[] = [];
        for (const category in data) {
          for (const id in data[category]) {
            const value = data[category][id];
            if (value) {
              tasks.push(writeData(connectionId, category, id, value));
            } else {
              tasks.push(removeData(connectionId, category, [id]));
            }
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  return { state, saveCreds };
}
