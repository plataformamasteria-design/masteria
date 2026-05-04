import { CadenceService } from './cadence-service';
import { db } from './db';
import { logger } from './logger';

interface SchedulerState {
  isRunning: boolean;
  detectorInterval: NodeJS.Timeout | null;
  processorInterval: NodeJS.Timeout | null;
}

const schedulerState: SchedulerState = {
  isRunning: false,
  detectorInterval: null,
  processorInterval: null,
};

/**
 * Detector Job - Executa diariamente para detectar leads inativos
 */
async function runInactiveDetector() {
  logger.info('[CadenceScheduler] Starting inactive leads detection...');

  try {
    const allCompanies = await db.query.companies.findMany({
      columns: {
        id: true,
        name: true,
      },
    });

    let totalEnrolled = 0;

    for (const company of allCompanies) {
      try {
        const enrolledCount = await CadenceService.detectAndEnrollInactive({
          companyId: company.id,
          inactiveDays: 21, // Configurável no futuro
          limit: 100,
        });

        totalEnrolled += enrolledCount;

        logger.info('[CadenceScheduler] Detector completed for company', {
          companyId: company.id,
          companyName: company.name,
          enrolled: enrolledCount,
        });
      } catch (error) {
        logger.error('[CadenceScheduler] Error detecting for company', {
          companyId: company.id,
          error,
        });
      }
    }

    logger.info('[CadenceScheduler] Inactive detection completed', {
      totalCompanies: allCompanies.length,
      totalEnrolled,
    });
  } catch (error) {
    logger.error('[CadenceScheduler] Error in inactive detector', { error });
  }
}

/**
 * Processor Job - Executa a cada hora para processar steps pendentes
 */
async function runStepProcessor() {
  logger.info('[CadenceScheduler] Starting step processor...');

  try {
    const processed = await CadenceService.processPendingSteps({
      batchSize: 100,
    });

    logger.info('[CadenceScheduler] Step processor completed', {
      processed,
    });
  } catch (error) {
    logger.error('[CadenceScheduler] Error in step processor', { error });
  }
}

/**
 * Inicia o scheduler de cadências
 */
export function startCadenceScheduler() {
  if (schedulerState.isRunning) {
    logger.warn('[CadenceScheduler] Scheduler already running');
    return;
  }

  logger.info('[CadenceScheduler] Starting cadence scheduler...');

  // Detector diário - executa às 9h da manhã
  const scheduleDailyDetector = () => {
    const now = new Date();
    const nextRun = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      9,
      0,
      0,
      0
    );

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const msUntilNextRun = nextRun.getTime() - now.getTime();

    setTimeout(() => {
      runInactiveDetector();
      schedulerState.detectorInterval = setInterval(
        runInactiveDetector,
        24 * 60 * 60 * 1000 // 24 horas
      );
    }, msUntilNextRun);

    logger.info('[CadenceScheduler] Detector scheduled for 9 AM daily', {
      nextRun: nextRun.toLocaleString('pt-BR'),
    });
  };

  // Processor horário - executa a cada hora
  const scheduleHourlyProcessor = () => {
    const now = new Date();
    const nextRun = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours() + 1,
      0,
      0,
      0
    );

    const msUntilNextRun = nextRun.getTime() - now.getTime();

    setTimeout(() => {
      runStepProcessor();
      schedulerState.processorInterval = setInterval(
        runStepProcessor,
        60 * 60 * 1000 // 1 hora
      );
    }, msUntilNextRun);

    logger.info('[CadenceScheduler] Processor scheduled for hourly runs', {
      nextRun: nextRun.toLocaleString('pt-BR'),
    });
  };

  // Iniciar schedulers
  scheduleDailyDetector();
  scheduleHourlyProcessor();

  schedulerState.isRunning = true;
  logger.info('[CadenceScheduler] Scheduler started successfully');
}

/**
 * Para o scheduler
 */
export function stopCadenceScheduler() {
  if (!schedulerState.isRunning) {
    return;
  }

  if (schedulerState.detectorInterval) {
    clearInterval(schedulerState.detectorInterval);
    schedulerState.detectorInterval = null;
  }

  if (schedulerState.processorInterval) {
    clearInterval(schedulerState.processorInterval);
    schedulerState.processorInterval = null;
  }

  schedulerState.isRunning = false;
  logger.info('[CadenceScheduler] Scheduler stopped');
}

/**
 * Executar detector manualmente (útil para testes)
 */
export async function runDetectorManually() {
  return runInactiveDetector();
}

/**
 * Executar processor manualmente (útil para testes)
 */
export async function runProcessorManually() {
  return runStepProcessor();
}

export function isSchedulerRunning() {
  return schedulerState.isRunning;
}
