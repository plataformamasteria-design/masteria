const { execFileSync } = require('child_process');
const fs = require('fs');

try {
    const rawOut = execFileSync('railway.cmd', ['variables', '--kv', '--service', '7c8cd7bd-09ff-4383-b665-397c849260f1'], {
        env: process.env,
        shell: true,
    });
    fs.writeFileSync('railway-kv-dump.txt', rawOut);
    console.log('Dumped to railway-kv-dump.txt');
} catch (e) {
    console.error('Failed to dump', e);
}
