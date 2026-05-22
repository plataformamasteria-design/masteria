const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

try {
  execSync('npx drizzle-kit push', { stdio: 'inherit', env: { ...process.env } });
} catch (e) {
  console.error(e);
}
