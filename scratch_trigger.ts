import { processIncomingMessageTrigger } from './src/lib/automation-engine';

async function main() {
    const messageId = 'c87a9a6f-b063-4be7-bbf9-18657609e0d2';
    const conversationId = 'df049856-d010-4f46-8e73-8c18d1cbdded';
    
    console.log(`Running test for ${messageId}...`);
    try {
        await processIncomingMessageTrigger(conversationId, messageId);
        console.log('Finished');
    } catch(err) {
        console.error('Error:', err);
    }
}

main().then(() => process.exit(0)).catch(console.error);
