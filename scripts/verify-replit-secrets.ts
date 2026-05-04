#!/usr/bin/env tsx
/**
 * Replit Secrets Verification Script
 * 
 * Verifies that all critical environment variables are properly configured
 * in Replit Secrets. This script checks for presence without exposing values.
 * 
 * Usage: npx tsx scripts/verify-replit-secrets.ts
 */

// Critical environment variables that MUST be in Replit Secrets
const CRITICAL_SECRETS = {
    // Google Gemini / AI Services
    'GOOGLE_API_KEY': 'Google Gemini API Key (primary)',
    'GOOGLE_GEMINI_AGENTS1': 'Google Gemini Agents API Key (secondary)',

    // Facebook/Meta (Instagram/WhatsApp)
    'FACEBOOK_CLIENT_ID': 'Facebook App ID (used in code as FACEBOOK_CLIENT_ID)',
    'FACEBOOK_CLIENT_SECRET': 'Facebook App Secret',

    // Database
    'DATABASE_URL': 'Neon PostgreSQL Database URL',

    // Redis
    'UPSTASH_REDIS_REST_URL': 'Upstash Redis REST URL',
    'UPSTASH_REDIS_REST_TOKEN': 'Upstash Redis REST Token',
    'REDIS_URL': 'Redis Connection URL',

    // Twilio
    'TWILIO_ACCOUNT_SID': 'Twilio Account SID',
    'TWILIO_AUTH_TOKEN': 'Twilio Auth Token',
    'TWILIO_PHONE_NUMBER': 'Twilio Phone Number',

    // SMS Gateways
    'SMSMKOM_API_TOKEN': 'SMSMkom API Token (if using SMS)',
    'MKOM_SMS_TOKEN': 'SMSMkom API Token (alias for SMSMKOM_API_TOKEN)',

    // Security
    'ENCRYPTION_KEY': 'Encryption Key for sensitive data',
    'NEXTAUTH_SECRET': 'NextAuth Secret',
    'JWT_SECRET_KEY_CALL': 'JWT Secret for Socket.IO and API authentication',
} as const;

// Optional but recommended secrets
const OPTIONAL_SECRETS = {
    'NEXT_PUBLIC_APP_URL': 'Public App URL',
    'SENTRY_DSN': 'Sentry DSN for error tracking',
    'ELEVENLABS_API_KEY': 'ElevenLabs API Key (if using TTS)',
    'OPENAI_API_KEY': 'OpenAI API Key (if using OpenAI instead of Gemini)',
    'GITHUB_TOKEN': 'GitHub Personal Access Token (for repo automation)',
    'POSTGRES_URL': 'Alternative Postgres URL (duplicate of DATABASE_URL)',
    // AWS S3 (optional if using Neon for storage)
    'AWS_ACCESS_KEY_ID': 'AWS Access Key ID (for S3 storage)',
    'AWS_SECRET_ACCESS_KEY': 'AWS Secret Access Key',
    'AWS_REGION': 'AWS Region',
    'AWS_S3_BUCKET_NAME': 'AWS S3 Bucket Name',
} as const;

interface VerificationResult {
    name: string;
    description: string;
    configured: boolean;
    hasValue: boolean;
    suffix?: string;
}

function checkSecret(name: string, description: string): VerificationResult {
    const value = process.env[name];
    const configured = value !== undefined;
    const hasValue = configured && value.trim().length > 0;

    // Show last 4 chars for verification (only for non-sensitive display)
    let suffix: string | undefined;
    if (hasValue && value.length > 4) {
        suffix = `...${value.slice(-4)}`;
    }

    return {
        name,
        description,
        configured,
        hasValue,
        suffix,
    };
}

function printResults() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║         REPLIT SECRETS VERIFICATION REPORT                    ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const criticalResults = Object.entries(CRITICAL_SECRETS).map(([name, desc]) =>
        checkSecret(name, desc)
    );

    const optionalResults = Object.entries(OPTIONAL_SECRETS).map(([name, desc]) =>
        checkSecret(name, desc)
    );

    // Critical Secrets
    console.log('🔴 CRITICAL SECRETS (MUST BE CONFIGURED)\n');
    console.log('─'.repeat(70));

    const missing: VerificationResult[] = [];
    const configured: VerificationResult[] = [];

    criticalResults.forEach(result => {
        if (!result.hasValue) {
            missing.push(result);
            console.log(`❌ ${result.name}`);
            console.log(`   ${result.description}`);
            console.log(`   Status: ${result.configured ? 'EMPTY VALUE' : 'NOT CONFIGURED'}\n`);
        } else {
            configured.push(result);
            console.log(`✅ ${result.name}`);
            console.log(`   ${result.description}`);
            console.log(`   Status: CONFIGURED ${result.suffix || ''}\n`);
        }
    });

    // Optional Secrets
    console.log('\n🟡 OPTIONAL SECRETS (RECOMMENDED)\n');
    console.log('─'.repeat(70));

    optionalResults.forEach(result => {
        const icon = result.hasValue ? '✅' : '⚪';
        const status = result.hasValue ? `CONFIGURED ${result.suffix || ''}` : 'NOT CONFIGURED';
        console.log(`${icon} ${result.name}`);
        console.log(`   ${result.description}`);
        console.log(`   Status: ${status}\n`);
    });

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                        SUMMARY                                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const total = criticalResults.length;
    const configuredCount = configured.length;
    const missingCount = missing.length;
    const percentage = Math.round((configuredCount / total) * 100);

    console.log(`Total Critical Secrets: ${total}`);
    console.log(`✅ Configured: ${configuredCount}`);
    console.log(`❌ Missing: ${missingCount}`);
    console.log(`Completion: ${percentage}%\n`);

    if (missingCount > 0) {
        console.log('⚠️  WARNING: Missing critical secrets detected!\n');
        console.log('Please configure the following in Replit Secrets:\n');
        missing.forEach(result => {
            console.log(`  • ${result.name} - ${result.description}`);
        });
        console.log('\nHow to add secrets in Replit:');
        console.log('1. Open the "Tools" panel in Replit');
        console.log('2. Click on "Secrets" tab');
        console.log('3. Add each missing secret with its value\n');

        process.exit(1);
    } else {
        console.log('✅ All critical secrets are properly configured!\n');
        console.log('🔒 Security Status: PASS\n');
        process.exit(0);
    }
}

// Run verification
printResults();
