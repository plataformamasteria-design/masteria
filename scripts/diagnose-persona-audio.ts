
import { db } from '@/lib/db';
import { aiPersonas, automationLogs, conversations, connections } from '@/lib/db/schema';
import { eq, ilike, and, desc, gt } from 'drizzle-orm';

async function diagnosePersonaAudio() {
    const targetName = 'ASSESSOR GCR - ALUNOS';
    console.log(`🔍 Diagnosing Audio Issues for Agent: "${targetName}"...\n`);

    const hasRequiredCredentials = !!process.env.ELEVENLABS_API_KEY || !!process.env.elevenlabs_audio_voz_agent_apikey;
    if (!hasRequiredCredentials) {
        console.log('⚠️ ElevenLabs credentials not configured — audio features may not work');
    }
    console.log('---------------------------------------------------\n');

    try {
        // 1. Find the Persona
        const personas = await db.select().from(aiPersonas).where(ilike(aiPersonas.name, `%${targetName}%`));

        if (personas.length === 0) {
            console.log(`❌ Agent "${targetName}" not found in database.`);
            process.exit(1);
        }

        const persona = personas[0];
        console.log('✅ Agent Found:');
        console.log(`   - Name: ${persona.name}`);
        console.log(`   - ID: ${persona.id}`);
        console.log(`   - Audio Mode: ${persona.audioMode} ${persona.audioMode === 'text' ? '❌ (Text Only - This is likely the cause)' : '✅'}`);
        console.log(`   - Voice Provider: ${persona.voiceProvider}`);
        console.log(`   - Voice Settings: ${JSON.stringify(persona.voiceSettings || {})}`);
        console.log(`   - Trigger Keywords: ${persona.triggerKeywords?.join(', ') || 'None'}`);
        console.log('---------------------------------------------------\n');

        // 2. Check Associated Connections
        // Find connections using this persona
        const attachedConnections = await db.select().from(connections).where(eq(connections.assignedPersonaId, persona.id));
        console.log(`📡 Linked Connections: ${attachedConnections.length}`);
        attachedConnections.forEach(conn => {
            console.log(`   - Connection ID: ${conn.id}`);
            console.log(`   - Config Name: ${conn.config_name}`);
            console.log(`   - Type: ${conn.connectionType} ${conn.connectionType === 'instagram' ? '⚠️ (Instagram usually does not support Audio PTT)' : ''}`);
            console.log(`   - Provider: ${conn.phoneNumberId ? 'APICloud (Meta)' : 'Baileys'}`);
        });
        console.log('---------------------------------------------------\n');

        // 3. Inspect Recent Logs for this Persona (via Conversations)
        console.log('📋 Recent Audio/TTS Logs (Last 24h):');
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Check specific connection logs if possible, or global audio errors
        const errors = await db.select({
            time: automationLogs.createdAt,
            level: automationLogs.level,
            message: automationLogs.message,
            details: automationLogs.details
        })
            .from(automationLogs)
            .where(and(
                gt(automationLogs.createdAt, twentyFourHoursAgo),
                ilike(automationLogs.message, '%TTS%')
            ))
            .orderBy(desc(automationLogs.createdAt))
            .limit(10);

        if (errors.length === 0) {
            console.log('   (No specific TTS logs found in global logs in last 24h)');
        } else {
            errors.forEach(e => {
                console.log(`   [${e.time.toLocaleString()}] ${e.level}: ${e.message}`);
            });
        }

    } catch (error) {
        console.error('❌ Error during diagnosis:', error);
    } finally {
        process.exit(0);
    }
}

diagnosePersonaAudio();
