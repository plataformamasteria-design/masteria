import { db } from '../src/lib/db/index';
import { companies, connections } from '../src/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { decrypt } from '../src/lib/crypto';

async function main() {
    try {
        const company = await db.query.companies.findFirst({
            where: ilike(companies.name, '%Deivid Rodrigues%')
        });

        const conns = await db.query.connections.findMany({
            where: eq(connections.companyId, company.id)
        });

        for (const c of conns) {
            console.log("Config Name:", c.config_name || c.name);
            console.log("ID:", c.id);
            let decryptedToken = null;
            let decryptedAppSecret = null;
            try {
                decryptedToken = c.accessToken ? decrypt(c.accessToken) : null;
            } catch (e) {}
            try {
                decryptedAppSecret = c.appSecret ? decrypt(c.appSecret) : null;
            } catch (e) {}

            console.log("DB App ID:", c.appId);
            console.log("DB WABA ID:", c.wabaId);
            console.log("DB Phone Number ID:", c.phoneNumberId);
            console.log("DB Token starts with:", decryptedToken?.substring(0, 15));
            console.log("DB App Secret starts with:", decryptedAppSecret?.substring(0, 5));
            console.log("-------------------");
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
