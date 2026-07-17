import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { sendUnifiedMessage } from './services/unified-message-sender.service';

async function run() {
  console.log('Testing unified sender...');
  try {
    const result = await sendUnifiedMessage({
      provider: 'openai' as any,
      connectionId: '55ca15f2-ae03-4ce8-bb99-a46d2fd6f60e', // Henrique Sartori
      to: '5588920008007',
      message: '',
      mediaUrl: 'https://masteria-temporario.up.railway.app/api/storage/neon?key=tenants%2F71f0ab13-6f3a-4549-8324-ec35b5174b88%2Fagent-library%2Fai_agent_1777482851759%2F6fcfb912-3259-4da3-a7ce-86b781b01992.pdf',
      mediaType: 'document',
      mediaFileName: 'CATÁLOGO SARTORI - Atualizado.pdf'
    });
    console.log('Result:', result);
  } catch(e) {
    console.error('Error:', e);
  }
  process.exit(0);
}
run();
