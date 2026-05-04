import { db } from '../src/lib/db';
import { marketingCredentials, connections } from '../src/lib/db/schema';
import { decrypt } from '../src/lib/crypto';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log("--- Marketing Credentials ---");
    const creds = await db.select().from(marketingCredentials);
    console.log("Count:", creds.length);

    console.log("--- Connections Pending Meta ---");
    const metaConns = await db.select().from(connections).where(eq(connections.connectionType, "meta_api"));
    console.log("Meta API Connections:", metaConns.length);

    for (const conn of metaConns) {
        console.log(`- ID: ${conn.id}, WABA: ${conn.wabaId}, Active: ${conn.isActive}`);
        if (conn.wabaId === 'PENDING_OAUTH' && conn.accessToken) {
            try {
                const token = decrypt(conn.accessToken);
                console.log("Token decriptado com sucesso. Testando fetch do Me...");
                const meRes = await fetch(`https://graph.facebook.com/v20.0/me?access_token=${token}`);
                const meData = await meRes.json();
                console.log("Me Response:", meData);

                console.log("Testando fetch de Businesses...");
                const bizRes = await fetch(`https://graph.facebook.com/v20.0/me/businesses?access_token=${token}`);
                const bizData = await bizRes.json();
                console.log("Biz Response:", bizData);

            } catch (e: any) {
                console.error("Erro na decriptação/fetch:", e.message);
            }
        }
    }

    process.exit(0);
}

main().catch(console.error);
