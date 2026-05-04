import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkSession() {
  const session = await db.query.connections.findFirst({
    where: eq(connections.id, '9ee5f5b8-166a-4ba3-9293-f1af0700bb7b'),
  });
  
  console.log('=== VERIFICAÇÃO DA SESSÃO CONECTADA ===');
  console.log('ID:', session?.id);
  console.log('Nome:', session?.config_name);
  console.log('Status:', session?.status);
  console.log('Telefone:', session?.phone);
  console.log('Ambiente:', session?.environment);
  console.log('Ativo:', session?.isActive);
  console.log('Última conexão:', session?.lastConnected);
  
  process.exit(0);
}
checkSession();
