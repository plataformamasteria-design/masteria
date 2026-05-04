// src/scripts/setup-kommo-integration.ts
// Setup script to register the Kommo CRM integration in MasterIA database
// Usage: npx tsx src/scripts/setup-kommo-integration.ts
//
// This script:
// 1. Finds the company
// 2. Creates/updates crm_integrations record
// 3. Creates crm_accounts record with encrypted access token
// 4. Creates crm_mappings record with pipeline/stage mappings

import { db } from '../lib/db';
import { crmIntegrations, crmAccounts, crmMappings, crmSyncLogs, companies, kanbanBoards } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt } from '../lib/crypto';

// ============================================
// KOMMO CREDENTIALS (from browser integration)
// ============================================

const KOMMO_DOMAIN = 'https://mapadevendas.kommo.com';
const KOMMO_ACCESS_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImQxOGQ0YTE0MDQ1NzJkNGVhNjI4OWEyNmQ3ZTFmNzE3ZTg1NDlhOGIxZTZkZDI2OGNmNDYxNDRjNmUzMDQ3ZjNhNTFlNTdmMDJmZDczNmQ2In0.eyJhdWQiOiI4Y2FlOTYzNC1kYjRjLTRlNzMtYmRkMC0yMGI0ZTIxZGMyYWUiLCJqdGkiOiJkMThkNGExNDA0NTcyZDRlYTYyODlhMjZkN2UxZjcxN2U4NTQ5YThiMWU2ZGQyNjhjZjQ2MTQ0YzZlMzA0N2YzYTUxZTU3ZjAyZmQ3MzZkNiIsImlhdCI6MTc3MjU0MzEzOSwibmJmIjoxNzcyNTQzMTM5LCJleHAiOjE3NzQ5MTUyMDAsInN1YiI6IjExNTA1OTE1IiwiZ3JhbnRfdHlwZSI6IiIsImFjY291bnRfaWQiOjMzMDk1NDY3LCJiYXNlX2RvbWFpbiI6ImtvbW1vLmNvbSIsInZlcnNpb24iOjIsInNjb3BlcyI6WyJwdXNoX25vdGlmaWNhdGlvbnMiLCJmaWxlcyIsImNybSIsImZpbGVzX2RlbGV0ZSIsIm5vdGlmaWNhdGlvbnMiXSwiaGFzaF91dWlkIjoiMmZmMDZhMDUtZjNkMy00Nzk5LTg5YzEtN2ZiNmI1ZmM2NmNhIiwiYXBpX2RvbWFpbiI6ImFwaS1nLmtvbW1vLmNvbSJ9.NKoxAcNkx21B5lIpgmyTRtq6X_S-WnWKcX2SzcfkSeNZZa857ogFXqKcNBUD5pxMdm6UOdfroFDgWn89fWVdhYYrZwuhJApdEhBrVrm2yIcd7IFLYw3DFm03EiS7xr4l7166f5cicQ4hHypvw1aH3HXLEaZRrfy7zVH604GiD2RMup9xfrHk4Oh8Yzwz9sUIDJS6C2Gd_c2gvBdlrI6NYvL56Sr30_2LRDIeWTMkQWe5u_jL-bc8ARmKKzhqlOaqgK5nabCuBlFnTqOfV64cLEEeHqG4iZeZVoIRA-lKecGwRvtb6p4j8eN0gvxkpirr06nrcKGwYvGIvGQgga3FSQ';

// Pipeline EDN [ATUAL]
const KOMMO_PIPELINE_ID = '12215780';

// Kommo pipeline stages (obtained from browser investigation)
const KOMMO_STAGES: Record<string, string> = {
    '94391812': 'ETAPA DE LEADS DE ENTRADA',
    '94391816': 'LEAD NOVO',
    '94391820': 'TENT CONTATO 01',
    '94561140': 'TENT CONTATO 02',
    '94561144': 'TENT CONTATO 03',
    '94561152': 'TENT CONTATO 04',
    '97979428': 'TENT CONTATO 05',
    '99096808': 'REAGENDAMENTO REUNIAO',
    '94561164': 'REUNIAO AGENDADA',
    '94561160': 'NEGOCIACAO',
};

