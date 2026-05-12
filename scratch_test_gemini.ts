import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { GoogleGenerativeAI } from '@google/generative-ai';

async function main() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { console.error('No GEMINI_API_KEY'); process.exit(1); }
    const client = new GoogleGenerativeAI(key);

    const modelsToTest = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
    for (const modelName of modelsToTest) {
        try {
            console.log(Testing ...);
            const model = client.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([{ text: 'Hello, reply with OK' }]);
            const response = await result.response;
            console.log([] Success: );
        } catch (e: any) {
            console.error([] Failed: );
        }
    }
    process.exit(0);
}
main().catch(console.error);
