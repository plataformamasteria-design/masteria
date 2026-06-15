import { evolutionApiService } from './src/services/evolution-api.service';
import { db } from './src/lib/db/index';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function syncCamila() {
    const connId = '42a07358-b55b-43d3-95a5-5fb3aa2e3a61';
    console.log(`Buscando status da instancia ${connId} na Evolution API...`);
    
    try {
        const state = await evolutionApiService.getConnectionState(connId);
        console.log('State retornado:', JSON.stringify(state, null, 2));
        
        if (state?.instance?.state === 'not_found') {
            console.log('Instancia não encontrada. Tentando recriar...');
            const createRes = await evolutionApiService.createInstance(connId);
            console.log('Create Response:', createRes);
        } else if (state?.instance?.state !== 'open') {
            console.log('Instancia não está aberta. Tentando conectar e pegar o QR Code...');
            const connectRes = await evolutionApiService.getConnectionData(connId);
            console.log('Connect Response (base64 length):', connectRes?.base64?.length);
        } else {
            console.log('Instancia já está aberta!');
        }
        
        // Atualiza status no banco
        await db.update(connections).set({
            status: state?.instance?.state === 'open' ? 'connected' : 'connecting'
        }).where(eq(connections.id, connId));
        console.log('Status no banco atualizado.');
    } catch (e) {
        console.error('Erro ao sincronizar:', e);
    }
}

syncCamila().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
