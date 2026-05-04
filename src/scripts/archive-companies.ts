
import { db } from '../lib/db';
import * as schema from '../lib/db/schema';
import { inArray } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const TARGET_IDS = [
  'c3e93263-bf3a-447d-a235-e1a5cd2c8cec',
  '1a386ca1-02ce-41dc-82b2-408bc4520143',
  '747cd644-328f-435b-b391-6fc919b9cbf2'
];

async function main() {
  console.log('Starting archive process for companies:', TARGET_IDS);
  const backup: Record<string, any[]> = {};

  // 1. Backup
  console.log('Backing up data...');
  for (const [key, value] of Object.entries(schema)) {
    // Basic check if it's a table with companyId
    if (value && typeof value === 'object' && 'companyId' in value) {
      try {
        // @ts-ignore
        const rows = await db.select().from(value).where(inArray(value.companyId, TARGET_IDS));
        if (rows.length > 0) {
          backup[key] = rows;
          console.log(`- Backed up ${rows.length} rows from ${key}`);
        }
      } catch (e) {
        // Ignore errors (e.g. if it's not a queryable table or other issues)
        // console.log(`Skipped ${key}: ${(e as Error).message}`);
      }
    }
  }

  // Save backup
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `archive-companies-${timestamp}.json`);
  
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup saved successfully to: ${backupPath}`);

  // 2. Delete
  console.log('\nDeleting companies and dependencies...');
  try {
    // Explicitly delete dependencies that might not cascade
    const tablesToDelete = [
      { name: 'users', table: schema.users },
      { name: 'contacts', table: schema.contacts },
      { name: 'connections', table: schema.connections },
      { name: 'apiKeys', table: schema.apiKeys },
      { name: 'webhooks', table: schema.webhooks },
      { name: 'tags', table: schema.tags },
      { name: 'contactLists', table: schema.contactLists },
      { name: 'kanbanBoards', table: schema.kanbanBoards },
      { name: 'mediaAssets', table: schema.mediaAssets },
      { name: 'templates', table: schema.templates },
      { name: 'messageTemplates', table: schema.messageTemplates },
      { name: 'smsGateways', table: schema.smsGateways },
      { name: 'campaigns', table: schema.campaigns },
      { name: 'aiCredentials', table: schema.aiCredentials },
      { name: 'aiPersonas', table: schema.aiPersonas },
      { name: 'notificationAgents', table: schema.notificationAgents },
      { name: 'webhookSubscriptions', table: schema.webhookSubscriptions },
      { name: 'customTemplateCategories', table: schema.customTemplateCategories },
      { name: 'cadenceDefinitions', table: schema.cadenceDefinitions },
      { name: 'alerts', table: schema.alerts },
      { name: 'alertRules', table: schema.alertRules },
      { name: 'alertSettings', table: schema.alertSettings },
      { name: 'features', table: schema.companyFeatureAccess }, // companyFeatureAccess
      { name: 'voiceAgents', table: schema.voiceAgents },
      { name: 'companyQuotas', table: schema.companyQuotas },
    ];

    for (const { name, table } of tablesToDelete) {
      console.log(`Deleting ${name}...`);
      // @ts-ignore
      const result = await db.delete(table).where(inArray(table.companyId, TARGET_IDS)).returning({ id: table.id });
      console.log(`Deleted ${result.length} records from ${name}.`);
    }

    console.log('Deleting companies...');
    const result = await db.delete(schema.companies).where(inArray(schema.companies.id, TARGET_IDS)).returning({ id: schema.companies.id });
    console.log(`Deleted ${result.length} companies.`);
    result.forEach(r => console.log(`- Deleted Company ID: ${r.id}`));

  } catch (error) {
    console.error('Error deleting companies:', error);
  }

  console.log('\nProcess completed.');
}

main().catch(console.error).finally(() => process.exit(0));
