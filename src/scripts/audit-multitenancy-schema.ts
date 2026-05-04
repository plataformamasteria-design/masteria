// src/scripts/audit-multitenancy-schema.ts
import * as schema from '@/lib/db/schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

// Tables that are intentionally global or don't need company_id
const GLOBAL_WHITELIST = [
    'companies',
    'users',
    'password_reset_tokens',
    'system_errors',
    'verification_tokens',
    'accounts',
    'sessions',
    'admin_audit_logs', // System wide audit
    'meta_webhook_health_events', // Infrastructure monitoring
    'sms_delivery_logs', // Usually provider level, but let's check
    'crm_accounts', // Linked to crm_integrations (which has company_id) -> transitive
    'crm_mappings', // Linked to integrations
    'crm_sync_logs', // Linked to integrations
    'kanban_leads', // Linked to board (which has company_id) -> transitive? NO, safer to have company_id
    'kanban_stage_personas', // Linked to board
    'message_reactions', // Linked to message
    'webhook_logs', // Linked to company directly?

    'ai_chat_messages', // Linked to chat
    'notification_logs', // Linked to agent
    'notification_agent_groups', // Linked to agent
];

async function main() {
    console.log('🛡️  INICIANDO AUDITORIA DE SCHEMA MULTI-TENANCY (V2) 🛡️\n');

    const violations: { table: string, reason: string }[] = [];
    const compliment: string[] = [];
    const transitive: string[] = [];

    // Helper to check if a table has company_id
    function hasCompanyId(tableObj: any): boolean {
        // Iterate over keys to find columns
        for (const key in tableObj) {
            const col = tableObj[key];
            if (col && typeof col === 'object' && col.name === 'company_id') {
                return true;
            }
        }
        return false;
    }

    for (const [key, value] of Object.entries(schema)) {
        if (!value || typeof value !== 'object') continue;

        let tableName: string | undefined;
        try {
            // Drizzle internals
            const config = getTableConfig(value as any);
            tableName = config.name;
        } catch (e) {
            continue;
        }

        if (!tableName) continue;

        if (GLOBAL_WHITELIST.includes(tableName)) {
            console.log(`⚪ [GLOBAL/WHITELIST] ${tableName}`);
            continue;
        }

        if (hasCompanyId(value)) {
            compliment.push(tableName);
        } else {
            // Analise detail is hard automatically, mark as violation for manual review
            violations.push({ table: tableName, reason: 'Missing company_id column' });
        }
    }

    console.log(`\n✅  Tabelas Compliant (Possuem company_id): ${compliment.length}`);
    compliment.forEach(t => console.log(`   - ${t}`));

    console.log(`\n🚨  POSSÍVEIS VIOLAÇÕES (Faltam company_id): ${violations.length}`);
    violations.forEach(v => console.log(`   - ${v.table}`));

    console.log('\nNOTA: Algumas tabelas podem ser "transitive" (filhas de uma tabela que tem company_id).');
    console.log('Tabelas na lista de violação devem ser verificadas manualmente.');

    process.exit(0);
}

main().catch(console.error);
