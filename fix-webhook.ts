import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { evolutionApiService } = require('./src/services/evolution-api.service');

async function main() {
    try {
        const id = '36bca632-4df0-49bb-899e-0a0ed53ccdff';
        const webhookUrl = 'https://masteria.app/api/v1/webhooks/evolution';
        
        console.log(`Configurando webhook para ${id} -> ${webhookUrl}`);
        const res = await evolutionApiService.setWebhook(id, webhookUrl);
        console.log('Resultado:', res);
        
    } catch(e) {
        console.log('Erro:', e);
    }
    process.exit(0);
}
main();
