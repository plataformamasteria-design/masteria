#!/usr/bin/env tsx
// Script de monitoramento em tempo real de detecções de reunião
// Uso: npm run tsx scripts/monitor-meeting-logs.ts

import { db } from '@/lib/db';
import { automationLogs } from '@/lib/db/schema';
import { desc, sql, and, gte } from 'drizzle-orm';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function formatTimestamp(date: Date): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

async function monitorLogs() {
  console.clear();
  console.log(`${COLORS.bright}${COLORS.cyan}╔════════════════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}║   🔍 MONITOR DE DETECÇÃO DE REUNIÕES EM TEMPO REAL           ║${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}╚════════════════════════════════════════════════════════════════╝${COLORS.reset}\n`);
  
  console.log(`${COLORS.yellow}⏰ Iniciado em: ${formatTimestamp(new Date())}${COLORS.reset}`);
  console.log(`${COLORS.blue}📊 Monitorando logs dos últimos 5 minutos...${COLORS.reset}\n`);
  console.log(`${COLORS.magenta}💡 Faça um teste no WhatsApp agora!${COLORS.reset}`);
  console.log(`${COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);

  let lastTimestamp: Date | null = null;
  let lastLogId: string | null = null;
  let logsFound = 0;
  let isQuerying = false;

  // Polling a cada 2 segundos com proteção contra sobreposição
  setInterval(async () => {
    if (isQuerying) return; // Evitar queries sobrepostas
    
    try {
      isQuerying = true;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const conditions = [
        gte(automationLogs.createdAt, fiveMinutesAgo),
        sql`(${automationLogs.message} LIKE '%REUNIÃO%' OR ${automationLogs.message} LIKE '%reunião%' OR ${automationLogs.message} LIKE '%meeting%')`
      ];

      // Usar timestamp + UUID como tie-breaker para garantir monotonia
      if (lastTimestamp) {
        conditions.push(
          sql`(${automationLogs.createdAt} > ${lastTimestamp} OR (${automationLogs.createdAt} = ${lastTimestamp} AND ${automationLogs.id} > ${lastLogId}))`
        );
      }

      const logs = await db.query.automationLogs.findMany({
        where: and(...conditions),
        orderBy: [desc(automationLogs.createdAt), desc(automationLogs.id)],
        limit: 50
      });

      if (logs.length > 0) {
        // Inverter para mostrar do mais antigo para o mais novo
        logs.reverse();

        for (const log of logs) {
          logsFound++;
          
          const timestamp = formatTimestamp(log.createdAt);
          const level = log.level;
          
          let levelColor = COLORS.reset;
          let levelIcon = '•';
          
          if (level === 'INFO') {
            levelColor = COLORS.green;
            levelIcon = '✓';
          } else if (level === 'WARN') {
            levelColor = COLORS.yellow;
            levelIcon = '⚠';
          } else if (level === 'ERROR') {
            levelColor = COLORS.red;
            levelIcon = '✗';
          }

          console.log(`${COLORS.bright}[${timestamp}]${COLORS.reset} ${levelColor}${levelIcon} ${level}${COLORS.reset}`);
          
          // Destacar se for detecção de reunião
          if (log.message.includes('REUNIÃO DETECTADA')) {
            console.log(`${COLORS.bright}${COLORS.green}🎯 ${log.message}${COLORS.reset}`);
          } else {
            console.log(`   ${log.message}`);
          }

          // Mostrar detalhes se houver
          if (log.details && typeof log.details === 'object') {
            const details = log.details as any;
            
            if (details.processedMessageId) {
              console.log(`${COLORS.cyan}   📨 Message ID: ${details.processedMessageId}${COLORS.reset}`);
            }
            
            if (details.evidence) {
              console.log(`${COLORS.magenta}   📋 Evidências: ${details.evidence}${COLORS.reset}`);
            }

            if (details.confidence) {
              console.log(`${COLORS.yellow}   📊 Confiança: ${details.confidence}%${COLORS.reset}`);
            }
          }

          console.log('');
          
          // Atualizar último timestamp + ID processado (tie-breaker para monotonia)
          lastTimestamp = log.createdAt;
          lastLogId = log.id;
        }

        // Separador
        console.log(`${COLORS.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}\n`);
      }

    } catch (error) {
      console.error(`${COLORS.red}❌ Erro ao monitorar logs:${COLORS.reset}`, error);
    } finally {
      isQuerying = false;
    }
  }, 2000); // Verifica a cada 2 segundos

  // Mostrar estatísticas a cada 30 segundos
  setInterval(() => {
    const now = formatTimestamp(new Date());
    console.log(`${COLORS.blue}📊 [${now}] Total de logs encontrados: ${logsFound}${COLORS.reset}\n`);
  }, 30000);
}

// Capturar Ctrl+C para sair graciosamente
process.on('SIGINT', () => {
  console.log(`\n\n${COLORS.yellow}⏸️  Monitor encerrado pelo usuário${COLORS.reset}`);
  console.log(`${COLORS.green}✅ Obrigado por usar o monitor!${COLORS.reset}\n`);
  process.exit(0);
});

console.log(`${COLORS.bright}Pressione Ctrl+C para sair${COLORS.reset}\n`);
monitorLogs().catch((error) => {
  console.error(`${COLORS.red}Erro fatal:${COLORS.reset}`, error);
  process.exit(1);
});
