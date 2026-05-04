
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testGemini(modelName) {
    console.log(`\n--- Testando Gemini: ${modelName} ---`);
    // Usando as chaves encontradas no .env (Prioridade para as novas chaves)
    const apiKey = process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_GEMINI_AGENTS2 || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('❌ Erro: Chave Gemini não encontrada no .env.');
        return false;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Responda apenas 'OK' se você estiver funcionando.");
        const response = await result.response;
        const text = response.text();
        console.log(`✅ Sucesso: ${text}`);
        return true;
    } catch (error) {
        console.error(`❌ Falha: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Iniciando testes de conectividade com IA...\n');
    
    // Testar Gemini (Modelos Oficiais)
    await testGemini('gemini-2.0-flash-exp');
    await testGemini('gemini-1.5-flash');
    
    console.log('\n🏁 Testes concluídos.');
}

runTests();
