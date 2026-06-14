import { evolutionApiService } from './src/services/evolution-api.service.js';
import { db } from './src/lib/db/index.js';
import { connections } from './src/lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function test() {
  const conn = await db.query.connections.findFirst({
      where: eq(connections.connectionType, 'evolution')
  });
  if (!conn) return console.log("No evolution connection found");
  
  const instance = conn.sessionName || conn.id;
  const number = '5588920008007'; // Seu numero de teste
  
  // 1. URL Direta
  try {
     console.log("Teste 1: URL Direta");
     await evolutionApiService.sendMedia(
        instance,
        number,
        'document',
        'https://masteria.app/api/storage/neon?key=tenants%2F71f0ab13-6f3a-4549-8324-ec35b5174b88%2Fagent-library%2Fai_agent_1780693346835%2F88017457-c6a8-4948-b633-1407b043dc84.pdf',
        'Teste URL',
        'teste_url.pdf',
        'application/pdf'
     );
     console.log("OK Teste 1");
  } catch(e: any) { console.error("Falha 1:", e.message); }

  // 2. Base64 com prefixo
  try {
     console.log("\nTeste 2: Base64 com prefixo");
     await evolutionApiService.sendMedia(
        instance,
        number,
        'document',
        'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAwALJMLU31jBQUjA0tlAwMTAxNzY30TJT0FEpLihLzSlJB4nppOYl5KXr5ualF+XkK+eUlqTz1uQpFCvkFOamJeSmpRZnJqXnF+XmpeSVA87LTU1NSc1PzSjTzFEI1C1Q00zQ1NdI0MzXWNNAwMzUxMjM1MjYxsUgwNLOwMDAwT0mxMDQwTEk2NzM0MTFJMksyMU1LNkxLMjNJMTc1NE2xTEkEAEgRLkEKZW5kc3RyZWFtCmVuZG9iagoKCjMgMCBvYmoKMTE0CmVuZG9iagoKMSAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDU5NS4yNzYgODQxLjg5XTw8L1BhcmVudCA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+L0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCgo0IDAgb2JqCjw8L1R5cGUvUGFnZXMvQ291bnQgMS9LaWRzWzEgMCBSXT4+CmVuZG9iagoKNSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKCjYgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSPj4KZW5kb2JqCgo3IDAgb2JqCjw8L0NyZWF0b3IoamVQREYpL1Byb2R1Y2VyKGplUERGKC9DcmVhdGlvbkRhdGUoRDoyMDI2MDYxNDAwMDAwMFopPj4KZW5kb2JqCgp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyMDAgMDAwMDAgbiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMTc5IDAwMDAwIG4gCjAwMDAwMDAyOTYgMDAwMDAgbiAKMDAwMDAwMDM0NyAwMDAwMCBuIAowMDAwMDAwNDM1IDAwMDAwIG4gCjAwMDAwMDA0ODQgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDgvUm9vdCA2IDAgUi9JbmZvIDcgMCBSPj4Kc3RhcnR4cmVmCjU3NQolJUVPRgo=',
        'Teste Prefix',
        'teste_prefix.pdf',
        'application/pdf'
     );
     console.log("OK Teste 2");
  } catch(e: any) { console.error("Falha 2:", e.message); }

  // 3. Base64 sem prefixo
  try {
     console.log("\nTeste 3: Base64 sem prefixo");
     await evolutionApiService.sendMedia(
        instance,
        number,
        'document',
        'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qo5ypUMFAwALJMLU31jBQUjA0tlAwMTAxNzY30TJT0FEpLihLzSlJB4nppOYl5KXr5ualF+XkK+eUlqTz1uQpFCvkFOamJeSmpRZnJqXnF+XmpeSVA87LTU1NSc1PzSjTzFEI1C1Q00zQ1NdI0MzXWNNAwMzUxMjM1MjYxsUgwNLOwMDAwT0mxMDQwTEk2NzM0MTFJMksyMU1LNkxLMjNJMTc1NE2xTEkEAEgRLkEKZW5kc3RyZWFtCmVuZG9iagoKCjMgMCBvYmoKMTE0CmVuZG9iagoKMSAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDU5NS4yNzYgODQxLjg5XTw8L1BhcmVudCA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+L0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCgo0IDAgb2JqCjw8L1R5cGUvUGFnZXMvQ291bnQgMS9LaWRzWzEgMCBSXT4+CmVuZG9iagoKNSAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKCjYgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSPj4KZW5kb2JqCgo3IDAgb2JqCjw8L0NyZWF0b3IoamVQREYpL1Byb2R1Y2VyKGplUERGKC9DcmVhdGlvbkRhdGUoRDoyMDI2MDYxNDAwMDAwMFopPj4KZW5kb2JqCgp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAyMDAgMDAwMDAgbiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMTc5IDAwMDAwIG4gCjAwMDAwMDAyOTYgMDAwMDAgbiAKMDAwMDAwMDM0NyAwMDAwMCBuIAowMDAwMDAwNDM1IDAwMDAwIG4gCjAwMDAwMDA0ODQgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDgvUm9vdCA2IDAgUi9JbmZvIDcgMCBSPj4Kc3RhcnR4cmVmCjU3NQolJUVPRgo=',
        'Teste No-Prefix',
        'teste_noprefix.pdf',
        'application/pdf'
     );
     console.log("OK Teste 3");
  } catch(e: any) { console.error("Falha 3:", e.message); }
  
  process.exit(0);
}
test();
