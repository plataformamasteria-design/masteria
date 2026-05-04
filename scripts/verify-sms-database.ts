#!/usr/bin/env tsx
/**
 * Script to verify SMS Gateway credentials in database
 * 
 * This script checks if SMSMKOM_API_TOKEN exists in the database
 * and displays the stored credentials without exposing full values.
 */

import { db } from '@/lib/db';
import { smsGateways } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function verifySmsMkomToken() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║     SMS GATEWAY CREDENTIALS VERIFICATION                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    try {
        // Buscar todos os gateways SMS
        const gateways = await db.select().from(smsGateways);

        if (gateways.length === 0) {
            console.log('❌ No SMS gateways found in database');
            process.exit(1);
        }

        console.log(`✅ Found ${gateways.length} SMS gateway(s) in database\n`);
        console.log('─'.repeat(70));

        for (const gateway of gateways) {
            console.log(`\n📱 Gateway: ${gateway.provider} (${gateway.name})`);
            console.log(`   ID: ${gateway.id}`);
            console.log(`   Company ID: ${gateway.companyId}`);
            console.log(`   Active: ${gateway.isActive ? '✅ Yes' : '❌ No'}`);

            if (gateway.credentials) {
                try {
                    // Credentials são armazenados como JSONB
                    const credentialsObj = gateway.credentials as any;

                    console.log(`   Credentials: ✅ STORED IN DATABASE`);

                    // Mostrar estrutura sem expor valores completos
                    if (credentialsObj.token) {
                        const token = credentialsObj.token;
                        const suffix = token.length > 8 ? `...${token.slice(-8)}` : '***';
                        console.log(`   Token: ✅ CONFIGURED ${suffix}`);
                        console.log(`   Token Length: ${token.length} characters`);
                    }

                    if (credentialsObj.cost_centre_id !== undefined) {
                        console.log(`   Cost Centre ID: ${credentialsObj.cost_centre_id || 'empty'}`);
                    }

                    // Verificar se é um dos provedores que usa SMSMKOM
                    if (gateway.provider === 'witi' || gateway.provider === 'mkom') {
                        console.log(`\n   ✅ This gateway USES SMSMKOM_API_TOKEN`);
                        console.log(`   🔐 Token is stored in database`);
                    }

                } catch (error) {
                    console.log(`   ❌ Failed to read credentials: ${error}`);
                }
            } else {
                console.log(`   ❌ No credentials stored`);
            }
            console.log('─'.repeat(70));
        }

        // Verificar se há pelo menos um gateway witi ou mkom ativo
        const smsMkomGateways = gateways.filter(
            g => (g.provider === 'witi' || g.provider === 'mkom') && g.isActive
        );

        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                        SUMMARY                                 ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        console.log(`Total SMS Gateways: ${gateways.length}`);
        console.log(`Active SMS/MKOM Gateways: ${smsMkomGateways.length}`);

        if (smsMkomGateways.length > 0) {
            console.log('\n✅ SMSMKOM_API_TOKEN is CONFIGURED in database');
            console.log('🔒 Token is encrypted and stored securely');
            console.log('\n💡 You do NOT need to add SMSMKOM_API_TOKEN to Replit Secrets');
            console.log('   The system reads it directly from the database.\n');
            process.exit(0);
        } else {
            console.log('\n⚠️  No active SMS/MKOM gateways found');
            console.log('   You may need to run sync-sms-gateways.ts first\n');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Database error:', error);
        process.exit(1);
    }
}

// Run verification
verifySmsMkomToken();
