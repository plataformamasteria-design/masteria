const fs = require('fs');
let code = fs.readFileSync('src/hooks/use-inbox-controller.ts', 'utf8');

// 1. Add handleFetchAllMessages to return
if (!code.includes('handleFetchAllMessages,')) {
    code = code.replace(/loadMoreMessages: async \(\) => \{/, 'handleFetchAllMessages,\n        loadMoreMessages: async () => {');
}

// 2. Fix handleSelectConversation fetchAndSetMessages
code = code.replace(
    /fetchAndSetMessages\(conversationId\),/g, 
    'fetchAndSetMessages(conversationId, undefined, false, false, false, conversation.connectionId),'
);

// 3. Fix useEffect initialization fetch
code = code.replace(
    /fetchAndSetMessages\(selectedConversation\.id, undefined, false, true, false\);/g,
    'fetchAndSetMessages(selectedConversation.id, undefined, false, true, false, selectedConversation.connectionId);'
);

// 4. Fix interval polling
code = code.replace(
    /fetchAndSetMessages\(selectedConversation\.id, undefined, false, true, true\);/g,
    'fetchAndSetMessages(selectedConversation.id, undefined, false, true, true, selectedConversation.connectionId);'
);

// 5. Fix syncHistory fetchAndSetMessages
code = code.replace(
    /fetchAndSetMessages\(selectedConversation\.id, lastMessageId, true, false, false\);/g,
    'fetchAndSetMessages(selectedConversation.id, lastMessageId, true, false, false, selectedConversation.connectionId);'
);

// 6. Fix loadMoreMessages
code = code.replace(
    /fetchAndSetMessages\(selectedConversation!\.id, oldestTime, true\);/g,
    'fetchAndSetMessages(selectedConversation!.id, oldestTime, true, false, false, selectedConversation!.connectionId);'
);

fs.writeFileSync('src/hooks/use-inbox-controller.ts', code);
console.log('Fixed use-inbox-controller.ts');
