import 'dotenv/config';
import { processIncomingMessageTrigger } from './src/lib/automation-engine';

async function test() {
  const conversationId = 'b6da298d-f1d1-42c6-80ff-03e031db27e7'; // From the screenshot URL
  const messageId = 'c7a3653a-3446-4eaa-bff5-f1a8e1a673ee'; // "Boa tarde"

  console.log(`Triggering automation for message ${messageId}...`);
  await processIncomingMessageTrigger(conversationId, messageId, false);
  console.log('Done!');
  process.exit(0);
}
test().catch(console.error);
