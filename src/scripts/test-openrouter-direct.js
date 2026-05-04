
const fetch = require('node-fetch');
require('dotenv').config();

async function testOpenRouter() {
    const apiKey = process.env.OPENROUTERS_API_KEY || process.env.openrouters_free_model_agents;
    const models = [
        'google/gemini-2.0-flash-exp:free',
        'mistralai/mistral-7b-instruct:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'qwen/qwen-2.5-7b-instruct:free',
        'deepseek/deepseek-chat:free'
    ];

    console.log("🚀 Testando novos modelos OpenRouter...");

    for (const model of models) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://masteria.app',
                    'X-Title': 'MasterIA'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'user', content: 'OK?' }
                    ],
                    max_tokens: 5
                })
            });

            const data = await response.json();
            if (response.ok && data.choices) {
                console.log(`✅ Modelo ${model}: ${data.choices[0].message.content}`);
            } else {
                console.log(`❌ Modelo ${model} falhou: ${JSON.stringify(data.error || data)}`);
            }
        } catch (error) {
            console.log(`💥 Erro ao testar ${model}: ${error.message}`);
        }
    }
}

testOpenRouter();
