import 'dotenv/config';
import { db } from '../src/lib/db';
import { contacts } from '../src/lib/db/schema';
import { evolutionApiService } from '../src/services/evolution-api.service';
import { like } from 'drizzle-orm';

async function run() {
  const phone = '88920008007';
  const connectionId = '4e13887e-fc7f-4b42-aac3-3dc163a8ca92'; // Guilherme Macedo (Open)
  
  const text = "Olá! Este é um teste automatizado do MasterIA usando a conexão do Guilherme Macedo. O envio via WhatsApp Não Oficial está funcionando perfeitamente!";
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
