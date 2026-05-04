
import { db } from '../lib/db';
import { aiPersonas } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function testPersonaResponse() {
    const personaId = '71c7a1c6-8903-436a-b0c1-699a746af25c';
    
    console.log(`Buscando persona ID: ${personaId}...`);
    
    const [persona] = await db.select().from(aiPersonas).where(eq(aiPersonas.id, personaId));
    
    if (!persona) {
        console.error('Persona não encontrada!');
        return;
    }
    
    console.log(`Persona encontrada: ${persona.name}`);
    console.log(`Provider: ${persona.provider}`);
    console.log(`Model: ${persona.model}`);
    
    const geminiKey = process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_GEMINI_AGENTS2 || process.env.GOOGLE_API_KEY;
    if (!geminiKey) {
        console.error('Chave Gemini não configurada!');
        return;
    }

    const userMessage = "Olá, gostaria de saber mais sobre os serviços da EDN.";
    
    console.log(`\nEnviando mensagem de teste: "${userMessage}"`);
    console.log('Aguardando resposta do Gemini...');

    try {
        const modelToUse = 'gemini-2.0-flash-exp'; 
        console.log(`Usando modelo para teste: ${modelToUse}`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiKey}`;

        const body = {
            contents: [
                { role: 'user', parts: [{ text: persona.systemPrompt || 'Você é um assistente útil.' }] },
                { role: 'user', parts: [{ text: userMessage }] }
            ],
            generationConfig: {
                temperature: Number(persona.temperature) || 0.7,
                maxOutputTokens: persona.maxOutputTokens || 1000
            }
        };

        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const errorText = await resp.text();
            throw new Error(`Erro na API (${resp.status}): ${errorText}`);
        }

        const data = await resp.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        console.log('\n--- RESPOSTA RECEBIDA ---');
        console.log(content);
        console.log('-------------------------');
        
    } catch (error) {
        console.error('Erro ao testar persona:', error);
    }
}

testPersonaResponse().catch(console.error);
