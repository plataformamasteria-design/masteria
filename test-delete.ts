import fs from 'fs';
import * as dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const { sessionService } = require('./src/services/session/session.service');

async function main() {
    try {
        console.log('Tentando deletar...');
        const res = await sessionService.deleteSession('26c20a74-01d0-44e8-b2c8-4af5f3146ca1', '71f0ab13-6f3a-4549-8324-ec35b5174b88');
        console.log('Resultado:', res);
    } catch(e) {
        console.log('Erro fatal:', e);
    }
    process.exit(0);
}
main();
