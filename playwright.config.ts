import { defineConfig, devices } from '@playwright/test';

// ✅ REGRA: Sempre usar URL do Replit em modo desenvolvimento
const REPLIT_DEV_URL = 'https://62863c59-d08b-44f5-a414-d7529041de1a-00-16zuyl87dp7m9.kirk.replit.dev';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || REPLIT_DEV_URL;

// ✅ VALIDAÇÃO: Garantir que não está usando produção em desenvolvimento
if (!process.env.CI && BASE_URL.includes('masteria-temporario.up.railway.app')) {
  console.warn('⚠️  AVISO: Usando URL de produção! Use PLAYWRIGHT_BASE_URL para desenvolvimento.');
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // ✅ REGRA: 0 retries em desenvolvimento
  workers: 1, // ✅ REGRA: 1 worker para evitar conflitos
  timeout: 60000, // ✅ Aumentar timeout padrão para 60s (Replit pode ser lento)
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry', // ✅ REGRA: Trace para debug
    screenshot: 'only-on-failure', // ✅ REGRA: Screenshots em falhas
    video: 'retain-on-failure', // ✅ REGRA: Vídeo em falhas
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
      },
    },
  ],
  // ✅ REGRA: webServer disabled - usando URL do Replit diretamente
  // webServer: {
  //   command: 'echo "Server already running"',
  //   url: BASE_URL,
  //   reuseExistingServer: true,
  // },
});
