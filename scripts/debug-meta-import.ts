
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';

loadEnv();
loadEnv({ path: '.env.local' });

async function debugMetaImport() {
    console.log("🔍 Debugging Meta Import...");

    // Get the first user with a Facebook token (or specific one)
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, 'jeferson@masteriaoficial.com.br')) // Default test user
        .limit(1);

    if (!user || !user.facebookAccessToken) {
        console.error("❌ Test user not found or has no Facebook Token.");

        // Try any user
        const [anyUser] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
        if (anyUser && anyUser.facebookAccessToken) {
            console.log(`⚠️  Using alternative admin user: ${anyUser.email}`);
            await debugToken(anyUser.facebookAccessToken);
        } else {
            console.error("❌ No admin user with Facebook Token found.");
        }
        return;
    }

    console.log(`✅ User found: ${user.email}`);
    await debugToken(user.facebookAccessToken);
}

async function debugToken(token: string) {
    console.log("🔑 Token:", token.substring(0, 15) + "...");

    // 1. Check Permissions/Scopes
    console.log("\n📡 Checking Permissions...");
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`;
    // Note: Usually debug_token requires an app access token, but let's try self-debug or just skip to functionality

    // 2. Initial Pages Fetch
    console.log("\n📄 Fetching Pages (me/accounts)...");
    const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=name,access_token,instagram_business_account&access_token=${token}`;

    const res = await fetch(pagesUrl);
    if (!res.ok) {
        console.error("❌ Failed to fetch Pages:", await res.text());
        return;
    }

    const data = await res.json();
    console.log(`✅ API Response Status: ${res.status}`);
    console.log("📦 Raw Data (First 3 items):");
    console.dir(data.data.slice(0, 3), { depth: null });

    // 3. Analyze for Instagram
    console.log("\n🕵️‍♂️ Analyzing for Instagram Business Accounts...");
    let found = 0;
    data.data.forEach((page: any) => {
        if (page.instagram_business_account) {
            console.log(`   found! -> Page: "${page.name}" linked to IG: ${page.instagram_business_account.id}`);
            found++;
        } else {
            console.log(`   missing -> Page: "${page.name}" has NO IG linked.`);
        }
    });

    if (found === 0) {
        console.log("\n⚠️  No Instagram accounts found in the response.");
        console.log("   Potential Causes:");
        console.log("   1. Missing 'instagram_basic' permission.");
        console.log("   2. Missing 'pages_show_list' permission.");
        console.log("   3. Instagram account is not a 'Business' account or not linked to the Page.");
        console.log("   4. User needs to Re-Login to grant new scopes.");
    }
}

debugMetaImport().catch(console.error);
