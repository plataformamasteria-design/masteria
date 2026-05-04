
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function verifyNeurolinguistics() {
  const conversationId = 'b5ba3a72-7601-4c9e-8157-22b32c775f18';
  
  console.log(`Verifying contact for conversation: ${conversationId}`);
  
  const result = await db.execute(sql`
    SELECT c.id, c.name, c.vak_profile, c.dominant_social_need, c.communication_pace
    FROM contacts c
    JOIN conversations conv ON c.id = conv.contact_id
    WHERE conv.id = ${conversationId};
  `);
  
  console.log('Contact Profile:', result);
  process.exit(0);
}

verifyNeurolinguistics();
