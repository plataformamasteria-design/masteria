
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { desc, isNotNull } from 'drizzle-orm';

// 1. ROBUST ENV LOADING
// Use __dirname equivalent for safe relative pathing
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

console.log(`\n📂 Script Context:`);
console.log(`   CWD: ${process.cwd()}`);
console.log(`   Env Path: ${envPath}`);

if (fs.existsSync(envPath)) {
    console.log(`   ✅ .env file found.`);
    const result = dotenv.config({ path: envPath });
    if (result.error) {
        console.error('   ❌ dotenv load error:', result.error);
    } else {
        console.log('   ✅ dotenv loaded successfully.');
    }
} else {
    console.error(`   ❌ .env file NOT found!`);
    // Try fallback to CWD
    const cwdEnv = path.resolve(process.cwd(), '.env');
    console.log(`   Trying CWD fallback: ${cwdEnv}`);
    dotenv.config({ path: cwdEnv });
}

// 2. VERIFY ENCRYPTION KEY BEFORE IMPORT
if (!process.env.ENCRYPTION_KEY) {
    console.error('\n❌ CRITICAL: ENCRYPTION_KEY is missing from process.env even after loading .env');
    console.log('   Keys loaded:', Object.keys(process.env).filter(k => !k.startsWith('npm_')));
    process.exit(1);
} else {
    console.log('   ✅ ENCRYPTION_KEY is present.');
}


async function main() {
    console.log('\n🔍 --- META TOKEN VALIDATION START ---');
    try {
        // 3. Dynamic Imports (Now safe since Env is ready)
        const { decrypt } = await import('../lib/crypto');
        const { db } = await import('../lib/db');
        const { users } = await import('../lib/db/schema');

        // 4. Find user
        const [user] = await db.select()
            .from(users)
            .where(isNotNull(users.facebookAccessToken))
            .orderBy(desc(users.emailVerified))
            .limit(1);

        if (!user || !user.facebookAccessToken) {
            console.error('❌ No user found with Facebook Access Token.');
            process.exit(1);
        }

        console.log(`👤 Testing User: ${user.name} (${user.email})`);

        // 5. Decrypt
        let token = user.facebookAccessToken;
        if (token.includes(':') && token.length > 50) {
            try {
                token = decrypt(token);
                console.log('🔓 Token Decrypted successfully.');
            } catch (e) {
                console.warn('⚠️ Decryption warning:', e);
            }
        }

        const appId = process.env.FACEBOOK_CLIENT_ID;
        const appSecret = process.env.FACEBOOK_CLIENT_SECRET;

        if (!appId || !appSecret) {
            console.error('❌ Missing FACEBOOK_CLIENT_ID or SECRET.');
            process.exit(1);
        }

        // 6. DEBUG_TOKEN
        console.log('\n📡 Calling debug_token...');
        const debugUrl = `https://graph.facebook.com/v24.0/debug_token?input_token=${token}&access_token=${appId}|${appSecret}`;
        const debugRes = await fetch(debugUrl);
        const debugData = await debugRes.json();

        if (!debugRes.ok || debugData.error) {
            console.error('❌ DEBUG_TOKEN FAILED:', debugData.error);
        } else {
            const d = debugData.data;
            console.log(`✅ Token Valid: ${d.is_valid}`);
            console.log(`🔑 Scopes GRANTED:`, d.scopes);

            const required = ['business_management', 'pages_show_list', 'instagram_basic'];
            const missing = required.filter(r => !d.scopes.includes(r));
            if (missing.length > 0) {
                console.error(`\n❌ CRITICAL: Missing Permission(s): ${missing.join(', ')}`);
                console.log('👉 ACTION: Re-login is REQUIRED to grant these.');
            } else {
                console.log('\n✅ All core permissions present!');
            }
        }

        // 7. ASSET TEST
        console.log('\n📡 Testing Asset Visibility...');

        // Pages
        const pagesRes = await fetch(`https://graph.facebook.com/v24.0/me/accounts?limit=3&access_token=${token}`);
        if (pagesRes.ok) {
            const pages = await pagesRes.json();
            console.log(`✅ pages_show_list WORKING: Found ${pages.data?.length || 0} pages.`);
        } else {
            const err = await pagesRes.json();
            console.error(`❌ pages_show_list FAILED:`, err.error?.message);
        }

        // Businesses
        const bizRes = await fetch(`https://graph.facebook.com/v24.0/me/businesses?limit=3&access_token=${token}`);
        if (bizRes.ok) {
            const biz = await bizRes.json();
            console.log(`✅ business_management WORKING: Found ${biz.data?.length || 0} businesses.`);
        } else {
            const err = await bizRes.json();
            console.error(`❌ business_management FAILED:`, err.error?.message);
        }

    } catch (err) {
        console.error('🔥 Fatal Error in Script:', err);
    }
    console.log('\n--- META TOKEN VALIDATION END ---');
    process.exit(0);
}

main();