async function main() {
    console.log('🔧 Setting up Kommo CRM integration...\n');

    // 1. Find the company
    const allCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies);
    console.log(`📋 Found ${allCompanies.length} companies:`);
    allCompanies.forEach(c => console.log(`   - ${c.id}: ${c.name}`));

    if (allCompanies.length === 0) {
        console.error('❌ No companies found in database!');
        process.exit(1);
    }

    // Use the first company (or specify one)
    const companyId = allCompanies[0].id;
    console.log(`\n✅ Using company: ${allCompanies[0].name} (${companyId})`);

    // 2. Check for existing Kommo integration
    const [existingIntegration] = await db
        .select()
        .from(crmIntegrations)
        .where(and(
            eq(crmIntegrations.companyId, companyId),
            eq(crmIntegrations.provider, 'kommo')
        ));

    let integrationId: string;

    if (existingIntegration) {
        console.log(`\n⚠️  Existing Kommo integration found: ${existingIntegration.id} (status: ${existingIntegration.status})`);
        // Update to connected
        await db.update(crmIntegrations)
            .set({ status: 'connected', updatedAt: new Date() })
            .where(eq(crmIntegrations.id, existingIntegration.id));
        // Delete old accounts
        await db.delete(crmAccounts).where(eq(crmAccounts.integrationId, existingIntegration.id));
        integrationId = existingIntegration.id;
        console.log('   Updated to connected and cleared old credentials');
    } else {
        const [newIntegration] = await db.insert(crmIntegrations).values({
            companyId,
            provider: 'kommo',
            status: 'connected',
        }).returning();
        integrationId = newIntegration.id;
        console.log(`\n✅ Created new Kommo integration: ${integrationId}`);
    }

    // 3. Insert encrypted credentials
    const encryptedToken = encrypt(KOMMO_ACCESS_TOKEN);
    await db.insert(crmAccounts).values({
        integrationId,
        domain: KOMMO_DOMAIN,
        authType: 'token',
        accessToken: encryptedToken,
    });
    console.log(`✅ Credentials saved (token encrypted, ${encryptedToken.length} chars)`);

    // 4. Find the default Kanban board for this company
    const boards = await db.select({ id: kanbanBoards.id, name: kanbanBoards.name, stages: kanbanBoards.stages })
        .from(kanbanBoards)
        .where(eq(kanbanBoards.companyId, companyId));

    console.log(`\n📋 Found ${boards.length} Kanban boards:`);
    boards.forEach(b => {
        const stages = b.stages as any[];
        console.log(`   - ${b.id}: ${b.name} (${stages.length} stages)`);
        stages.forEach((s: any) => console.log(`     · ${s.id}: ${s.title}`));
    });

    // 5. Create stage mappings for each board
    for (const board of boards) {
        const boardStages = board.stages as any[];

        // Auto-map MasterIA stages to Kommo stages by position
        const stageMap: Record<string, string> = {};
        const kommoStageIds = Object.keys(KOMMO_STAGES);

        boardStages.forEach((stage: any, index: number) => {
            if (index < kommoStageIds.length) {
                stageMap[stage.id] = kommoStageIds[index];
            }
        });

        // Check if mapping already exists
        const [existingMapping] = await db.select()
            .from(crmMappings)
            .where(eq(crmMappings.boardId, board.id));

        if (existingMapping) {
            await db.update(crmMappings)
                .set({ pipelineId: KOMMO_PIPELINE_ID, stageMap, integrationId })
                .where(eq(crmMappings.id, existingMapping.id));
            console.log(`\n✅ Updated stage mapping for board "${board.name}"`);
        } else {
            await db.insert(crmMappings).values({
                integrationId,
                boardId: board.id,
                pipelineId: KOMMO_PIPELINE_ID,
                stageMap,
            });
            console.log(`\n✅ Created stage mapping for board "${board.name}"`);
        }

        console.log('   Stage mapping:');
        Object.entries(stageMap).forEach(([masteriaId, kommoId]) => {
            const masteriaStage = boardStages.find((s: any) => s.id === masteriaId);
            console.log(`   ${masteriaStage?.title || masteriaId} → ${KOMMO_STAGES[kommoId] || kommoId}`);
        });
    }

    // 6. Log the setup
    await db.insert(crmSyncLogs).values({
        integrationId,
        type: 'setup',
        status: 'SUCCESS',
        payload: {
            domain: KOMMO_DOMAIN,
            pipelineId: KOMMO_PIPELINE_ID,
            boardsMapped: boards.length,
            setupDate: new Date().toISOString(),
        },
    });

    // 7. Verify connection by calling Kommo API
    console.log('\n🔍 Verifying Kommo API connection...');
    try {
        const response = await fetch(`${KOMMO_DOMAIN}/api/v4/account`, {
            headers: {
                'Authorization': `Bearer ${KOMMO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const account = await response.json();
            console.log(`✅ Kommo API connected! Account: ${account.name || account.subdomain} (ID: ${account.id})`);
        } else {
            console.warn(`⚠️  Kommo API returned ${response.status}: ${await response.text()}`);
        }
    } catch (error) {
        console.warn('⚠️  Could not verify Kommo API (may need to run in Railway):', error);
    }

    console.log('\n🎉 Kommo integration setup complete!');
    console.log(`   Integration ID: ${integrationId}`);
    console.log(`   Pipeline: EDN [ATUAL] (${KOMMO_PIPELINE_ID})`);
    console.log(`   Token expires: 31/03/2026`);

    process.exit(0);
}

main().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
});
