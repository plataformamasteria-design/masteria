import { db } from './src/lib/db/index.js';
import { contacts, conversations, messages } from './src/lib/db/schema.js';
import fs from 'fs';

async function backup() {
  console.log('Iniciando backup das tabelas críticas...');
  
  const allContacts = await db.select().from(contacts);
  console.log(`- Contatos copiados: ${allContacts.length}`);
  
  const allConversations = await db.select().from(conversations);
  console.log(`- Conversas copiadas: ${allConversations.length}`);
  
  const allMessages = await db.select().from(messages);
  console.log(`- Mensagens copiadas: ${allMessages.length}`);
  
  const data = {
    contacts: allContacts,
    conversations: allConversations,
    messages: allMessages
  };
  
  fs.writeFileSync('db_backup.json', JSON.stringify(data, null, 2));
  console.log('Backup concluído com sucesso e salvo em db_backup.json');
  process.exit(0);
}

backup().catch(console.error);
