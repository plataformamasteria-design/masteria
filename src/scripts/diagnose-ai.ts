
import { db } from '../lib/db';
import { aiPersonas } from '../lib/db/schema';
import * as dotenv from 'dotenv';

dotenv.config();

async function diagnoseAI() {
    console.log('--- AI DIAGNOSTIC ---');

    // Check Keys
    const hasGemini = !!(process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_GEMINI_AGENTS2 || process.env.GOOGLE_API_KEY);

    // Check Personas
    const personas = await db.select().from(aiPersonas);
    console.log(`\nFound ${personas.length} personas:`);

    for (const p of personas) {
        console.log(`- [${p.id}] ${p.name} | Provider: ${p.provider} | Model: ${p.model}`);
        if (p.provider === 'GEMINI' && !hasGemini) {
            console.warn(`  ⚠️ Persona uses Gemini but key is missing!`);
        }
    }

    console.log('\n--- ENDPOINT TESTS ---');
    const samplePrompt = 'Responda com uma frase curta: teste de disponibilidade.';

    if (hasGemini) {
        try {
            const geminiKey = process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_GEMINI_AGENTS2 || process.env.GOOGLE_API_KEY;
            const model = 'gemini-2.0-flash-exp';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

            const body = {
                contents: [
                    { role: 'user', parts: [{ text: 'Você é um assistente.' }] },
                    { role: 'user', parts: [{ text: samplePrompt }] }
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 50
                }
            };
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
            });
            const ok = resp.ok;
            const status = resp.status;
            let content = '';
            if (ok) {
                const data: any = await resp.json();
                content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            } else {
                content = await resp.text();
            }
            console.log(`Gemini: status=${status}, success=${ok}, output=${content.substring(0, 120)}`);
        } catch (err: any) {
            console.log(`Gemini error: ${err.message}`);
        }
    } else {
        console.log('Gemini not tested: key missing.');
    }
}

diagnoseAI().catch(console.error);
