
import { db } from '../lib/db';
import { connections } from '../lib/db/schema';
import { decrypt } from '../lib/crypto';

async function diagnose() {
    try {
        console.log("🔍 Buscando conexões...");
        const conns = await db.select().from(connections);

        for (const conn of conns) {
            console.log(`\n📡 Conexão: ${conn.config_name} (${conn.id})`);
            console.log(`   - Tipo: ${conn.connectionType}`);
            console.log(`   - Ativa: ${conn.isActive}`);
            console.log(`   - WABA ID: ${conn.wabaId}`);
            console.log(`   - Phone ID: ${conn.phoneNumberId}`);

            if (conn.accessToken) {
                try {
                    const token = decrypt(conn.accessToken);
                    console.log(`   - Token: Decriptado com sucesso (${token?.substring(0, 10)}...)`);

                    // Test Meta API
                    const url = `https://graph.facebook.com/v24.0/${conn.phoneNumberId || 'me'}?access_token=${token}`;
                    const start = Date.now();
                    const res = await fetch(url);
                    const duration = Date.now() - start;
                    console.log(`   - Meta API Response: ${res.status} (${duration}ms)`);
                    if (!res.ok) {
                        const err = await res.json();
                        console.log(`     ❌ Erro Meta: ${JSON.stringify(err)}`);
                    }
                } catch (e: any) {
                    console.log(`   - Token: ❌ Erro ao decriptar: ${e.message}`);
                }
            } else {
                console.log(`   - Token: ❌ Ausente`);
            }
        }
    } catch (e) {
        console.error("Erro no diagnóstico:", e);
    }
}

diagnose();
