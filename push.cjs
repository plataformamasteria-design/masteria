const { config } = require('dotenv');
config({ path: '.env.local' });
config({ path: '.env' });
let url = process.env.DATABASE_URL || '';
if (!url.includes('sslmode')) url += '?sslmode=require';
process.env.DATABASE_URL = url;
const { spawnSync } = require('child_process');
const result = spawnSync('npx', ['drizzle-kit', 'push', '--config=drizzle.config.ts'], { stdio: 'inherit', shell: true });
process.exit(result.status || 0);
