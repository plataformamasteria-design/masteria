const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./scratch/audit-results.json', 'utf-8'));

let output = '';

for (const [contactName, info] of Object.entries(data)) {
    const messages = info.messages;
    
    // Sort messages by sentAt ascending
    messages.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));

    output += `\n--- LEAD: ${contactName} ---\n`;
    for (const msg of messages) {
        const isUser = msg.sender === 'USER' || msg.sender === 'CONTACT';
        const sender = isUser ? '👤 LEAD' : (msg.isAi ? '🤖 BOT' : '👨‍💼 ATENDENTE');
        const content = msg.content.replace(/\n/g, ' ');
        output += `${sender}: ${content}\n`;
    }
}

fs.writeFileSync('./scratch/audit-compact.txt', output);
console.log("Saved to scratch/audit-compact.txt. Size:", output.length);
