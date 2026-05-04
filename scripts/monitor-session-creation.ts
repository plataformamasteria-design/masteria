/**
 * Monitor de Logs: Criação de Sessão WhatsApp Baileys
 * Monitora logs do frontend, middleware e backend
 */

import * as fs from 'fs';
import * as path from 'path';

const LOG_PATTERNS = {
  baileys: /\[Baileys\]/i,
  api: /\[API\]/i,
  session: /\[SessionService\]|\[Session\]/i,
  error: /error|Error|ERROR|❌|⚠️|failed|Failed|FAILED/i,
  success: /✅|success|Success|SUCCESS|connected|Connected/i,
  websocket: /WebSocket|Socket|socket/i,
  qr: /QR|qr|qrcode|QRCode/i,
};

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warning' | 'success';
  source: 'baileys' | 'api' | 'session' | 'websocket' | 'other';
  message: string;
  raw: string;
}

const logs: LogEntry[] = [];

function parseLogLine(line: string): LogEntry | null {
  const timestamp = new Date().toISOString();
  
  // Detectar nível
  let level: 'info' | 'error' | 'warning' | 'success' = 'info';
  if (LOG_PATTERNS.error.test(line)) level = 'error';
  else if (LOG_PATTERNS.success.test(line)) level = 'success';
  else if (line.includes('⚠️') || line.includes('WARN')) level = 'warning';
  
  // Detectar fonte
  let source: 'baileys' | 'api' | 'session' | 'websocket' | 'other' = 'other';
  if (LOG_PATTERNS.baileys.test(line)) source = 'baileys';
  else if (LOG_PATTERNS.api.test(line)) source = 'api';
  else if (LOG_PATTERNS.session.test(line)) source = 'session';
  else if (LOG_PATTERNS.websocket.test(line)) source = 'websocket';
  
  return {
    timestamp,
    level,
    source,
    message: line.trim(),
    raw: line,
  };
}

function printLog(entry: LogEntry) {
  const colors = {
    info: '\x1b[36m',    // Cyan
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m', // Yellow
    success: '\x1b[32m', // Green
    reset: '\x1b[0m',
  };
  
  const sourceColors = {
    baileys: '\x1b[35m',    // Magenta
    api: '\x1b[34m',        // Blue
    session: '\x1b[36m',    // Cyan
    websocket: '\x1b[33m',  // Yellow
    other: '\x1b[37m',      // White
  };
  
  const time = new Date(entry.timestamp).toLocaleTimeString();
  const levelIcon = {
    info: 'ℹ️',
    error: '❌',
    warning: '⚠️',
    success: '✅',
  }[entry.level];
  
  console.log(
    `${colors[entry.level]}${levelIcon} ${time}${colors.reset} ` +
    `${sourceColors[entry.source]}[${entry.source.toUpperCase()}]${colors.reset} ` +
    `${entry.message}`
  );
}

async function monitorLogs() {
  console.log('=== 📊 MONITOR DE LOGS: Criação de Sessão WhatsApp Baileys ===');
  console.log('');
  console.log('Monitorando logs em tempo real...');
  console.log('Pressione Ctrl+C para parar');
  console.log('');
  console.log('Padrões monitorados:');
  console.log('  - [Baileys] - Logs do BaileysSessionManager');
  console.log('  - [API] - Logs das APIs');
  console.log('  - [SessionService] - Logs do serviço de sessões');
  console.log('  - WebSocket - Logs de WebSocket');
  console.log('  - Erros, Warnings e Success');
  console.log('');
  console.log('Aguardando logs...');
  console.log('');
  
  // Monitorar console.log via interceptor (limitado, mas útil)
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.log = (...args: any[]) => {
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const entry = parseLogLine(message);
    if (entry && (entry.source !== 'other' || entry.level !== 'info')) {
      logs.push(entry);
      printLog(entry);
    }
    originalLog.apply(console, args);
  };
  
  console.error = (...args: any[]) => {
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const entry = parseLogLine(message);
    if (entry) {
      entry.level = 'error';
      logs.push(entry);
      printLog(entry);
    }
    originalError.apply(console, args);
  };
  
  console.warn = (...args: any[]) => {
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const entry = parseLogLine(message);
    if (entry) {
      entry.level = 'warning';
      logs.push(entry);
      printLog(entry);
    }
    originalWarn.apply(console, args);
  };
  
  // Aguardar indefinidamente
  process.on('SIGINT', () => {
    console.log('');
    console.log('=== 📊 RESUMO DOS LOGS ===');
    console.log('');
    
    const errors = logs.filter(l => l.level === 'error');
    const warnings = logs.filter(l => l.level === 'warning');
    const successes = logs.filter(l => l.level === 'success');
    
    console.log(`Total de logs capturados: ${logs.length}`);
    console.log(`Erros: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Success: ${successes.length}`);
    console.log('');
    
    if (errors.length > 0) {
      console.log('🔴 ERROS ENCONTRADOS:');
      errors.forEach(e => {
        console.log(`   - [${e.source}] ${e.message}`);
      });
      console.log('');
    }
    
    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS ENCONTRADOS:');
      warnings.forEach(w => {
        console.log(`   - [${w.source}] ${w.message}`);
      });
      console.log('');
    }
    
    // Salvar relatório
    const reportPath = path.join(process.cwd(), 'session-creation-logs.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: {
        total: logs.length,
        errors: errors.length,
        warnings: warnings.length,
        successes: successes.length,
      },
      logs: logs,
      timestamp: new Date().toISOString(),
    }, null, 2));
    
    console.log(`📄 Relatório salvo em: ${reportPath}`);
    console.log('');
    
    process.exit(0);
  });
  
  // Manter processo vivo
  await new Promise(() => {});
}

// Nota: Este script funciona melhor quando executado junto com o servidor
// Para monitorar logs reais, execute: npm run dev | npx tsx scripts/monitor-session-creation.ts
console.log('⚠️  NOTA: Para monitorar logs reais do servidor, execute:');
console.log('   npm run dev 2>&1 | npx tsx scripts/monitor-session-creation.ts');
console.log('');
console.log('Ou execute este script em um terminal separado e monitore manualmente.');
console.log('');

monitorLogs();
