const fs = require('fs');
let code = fs.readFileSync('src/components/atendimentos/active-chat.tsx', 'utf8');

if (!code.includes('onFetchAllMessages?: () => void;')) {
    code = code.replace(
        'interface ActiveChatProps {',
        'interface ActiveChatProps {\n  onFetchAllMessages?: () => void;'
    );
}

if (!code.includes('onFetchAllMessages,')) {
    code = code.replace(
        /onSwitchConnection,\n  onRefreshConversations,/g,
        'onSwitchConnection,\n  onRefreshConversations,\n  onFetchAllMessages,'
    );
}

code = code.replace(
    /setShowAllMessages\(true\);\n\s*setShowConnectionDropdown\(false\);/,
    'setShowAllMessages(true);\n                        setShowConnectionDropdown(false);\n                        if (onFetchAllMessages) onFetchAllMessages();'
);

fs.writeFileSync('src/components/atendimentos/active-chat.tsx', code);
console.log('Fixed active-chat.tsx');
