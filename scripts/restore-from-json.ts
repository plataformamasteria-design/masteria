import { db } from '../src/lib/db';
import { connections, contacts, companies } from '../src/lib/db/schema';
import fs from 'fs';
import path from 'path';

async function restoreData() {
  console.log('🔄 Starting data restoration...');
  
  const companyIds = new Set<string>();
  let connectionsData: any[] = [];
  let contactsData: any[] = [];

  // 1. Read and Parse Data Files
  try {
    // --- Connections ---
    const connectionsPath = path.resolve(process.cwd(), 'connections_all.json');
    if (fs.existsSync(connectionsPath)) {
      connectionsData = JSON.parse(fs.readFileSync(connectionsPath, 'utf-8'));
      connectionsData.forEach((c: any) => {
        if (c.companyId) companyIds.add(c.companyId);
      });
    }

    // --- Contacts ---
    const contactsPath = path.resolve(process.cwd(), 'contact_check.json');
    if (fs.existsSync(contactsPath)) {
      console.log('📄 Reading contact_check.json...');
      const rawContent = fs.readFileSync(contactsPath, 'utf16le');
      
      // Attempt to extract the array content using regex [ ... ]
      // This ignores any prefixes or suffixes
      const match = rawContent.match(/\[[\s\S]*\]/);
      
      if (match) {
        let jsObjStr = match[0];
        try {
          const parser = new Function(`return ${jsObjStr};`);
          contactsData = parser();
          
          if (Array.isArray(contactsData)) {
            contactsData.forEach((c: any) => {
               if (c.companyId) companyIds.add(c.companyId);
            });
          }
        } catch (e) {
          console.error('❌ Failed to parse extracted contacts object:', e);
        }
      } else {
        console.error('❌ Could not find array [...] in contact_check.json');
      }
    }
  } catch (err) {
    console.error('❌ Error reading files:', err);
    return;
  }

  // 2. Restore Companies
  console.log(`🏢 Found ${companyIds.size} unique companies. Restoring...`);
  for (const companyId of companyIds) {
    try {
      await db.insert(companies).values({
        id: companyId,
        name: `Restored Company ${companyId.substring(0, 8)}`,
        plan: 'free',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).onConflictDoNothing();
    } catch (err) {
      console.error(`   ⚠️ Failed to restore company ${companyId}:`, err);
    }
  }

  // 3. Restore Connections
  if (connectionsData.length > 0) {
    console.log(`🔌 Restoring ${connectionsData.length} connections...`);
    let count = 0;
    for (const conn of connectionsData) {
      const configName = conn.config_name || conn.configName || 'default_config';
      
      const insertData = {
        id: conn.id,
        companyId: conn.companyId,
        config_name: configName,
        connectionType: conn.connectionType,
        wabaId: conn.wabaId,
        phoneNumberId: conn.phoneNumberId,
        appId: conn.appId,
        accessToken: conn.accessToken,
        webhookSecret: conn.webhookSecret,
        appSecret: conn.appSecret,
        sessionId: conn.sessionId,
        phone: conn.phone,
        qrCode: conn.qrCode,
        status: conn.status,
        lastConnected: conn.lastConnected ? new Date(conn.lastConnected) : null,
        isActive: conn.isActive,
        assignedPersonaId: conn.assignedPersonaId,
        environment: conn.environment,
        tokenType: conn.tokenType,
        tokenExpiresAt: conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt) : null,
        tokenLastRefreshed: conn.tokenLastRefreshed ? new Date(conn.tokenLastRefreshed) : null,
        tokenRefreshFailedAt: conn.tokenRefreshFailedAt ? new Date(conn.tokenRefreshFailedAt) : null,
        tokenRefreshError: conn.tokenRefreshError,
        createdAt: conn.createdAt ? new Date(conn.createdAt) : new Date(),
      };

      try {
        await db.insert(connections).values(insertData).onConflictDoNothing();
        count++;
      } catch (err: any) {
        // Retry logic: check inner cause for PostgresError code 23503 (FK violation)
        const cause = err.cause || err;
        if (cause.code === '23503' && cause.constraint_name === 'connections_assigned_persona_id_ai_personas_id_fk') {
           console.log(`   ⚠️ Retrying conn ${conn.id} without persona ID...`);
           insertData.assignedPersonaId = null;
           try {
             await db.insert(connections).values(insertData).onConflictDoNothing();
             count++;
             console.log(`   ✅ Recovered conn ${conn.id}`);
           } catch (retryErr) {
             console.error(`   ❌ Failed retry for conn ${conn.id}:`, retryErr);
           }
        } else {
           console.error(`   ⚠️ Failed conn ${conn.id}:`, cause.message || err);
        }
      }
    }
    console.log(`   ✅ Restored ${count} connections.`);
  }

  // 4. Restore Contacts
  if (contactsData.length > 0) {
    console.log(`busts Restoring ${contactsData.length} contacts...`);
    let count = 0;
    for (const contact of contactsData) {
      try {
        await db.insert(contacts).values({
          id: contact.id,
          companyId: contact.companyId,
          name: contact.name,
          whatsappName: contact.whatsappName,
          phone: contact.phone,
          email: contact.email,
          avatarUrl: contact.avatarUrl,
          status: contact.status,
          isGroup: contact.isGroup,
          notes: contact.notes,
          profileLastSyncedAt: contact.profileLastSyncedAt ? new Date(contact.profileLastSyncedAt) : null,
          addressStreet: contact.addressStreet,
          addressNumber: contact.addressNumber,
          addressComplement: contact.addressComplement,
          addressDistrict: contact.addressDistrict,
          addressCity: contact.addressCity,
          addressState: contact.addressState,
          addressZipCode: contact.addressZipCode,
          externalId: contact.externalId,
          externalProvider: contact.externalProvider,
          createdAt: contact.createdAt ? new Date(contact.createdAt) : new Date(),
          deletedAt: contact.deletedAt ? new Date(contact.deletedAt) : null
        }).onConflictDoNothing();
        count++;
      } catch (err) {
        console.error(`   ⚠️ Failed contact ${contact.id}:`, err);
      }
    }
    console.log(`   ✅ Restored ${count} contacts.`);
  }

  console.log('🎉 Data restoration finished!');
  process.exit(0);
}

restoreData();
