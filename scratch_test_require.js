require('dotenv').config({ path: '.env.local' });
require('tsx/cjs');

try {
    const engine = require('./src/lib/automation-engine');
    console.log("automation-engine loaded successfully!");
    console.log("Keys available:", Object.keys(engine));
    if (typeof engine.processIncomingMessageTrigger !== 'function') {
        console.error("processIncomingMessageTrigger is NOT a function!");
    } else {
        console.log("processIncomingMessageTrigger is a function!");
    }
} catch (err) {
    console.error("Error loading automation-engine:", err);
}
