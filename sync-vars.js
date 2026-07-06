const fs = require('fs');
const { execSync } = require('child_process');

const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');

for (let line of lines) {
  line = line.trim();
  if (!line || line.startsWith('#')) continue;

  const splitIdx = line.indexOf('=');
  if (splitIdx > 0) {
    const key = line.substring(0, splitIdx).trim();
    let value = line.substring(splitIdx + 1).trim();

    if (key.startsWith('RAILWAY_')) continue;
    if (['APP_URL', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_CUSTOM_DOMAIN', 'NEXTAUTH_URL', 'REDIS_URL'].includes(key)) continue;

    if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.substring(1, value.length - 1);

    console.log(`Setting ${key}...`);
    try {
      execSync(`railway variables set "${key}=${value}" --skip-deploys -s masteria`, {
        stdio: 'inherit',
        env: { ...process.env, RAILWAY_TOKEN: '41cc25ca-977d-467d-aab7-5427da65009f' }
      });
    } catch (e) {
      console.error(`Failed to set ${key}`);
    }
  }
}
console.log('Done!');
