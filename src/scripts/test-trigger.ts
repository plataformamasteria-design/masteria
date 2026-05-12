import 'dotenv/config';
import { db } from '../lib/db';
import { processIncomingMessageTrigger } from '../lib/automation-engine';

async function main() {
    console.log('Testing processIncomingMessageTrigger...');
    const conversationId = 'd5564e3f-4442-43b4-9e12-90ac45b032a3';
    const messageId = '8dca1b81-d62b-4ab0-809f-a23d9b8b6bc1';

    try {
        await processIncomingMessageTrigger(conversationId, messageId, false);
        console.log('Success!');
    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

main();
