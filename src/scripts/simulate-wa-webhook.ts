
import { db } from '../lib/db';
import { companies } from '../lib/db/schema';

async function main() {
    const [company] = await db.select().from(companies).limit(1);
    if (!company) throw new Error("No company found");

    const slug = company.webhookSlug;
    console.log(`Targeting Slug: ${slug}`);

    const payload = {
        object: "whatsapp_business_account",
        entry: [
            {
                id: "399691246563833", // WABA ID from User
                changes: [
                    {
                        value: {
                            messaging_product: "whatsapp",
                            metadata: {
                                display_phone_number: "1 1033",
                                phone_number_id: "861576807044352" // Phone ID from User
                            },
                            contacts: [{ profile: { name: "Test User" }, wa_id: "5511999999999" }],
                            messages: [
                                {
                                    from: "5511999999999",
                                    id: "wamid.TEST" + Date.now(),
                                    timestamp: Math.floor(Date.now() / 1000),
                                    text: { body: "Simulated Webhook Message " + new Date().toISOString() },
                                    type: "text"
                                }
                            ]
                        },
                        field: "messages"
                    }
                ]
            }
        ]
    };

    // Use localhost:3000 assuming the dev server is running there, 
    // OR use the Replit URL if localhost fails (but script runs in replit container so localhost should work if port is bound)
    // Actually, in Replit environment scripts running via `npx` might not reach the Next.js server on localhost if it's not bound to 0.0.0.0 or weird networking.
    // Let's try localhost:3000 first.

    // UPDATE: The user environment is Windows, but connected to Replit? 
    // The previous browser step failed on localhost:3000 but worked on REPLIT_DEV_URL.
    // I should generate the URL dynamically like in check-webhook-env.

    let baseUrl = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:3000';
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;

    const url = `${baseUrl}/api/webhooks/meta/${slug}`;
    console.log(`POSTing to: ${url}`);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text}`);

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

main().catch(console.error).finally(() => process.exit(0));
