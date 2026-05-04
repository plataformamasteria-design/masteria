import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const COMPANY_ID = '682b91ea-15ee-42da-8855-70309b237008';

async function createTestSession() {
  console.log('=== CRIANDO SESSÃO PARA TESTE E2E ===');
  console.log('Company ID:', COMPANY_ID);
  console.log('');
  
  // First check existing sessions
  const existing = await db.query.connections.findMany({
    where: eq(connections.connectionType, 'baileys'),
  });
  
  console.log('Sessões existentes:', existing.length);
  for (const s of existing) {
    console.log('  -', s.config_name, '|', s.status, '|', s.environment);
  }
  console.log('');
  
  // Create session in database
  const [session] = await db.insert(connections).values({
    companyId: COMPANY_ID,
    config_name: 'TESTE-E2E-QRCODE',
    connectionType: 'baileys',
    status: 'connecting',
    isActive: true,
    environment: 'production', // Default
  }).returning();
  
  console.log('✅ Sessão criada no banco:');
  console.log('   ID:', session.id);
  console.log('   Nome:', session.config_name);
  console.log('   Status:', session.status);
  console.log('   Environment:', session.environment);
  console.log('');
  console.log('🎯 Para ver o QR Code, acesse:');
  console.log('   http://localhost:5000/whatsapp-sessoes');
  console.log('   E clique em Conectar na sessão criada.');
  console.log('');
  
  process.exit(0);
}

createTestSession();
