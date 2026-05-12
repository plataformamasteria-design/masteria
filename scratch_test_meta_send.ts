import { db } from './src/lib/db';
import { messageTemplates, connections, contacts } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';
import { sendWhatsappTemplateMessage } from './src/lib/facebookApiService';

async function run() {
  try {
    const connectionId = '81994284-e8f0-4a2b-b17b-a9440a0d563a';
    
    const template = await db.query.messageTemplates.findFirst({
      where: eq(messageTemplates.name, 'lista2edn7')
    });
    
    const connection = await db.query.connections.findFirst({
      where: eq(connections.id, connectionId)
    });
    
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.phone, '5588920008007')
    });

    if (!template || !connection || !contact) throw new Error("Missing data");

    console.log("Sending using valid Meta Media ID...");
    
    const res = await sendWhatsappTemplateMessage({
        connection,
        to: contact.phone,
        templateName: template.name,
        languageCode: template.language,
        components: [
            {
                type: 'header',
                parameters: [
                    {
                        type: 'image',
                        image: { id: "2116803532226287" } // Using the ID we just uploaded!
                    }
                ]
            }
        ]
    });
    
    console.log("Result:", res);

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
