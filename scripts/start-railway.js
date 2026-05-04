require('dotenv').config();
console.log('--- RAILWAY BOOTSTRAP ---');
console.log('REDIS_URL:', process.env.REDIS_URL ? 'PRESENT' : 'MISSING');

// Use the standard and safer way to run TS with tsx in a script
// We will just spawn it as a child process or use the programmatic API if possible.
// But the simplest fix is to just use 'tsx' directly in the start command.
// However, the user wants me to fix THIS script.
// Let's use the spawn approach to be absolutely sure env is preserved and loaders are right.

console.log('Restoring sessions...');
const { execSync } = require('child_process');
try {
    execSync('node scripts/restore-sessions.js', { stdio: 'inherit' });
} catch (e) {
    console.warn('Warning: session restoration failed, but continuing...');
}

console.log('Spawning server with node (robust entry point)...');
const { spawn } = require('child_process');
const path = require('path');
const serverPath = path.join(__dirname, '../src/server.js');

const productionEnv = {
    ...process.env,
    NODE_ENV: 'production',
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'production'
};

const child = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: productionEnv
});

child.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    process.exit(code);
});
