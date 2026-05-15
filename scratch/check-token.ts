import { db } from '../src/lib/db/index';
import { companies, connections } from '../src/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { decrypt } from '../src/lib/crypto';

async function main() {
    try {
        const company = await db.query.companies.findFirst({
            where: ilike(companies.name, '%Deivid Rodrigues%')
        });

        if (!company) {
            console.log("Company not found.");
            process.exit(1);
        }

        const conns = await db.query.connections.findMany({
            where: eq(connections.companyId, company.id)
        });

        const c = conns.find((x: any) => x.config_name === 'Teste' || x.name === 'Teste');

        if (!c) {
            console.log("Teste connection not found.");
            process.exit(1);
        }
        
        let decryptedToken = null;
        let decryptedAppSecret = null;
        try {
            decryptedToken = c.accessToken ? decrypt(c.accessToken) : null;
        } catch (e) {
            console.log("Error decrypting token", e.message);
        }
        try {
            decryptedAppSecret = c.appSecret ? decrypt(c.appSecret) : null;
        } catch (e) {
            console.log("Error decrypting appSecret", e.message);
        }

        console.log("DB App ID:", c.appId);
        console.log("User App ID: 906272602284373");
        console.log("DB WABA ID:", c.wabaId);
        console.log("User WABA ID: 738069496720828");
        console.log("DB Phone Number ID:", c.phoneNumberId);
        console.log("User Phone Number ID: 3017369158294074");
        console.log("-------------------");
        
        const userToken = "EAAM4QAiHYVUBRVwxDvy1sY0tuFy9alWvrloF9FSHC5X7Jn8VudsqSuGIGmkonHqKAgNZAsenSoQt0EC0NGWWf9KYhIyWTLa3wgGgfzyns5QkPpX54LHmicW6fgSZClRxCjBYn8SC1ZCHGoCmtZBtrDG90agrTFIeaBOVgPSsoolZBjKA4ZBFzCqvGJSufuWQZDZD";
        console.log("DB Token starts with:", decryptedToken?.substring(0, 15));
        console.log("User Token starts with:", userToken.substring(0, 15));
        console.log("Tokens Match?:", decryptedToken === userToken);
        console.log("-------------------");
        
        const userAppSecret = "da32dd60a4679c5b2d1837f79cb59a5e";
        console.log("DB App Secret starts with:", decryptedAppSecret?.substring(0, 5));
        console.log("User App Secret starts with:", userAppSecret.substring(0, 5));
        console.log("App Secrets Match?:", decryptedAppSecret === userAppSecret);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
