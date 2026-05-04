/**
 * ✅ FASE 3.1: Queue para Upload de Mídia
 * Processa uploads de forma assíncrona com retry automático
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../lib/redis-connection';
import { uploadFileToS3 } from '@/lib/s3';
import { mediaUploadBreaker } from '@/utils/circuit-breaker';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

interface MediaUploadJobData {
  connectionId: string;
  companyId: string;
  s3Key: string;
  buffer?: Buffer;
  filePath?: string;
  mimeType: string;
  messageId?: string;
  priority?: number;
}

interface MediaUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Singleton instance
let mediaUploadQueue: Queue<MediaUploadJobData, MediaUploadResult> | null = null;
let mediaUploadWorker: Worker<MediaUploadJobData, MediaUploadResult> | null = null;
let mediaUploadEvents: QueueEvents | null = null;

/**
 * Inicializa a queue de upload de mídia
 */
export function initializeMediaUploadQueue(): void {
  if (mediaUploadQueue) {
    return; // Já inicializado
  }

  try {
    console.log('🔄 [MediaUploadQueue] Initializing with distinct Redis connections...');

    // Create distinct connection for Queue
    const queueConnection = createRedisConnection();

    // Criar queue
    mediaUploadQueue = new Queue<MediaUploadJobData, MediaUploadResult>('media-upload', {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Manter por 1 hora
          count: 1000, // Manter últimos 1000 jobs
        },
        removeOnFail: {
          age: 86400, // Manter falhas por 24 horas
          count: 500, // Manter últimas 500 falhas
        },
      },
    });

    // ✅ CORREÇÃO: Inicializar QueueEvents necessário para waitUntilFinished
    console.log('🔄 [MediaUploadQueue] Spawning distinct Redis connection for QueueEvents...');
    const eventsConnection = createRedisConnection();
    mediaUploadEvents = new QueueEvents('media-upload', { connection: eventsConnection });

    // Criar worker
    console.log('🔄 [MediaUploadQueue] Spawning distinct Redis connection for Worker...');
    const workerConnection = createRedisConnection();
    mediaUploadWorker = new Worker<MediaUploadJobData, MediaUploadResult>(
      'media-upload',
      async (job) => {
        const jobData = job.data;

        // Destructure needed fields
        const { companyId, s3Key, mimeType, connectionId, messageId, filePath } = jobData;
        let { buffer } = jobData;

        if (!companyId || !s3Key) {
          console.error('[MediaUploadWorker] ❌ Invalid job data:', jobData);
          throw new Error('Invalid job data');
        }

        // Helper for cleanup
        const cleanup = () => {
          if (filePath && fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              console.log(`[MediaUploadQueue] 🧹 Cleaned up temporary file: ${filePath}`);
            } catch (cleanupErr) {
              console.warn(`[MediaUploadQueue] ⚠️ Failed to cleanup ${filePath}:`, cleanupErr);
            }
          }
        };

        try {
          // If buffer is missing but filePath exists, read it
          if (!buffer && filePath) {
            if (fs.existsSync(filePath)) {
              buffer = fs.readFileSync(filePath);
            } else {
              throw new Error(`Temporary file not found: ${filePath}`);
            }
          }

          // Reconstitute Buffer if it was serialized by BullMQ/Redis
          if (buffer && typeof buffer === 'object' && 'type' in buffer && (buffer as any).type === 'Buffer' && 'data' in buffer) {
            buffer = Buffer.from((buffer as any).data);
          }

          if (!buffer) {
            throw new Error('No buffer or valid filePath found in job data');
          }

          console.log(`[MediaUploadQueue] Processing upload for connection ${connectionId}, message ${messageId || 'N/A'} (${buffer.length} bytes)`);

          // ✅ FASE 3.2: Usar Circuit Breaker para uploads
          const url = await mediaUploadBreaker.execute(() =>
            uploadFileToS3(companyId, s3Key, buffer!, mimeType)
          );

          console.log(`[MediaUploadQueue] ✅ Upload successful: ${url}`);

          cleanup();

          // ✅ FASE 4: GC Hint for large files
          if (buffer.length > 5 * 1024 * 1024 && typeof global !== 'undefined' && (global as any).gc) {
            try {
              (global as any).gc();
            } catch (_e) { /* GC hint best effort */ }
          }

          return {
            success: true,
            url,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[MediaUploadQueue] ❌ Upload failed for ${s3Key}:`, errorMessage);

          // Se ainda há tentativas, relançar erro para retry
          if (job.attemptsMade < (job.opts.attempts || 3)) {
            throw error;
          }

          cleanup();
          return {
            success: false,
            error: errorMessage,
          };
        }
      },
      {
        connection: workerConnection,
        concurrency: 2, // ✅ Reduzido de 5 para 2 para diminuir pico de uso de RAM
        limiter: {
          max: 10, // Máximo 10 jobs por período
          duration: 1000, // Por segundo
        },
      }
    );

    // Error handlers on connections to trace issues without crashing
    queueConnection.on('error', (err) => console.error('❌ [MediaUploadQueue] Queue connection error:', err.message));
    eventsConnection.on('error', (err) => console.error('❌ [MediaUploadQueue] Events connection error:', err.message));
    workerConnection.on('error', (err) => console.error('❌ [MediaUploadQueue] Worker connection error:', err.message));

    // Event handlers
    mediaUploadWorker.on('completed', (job) => {
      console.log(`✅ [MediaUploadQueue] Job ${job.id} completed successfully`);
    });

    mediaUploadWorker.on('failed', (job, err) => {
      console.error(
        `❌ [MediaUploadQueue] Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
        err.message
      );
    });

    mediaUploadWorker.on('active', (job) => {
      console.log(
        `🔄 [MediaUploadQueue] Processing job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts || 3})`
      );
    });

    mediaUploadWorker.on('error', (err) => {
      console.error('❌ [MediaUploadQueue] Worker error:', err);
    });

    console.log('✅ [MediaUploadQueue] Queue and worker initialized');
  } catch (error) {
    console.error('[MediaUploadQueue] Failed to initialize:', error);
    // Não lançar erro - sistema pode funcionar sem queue (fallback síncrono)
  }
}

