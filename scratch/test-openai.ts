import { generateText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run() {
  try {
    const res = await generateText({
      model: openai('gpt-4-turbo'),
      prompt: 'Oi, chame a tool myTool por favor',
      tools: {
        myTool: tool({
          description: 'teste',
          parameters: z.object({ a: z.string() }),
          execute: async () => 'ok'
        })
      }
    });
    console.log(res.text, res.toolCalls);
  } catch (e) {
    console.error(e);
  }
}
run();
