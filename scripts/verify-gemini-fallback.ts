
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const geminiApiKey = process.env.gemini_25_agent_google_chat || process.env.GOOGLE_API_KEY;

async function verifyFallback() {
    console.log('🚀 Iniciando verificação de fallback do Gemini...');

    if (!geminiApiKey) {
        console.error('❌ API Key não encontrada.');
        return;
    }

    // Lista de modelos simulando o ambiente de produção, mas com um modelo inválido no início para forçar o erro
    const geminiModels = ['gemini-invalid-model-test', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

    console.log('📋 Lista de modelos para teste (incluindo um inválido propositalmente):', geminiModels);

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const systemPrompt = "Você é um assistente de teste.";
    const userMessage = "Responda apenas com 'FALLBACK_OK'";

    let fallbackResponse: string | null = null;
    let attempts = 0;

    for (const modelName of geminiModels) {
        attempts++;
        console.log(`\n🔄 [Tentativa ${attempts}] Testando modelo: ${modelName}...`);

        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt
            });

            const chat = model.startChat({
                history: [],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 100,
                },
            });

            console.log(`   ⏳ Enviando mensagem para ${modelName}...`);
            const result = await chat.sendMessage(userMessage);
            const text = result.response.text();

            if (text && text.trim().length > 0) {
                console.log(`   ✅ SUCESSO! Modelo ${modelName} respondeu: "${text.trim()}"`);
                fallbackResponse = text;
                break; // Sai do loop ao ter sucesso
            } else {
                console.log(`   ⚠️ Modelo ${modelName} retornou resposta vazia.`);
            }
        } catch (err: any) {
            console.log(`   ❌ FALHA no modelo ${modelName}: ${err.message}`);
            console.log(`   ➡️ Passando para o próximo modelo...`);
        }
    }

    if (fallbackResponse) {
        console.log('\n✅✅ VERIFICAÇÃO CONCLUÍDA: O sistema de fallback funcionou corretamente!');
        console.log('O primeiro modelo falhou (como esperado) e o sistema recuperou usando o próximo modelo disponível.');
    } else {
        console.error('\n❌❌ VERIFICAÇÃO FALHOU: Nenhum modelo conseguiu responder.');
    }
}

verifyFallback().catch(console.error);
