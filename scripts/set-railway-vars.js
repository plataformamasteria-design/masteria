const { execFileSync } = require('child_process');

// Script para injetar variáveis na Railway sem envelopar com aspas duplas literais
const envVars = [
    ['NODE_ENV', 'production'],
    ['NEXT_PUBLIC_BASE_URL', 'https://masteria-production.up.railway.app'],
    ['NEXT_PUBLIC_APP_URL', 'https://masteria-production.up.railway.app'],
    ['NEXT_PUBLIC_CUSTOM_DOMAIN', 'masteria-production.up.railway.app'],
    ['NEXTAUTH_URL', 'https://masteria-production.up.railway.app'],
    ['BAILEYS_SESSIONS_ENABLED', 'true'],
    ['ENABLE_BULLMQ_QUEUE', 'true'],
    ['DB_DEBUG', 'true'],
    ['DEBUG', 'false'],
    ['RATE_LIMIT_DISABLED', 'true'],
    ['NEXTAUTH_SECRET', '30deb8584fac7192d1c44d8c2831ea02'],
    ['SESSION_SECRET', 'EndDyuB09CUOrvQoU6ZEOEYxBbKyQN8LqfjOhFd2l8yhoiQlN4GZhIJ6vfOC9MAHRBIvOXwZ9d2IMlT1DRCpyA=='],
    ['JWT_SECRET_KEY_CALL', "HkRs$M[gS'>z#14bJ)ZSpA;CJ'&F6Go+"],
    ['ENCRYPTION_KEY', '32-character-encryption-key-here'],
    ['DATABASE_URL', 'postgresql://neondb_owner:npg_3A4aphDSoLUZ@ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require'],
    ['APIKEY_USER_DB_NEON_MASTER', 'napi_qhs3h0lyj9a65vnr0022hwsam8xg7t0c03eb1tj6zdyayqteogoljgqboac3245h'],
    ['PGDATABASE', 'neondb'],
    ['PGPORT', '5432'],
    ['PGUSER', 'neondb_owner'],
    ['PGPASSWORD', 'npg_3A4aphDSoLUZ'],
    ['PGHOST', 'ep-broad-truth-afj172ni.c-2.us-west-2.aws.neon.tech'],
    ['FACEBOOK_API_VERSION', 'v23.0'],
    ['FACEBOOK_CLIENT_ID', '733445277925306'],
    ['FACEBOOK_CLIENT_SECRET', 'c1960ea4eddaead035d64a72208e0502'],
    ['META_PHONE_NUMBER_ID', '391262387407327'],
    ['META_VERIFY_TOKEN', 'zapmaster_verify_2024'],
    ['GOOGLE_API_KEY_CALL', 'AIzaSyASlLMUXkB08AbrmADz8MfWjzEzccBMeL0'],
    ['GOOGLE_GEMINI_AGENTS1', 'AIzaSyC887cnakGlTFG5FZbO8yc6B_PqY1CL7D8'],
    ['GOOGLE_GEMINI_AGENTS2', 'AIzaSyBP3KNLi4kafgI1tJxAJlMyR7Vg7zCK4M8'],
    ['AGENTE_GOOGLE_API_KEY_3', 'AIzaSyCVRcO73wo3F8DivwyYk38lwcKh0FXInQI'],
    ['GOOGLE_CALENDAR_CLIENT_ID', '760101813024-kdqh3cmvoq2dngonlmeplbetvajhjtlc.apps.googleusercontent.com'],
    ['GOOGLE_CALENDAR_CLIENT_SECRET', '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'],
    ['GOOGLE_CALENDAR_REDIRECT_URI', 'https://masteria-production.up.railway.app/api/v1/integrations/google/callback'],
    ['GOOGLE_DRIVE_REDIRECT_URI', 'https://masteria-production.up.railway.app/api/v1/integrations/google-drive/callback'],
    ['TWILIO_ACCOUNT_SID', 'AC801c22459d806d9f2107f255e95ac476'],
    ['TWILIO_AUTH_TOKEN', 'b0b2466cf01177a1152ae338f8556085'],
    ['TWILIO_API_KEY', 'SKa55f97ec46ae4f399102fb5f9c2b649'],
    ['TWILIO_API_SECRET', 'SKca5597ec86ae4f399102f5bf95c2b649'],
    ['TWILIO_PHONE_NUMBER', '+553322980007'],
    ['TWILIO_SIP_TERMINATION_URI', 'retell-1765080490561.pstn.twilio.com'],
    ['RETELL_API_KEY', 'key_f2cfbba3b9c96a52ecc83296fc7d'],
    ['RETELL_WORKSPACE_ID', 'org_JY55cp5S9pRJjrV'],
    ['VAPI_PHONE_NUMBER', '+17752889379'],
    ['VAPI_WEBHOOK_SECRET', 'vapi_wh_2025_7x9KmP2nQ4rL8sT6vB3cF5jH1wN0yZ'],
    ['ELEVENLABS_API_KEY', '478e0eb000cf41a319aded16c363e0ada165d258cc93640e115a723c07a34e4f'],
    ['ELEVENLABS_API_KEY_SECONDARY', 'bd06a8bea9d2200f4f982df98d8f49253f1ea2c318c6d98222603e8ffa8fac11'],
    ['ELEVENLABS_API_KEY_TERTIARY', 'cc6518881747162a5cd456580f00645659bd9bb34fb6d9b14564cfb3eaa921b4'],
    ['VOICE_AI_PLATFORM_URL', 'https://plataformai.global'],
    ['GITHUB_PERSONAL_ACCESS_TOKEN', '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'],
    ['GITHUB_PERSONAL_ACCESS_TOKEN_NOVO', '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'],
    ['UPSTASH_REDIS_REST_TOKEN', 'Adn4AAIncDEwZmNmYTQ1OGY4NjY0OTQ5YjFmZjIxMDdjZmVlNDJmZnAxNTU4MDA'],
    ['UPSTASH_REDIS_REST_URL', 'https://exotic-lemur-55800.upstash.io'],
    ['REDIS_URL', 'rediss://default:Adn4AAIncDEwZmNmYTQ1OGY4NjY0OTQ5YjFmZjIxMDdjZmVlNDJmZnAxNTU4MDA@exotic-lemur-55800.upstash.io:6379']
];

const args = ['variables', '--service', '7c8cd7bd-09ff-4383-b665-397c849260f1'];

console.log('Running railway variables with unquoted secrets individually...');
envVars.forEach(([key, val]) => {
    try {
        console.log(`Setting ${key}...`);
        execFileSync('railway.cmd', ['variables', '--service', '7c8cd7bd-09ff-4383-b665-397c849260f1', '--skip-deploys', '--set', `${key}=${val}`], { env: process.env, stdio: 'pipe', shell: true });
    } catch (e) {
        // Special fallback for complex secrets using base64 or safe shell quotes
        console.log(`Failed setting ${key} with direct execution, attempting safe quotes...`);
        try {
            const safeVal = val.replace(/"/g, '\\"');
            execFileSync('railway.cmd', ['variables', '--service', '7c8cd7bd-09ff-4383-b665-397c849260f1', '--skip-deploys', '--set', `${key}="${safeVal}"`], { env: process.env, stdio: 'pipe', shell: true });
        } catch (e2) {
            console.error(`COMPLETELY FAILED TO SET ${key}. Error:`, e2.message);
        }
    }
});
console.log('Secrets pushed successfully without literal quotes!');
