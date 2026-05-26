import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { evolutionApiService } = require('./src/services/evolution-api.service');

async function main() {
    try {
        const id = '36bca632-4df0-49bb-899e-0a0ed53ccdff';
        
        console.log('--- Fetching Webhook for', id);
        const config = evolutionApiService.getConfig();
        const res = await fetch(`${config.url}/webhook/find/${id}`, {
            headers: { 'apikey': config.apiKey }
        });
        const text = await res.text();
        console.log('Webhook:', text);
        
        console.log('--- Fetching State for', id);
        const state = await evolutionApiService.getConnectionState(id);
        console.log('State:', JSON.stringify(state, null, 2));
    } catch(e) {
        console.log('Erro:', e);
    }
    process.exit(0);
}
main();
