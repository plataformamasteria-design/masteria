import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './src/lib/crypto';

async function main() {
    const conn = await db.query.connections.findFirst({
        where: eq(connections.phoneNumberId, '1098490746688494')
    });
    
    if (conn) {
        const token = decrypt(conn.accessToken);
        
        const url2 = `https://graph.facebook.com/v21.0/${conn.phoneNumberId}?access_token=${token}`;
        const res2 = await fetch(url2);
        const data2 = await res2.json();
        console.log("Phone Number Response:", JSON.stringify(data2, null, 2));
    }
}

main().catch(console.error).finally(() => process.exit(0));
