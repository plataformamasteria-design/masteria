const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require' });

client.connect().then(async () => {
    try {
        const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
        
        // 1. Encontrar o contato antigo (sem o 9) que a UI está usando (Deivid Rodrigues)
        const oldContactRes = await client.query("SELECT id FROM contacts WHERE company_id = $1 AND phone = '+558820008007'", [companyId]);
        
        if (oldContactRes.rows.length === 0) {
            console.log("Contato antigo não encontrado.");
            return;
        }
        const oldContactId = oldContactRes.rows[0].id;
        console.log("Contato antigo ID (sem 9):", oldContactId);

        // 2. Encontrar os contatos que já tem o 9 na mesma company (para não dar erro de duplicate)
        const duplicateRes = await client.query("SELECT id FROM contacts WHERE company_id = $1 AND phone = '+5588920008007'", [companyId]);
        
        if (duplicateRes.rows.length > 0) {
            console.log(`Encontrados ${duplicateRes.rows.length} contatos duplicados com o número correto. Removendo duplicatas vazias...`);
            for (const dup of duplicateRes.rows) {
                // Transferir qualquer conversa do contato duplicado para o contato original (oldContactId) ANTES de excluir
                // ou simplesmente excluir o contato duplicado se não tiver conversa
                await client.query("UPDATE conversations SET contact_id = $1 WHERE contact_id = $2", [oldContactId, dup.id]);
                await client.query("UPDATE whatsapp_delivery_reports SET contact_id = $1 WHERE contact_id = $2", [oldContactId, dup.id]);
                await client.query("DELETE FROM contacts WHERE id = $1", [dup.id]);
                console.log(`Duplicata ${dup.id} removida.`);
            }
        }

        // 3. Agora podemos atualizar o telefone do contato original com segurança
        const updated = await client.query("UPDATE contacts SET phone = '+5588920008007' WHERE id = $1 RETURNING *", [oldContactId]);
        console.log('✅ SUCESSO! Contato atualizado:', updated.rows[0]);
        
    } catch (e) {
        console.error('ERRO:', e.message);
    } finally {
        await client.end();
    }
});
