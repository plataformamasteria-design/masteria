
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });

async function listModels() {
  const key = process.env.GOOGLE_GEMINI_AGENTS1 || process.env.GOOGLE_API_KEY;
  if (!key) {
      console.log('Sem chave');
      return;
  }
  const genAI = new GoogleGenerativeAI(key);
  try {
      // @ts-ignore
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' }); // Dummy
      // A biblioteca não expõe listModels diretamente na classe principal facilmente em versões antigas,
      // mas vamos tentar ver se conseguimos fazer uma chamada bruta ou usar um modelo conhecido.
      
      console.log('Testando modelos conhecidos...');
      
      const modelsToTest = [
          'gemini-1.5-flash',
          'gemini-1.5-flash-latest',
          'gemini-1.5-flash-001',
          'gemini-1.5-pro',
          'gemini-1.5-pro-latest',
          'gemini-pro',
          'gemini-2.0-flash-exp'
      ];

      for (const m of modelsToTest) {
          try {
              console.log(`Testando ${m}...`);
              const model = genAI.getGenerativeModel({ model: m });
              const result = await model.generateContent('Hello');
              console.log(`✅ ${m} funcionou!`);
              break; 
          } catch (e: any) {
              console.log(`❌ ${m} falhou: ${e.message.split(':')[0]}`);
          }
      }

  } catch (e) {
      console.error(e);
  }
}

listModels();
