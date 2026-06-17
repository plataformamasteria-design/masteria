import { db } from '../src/lib/db';
import { apiKeys } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const keys = await db.query.apiKeys.findFirst({
        where: eq(apiKeys.companyId, '7cb4773e-1fab-4699-b35d-c70d9f8d9149')
    });
    console.log('OpenAI Key configured:', !!keys?.openaiApiKey);
    console.log('Gemini Key configured:', !!keys?.geminiApiKey);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
