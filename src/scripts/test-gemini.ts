
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

async function testGemini() {
    const apiKey = process.env.gemini_25_agent_google_chat || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
        console.error('API Key not found in environment');
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Olá! Você é o Gemini integrado na Masteria X. Mande um salve para o Diego.";
        console.log('Prompt:', prompt);

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        console.log('--- RESPONSE ---');
        console.log(text);
        console.log('-----------------');
        console.log('SUCCESS');
    } catch (error) {
        console.error('Gemini Test failed:', error);
    }
}

testGemini();
