// src/scripts/quick-webhook-check.ts
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

async function main() {
    const metaConnections = await db.select({
        id: connections.id,
        name: connections.config_name,
        type: connections.connectionType,
        appId: connections.appId,
        appSecret: connections.appSecret,
        status: connections.status
    }).from(connections).where(
        or(eq(connections.connectionType, 'meta_api'), eq(connections.connectionType, 'instagram'))
    );

    const results = [];
    for (const conn of metaConnections) {
        const hasAppId = !!conn.appId;
        const hasAppSecret = !!conn.appSecret;
        let secretValid = false;
        if (conn.appSecret) {
            const decrypted = decrypt(conn.appSecret);
            secretValid = !!decrypted && decrypted.length > 10;
        }
        results.push({
            name: conn.name,
            type: conn.type,
            status: conn.status,
            hasAppId,
            hasAppSecret,
            secretValid,
            issue: !hasAppId ? 'MISSING_APP_ID' : !hasAppSecret ? 'MISSING_APP_SECRET' : !secretValid ? 'INVALID_SECRET' : 'OK'
        });
    }
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
}
main().catch(console.error);
