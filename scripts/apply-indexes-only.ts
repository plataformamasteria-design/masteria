#!/usr/bin/env tsx

import { db, conn } from '../src/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Script para aplicar apenas os índices compostos sem recriar tipos/tabelas
 */

const indexes = [
  // Messages indexes
  `CREATE INDEX IF NOT EXISTS messages_company_sent_at_idx ON messages (company_id, sent_at DESC) WHERE company_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS messages_company_conversation_idx ON messages (company_id, conversation_id) WHERE company_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS messages_company_status_idx ON messages (company_id, status) WHERE company_id IS NOT NULL AND status IS NOT NULL`,
  
  // Contacts indexes
  `CREATE INDEX IF NOT EXISTS contacts_company_status_idx ON contacts (company_id, status) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS contacts_company_created_at_idx ON contacts (company_id, created_at DESC) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS contacts_company_phone_idx ON contacts (company_id, phone) WHERE deleted_at IS NULL`,
  
  // Conversations indexes
  `CREATE INDEX IF NOT EXISTS conversations_company_status_idx ON conversations (company_id, status) WHERE archived_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS conversations_company_last_message_at_idx ON conversations (company_id, last_message_at DESC) WHERE archived_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS conversations_company_updated_at_idx ON conversations (company_id, updated_at DESC) WHERE archived_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS conversations_company_contact_idx ON conversations (company_id, contact_id) WHERE archived_at IS NULL`,
  
  // Campaigns indexes
  `CREATE INDEX IF NOT EXISTS campaigns_company_status_idx ON campaigns (company_id, status)`,
  `CREATE INDEX IF NOT EXISTS campaigns_company_created_at_idx ON campaigns (company_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS campaigns_company_channel_status_idx ON campaigns (company_id, channel, status)`,
  
  // Connections indexes
  `CREATE INDEX IF NOT EXISTS connections_company_status_idx ON connections (company_id, status)`,
  `CREATE INDEX IF NOT EXISTS connections_company_active_idx ON connections (company_id, is_active) WHERE is_active = true`,
  `CREATE INDEX IF NOT EXISTS connections_company_type_idx ON connections (company_id, connection_type)`,
  
  // Automation Rules indexes
  `CREATE INDEX IF NOT EXISTS automation_rules_company_active_idx ON automation_rules (company_id, is_active) WHERE is_active = true`,
  `CREATE INDEX IF NOT EXISTS automation_rules_company_trigger_idx ON automation_rules (company_id, trigger_event)`,
  
  // Automation Logs indexes
  `CREATE INDEX IF NOT EXISTS automation_logs_company_created_at_idx ON automation_logs (company_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS automation_logs_company_rule_idx ON automation_logs (company_id, rule_id) WHERE rule_id IS NOT NULL`,
  
  // Kanban Leads indexes
  `CREATE INDEX IF NOT EXISTS kanban_leads_company_board_idx ON kanban_leads (company_id, board_id)`,
  `CREATE INDEX IF NOT EXISTS kanban_leads_company_stage_idx ON kanban_leads (company_id, stage_id)`,
  `CREATE INDEX IF NOT EXISTS kanban_leads_company_contact_idx ON kanban_leads (company_id, contact_id)`,
  `CREATE INDEX IF NOT EXISTS kanban_leads_company_updated_at_idx ON kanban_leads (company_id, updated_at DESC)`,
  
  // Media Assets indexes
  `CREATE INDEX IF NOT EXISTS media_assets_company_type_idx ON media_assets (company_id, type)`,
  `CREATE INDEX IF NOT EXISTS media_assets_company_created_at_idx ON media_assets (company_id, created_at DESC)`,
  
  // Templates indexes
  `CREATE INDEX IF NOT EXISTS templates_company_status_idx ON templates (company_id, status)`,
  `CREATE INDEX IF NOT EXISTS templates_company_category_idx ON templates (company_id, category)`,
  `CREATE INDEX IF NOT EXISTS templates_company_waba_idx ON templates (company_id, waba_id)`,
];

async function applyIndexes() {
  console.log('🚀 Aplicando índices compostos...');
  console.log(`Total de índices: ${indexes.length}`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const indexSql of indexes) {
    try {
      await db.execute(sql.raw(indexSql));
      successCount++;
      console.log(`✅ ${indexSql.split('IF NOT EXISTS')[1]?.split(' ON')[0]?.trim() || 'Índice aplicado'}`);
    } catch (error: any) {
      // Ignorar erros de índice já existente
      if (error.message?.includes('already exists') || error.code === '42P07') {
        console.log(`ℹ️  Índice já existe: ${indexSql.split('IF NOT EXISTS')[1]?.split(' ON')[0]?.trim() || 'Índice'}`);
        successCount++;
      } else {
        errorCount++;
        console.error(`❌ Erro ao criar índice:`, error.message);
      }
    }
  }
  
  console.log(`\n📊 Resultado:`);
  console.log(`✅ Sucesso: ${successCount}`);
  console.log(`❌ Erros: ${errorCount}`);
  console.log(`\n🎉 Índices aplicados com sucesso!`);
}

applyIndexes()
  .then(() => {
    conn.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    conn.end();
    process.exit(1);
  });