/**
 * Adiciona um upload de mídia à queue
 */
export async function queueMediaUpload(
  connectionId: string,
  companyId: string,
  s3Key: string,
  bufferOrPath: Buffer | string, // Accept Buffer or File Path
  mimeType: string,
  messageId?: string,
  priority: number = 0
): Promise<string | null> {
  let buffer: Buffer | undefined;
  let inputFilePath: string | undefined;

  // Resolve input type
  if (Buffer.isBuffer(bufferOrPath)) {
    buffer = bufferOrPath;
  } else if (typeof bufferOrPath === 'string') {
    inputFilePath = bufferOrPath;
  } else {
    console.error('[MediaUploadQueue] ❌ Invalid input: provide Buffer or filePath string');
    return null;
  }

  const bufferSize = buffer ? buffer.length : (inputFilePath ? fs.statSync(inputFilePath).size : 0);
  const isBuffer = !!buffer;

  if (process.env.DEBUG || bufferSize > 1024 * 1024) {
    console.log(`[MediaUploadQueue] Request to queue upload. Key: ${s3Key}, Size: ${bufferSize} bytes, Input: ${isBuffer ? 'Buffer' : 'File'}, Mime: ${mimeType}`);
  }

  if (!mediaUploadQueue || !mediaUploadEvents) {
    // Fallback síncrono se queue não estiver disponível
    console.warn('[MediaUploadQueue] Queue or Events not initialized, using synchronous upload');
    try {
      const fallbackBuffer = buffer || (inputFilePath ? fs.readFileSync(inputFilePath) : undefined);
      if (!fallbackBuffer) throw new Error('No buffer or file available for fallback');
      return await uploadFileToS3(companyId, s3Key, fallbackBuffer, mimeType);
    } catch (error) {
      console.error('[MediaUploadQueue] Synchronous upload failed:', error);
      return null;
    }
  }

  try {
    // ✅ REDUCED THRESHOLD: 256KB to aggressively save RAM
    const SIZE_THRESHOLD = 256 * 1024;
    let filePath: string | undefined = inputFilePath;
    let jobBuffer: Buffer | undefined;

    // Handle Buffer Input: Isolate and Offload if large
    if (buffer) {
      jobBuffer = Buffer.from(buffer); // Isolate memory

      if (bufferSize > SIZE_THRESHOLD) {
        try {
          filePath = path.join(os.tmpdir(), `upload-${uuidv4()}`);
          fs.writeFileSync(filePath, jobBuffer);

          if (process.env.DEBUG) {
            console.log(`[MediaUploadQueue] 💾 Large buffer detected (${(bufferSize / 1024 / 1024).toFixed(2)}MB). Queuing via disk: ${filePath}`);
          }

          jobBuffer = undefined; // Drop buffer from memory

          // GC Hint
          if (typeof global !== 'undefined' && (global as any).gc) {
            try { (global as any).gc(); } catch (_e) { /* GC hint best effort */ }
          }
        } catch (fsError) {
          console.error(`[MediaUploadQueue] ❌ Failed to write temp file: ${fsError}`);
          // Fallback: keep jobBuffer defined and attempt Redis (risky)
        }
      }
    } else if (inputFilePath) {
      // Input is already a file path, nothing to write.
      if (process.env.DEBUG) {
        console.log(`[MediaUploadQueue] 📂 File path provided directly: ${inputFilePath}`);
      }
      jobBuffer = undefined;
    }

    // FINAL SAFETY CHECK: If jobBuffer is still defined (meaning not offloaded), ensure it is NOT huge
    if (jobBuffer && jobBuffer.length > 5 * 1024 * 1024) {
      console.error(`[MediaUploadQueue] 🛑 CRITICAL: Attempting to send ${jobBuffer.length} bytes to Redis. Aborting to prevent crash. Switched to Sync Upload.`);
      const fallbackBuffer = jobBuffer;
      return await uploadFileToS3(companyId, s3Key, fallbackBuffer, mimeType);
    }

    const job = await mediaUploadQueue.add(
      'upload',
      {
        connectionId,
        companyId,
        s3Key,
        buffer: jobBuffer, // Will be undefined for large files or file-path inputs
        filePath,
        mimeType,
        messageId,
        priority,
      },
      {
        priority,
        jobId: messageId ? `media-${messageId}` : undefined, // Evitar duplicatas
        removeOnComplete: true, // Aggressively remove completed jobs to save Redis memory
        removeOnFail: true
      }
    );

    console.log(`[MediaUploadQueue] ✅ Job ${job.id} queued for upload (${filePath ? 'DISK' : 'BUFFER'}). Payload Check: Buffer is ${jobBuffer ? 'PRESENT' : 'UNDEFINED'}`);

    // Aguardar resultado (opcional - pode ser assíncrono)
    // ✅ CORREÇÃO: Verificar se já completou antes de esperar o evento, evitando race conditions
    const state = await job.getState();
    if (state === 'completed') {
      const res = job.returnvalue;
      if (res?.success && res.url) {
        console.log(`[MediaUploadQueue] ⚡ Job ${job.id} already finished. Returning URL.`);
        return res.url;
      }
    }

    const result = await job.waitUntilFinished(mediaUploadEvents!, 120000); // Aumentado para 120s por segurança

    if (result.success && result.url) {
      return result.url;
    }

    console.error(`[MediaUploadQueue] Upload failed for ${s3Key}: ${result.error}`);
    return null;
  } catch (error: any) {
    if (error?.message?.includes('max request size exceeded')) {
      console.error('[MediaUploadQueue] 🛑 Redis Max Size Exceeded caught! Falling back to sync upload.');
    } else {
      console.error('[MediaUploadQueue] Failed to queue upload:', error);
    }

    // Fallback síncrono em caso de erro
    try {
      console.log('[MediaUploadQueue] Attempting synchronous fallback...');
      const fallbackBuffer = buffer || (inputFilePath ? fs.readFileSync(inputFilePath) : undefined);
      if (!fallbackBuffer) throw new Error('No buffer available for fallback');
      return await uploadFileToS3(companyId, s3Key, fallbackBuffer, mimeType);
    } catch (fallbackError) {
      console.error('[MediaUploadQueue] Fallback upload also failed:', fallbackError);
      return null;
    }
  }
}

/**
 * Obtém estatísticas da queue
 */
export async function getMediaUploadQueueStats() {
  if (!mediaUploadQueue) {
    return null;
  }

  try {
    const [waiting, active, completed, failed] = await Promise.all([
      mediaUploadQueue.getWaitingCount(),
      mediaUploadQueue.getActiveCount(),
      mediaUploadQueue.getCompletedCount(),
      mediaUploadQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    };
  } catch (error) {
    console.error('[MediaUploadQueue] Failed to get stats:', error);
    return null;
  }
}

/**
 * Fecha a queue e worker graciosamente
 */
export async function closeMediaUploadQueue(): Promise<void> {
  if (mediaUploadWorker) {
    await mediaUploadWorker.close();
    mediaUploadWorker = null;
  }

  if (mediaUploadQueue) {
    await mediaUploadQueue.close();
    mediaUploadQueue = null;
  }

  if (mediaUploadEvents) {
    await mediaUploadEvents.close();
    mediaUploadEvents = null;
  }

  console.log('✅ [MediaUploadQueue] Queue and worker closed');
}
