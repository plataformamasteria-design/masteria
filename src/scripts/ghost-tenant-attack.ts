// src/scripts/ghost-tenant-attack.ts
import { SignJWT } from 'jose';
import { db } from '@/lib/db';
import { users, contacts, messages, mediaAssets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY_CALL;
const BASE_URL = 'http://localhost:5000'; // Running on port 5000

async function forgeToken(companyId: string, userId: string) {
    if (!JWT_SECRET_KEY) throw new Error('JWT_SECRET_KEY_CALL missing');
    const secret = new TextEncoder().encode(JWT_SECRET_KEY);

    return new SignJWT({ userId, companyId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret);
}

async function main() {
    console.log('👻 STARTING GHOST TENANT ATTACK SIMULATION 👻');

    // 1. Get Target Data (Diego)
    const targetEmail = 'diegomaninhu@gmail.com';
    const [targetUser] = await db.select().from(users).where(eq(users.email, targetEmail));
    if (!targetUser) {
        console.error('❌ Target user not found: ' + targetEmail);
        process.exit(1);
    }
    if (!targetUser.companyId) {
        console.error('❌ Target user has no company ID.');
        process.exit(1);
    }
    console.log(`🎯 Target Found: ${targetUser.name} (${targetUser.companyId})`);

    // Get a contact belonging to Diego
    const [targetContact] = await db.select().from(contacts).where(eq(contacts.companyId, targetUser.companyId)).limit(1);
    if (!targetContact) {
        console.error('❌ No contact found for target company.');
        process.exit(1);
    }
    console.log(`🎯 Target Asset (Contact): ${targetContact.id}`);

    // Get a message belonging to Diego
    const [targetMessage] = await db.select().from(messages).where(eq(messages.companyId, targetUser.companyId)).limit(1);
    if (targetMessage) {
        console.log(`🎯 Target Asset (Message): ${targetMessage.id}`);
    }

    // Get a media asset belonging to Diego
    // @ts-ignore
    const [targetMedia] = await db.select().from(mediaAssets).where(eq(mediaAssets.companyId, targetUser.companyId)).limit(1);
    if (targetMedia) {
        console.log(`🎯 Target Asset (Media): ${targetMedia.id}`);
    }

    // 2. Forge "Evil Tenant" Identity
    const evilCompanyId = '00000000-0000-0000-0000-000000000000'; // Fake UUID
    const evilUserId = '11111111-1111-1111-1111-111111111111';
    console.log(`😈 Forging Identity for Evil Tenant (${evilCompanyId})...`);

    const token = await forgeToken(evilCompanyId, evilUserId);
    console.log('🔑 Forged Token generated.');

    // 3. Launch Attacks
    interface Attack {
        name: string;
        method: string;
        path: string;
        exceptedStatus?: number[];
        validate?: (res: any, data: any) => boolean;
        body?: any;
    }

    const attacks: Attack[] = [
        {
            name: 'IDOR - Get Contact',
            method: 'GET',
            path: `/api/v1/contacts/${targetContact.id}`,
            exceptedStatus: [404, 403, 401]
        },
        {
            name: 'IDOR - List Media (Self only)',
            method: 'GET',
            path: '/api/v1/media', // Should return empty list, not Diego's assets
            validate: (res: any, data: any) => res.status === 200 && data.length === 0
        },
        {
            name: 'Leak - Conversation Messages (IDOR)',
            method: 'GET',
            path: `/api/v1/conversations/${targetContact.id}/messages`, // Assuming contactId might map to a conversation for testing
            exceptedStatus: [404, 403, 401]
        },
        {
            name: 'Leak - List Agents (Debug Route)',
            method: 'GET',
            path: '/api/v1/voice/debug/agents',
            exceptedStatus: [200],
            validate: (res: any, data: any) => res.status === 200 && (data.count === 0 || data.length === 0)
        }
    ];

    console.log('\n⚔️  EXECUTING ATTACKS...');

    for (const attack of attacks) {
        console.log(`\n[${attack.name}] ${attack.method} ${attack.path}`);
        try {
            const res = await fetch(`${BASE_URL}${attack.path}`, {
                method: attack.method,
                headers: {
                    'Cookie': `session_token=${token}`,
                    'Content-Type': 'application/json'
                },
                body: attack.body ? JSON.stringify(attack.body) : undefined
            });

            console.log(`   Status: ${res.status}`);
            const data = await res.json().catch(() => null);

            if (attack.validate) {
                if (attack.validate(res, data)) {
                    console.log('   ✅ PASSED (Isolation verified)');
                } else {
                    console.log('   ❌ FAILED (Data leaked or unexpected result!)');
                    console.log('   Response:', JSON.stringify(data).substring(0, 200));
                }
            } else {
                if (attack.exceptedStatus?.includes(res.status)) {
                    console.log('   ✅ PASSED (Access Denied/Not Found)');
                } else {
                    console.log(`   ❌ FAILED (Unexpected Status: ${res.status})`);
                    console.log('   Response:', JSON.stringify(data).substring(0, 200));
                }
            }
        } catch (e: any) {
            console.log(`   ⚠️ Network Error (Server running?): ${e.message}`);
        }
    }
}

main().catch(console.error);
