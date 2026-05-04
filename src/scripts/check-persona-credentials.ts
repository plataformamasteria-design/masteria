
import { db } from '@/lib/db';
import { aiPersonas, aiCredentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const personaId = 'f2efb8d8-109c-4a76-8316-21bb8e4cc326';

    console.log(`Checking persona: ${personaId}`);
    const persona = await db.query.aiPersonas.findFirst({
        where: eq(aiPersonas.id, personaId)
    });

    if (!persona) {
        console.log('Persona not found');
        return;
    }

    console.log('Persona details:');
    console.log(JSON.stringify({
        id: persona.id,
        name: persona.name,
        model: persona.model,
        credentialId: persona.credentialId
    }, null, 2));

    if (persona.credentialId) {
        console.log(`Checking credential: ${persona.credentialId}`);
        const credential = await db.query.aiCredentials.findFirst({
            where: eq(aiCredentials.id, persona.credentialId)
        });

        if (credential) {
            console.log('Credential details:');
            console.log(JSON.stringify({
                id: credential.id,
                name: credential.name,
                provider: credential.provider
            }, null, 2));
        } else {
            console.log('Credential not found');
        }
    } else {
        console.log('Persona does not have a specific credential assigned.');
        console.log(`Default key (GPT Padrao) would be used.`);
    }
}

main().catch(console.error).finally(() => process.exit(0));
