import { sessionService } from './src/services/session/session.service';

async function testCreate() {
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
    console.log('Testing createSession...');
    try {
        const result = await sessionService.createSession(companyId, 'Test Connection AI 2');
        console.log('Result:', result);
    } catch (e: any) {
        console.error('Fatal Error:', e);
    }
}

testCreate();
