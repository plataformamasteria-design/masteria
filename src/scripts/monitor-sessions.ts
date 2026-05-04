
import { SessionMonitor } from '../lib/baileys/session-monitor';

// Intervalo de verificação em milissegundos (ex: 5 minutos)
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function main() {
  console.log('Iniciando serviço de monitoramento de sessões WhatsApp...');
  
  const monitor = SessionMonitor.getInstance();

  // Execução inicial imediata
  await monitor.checkAndRecoverSessions();

  // Loop infinito
  setInterval(async () => {
    await monitor.checkAndRecoverSessions();
  }, CHECK_INTERVAL_MS);

  console.log(`Monitoramento ativo. Verificando a cada ${CHECK_INTERVAL_MS / 1000} segundos.`);
  
  // Manter processo vivo
  process.on('SIGINT', () => {
    console.log('Parando serviço de monitoramento...');
    process.exit(0);
  });
}

main().catch(console.error);
