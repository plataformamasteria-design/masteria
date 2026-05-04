require('dotenv').config();
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_AGENTS1;
if (!apiKey) {
    console.error("API Key not found!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function transcribe(filePath) {
    try {
        console.log(`Processando: ${filePath}...`);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const data = fs.readFileSync(filePath);
        const audio = {
            inlineData: {
                data: data.toString("base64"),
                mimeType: "audio/ogg"
            }
        };

        const result = await model.generateContent([audio, "Transcreva este áudio perfeitamente em Português do Brasil. Mantenha as pausas naturais. Apenas o texto transcrito, sem comentários."]);
        console.log(`\n--- Transcrição de ${filePath} ---\n${result.response.text()}\n---------------------------------------\n`);
    } catch (err) {
        console.error(`Erro ao transcrever ${filePath}:`, err.message);
    }
}

async function run() {
    await transcribe("C:\\Users\\Ezequiel Rodrigues\\Downloads\\WhatsApp Audio 2026-04-08 at 17.19.42.ogg");
    await transcribe("C:\\Users\\Ezequiel Rodrigues\\Downloads\\WhatsApp Ptt 2026-04-08 at 17.20.12.ogg");
}

run();
