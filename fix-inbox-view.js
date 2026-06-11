const fs = require('fs');
let code = fs.readFileSync('src/components/atendimentos/inbox-view.tsx', 'utf8');

if (!code.includes('onFetchAllMessages={')) {
    code = code.replace(
        'onSwitchConnection={controller.handleSwitchConnection}',
        'onSwitchConnection={controller.handleSwitchConnection}\n                onFetchAllMessages={controller.handleFetchAllMessages}'
    );
}

fs.writeFileSync('src/components/atendimentos/inbox-view.tsx', code);
console.log('Fixed inbox-view.tsx');
