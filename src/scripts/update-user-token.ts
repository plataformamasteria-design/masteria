
import dotenv from 'dotenv';
dotenv.config();

import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '../lib/crypto';

async function main() {
    const userId = '214d751e-f582-4303-aad4-c4ddb822eb8a';
    const newFacebookId = '10159578274245672';
    // User provided token from the request
    const rawToken = 'EAAKbEIlAv7oBQTie4AQt8Qc8EJtO9ZAZBhfAqnC7QFoQNRxuhQrl8hZCGTiI0XZAOrdtUZCXtpJurov77DPH2duXV9dSZB1O6VLZCf3NdjtYPgEZCYVx1GaEcTXcKAIBRDdmf4wnio6xCi09ThoqZAw7KvTaQ9K1SiCvPJGF9hmkqOkbZCiYqK5ZBmdG1rTSgZDZD';

    console.log(`🔐 Updating token for user ${userId}...`);

    const encryptedToken = encrypt(rawToken);

    try {
        const result = await db.update(users)
            .set({
                facebookAccessToken: encryptedToken,
                facebookId: newFacebookId
            })
            .where(eq(users.id, userId))
            .returning();

        if (result.length > 0 && result[0]) {
            console.log(`✅ Success! User ${result[0].name} updated.`);
            console.log(`ℹ️ Facebook ID set to: ${newFacebookId}`);
        } else {
            console.log(`❌ Error: User not found.`);
        }
    } catch (error) {
        console.error(`🔥 Database update failed:`, error);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
