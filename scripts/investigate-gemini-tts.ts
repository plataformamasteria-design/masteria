
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env' });

async function testGeminiTTS() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  INVESTIGAÇÃO DE MODELO DE ÁUDIO (GEMINI TTS)                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    const apiKey = process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('❌ Chave de API (GOOGLE_GEMINI_AGENTS1 ou GOOGLE_API_KEY) não encontrada no .env');
        return;
    }

    const ai = new GoogleGenAI({ apiKey });

    // Lista de modelos para testar (ordem de preferência)
    const modelsToTest = [
        'gemini-2.0-flash-exp',
        'gemini-2.5-flash-preview-tts', // Oficial da documentação
    ];

    const textToSpeak = "Olá! Esta é uma prova de conceito para validar a geração de áudio paralela usando o modelo Gemini. O sistema continua rápido e eficiente.";

    for (const modelName of modelsToTest) {
        console.log(`\n🔍 Testando modelo: ${modelName}...`);
        
        try {
            // Configuração específica para saída de áudio
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: textToSpeak }] }],
                config: {
                    responseModalities: ['AUDIO'], 
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: 'Kore' 
                            }
                        }
                    }
                }
            });

            console.log(`✅ Requisição enviada com sucesso para ${modelName}`);

            const candidate = response.candidates?.[0];
            
            // Verificação robusta da resposta
            if (candidate?.content?.parts?.[0]?.inlineData) {
                const audioData = candidate.content.parts[0].inlineData.data;
                const buffer = Buffer.from(audioData, 'base64');
                
                // Salvar arquivo para verificação
                const outputPath = path.join(process.cwd(), `test-output-${modelName.replace(/\./g, '_')}.wav`);
                fs.writeFileSync(outputPath, buffer);
                
                console.log(`🎉 SUCESSO! Áudio gerado e salvo em: ${outputPath}`);
                console.log(`📊 Tamanho do arquivo: ${buffer.length} bytes`);
                console.log(`ℹ️  Este modelo (${modelName}) É VIÁVEL para uso.`);
                return; // Sucesso encontrado
            } else {
                console.warn(`⚠️ O modelo ${modelName} respondeu, mas não retornou dados de áudio inline.`);
                // console.log('Resposta completa:', JSON.stringify(candidate, null, 2));
            }

        } catch (error: any) {
            console.error(`❌ Falha com modelo ${modelName}:`, error.message);
            
            if (error.message.includes('404') || error.message.includes('not found')) {
                console.log(`   -> Diagnóstico: Modelo não encontrado ou sem acesso na API Key atual.`);
            } else if (error.message.includes('400')) {
                console.log(`   -> Diagnóstico: Requisição inválida (provavelmente modalidade AUDIO não suportada neste modelo).`);
            }
        }
    }

    console.log('\n🏁 Conclusão da Investigação:');
    console.log('Nenhum dos modelos testados retornou áudio com a configuração padrão.');
    console.log('Ação Recomendada: Verificar se a API Key tem acesso ao "Google AI Studio" e aos modelos experimentais.');
}

testGeminiTTS().catch(console.error);
