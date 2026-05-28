import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function applyIndexes() {
  console.log('Aplicando índices plenos manualmente para resolver o gargalo de performance...');
  const statements = [
    // Contacts
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS contacts_company_status_full_idx ON contacts (company_id, status);`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS contacts_company_created_at_full_idx ON contacts (company_id, created_at DESC);`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS contacts_company_phone_full_idx ON contacts (company_id, phone);`,
    // Contacts_to_Contact_Lists
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS contacts_to_contact_lists_list_id_idx ON contacts_to_contact_lists (list_id);`,
    // Conversations
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_company_status_full_idx ON conversations (company_id, status);`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_company_last_msg_full_idx ON conversations (company_id, last_message_at DESC);`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_company_updated_at_full_idx ON conversations (company_id, updated_at DESC);`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_company_contact_full_idx ON conversations (company_id, contact_id);`,
    // Messages
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_company_sent_full_idx ON messages (company_id, sent_at DESC);`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_company_conversation_full_idx ON messages (company_id, conversation_id);`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_company_status_full_idx ON messages (company_id, status);`,
  ];

  for (const stmt of statements) {
    console.log(`Executing: ${stmt}`);
    try {
      await db.execute(sql.raw(stmt));
      console.log('Success.');
    } catch (error: any) {
      console.error(`Erro: ${error.message}`);
    }
  }
  console.log('Todos os índices aplicados.');
  process.exit(0);
}

applyIndexes();
