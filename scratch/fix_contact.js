const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
    // Buscar o contato
    const res = await client.query("SELECT id, name, phone FROM contacts WHERE phone LIKE '%8820008007%'");
    console.log('Contato atual:', res.rows);
    
    if (res.rows.length > 0) {
        // Atualizar o número de telefone para adicionar o 9
        const updated = await client.query("UPDATE contacts SET phone = '+5588920008007' WHERE id = $1 RETURNING *", [res.rows[0].id]);
        console.log('Contato atualizado:', updated.rows.map(r => ({id: r.id, phone: r.phone})));
    }
    await client.end();
}).catch(e => { console.error(e.message); process.exit(1); });
