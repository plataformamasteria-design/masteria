import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Pool } from 'pg';

async function main() {
  console.log("Starting contact merge process...");
  const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // 1. Get all foreign key tables referencing contacts.id
  const fkSql = `
    SELECT
        tc.table_name, 
        kcu.column_name
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'contacts' AND ccu.column_name = 'id';
  `;
  const fkRes = await pool.query(fkSql);
  const referencingTables = fkRes.rows;

  const duplicatesSql = `
    WITH normalized_contacts AS (
      SELECT 
        id, 
        name, 
        phone,
        created_at,
        REGEXP_REPLACE(phone, '[^0-9]', '', 'g') AS num
      FROM contacts 
      WHERE company_id = $1
    ),
    stripped_contacts AS (
      SELECT 
        id, name, phone, created_at, num,
        CASE 
          WHEN num LIKE '55%' THEN SUBSTRING(num FROM 3)
          ELSE num 
        END AS local_num
      FROM normalized_contacts
    )
    SELECT 
      local_num, 
      COUNT(*) as count, 
      ARRAY_AGG(id ORDER BY created_at ASC) as ids,
      ARRAY_AGG(phone ORDER BY created_at ASC) as phones
    FROM stripped_contacts
    WHERE local_num IS NOT NULL AND local_num != ''
    GROUP BY local_num
    HAVING COUNT(*) > 1
  `;

  const duplicatesResult = await pool.query(duplicatesSql, [companyId]);
  const duplicates = duplicatesResult.rows;

  console.log(`Found ${duplicates.length} sets of duplicated contacts.`);

  let totalMerged = 0;
  let totalDeletedContacts = 0;

  for (const group of duplicates) {
    const ids = group.ids;
    if (ids.length < 2) continue;

    const masterId = ids[0];
    const duplicateIds = ids.slice(1);

    console.log(`\nMerging ${duplicateIds.length} duplicates into master ${masterId} (phone: ${group.phones[0]})...`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Unify Conversations FIRST
      // This is the tricky part because we want only ONE conversation per connection
      for (const dupId of duplicateIds) {
        // Get all conversations for this duplicate
        const convsRes = await client.query('SELECT id, connection_id FROM conversations WHERE contact_id = $1', [dupId]);
        
        for (const conv of convsRes.rows) {
           const connId = conv.connection_id;
           // Check if master already has a conversation for this connection
           let masterConvId = null;
           if (connId) {
              const masterConvRes = await client.query('SELECT id FROM conversations WHERE contact_id = $1 AND connection_id = $2 ORDER BY created_at DESC LIMIT 1', [masterId, connId]);
              if (masterConvRes.rows.length > 0) {
                 masterConvId = masterConvRes.rows[0].id;
              }
           } else {
              const masterConvRes = await client.query('SELECT id FROM conversations WHERE contact_id = $1 AND connection_id IS NULL ORDER BY created_at DESC LIMIT 1', [masterId]);
              if (masterConvRes.rows.length > 0) {
                 masterConvId = masterConvRes.rows[0].id;
              }
           }

           if (masterConvId) {
              // Master already has a conversation for this connection. Move messages to it.
              await client.query('UPDATE messages SET conversation_id = $1 WHERE conversation_id = $2', [masterConvId, conv.id]);
              // Also update any references to conversation_id in other tables just in case, though there are few.
              const tablesWithConvId = [
                 { table: 'security_logs', col: 'conversation_id' },
                 { table: 'voice_calls', col: 'conversation_id' },
                 { table: 'cadence_enrollments', col: 'conversation_id' },
                 { table: 'ai_scheduled_meetings', col: 'conversation_id' }
              ];
              for (const tbl of tablesWithConvId) {
                  try {
                      await client.query(`UPDATE ${tbl.table} SET ${tbl.col} = $1 WHERE ${tbl.col} = $2`, [masterConvId, conv.id]);
                  } catch (e) {
                      // ignore if column/table doesn't exist or fails
                  }
              }

              // Archive the now empty duplicate conversation instead of deleting to avoid ON DELETE CASCADE seq scans
              await client.query("UPDATE conversations SET status = 'CLOSED', archived_at = NOW() WHERE id = $1", [conv.id]);
              console.log(`  - Merged messages from duplicate conversation ${conv.id} into master conversation ${masterConvId}`);
           } else {
              // Master doesn't have a conversation for this connection. Just change ownership.
              await client.query('UPDATE conversations SET contact_id = $1 WHERE id = $2', [masterId, conv.id]);
              console.log(`  - Reassigned conversation ${conv.id} to master contact`);
           }
        }
      }

      // 2. Update all other Foreign Keys
      // We will loop over each table that references contacts.id (except conversations and messages since we handled convs)
      for (const fk of referencingTables) {
         if (fk.table_name === 'conversations') continue;
         
         const isAssociationTable = fk.table_name === 'contacts_to_tags' || fk.table_name === 'contacts_to_contact_lists';
         
         console.log(`  - Processing table ${fk.table_name}.${fk.column_name}...`);
         try {
            if (isAssociationTable) {
               // For association tables, we use ON CONFLICT DO NOTHING by writing a safe insert/delete
               for (const dupId of duplicateIds) {
                  const items = await client.query(`SELECT * FROM ${fk.table_name} WHERE ${fk.column_name} = $1`, [dupId]);
                  for (const item of items.rows) {
                     // Get all column names to build the insert
                     const cols = Object.keys(item);
                     const vals = Object.values(item).map((v, i) => {
                         if (cols[i] === fk.column_name) return masterId;
                         return v;
                     });
                     
                     // Build UPSERT-like logic
                     const setValues = cols.map((c, i) => `$${i+1}`).join(', ');
                     const insertSql = `INSERT INTO ${fk.table_name} (${cols.join(', ')}) VALUES (${setValues}) ON CONFLICT DO NOTHING`;
                     await client.query(insertSql, vals);
                  }
                  // Delete old
                  await client.query(`DELETE FROM ${fk.table_name} WHERE ${fk.column_name} = $1`, [dupId]);
               }
            } else {
               // Normal tables, just update
               const ph = duplicateIds.map((_, i) => `$${i+2}`).join(', ');
               const updateSql = `UPDATE ${fk.table_name} SET ${fk.column_name} = $1 WHERE ${fk.column_name} IN (${ph})`;
               await client.query(updateSql, [masterId, ...duplicateIds]);
            }
         } catch (e) {
            console.error(`  - Warning: Failed to update ${fk.table_name}.${fk.column_name}`, e.message);
         }
      }

      // 3. Delete Duplicate Contacts (Soft Delete)
      const dupPh = duplicateIds.map((_, i) => `$${i+1}`).join(', ');
      await client.query(`UPDATE contacts SET deleted_at = NOW() WHERE id IN (${dupPh})`, duplicateIds);
      
      console.log(`  - Successfully deleted ${duplicateIds.length} duplicate contacts.`);
      
      await client.query('COMMIT');
      totalMerged++;
      totalDeletedContacts += duplicateIds.length;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  - Failed to merge group starting with ${masterId}:`, err.message);
    } finally {
      client.release();
    }
  }

  console.log(`\nMerge Complete! Successfully merged ${totalMerged} groups and deleted ${totalDeletedContacts} duplicated contacts.`);
  pool.end();
}

main().catch(console.error);
