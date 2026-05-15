const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
        
        const contactRes = await client.query("SELECT id, name, phone FROM contacts WHERE company_id = $1 AND phone = '+5588920008007'", [companyId]);
        
        if (contactRes.rows.length === 0) {
            console.log("Contact not found!");
            return;
        }

        for (const contact of contactRes.rows) {
            console.log('Contact:', contact.id, contact.name);
            const convRes = await client.query("SELECT id, connection_id FROM conversations WHERE contact_id = $1", [contact.id]);
            
            for (const conv of convRes.rows) {
                 console.log('  Conv:', conv.id, 'ConnectionId:', conv.connection_id);
                 if (conv.connection_id) {
                     const connRes = await client.query("SELECT * FROM connections WHERE id = $1", [conv.connection_id]);
                     if (connRes.rows.length > 0) {
                         const c = connRes.rows[0];
                         console.log('    Connection:', c.name || c.connection_name || c.id, 'Type:', c.connection_type, c.meta_access_token ? 'HAS_TOKEN' : 'NO_TOKEN', 'PhoneId:', c.phone_number_id);
                     } else {
                         console.log('    Connection NOT FOUND IN DB');
                     }
                 }
            }
        }
        
    } catch (e) {
        console.error('ERRO:', e.message);
    } finally {
        await client.end();
    }
});
