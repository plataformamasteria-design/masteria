import { db } from './src/lib/db';
import { crmIntegrations, crmAccounts } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function checkKommoFields() {
    console.log('Fetching Kommo custom fields...');

    // Find Diegos company integration
    const [integration] = await db
        .select()
        .from(crmIntegrations)
        .where(eq(crmIntegrations.companyId, '7cb4773e-1fab-4699-b35d-c70d9f8d9149'))
        .limit(1);

    if (!integration) {
        console.log('Integration not found');
        process.exit(1);
    }

    const [account] = await db
        .select()
        .from(crmAccounts)
        .where(eq(crmAccounts.integrationId, integration.id))
        .limit(1);

    const token = decrypt(account.accessToken);
    const domain = account.domain;

    console.log(`Domain: ${domain}`);

    // Fetch lead custom fields
    const url = `${domain}/api/v4/leads/custom_fields`;
    console.log(`GET ${url}`);

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        console.error(`Error: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.error(text);
        process.exit(1);
    }

    const data = await response.json();
    console.log('\n--- LEAD CUSTOM FIELDS ---');
    const fields = data._embedded?.custom_fields || [];
    console.log(`Found ${fields.length} fields`);

    // Print first 50 for inspection
    fields.slice(0, 50).forEach((f: any) => {
        console.log(`  - ID: ${f.id} | Name: "${f.name}" | Type: ${f.type}`);
        if (f.enums) {
            const enums = Array.isArray(f.enums) ? f.enums.map((e: any) => e.value).join(', ') : '';
            if (enums) console.log(`    Enums: ${enums}`);
        }
    });

    console.log('\nDone.');
    process.exit(0);
}

checkKommoFields().catch(console.error);
