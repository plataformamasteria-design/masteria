const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
    // Buscar a conversa para o contato correto
    const res = await client.query(`
        SELECT cv.id, c.phone, cv.company_id, cv.connection_id 
        FROM conversations cv
        JOIN contacts c ON cv.contact_id = c.id
        WHERE c.phone = '+5588920008007'
    `);
    console.log('Conversas para o número correto:', res.rows);
    
    // Inserir uma conversa nova se não existir, para a conexão 81994284-e8f0-4a2b-b17b-a9440a0d563a
    if (res.rows.length === 0) {
        const contactId = '87eaeaad-a2a1-42a7-b166-6eb409afd0db'; // O id do contato com +5588920008007
        const newConv = await client.query(`
            INSERT INTO conversations (company_id, contact_id, connection_id, status, last_message_at)
            VALUES ('7cb4773e-1fab-4699-b35d-c70d9f8d9149', $1, '81994284-e8f0-4a2b-b17b-a9440a0d563a', 'open', NOW())
            RETURNING id
        `, [contactId]);
        console.log('Nova conversa criada:', newConv.rows[0].id);
    }
    await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
