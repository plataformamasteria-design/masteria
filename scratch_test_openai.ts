import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
import { OpenAI, toFile } from 'openai';

console.log(typeof toFile === 'function' ? 'toFile is available' : 'toFile not available');
process.exit(0);
