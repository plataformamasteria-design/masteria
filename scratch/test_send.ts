import 'dotenv/config';
import { db } from '../src/lib/db';
import { contacts } from '../src/lib/db/schema';
import { evolutionApiService } from '../src/services/evolution-api.service';
import { eq, like } from 'drizzle-orm';

async function run() {
  const phone = '88920008007';
  const connectionId = '2fe3c4ff-4ac3-4d09-b6b9-1e15524b70e2'; // Camila Brandão
  
  // Find contact
  const matchedContacts = await db.select().from(contacts).where(like(contacts.phone, `%${phone}%`));
  console.log("Contacts matched:", matchedContacts.map(c => ({ id: c.id, phone: c.phone, name: c.name })));
  
  const text = "Olá! Este é um teste automatizado do MasterIA usando a conexão da Camila. O erro de criação de campanha foi resolvido.";
  console.log(`Sending message to ${phone} via connection ${connectionId}...`);
  
  try {
    const result = await evolutionApiService.sendMessage(connectionId, `55${phone}`, text);
    console.log("Success:", result);
  } catch (error: any) {
    console.error("Error:", error?.response?.data || error?.message || error);
  }
  
  process.exit(0);
}

run();
