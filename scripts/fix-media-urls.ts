import { db } from '../src/lib/db';
import { messages } from '../src/lib/db/schema';
import { like } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

async function run() {
    console.log("🚀 Iniciando correção de URLs de mídia (localhost -> masteria-temporario.up.railway.app)...");
    
    try {
        // Encontra quantas mensagens têm localhost na URL
        const brokenMessages = await db.select({
            id: messages.id,
            mediaUrl: messages.mediaUrl
        }).from(messages).where(like(messages.mediaUrl, '%localhost%'));
        
        console.log(`🔍 Encontradas ${brokenMessages.length} mensagens com URLs quebradas.`);
        
        if (brokenMessages.length > 0) {
            // Executa o update usando SQL replace nativo do Postgres para ser rápido
            const result = await db.execute(sql`
                UPDATE messages 
                SET "media_url" = REPLACE("media_url", 'http://localhost:3000', 'https://masteria-temporario.up.railway.app')
                WHERE "media_url" LIKE '%localhost%';
            `);
            
            console.log(`✅ Atualização concluída com sucesso no banco de dados.`);
        } else {
            console.log(`✨ Nenhuma mensagem com URL 'localhost' precisava ser corrigida.`);
        }
    } catch (error) {
        console.error("❌ Erro ao atualizar o banco de dados:", error);
    }
    
    process.exit(0);
}

run();
