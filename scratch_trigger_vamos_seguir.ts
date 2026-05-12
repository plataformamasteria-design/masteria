import 'dotenv/config';
import { processIncomingMessageTrigger } from './src/lib/automation-engine';

async function test() {
  const conversationId = 'b6da298d-f1d1-42c6-80ff-03e031db27e7';
  const messageId = 'fbac76fc-1846-4ca5-9b59-14709fed07bf'; // "Vamos seguir?"

  console.log(`Triggering automation for message ${messageId}...`);
  await processIncomingMessageTrigger(conversationId, messageId, false);
  console.log('Done!');
  process.exit(0);
}
test().catch(console.error);
