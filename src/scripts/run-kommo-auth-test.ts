import { pushLeadToKommo } from '../services/kommo-lead-sync.service';

const COMPANY_ID = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';

async function run() {
    console.log(`Setting up basic lead test for company ${COMPANY_ID}`);

    const mockLeadId = `e2e-test-${Date.now()}`;
    const mockLeadData = {
        leadId: mockLeadId,
        contactName: 'Teste Auth Kommo',
        contactPhone: '+5511999998888',
        value: 100,
        title: 'Lead via Sync Test',
        source: 'Automated Auth Check',
        metadata: {}
    };

    console.log('Trigerring Sync...');
    try {
        const syncRes = await pushLeadToKommo(COMPANY_ID, mockLeadData as any);
        console.log(`Sync Result:`, syncRes);
    } catch (err) {
        console.error('Error during sync:', err);
    }
    process.exit(0);
}

run().catch(console.error);
