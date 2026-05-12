import fs from 'fs';
import { execSync } from 'child_process';

const env = fs.readFileSync('.env', 'utf8').split('\n');
let token = '';
for (const rawLine of env) {
    const line = rawLine.trim();
    if (line.startsWith('SUPABASE_ACCESS_TOKEN=')) {
        token = line.split('=')[1].replace(/['"]/g, '').trim();
    }
}
process.env.SUPABASE_ACCESS_TOKEN = token;

const functionName = process.argv[2] || 'automation-executor';

try {
    console.log(`Deploying ${functionName}...`);
    const result = execSync(`npx supabase functions deploy ${functionName} --no-verify-jwt`, { encoding: 'utf8' });
    console.log(result);
} catch (e) {
    console.error(e.stdout);
    console.error(e.stderr);
    process.exit(1);
}
