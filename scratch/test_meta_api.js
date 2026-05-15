const { Client } = require('pg');
const fetch = require('node-fetch');

const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
        const res = await client.query("SELECT access_token, phone_number_id FROM connections WHERE company_id = $1 AND connection_type = 'meta_api'", [companyId]);
        const conn = res.rows[0];
        
        console.log("Token:", conn.access_token.substring(0, 15) + "...");
        
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: "5588920008007",
            type: "text",
            text: { preview_url: false, body: "Teste manual" }
        };
        
        const response = await fetch(`https://graph.facebook.com/v20.0/${conn.phone_number_id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${conn.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('ERRO:', e.message);
    } finally {
        await client.end();
    }
});
