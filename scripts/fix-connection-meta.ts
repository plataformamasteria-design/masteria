
import { db } from '../src/lib/db';
import { connections } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '../src/lib/crypto';

async function fixConnection() {
  const CONNECTION_ID = '7732ca9e-6e14-4d7c-b846-be4a8f82e907';
  const API_VERSION = process.env.FACEBOOK_API_VERSION || 'v24.0';

  console.log(`Fixing connection ${CONNECTION_ID}...`);

  const [connection] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, CONNECTION_ID));

  if (!connection) {
    console.error('Connection not found');
    process.exit(1);
  }

  if (!connection.accessToken) {
    console.error('No access token found');
    process.exit(1);
  }

  const token = decrypt(connection.accessToken);
  if (!token) {
    console.error('Failed to decrypt token');
    process.exit(1);
  }

  console.log(`Token decrypted. Debugging token...`);

  try {
    // 1. Check Token User
    console.log('1. Checking /me...');
    const meRes = await fetch(`https://graph.facebook.com/${API_VERSION}/me?fields=id,name`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    console.log('/me Result:', JSON.stringify(meData, null, 2));

    if (meData.error) {
       console.error('Token is invalid!');
       process.exit(1);
     }

     // 1.5 Check Token Scopes
     console.log('1.5 Checking Token Scopes...');
     const debugRes = await fetch(`https://graph.facebook.com/${API_VERSION}/debug_token?input_token=${token}&access_token=${token}`);
     const debugData = await debugRes.json();
     console.log('Token Debug:', JSON.stringify(debugData, null, 2));

     // 2. List Phone Numbers for WABA
     const wabaId = connection.wabaId;
    if (wabaId) {
      console.log(`2. Listing phone numbers for WABA ${wabaId}...`);
      const wabaRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${wabaId}/phone_numbers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const wabaData = await wabaRes.json();
      console.log('WABA Phone Numbers:', JSON.stringify(wabaData, null, 2));
      
      // Check if our phone ID is in the list
      if (wabaData.data) {
         const found = wabaData.data.find((p: any) => p.id === connection.phoneNumberId);
         if (found) {
             console.log('✅ Phone ID found in WABA list!');
             console.log(`Found Phone Info: ${found.display_phone_number} (${found.verified_name})`);
             
             const phoneNumber = found.display_phone_number.replace(/\D/g, '');
              await db
               .update(connections)
               .set({
                 phone: phoneNumber,
                 isActive: true,
                 status: 'connected',
                 lastConnected: new Date(),
                 updatedAt: new Date(),
               })
               .where(eq(connections.id, CONNECTION_ID));
              console.log('Connection updated successfully!');
              process.exit(0);
         } else {
             console.warn('❌ Phone ID NOT found in WABA list. The ID might be wrong or from another WABA.');
         }
       } else if (wabaData.error) {
          console.warn('⚠️ API Error listing phones. Using fallback number provided by user.');
          // FALLBACK: User provided number 556237718276
          const phoneNumber = '556237718276';
          await db
            .update(connections)
            .set({
              phone: phoneNumber,
              isActive: true,
              status: 'connected',
              lastConnected: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(connections.id, CONNECTION_ID));
          console.log(`Connection FORCE updated with fallback phone: ${phoneNumber}`);
          process.exit(0);
       }
     } else {
         console.warn('No WABA ID in connection record.');
     }

    // 3. Try to access Phone ID directly again (just in case)
    /*
    const url = `https://graph.facebook.com/${API_VERSION}/${connection.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`;
    ...
    */

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  process.exit(0);
}

fixConnection();
