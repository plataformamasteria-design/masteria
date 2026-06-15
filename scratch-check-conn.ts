import { db } from './src/lib/db';
import { connections } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const conn = await db.query.connections.findFirst({
        where: eq(connections.phoneNumberId, '1098490746688494')
    });
    
    if (conn) {
        console.log(JSON.stringify(conn, null, 2));
    } else {
        console.log("Connection not found for Phone ID 1098490746688494");
    }
}

main().catch(console.error).finally(() => process.exit(0));
