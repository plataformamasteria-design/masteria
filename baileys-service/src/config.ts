import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  apiKey: process.env.API_KEY || '',
  debug: process.env.DEBUG === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
  webhookUrl: process.env.MASTER_IA_WEBHOOK_URL || 'http://localhost:3000/api/v1/webhooks/baileys',
} as const;

// Validation
if (!config.databaseUrl) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}
