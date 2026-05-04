const { execSync } = require('child_process');

// Massive list of possible service names
const names = [
  'MasterIA', 'masteria', 'master-ia', 'Master-IA',
  'whatsmeow', 'WhatsMeow', 'whatsmeow-service', 'WhatsmeowService',
  'whatsapp', 'Whatsapp', 'WhatsApp', 'whatsapp-service',
  'go', 'go-service', 'Go', 'GoService',
  'backend', 'Backend', 'api', 'API',
  'microservice', 'micro', 'service',
  'worker', 'Worker',
  'next', 'nextjs', 'Next', 'NextJS', 'frontend', 'Frontend',
  'web', 'Web', 'app', 'App',
  'master', 'Master',
  'dashboard', 'Dashboard',
  'redis', 'Redis', 'postgres', 'Postgres',
  'whatsmeow-go', 'go-whatsmeow',
  'baileys', 'Baileys', 'baileys-service',
  'ia', 'IA', 'bot', 'Bot',
  'master-ia-oficial', 'master-ia-oficial-v2', 'master-ia-oficial-v2-main',
];

const env = { ...process.env, RAILWAY_TOKEN: '26da84a5-364f-416d-a9f0-c8f492af2fa2' };

const found = [];
for (const name of names) {
  try {
    const out = execSync(`railway up -d --service "${name}"`, { env, timeout: 8000, cwd: process.cwd() }).toString();
    if (out.includes('Indexing') || out.includes('Uploading') || out.includes('Build Logs')) {
      console.log(`✅ FOUND: "${name}" => ${out.trim()}`);
      found.push(name);
    }
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    if (!stderr.includes('Service not found') && !stdout.includes('Service not found')) {
      console.log(`⚠️  "${name}" => unexpected: ${stderr || stdout}`);
    }
  }
}

if (found.length === 0) {
  console.log('\n❌ No service names matched. All common names returned "Service not found".');
} else {
  console.log('\n🎉 Found services:', found);
}
