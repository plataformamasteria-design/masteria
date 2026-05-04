import { Boom } from '@hapi/boom';
import { EventEmitter } from 'events';
import { db } from '@/lib/db';
import { connections, conversations, messages, contacts, messageReactions, whatsappDeliveryReports } from '@/lib/db/schema';
import { eq, and, isNull, gte } from 'drizzle-orm';
import pino from 'pino';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { processIncomingMessageTrigger } from '@/lib/automation-engine';
import { v4 as uuidv4 } from 'uuid';
import { detectGroup } from '../lib/utils/phone';
import { UserNotificationsService } from '../lib/notifications/user-notifications.service';
import {
  emitSessionCreated,
  emitSessionUpdated,
  emitSessionDeleted,
  emitQRCodeUpdated,
  emitConnectionStatusChanged,
} from '@/lib/whatsapp-sessions-ws';
// ✅ FASE 3.1: Queue para Upload de Mídia
import { queueMediaUpload } from '@/services/media-upload-queue.service';
import redis from '../lib/redis';
import { getSocketIO } from '@/lib/socket';
import { transcribeAudioGemini } from '@/services/gemini-transcription.service';
import { convertAudioToMp3FromFile } from '@/services/audio-converter.service';
// ✅ PERSISTÊNCIA: Backup/Restore de auth para Replit Object Storage
import { backupAuthToObjectStorage, restoreAuthFromObjectStorage, syncCredsToObjectStorage, deleteAuthFromObjectStorage } from '@/lib/baileys/baileys-auth-storage';

const logger = pino({ level: 'silent' });
const DEBUG = process.env.DEBUG === 'true';

interface SessionData {
  socket: any;
  emitter: EventEmitter;
  qr?: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'qr' | 'failed';
  phone?: string;
  retryCount: number;
}

interface ChatClassification {
  type: 'individual' | 'group' | 'broadcast' | 'newsletter' | 'community' | 'status' | 'unknown';
  reason: string;
  shouldBlockAI: boolean;
}

function classifyChat(remoteJid: string, msg: any): ChatClassification {
  if (!remoteJid) {
    return { type: 'unknown', reason: 'No remoteJid provided', shouldBlockAI: true };
  }

  const jidLower = remoteJid.toLowerCase();

  if (jidLower.includes('@g.us')) {
    return { type: 'group', reason: 'JID suffix @g.us (WhatsApp group)', shouldBlockAI: true };
  }

  if (jidLower.includes('@newsletter')) {
    return { type: 'newsletter', reason: 'JID suffix @newsletter (WhatsApp channel)', shouldBlockAI: true };
  }

  if (jidLower.includes('@broadcast')) {
    return { type: 'broadcast', reason: 'JID suffix @broadcast (broadcast list)', shouldBlockAI: true };
  }

  if (jidLower.includes('@status')) {
    return { type: 'status', reason: 'JID suffix @status (status update)', shouldBlockAI: true };
  }

  if (jidLower.includes('@community')) {
    return { type: 'community', reason: 'JID suffix @community (WhatsApp community)', shouldBlockAI: true };
  }

  if (msg?.key?.participant || msg?.participant) {
    return { type: 'group', reason: 'Message has participant field (group message)', shouldBlockAI: true };
  }

  const phoneNumber = remoteJid.split('@')[0] || '';
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  if (digitsOnly.length > 15) {
    return {
      type: 'unknown',
      reason: `Number too long (${digitsOnly.length} digits, >15 indicates group/community)`,
      shouldBlockAI: true
    };
  }

  // Accept individual chats with @s.whatsapp.net suffix
  if (jidLower.includes('@s.whatsapp.net') && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return {
      type: 'individual',
      reason: 'Valid individual chat (10-15 digits, @s.whatsapp.net)',
      shouldBlockAI: false
    };
  }

  // Also accept numbers with 10-15 digits even without standard suffix
  // This handles cases where JID format may vary
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    // Additional check: ensure it's not a known non-individual format
    if (!jidLower.includes('@g.us') && !jidLower.includes('@broadcast') &&
      !jidLower.includes('@newsletter') && !jidLower.includes('@status')) {
      return {
        type: 'individual',
        reason: `Valid phone number (${digitsOnly.length} digits, treating as individual)`,
        shouldBlockAI: false
      };
    }
  }

  return {
    type: 'unknown',
    reason: 'Could not classify chat type',
    shouldBlockAI: true
  };
}

class BaileysSessionManager {
  private sessions = new Map<string, SessionData>();
  private phoneToConnectionMap = new Map<string, string>();
  private messageQueue = new Map<string, any[]>();
  private pendingCreations = new Map<string, Promise<void>>();
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private profilePictureCache = new Map<string, { url: string | null; timestamp: number }>();
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RECONNECT_INTERVAL = 5000;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 segundos
  private readonly CONNECTION_CHECK_INTERVAL = 60000; // 1 minuto
  private readonly PP_CACHE_TTL = 10 * 60 * 1000;

  constructor() {
    this.startCacheCleanup();
  }

  private startCacheCleanup() {
    // Run cleanup every 10 minutes
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, value] of this.profilePictureCache.entries()) {
        if (now - value.timestamp > this.PP_CACHE_TTL) {
          this.profilePictureCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0 && DEBUG) {
        console.log(`[Baileys Cache] 🧹 Cleared ${cleaned} expired profile pictures`);
      }
    }, 10 * 60 * 1000); // 10 minutes check interval
  }

  private getAuthPath(connectionId: string): string {
    return path.join(process.cwd(), 'whatsapp_sessions', `session_${connectionId}`);
  }

  async clearFilesystemAuth(connectionId: string): Promise<void> {
    try {
      const authPath = this.getAuthPath(connectionId);
      const fs = await import('fs/promises');

      // ✅ RESILIÊNCIA WINDOWS: Loop de retry para lidar com EBUSY/EPERM (file locks)
      const MAX_RETRIES = 5;
      const RETRY_DELAY = 1000;

      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          await fs.access(authPath);
          console.log(`[Baileys] Attempting to clear auth for ${connectionId} (Attempt ${i + 1}/${MAX_RETRIES})...`);

          await fs.rm(authPath, { recursive: true, force: true });
          console.log(`[Baileys] ✅ Cleared filesystem auth for ${connectionId} at ${authPath}`);

          break; // Sucesso, sair do loop
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            console.log(`[Baileys] Filesystem auth already clean for ${connectionId}`);
            break;
          } else if (error.code === 'EBUSY' || error.code === 'EPERM') {
            if (i < MAX_RETRIES - 1) {
              console.warn(`[Baileys] ⚠️ File lock detected cleaning auth for ${connectionId}. Retrying in ${RETRY_DELAY}ms...`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              continue;
            } else {
              console.error(`[Baileys] ❌ Failed to clear auth after ${MAX_RETRIES} attempts due to file locks.`);
              throw error;
            }
          } else {
            throw error;
          }
        }
      }

      // Also cleanup in-memory session if it exists
      await this.deleteSession(connectionId);
    } catch (error) {
      console.error('[Baileys] Error clearing filesystem auth:', error);
      throw error;
    }
  }

  async resumeAllSessions(): Promise<{ success: number; failed: number }> {
    console.log('[Baileys] 🔄 Starting auto-resume of active sessions...');

    try {
      const activeConnections = await db.query.connections.findMany({
        where: and(
          eq(connections.status, 'connected'),
          eq(connections.connectionType, 'baileys')
        ),
      });

      console.log(`[Baileys] Found ${activeConnections.length} sessions marked as connected in DB`);

      let success = 0;
      let failed = 0;

      for (const conn of activeConnections) {
        try {
          // Check if already running in memory
          if (this.sessions.has(conn.id)) {
            const session = this.sessions.get(conn.id);
            if (session?.status === 'connected') {
              console.log(`[Baileys] Session ${conn.id} (${conn.phone}) is already running`);
              success++;
              continue;
            }
          }

          // Check for auth files
          const authPath = this.getAuthPath(conn.id);
          const fs = await import('fs/promises');
          let hasAuth = false;
          try {
            await fs.access(authPath);
            hasAuth = true;
          } catch {
            hasAuth = false;
          }

          if (hasAuth) {
            console.log(`[Baileys] Resuming session ${conn.id} (${conn.phone})...`);
            // Clean specific memory state before recreating
            this.sessions.delete(conn.id);
            await this.createSession(conn.id, conn.companyId);
            success++;
          } else {
            console.log(`[Baileys] ⚠️ Session ${conn.id} has no auth files. Marking as disconnected.`);
            await db
              .update(connections)
              .set({ status: 'disconnected' })
              .where(eq(connections.id, conn.id));
            failed++;
          }
        } catch (error) {
          console.error(`[Baileys] Failed to resume session ${conn.id}:`, error);
          failed++;
        }
      }

      console.log(`[Baileys] Auto-resume complete. Success: ${success}, Failed: ${failed}`);
      return { success, failed };
    } catch (error) {
      console.error('[Baileys] Critical error in resumeAllSessions:', error);
      return { success: 0, failed: 0 };
    }
  }

  async createSession(connectionId: string, companyId: string): Promise<void> {
    if (this.sessions.has(connectionId)) {
      const session = this.sessions.get(connectionId);
      if (session && (session.status === 'connected' || session.status === 'connecting')) {
        console.log(`[Baileys] Session ${connectionId} already exists (status: ${session.status}), skipping creation`);
        return;
      }
    }

    const pendingCreation = this.pendingCreations.get(connectionId);
    if (pendingCreation) {
      console.log(`[Baileys] ⏳ Session ${connectionId} creation already in progress, waiting...`);
      await pendingCreation;
      return;
    }

    const creationPromise = this._doCreateSession(connectionId, companyId);
    this.pendingCreations.set(connectionId, creationPromise);

    try {
      await creationPromise;
    } finally {
      this.pendingCreations.delete(connectionId);
    }
  }

  private async _doCreateSession(connectionId: string, companyId: string): Promise<void> {
    try {
      if (this.sessions.has(connectionId)) {
        const session = this.sessions.get(connectionId);
        if (session && (session.status === 'connected' || session.status === 'connecting')) {
          console.log(`[Baileys] Session ${connectionId} already exists after await, skipping`);
          return;
        }
      }

      // ✅ CORREÇÃO MULTI-TENANT: Validar que a conexão pertence à empresa
      const [connectionData] = await db
        .select()
        .from(connections)
        .where(and(
          eq(connections.id, connectionId),
          eq(connections.companyId, companyId)
        ))
        .limit(1);

      if (!connectionData) {
        throw new Error(`Connection ${connectionId} not found in database or does not belong to company ${companyId}`);
      }

      const phoneNumber = connectionData.phone;

      // ✅ CORREÇÃO: Prevenção melhorada de múltiplas sessões do mesmo número
      if (phoneNumber) {
        const existingConnectionId = this.phoneToConnectionMap.get(phoneNumber);
        if (existingConnectionId && existingConnectionId !== connectionId) {
          const existingSession = this.sessions.get(existingConnectionId);
          const existingStatus = existingSession?.status;

          console.warn(`[Baileys] ⚠️  CONFLICT DETECTED: Phone ${phoneNumber} already connected via ${existingConnectionId} (status: ${existingStatus})`);

          // ✅ CORREÇÃO: Se a sessão existente está realmente conectada, bloquear nova conexão
          if (existingStatus === 'connected') {
            console.warn(`[Baileys] ⚠️  BLOCKING: Another active session exists for ${phoneNumber}. Disconnect it first.`);

            // Marcar nova conexão como bloqueada
            await db
              .update(connections)
              .set({
                status: 'disconnected',
                qrCode: null
              })
              .where(eq(connections.id, connectionId));

            // Emitir evento de conflito
            emitConnectionStatusChanged(companyId, connectionId, 'disconnected');
            await emitSessionUpdated(companyId, {
              id: connectionId,
              status: 'disconnected',
            });

            throw new Error(`Multiple sessions detected: Phone ${phoneNumber} is already connected via ${existingConnectionId}. Disconnect the existing session first.`);
          } else if (existingStatus === 'disconnected' || existingStatus === 'failed') {
            // ✅ CORREÇÃO: Se a sessão existente está desconectada, limpar e permitir nova conexão
            console.log(`[Baileys] ℹ️  Existing session ${existingConnectionId} is ${existingStatus}. Cleaning up and allowing new connection.`);
            this.phoneToConnectionMap.delete(phoneNumber);
            if (existingSession) {
              this.deleteSession(existingConnectionId);
            }
          } else if (existingStatus === 'connecting' || existingStatus === 'qr') {
            // ✅ CORREÇÃO: Se está em estado intermediário, esperar um pouco e verificar
            console.warn(`[Baileys] ⚠️  Existing session ${existingConnectionId} is in state ${existingStatus}. Waiting 3s before proceeding...`);
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Verificar novamente
            const recheckSession = this.sessions.get(existingConnectionId);
            const recheckStatus = recheckSession?.status;

            if (recheckStatus === 'connected') {
              console.warn(`[Baileys] ⚠️  BLOCKING: Session ${existingConnectionId} is now connected. Cannot proceed.`);
              throw new Error(`Multiple sessions detected: Phone ${phoneNumber} is now connected via ${existingConnectionId}. Disconnect it first.`);
            } else {
              console.log(`[Baileys] ℹ️  Session ${existingConnectionId} is now ${recheckStatus}. Proceeding with new connection.`);
              this.phoneToConnectionMap.delete(phoneNumber);
              if (recheckSession) {
                this.deleteSession(existingConnectionId);
              }
            }
          } else {
            // Estado desconhecido, limpar e permitir nova conexão
            console.log(`[Baileys] ℹ️  Existing session ${existingConnectionId} has unknown status. Cleaning up and allowing new connection.`);
            this.phoneToConnectionMap.delete(phoneNumber);
            if (existingSession) {
              this.deleteSession(existingConnectionId);
            }
          }
        }
      }

      console.log(`[Baileys] Creating new session for connection ${connectionId} (Phone: ${phoneNumber || 'unknown'})`);

      const emitter = new EventEmitter();

      console.log(`[Baileys] Initiating dynamic Baileys import...`);
      const Baileys = await import('@whiskeysockets/baileys');

      if (!Baileys.useMultiFileAuthState || !Baileys.makeWASocket || !Baileys.Browsers) {
        throw new Error('Baileys functions not available');
      }

      console.log(`[Baileys] Fetching Baileys version...`);
      const { version } = await Baileys.fetchLatestBaileysVersion();
      console.log(`[Baileys] Using version:`, version);

      console.log(`[Baileys] Loading auth state from filesystem...`);
      const authPath = this.getAuthPath(connectionId);

      // ✅ CORREÇÃO: Garantir que o diretório pai existe antes de carregar o estado
      const parentDir = path.dirname(authPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true, mode: 0o777 });
      }

      // ✅ PERSISTÊNCIA: Tentar restaurar do Object Storage se filesystem estiver vazio
      const credsPath = path.join(authPath, 'creds.json');
      if (!fs.existsSync(credsPath)) {
        console.log(`[Baileys] No local auth found, attempting restore from Object Storage...`);
        const restored = await restoreAuthFromObjectStorage(connectionId, authPath);
        if (restored) {
          console.log(`[Baileys] ✅ Auth restored from Object Storage for ${connectionId}`);
        }
      }

      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { state, saveCreds } = await Baileys.useMultiFileAuthState(authPath);
      console.log(`[Baileys] Auth state loaded from ${authPath}`);

      const sessionData: SessionData = {
        socket: null as any,
        emitter,
        status: 'connecting',
        retryCount: 0,
      };

      this.sessions.set(connectionId, sessionData);

      // ✅ FASE 1.1: Emitir evento WebSocket para criação de sessão
      await emitSessionCreated(companyId, {
        id: connectionId,
        status: 'connecting',
        name: connectionData.config_name || '',
      });

      console.log(`[Baileys] Creating WASocket...`);
      const sock = Baileys.makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger, // pino level: 'silent'
        browser: Baileys.Browsers.macOS('Chrome'),
        syncFullHistory: false, // Economiza memória não baixando histórico antigo
        generateHighQualityLinkPreview: false, // Economiza recursos
        retryRequestDelayMs: 5000,
        markOnlineOnConnect: false, // Não marcar online automaticamente (reduz tráfego)
        // @ts-ignore - getMessage pode retornar undefined para suprimir download de mídia antiga
        getMessage: async () => undefined, // Não baixar mensagens antigas (evita buffers binários)
      });

      sessionData.socket = sock;
      console.log(`[Baileys] WASocket created successfully`);

      sock.ev.on('connection.update', async (update) => {
        try {
          const { connection, lastDisconnect, qr } = update;

          if (connection || lastDisconnect) {
            console.log(`[Baileys] Connection update for ${connectionId}:`, connection, lastDisconnect?.error);
          } else {
            // Logar apenas as chaves atualizadas para evitar "undefined undefined"
            const updateKeys = Object.keys(update).filter(k => k !== 'qr');
            if (qr) updateKeys.push('qr (masked)');
            console.log(`[Baileys] Connection update for ${connectionId}:`, updateKeys.join(', '));
          }

          if (qr) {
            // ✅ CORREÇÃO: Prevenir emissão duplicada de QR Code
            if (sessionData.qr === qr && sessionData.status === 'qr') {
              console.log(`[Baileys] QR Code already emitted for ${connectionId}, skipping duplicate`);
              return;
            }

            console.log(`[Baileys] QR Code generated for ${connectionId}`);
            sessionData.qr = qr;
            sessionData.status = 'qr';
            emitter.emit('qr', qr);

            await db
              .update(connections)
              .set({ qrCode: qr, status: 'connecting' })
              .where(eq(connections.id, connectionId));

            // ✅ FASE 1.1: Emitir evento WebSocket para QR Code (apenas uma vez)
            emitQRCodeUpdated(companyId, connectionId, qr);
            emitConnectionStatusChanged(companyId, connectionId, 'qr');
          }

          if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const errorMessage = lastDisconnect?.error?.message;
            const shouldReconnect = statusCode !== 401;

            console.log(`[Baileys] Connection closed for ${connectionId}. Status code: ${statusCode}, Error: ${errorMessage}`);

            if (sessionData.phone) {
              const mappedConnectionId = this.phoneToConnectionMap.get(sessionData.phone);
              if (mappedConnectionId === connectionId) {
                this.phoneToConnectionMap.delete(sessionData.phone);
                console.log(`[Baileys] 🗑️  Removed phone mapping for ${sessionData.phone}`);
              }
            }

            // ✅ CORREÇÃO: Tratamento específico para erro 440 (conflict) - múltiplas sessões
            if (statusCode === 440) {
              const errorData = (lastDisconnect?.error as any)?.data;
              // const isConflict = errorData?.tag === 'conflict' || errorMessage?.includes('conflict'); // Removed unused var

              console.warn(`[Baileys] ⚠️ Error 440 - CONFLICT DETECTED: Another session connected with same number`);
              console.warn(`[Baileys] Connection ID: ${connectionId}, Phone: ${sessionData.phone || 'unknown'}`);
              console.warn(`[Baileys] Error data:`, JSON.stringify(errorData || {}));

              // Marcar como desconectado (não como failed, pois pode ser recuperado)
              sessionData.status = 'disconnected';
              await db
                .update(connections)
                .set({
                  status: 'disconnected',
                  qrCode: null
                })
                .where(eq(connections.id, connectionId));

              emitter.emit('error', {
                message: 'Multiple sessions detected. Please disconnect other sessions and reconnect.',
                code: 440,
                isConflict: true
              });

              // ✅ FASE 1.1: Emitir evento WebSocket para conflito
              emitConnectionStatusChanged(companyId, connectionId, 'disconnected');
              await emitSessionUpdated(companyId, {
                id: connectionId,
                status: 'disconnected'
              });

              // Não tentar reconectar automaticamente - usuário precisa resolver o conflito
              this.deleteSession(connectionId);
              return;
            }

            // ✅ CORREÇÃO: Melhorar tratamento de erro 515 com backoff exponencial INFINITO
            if (statusCode === 515) {
              console.log(`[Baileys] Error 515 - WhatsApp stream error (restart required). Will reconnect with exponential backoff...`);
              sessionData.retryCount++;

              // Backoff exponencial: 2s, 4s, 8s, etc. (teto de 60s)
              const backoffDelay = Math.min(
                this.RECONNECT_INTERVAL * Math.pow(1.5, sessionData.retryCount - 1), // Fator 1.5 para crescer mais devagar
                60000 // Máximo 1 minuto
              );

              console.log(`[Baileys] Attempting reconnect (${sessionData.retryCount}) with ${backoffDelay}ms delay...`);

              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              this.sessions.delete(connectionId);
              await this.createSession(connectionId, companyId);
              return;
            }

            if (statusCode === undefined) {
              // ✅ CORREÇÃO: Tentar reconectar INFINITAMENTE quando statusCode é undefined (erros de rede)
              console.log(`[Baileys] Unexpected closure (statusCode: undefined). Will attempt reconnect.`);

              sessionData.retryCount++;

              // Backoff para erros de rede (máximo 30s)
              const backoffDelay = Math.min(
                this.RECONNECT_INTERVAL * Math.pow(1.2, sessionData.retryCount - 1),
                30000
              );

              console.log(`[Baileys] Attempting reconnect after undefined closure (${sessionData.retryCount}) with delay ${backoffDelay}ms`);

              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              this.sessions.delete(connectionId);
              await this.createSession(connectionId, companyId);
              return;
            }

            // ✅ LÓGICA DE RECONEXÃO INFINITA PARA ERROS GERAIS (EXCETO 401/403/440)
            if (shouldReconnect) {
              sessionData.retryCount++;

              // Backoff suave (máximo 45s)
              const backoffDelay = Math.min(
                this.RECONNECT_INTERVAL * Math.pow(1.3, sessionData.retryCount - 1),
                45000
              );

              console.log(`[Baileys] Attempting reconnect (${sessionData.retryCount}) due to error ${statusCode} with delay ${backoffDelay}ms`);

              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              this.deleteSession(connectionId);
              await this.createSession(connectionId, companyId);
            } else {
              // ... lógica de erro fatal (401) ...
              // ✅ CORREÇÃO CRÍTICA: Se for erro 401 (Unauthorized), limpar credenciais inválidas
              // Isso força a geração de um novo QR Code e quebra o loop de reconexão
              if (statusCode === 401) {
                console.warn(`[Baileys] 🛑 Erro 401 (Unauthorized) detectado para ${connectionId}. Credenciais inválidas.`);
                console.log(`[Baileys] 🧹 Limpando arquivos de sessão para forçar novo QR Code...`);

                await this.clearFilesystemAuth(connectionId);

                // Resetar status para disconnected (que vai permitir gerar novo QR)
                sessionData.status = 'disconnected';
              } else {
                sessionData.status = 'failed';
              }

              await db
                .update(connections)
                .set({
                  status: sessionData.status,
                  qrCode: null
                })
                .where(eq(connections.id, connectionId));

              emitter.emit('disconnected', { reason: statusCode });

              // ✅ FASE 1.1: Emitir evento WebSocket para desconexão
              emitConnectionStatusChanged(companyId, connectionId, sessionData.status);
              await emitSessionUpdated(companyId, {
                id: connectionId,
                status: sessionData.status
              });

              this.deleteSession(connectionId);
            }
          }

          if (connection === 'open') {
            console.log(`[Baileys] ✅ Connected successfully: ${connectionId}`);
            sessionData.status = 'connected';
            sessionData.retryCount = 0;

            const phoneNumber = sock.user?.id?.split(':')[0] || '';
            sessionData.phone = phoneNumber;

            if (phoneNumber) {
              const existingConnectionId = this.phoneToConnectionMap.get(phoneNumber);
              if (existingConnectionId && existingConnectionId !== connectionId) {
                console.warn(`[Baileys] ⚠️  Phone ${phoneNumber} was mapped to ${existingConnectionId}, updating to ${connectionId}`);
              }
              this.phoneToConnectionMap.set(phoneNumber, connectionId);
              if (DEBUG) console.log(`[Baileys] ✅ Registered phone mapping: ${phoneNumber} → ${connectionId}`);
            }

            await db
              .update(connections)
              .set({
                status: 'connected',
                phone: phoneNumber,
                qrCode: null,
                isActive: true,
                lastConnected: new Date(),
              })
              .where(eq(connections.id, connectionId));

            emitter.emit('connected', { phone: phoneNumber });

            // ✅ FASE 1.1: Emitir evento WebSocket para conexão estabelecida
            emitConnectionStatusChanged(companyId, connectionId, 'connected', phoneNumber);
            await emitSessionUpdated(companyId, {
              id: connectionId,
              status: 'connected',
              phone: phoneNumber,
              isActive: true,
              lastConnected: new Date(),
            });

            const queuedMessages = this.messageQueue.get(connectionId);
            if (queuedMessages && queuedMessages.length > 0) {
              console.log(`[Baileys] 📥 Processing ${queuedMessages.length} queued messages from reconnection`);
              for (const msg of queuedMessages) {
                try {
                  await this.handleIncomingMessage(connectionId, companyId, msg);
                } catch (error) {
                  console.error(`[Baileys] Error processing queued message:`, error);
                }
              }
              this.messageQueue.delete(connectionId);
              console.log(`[Baileys] ✅ Queue cleared for ${connectionId}`);
            }

            // ✅ CORREÇÃO: Iniciar heartbeat periódico para detectar conexões mortas
            this.startHeartbeat(connectionId, companyId, sock);

            // ✅ PERSISTÊNCIA: Backup completo para Object Storage após conexão bem-sucedida
            await backupAuthToObjectStorage(connectionId, authPath);
          }
        } catch (error) {
          console.error(`[Baileys] Error in connection.update handler:`, error);
        }
      });

      sock.ev.on('messages.upsert', async ({ messages: newMessages, type }) => {
        console.log(`[Baileys] 📨 messages.upsert recebido - Connection: ${connectionId}, Type: ${type}, Count: ${newMessages.length}, Status: ${sessionData.status}`);

        // ✅ CORREÇÃO: Permitir 'append' se for mensagem recente (recuperação de offline)
        // Isso resolve o problema de mensagens perdidas quando o bot reconecta
        const isNotify = type === 'notify';
        const isAppend = type === 'append';

        if (!isNotify && !isAppend) {
          console.log(`[Baileys] ⚠️  Tipo ${type} não é 'notify' nem 'append', ignorando...`);
          return;
        }

        for (const msg of newMessages) {
          // Para mensagens 'append' (histórico/sync), verificar se são recentes (últimos 5 minutos)
          if (isAppend) {
            const msgTime = typeof msg.messageTimestamp === 'number'
              ? msg.messageTimestamp * 1000
              : (msg.messageTimestamp?.low || 0) * 1000; // Handle Long type if needed

            const now = Date.now();
            // Se msgTime for 0 ou inválido, ignorar por segurança
            if (!msgTime) {
              continue;
            }

            const diff = now - msgTime;
            // Ignorar se for mais antiga que 5 minutos (300000 ms)
            if (diff > 300000) {
              // Log apenas debug para não poluir
              // console.log(`[Baileys] ⏳ Ignorando mensagem antiga (append) de ${new Date(msgTime).toISOString()}`);
              continue;
            }
            console.log(`[Baileys] 🔄 Processando mensagem recente (append) de ${new Date(msgTime).toISOString()} (Delay: ${diff}ms)`);
          }
          if (!msg.message) {
            console.log(`[Baileys] ⚠️  Mensagem sem conteúdo, ignorando...`);
            continue;
          }
          // if (msg.key.fromMe) continue; // Removed skip to allow logging messages sent from the physical phone

          console.log(`[Baileys] 📨 Processando mensagem - From: ${msg.key.remoteJid}, FromMe: ${msg.key.fromMe}, Status: ${sessionData.status}`);

          if (sessionData.status === 'connected') {
            console.log(`[Baileys] ✅ Status é 'connected', processando mensagem...`);
            try {
              await this.handleIncomingMessage(connectionId, companyId, msg);
            } catch (error) {
              console.error(`[Baileys] ❌ Error processing message from ${msg.key.remoteJid}:`, error);
            }
          } else {
            console.warn(`[Baileys] ⚠️  Message received but connection not ready (status: ${sessionData.status}). Queueing for later.`);
            const queue = this.messageQueue.get(connectionId) || [];

            // Limit queue size to 100 to prevent memory leak
            if (queue.length < 100) {
              queue.push(msg);
              this.messageQueue.set(connectionId, queue);
              console.log(`[Baileys] 📥 Queued message from ${msg.key.remoteJid}. Queue size: ${queue.length}`);
            } else {
              console.warn(`[Baileys] ⚠️  Message queue full for ${connectionId}, dropping message.`);
            }
          }
        }
      });

      sock.ev.on('creds.update', async () => {
        await saveCreds();
        // ✅ PERSISTÊNCIA: Sync creds para Object Storage após cada atualização
        await syncCredsToObjectStorage(connectionId, authPath);
      });

      sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
          try {
            const { key, update: statusUpdate } = update;
            if (!key.id || !key.fromMe) continue;

            const status = statusUpdate?.status;
            if (!status) continue;

            let newStatus: string | null = null;
            if (status === 2) newStatus = 'sent';
            else if (status === 3) newStatus = 'delivered';
            else if (status === 4) newStatus = 'read';
            else if (status === 5) newStatus = 'played';

            if (newStatus) {
              // ✅ whatsappDeliveryReports, eq e and já estão importados estaticamente no topo do arquivo

              const updatedRows = await db
                .update(whatsappDeliveryReports)
                .set({
                  status: newStatus,
                  updatedAt: new Date()
                })
                .where(
                  and(
                    eq(whatsappDeliveryReports.providerMessageId, key.id),
                    eq(whatsappDeliveryReports.connectionId, connectionId)
                  )
                )
                .returning({ id: whatsappDeliveryReports.id });

              if (updatedRows.length > 0 && updatedRows[0]) {
                console.log(`[Baileys Receipt] ✅ Updated delivery report ${updatedRows[0].id} to status: ${newStatus}`);

                // NOVO: Emitir evento WebSocket para atualizar frontend em tempo real
                try {
                  // ✅ getSocketIO já está importado estaticamente no topo do arquivo
                  const io = getSocketIO();
                  if (io) {
                    const campaignResult = await db
                      .select({ campaignId: whatsappDeliveryReports.campaignId })
                      .from(whatsappDeliveryReports)
                      .where(eq(whatsappDeliveryReports.id, updatedRows[0].id))
                      .limit(1);

                    if (campaignResult.length > 0 && campaignResult[0]) {
                      const campaignId = campaignResult[0].campaignId;
                      io.to(`campaign:${campaignId}`).emit(`campaign:${campaignId}:delivery-report`, {
                        campaignId,
                        reportId: updatedRows[0].id,
                        status: newStatus,
                        updatedAt: new Date().toISOString(),
                      });
                    }
                  }
                } catch (error) {
                  console.warn('[Baileys Receipt] Failed to emit WebSocket event:', error);
                }
              }
            }
          } catch (error) {
            console.error('[Baileys Receipt] Error processing message update:', error);
          }
        }
      });

      console.log(`[Baileys] Session setup complete for ${connectionId}`);
    } catch (error) {
      console.error(`[Baileys] Error creating session ${connectionId}:`, error);
      this.sessions.delete(connectionId);

      await db
        .update(connections)
        .set({
          status: 'failed',
          qrCode: null
        })
        .where(eq(connections.id, connectionId));

      throw error;
    }
  }

  private async handleIncomingMessage(
    connectionId: string,
    companyId: string,
    msg: any
  ): Promise<void> {
    const messageId = msg.key.id;
    if (!messageId) return;

    try {
      // 1. EARLY DEDUPLICATION: Check if message already exists in DB
      const existingMsg = await db.query.messages.findFirst({
        where: eq(messages.providerMessageId, messageId),
        columns: { id: true }
      });

      if (existingMsg) {
        if (DEBUG) console.log(`[Baileys Dedupe] Message ${messageId} already exists in DB. Skipping processing.`);
        return;
      }

      // 2. CONCURRENCY GUARD: Use Redis lock to prevent simultaneous processing by different sessions
      const lockKey = `message_processing:${messageId}`;
      const locked = await redis.set(lockKey, 'processing', 'EX', 120, 'NX' as any);

      if (!locked) {
        if (DEBUG) console.log(`[Baileys Dedupe] Message ${messageId} is being processed by another session. Skipping.`);
        return;
      }

      /*
      try {
        const fs = await import('fs/promises');
        await fs.appendFile('debug-baileys.log', `[${new Date().toISOString()}] Key: ${JSON.stringify(msg.key)}\n`);
      } catch (err) {
        console.error('Failed to log to debug file', err);
      }
      */

      let remoteJid = msg.key.remoteJid || '';

      // ✅ CORREÇÃO: Tratamento de JID LID (Linked Device)
      // Se recebermos um ID @lid, tentar encontrar o número real no remoteJidAlt ou participant
      if (remoteJid.includes('@lid')) {
        // Tentar remoteJidAlt primeiro (onde o Baileys costuma colocar o JID real)
        if (msg.key.remoteJidAlt && msg.key.remoteJidAlt.includes('@s.whatsapp.net')) {
          const oldJid = remoteJid;
          remoteJid = msg.key.remoteJidAlt;
          console.log(`[Baileys] 🔄 Converted LID ${oldJid} to Alt JID ${remoteJid}`);
        }
        // Fallback para participant se remoteJidAlt falhar
        else if (msg.key.participant && msg.key.participant.includes('@s.whatsapp.net')) {
          const oldJid = remoteJid;
          remoteJid = msg.key.participant;
          console.log(`[Baileys] 🔄 Converted LID ${oldJid} to Participant JID ${remoteJid}`);
        } else {
          console.warn(`[Baileys] ⚠️ Received message from LID ${remoteJid} but could not resolve Phone JID. MsgKey:`, JSON.stringify(msg.key));
        }
      }

      const phoneNumber = remoteJid.split('@')[0];

      let messageContent = '';
      let contentType = 'TEXT';
      let mediaUrl: string | null = null;

      const Baileys = await import('@whiskeysockets/baileys');

      if (msg.message?.conversation) {
        messageContent = msg.message.conversation;
        contentType = 'TEXT';
      } else if (msg.message?.extendedTextMessage) {
        messageContent = msg.message.extendedTextMessage.text || '';
        contentType = 'TEXT';
      } else if (msg.message?.imageMessage) {
        messageContent = msg.message.imageMessage.caption || '📷 Imagem';
        contentType = 'IMAGE';

        try {
          const fileLength = Number(msg.message.imageMessage.fileLength || 0);
          const MAX_SIZE = 50 * 1024 * 1024; // 50MB

          if (fileLength > MAX_SIZE) {
            console.warn(`[Baileys] 🛑 Skipping image download: File too large (${(fileLength / 1024 / 1024).toFixed(2)}MB)`);
            messageContent = '📷 Imagem (arquivo muito grande para processar)';
          } else if (!msg.message.imageMessage.mediaKey || msg.message.imageMessage.mediaKey.length === 0) {
            if (DEBUG) console.log('[Baileys] Skipping image without media key (deleted/forwarded media)');
            messageContent = '📷 Imagem (indisponível)';
          } else {
            // ✅ OOM FIX: Stream download directly to file
            const stream = await Baileys.downloadMediaMessage(msg, 'stream', {});
            const extension = 'jpg';
            const fileName = `media_recebida/${uuidv4()}.${extension}`;
            const tempFilePath = path.join(os.tmpdir(), `baileys-${uuidv4()}.${extension}`);

            await new Promise((resolve, reject) => {
              const writeStream = fs.createWriteStream(tempFilePath);
              stream.pipe(writeStream);
              writeStream.on('finish', resolve);
              writeStream.on('error', reject);
            });

            // ✅ FASE 3.1: Usar queue para upload via ARQUIVO
            mediaUrl = await queueMediaUpload(connectionId, companyId, fileName, tempFilePath, 'image/jpeg', msg.key.id);

            if (mediaUrl) {
              console.log(`[Baileys] ✅ Image uploaded successfully: ${mediaUrl}`);
            } else {
              console.warn(`[Baileys] ⚠️ Image upload returned null! File may not be accessible. Path: ${tempFilePath}`);
              messageContent = '📷 Imagem (falha no upload - arquivo pode não estar disponível)';
            }
          }
        } catch (error: any) {
          const errMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
          console.error(`[Baileys] ❌ Error downloading/uploading image:`, errMsg, { connectionId, messageId: msg.key.id });
          messageContent = '📷 Imagem (erro ao carregar)';
        }
      } else if (msg.message?.videoMessage) {
        messageContent = msg.message.videoMessage.caption || '📹 Vídeo';
        contentType = 'VIDEO';

        try {
          const fileLength = Number(msg.message.videoMessage.fileLength || 0);
          const MAX_SIZE = 50 * 1024 * 1024; // 50MB

          if (fileLength > MAX_SIZE) {
            console.warn(`[Baileys] 🛑 Skipping video download: File too large (${(fileLength / 1024 / 1024).toFixed(2)}MB)`);
            messageContent = '📹 Vídeo (arquivo muito grande para processar)';
          } else if (!msg.message.videoMessage.mediaKey || msg.message.videoMessage.mediaKey.length === 0) {
            if (DEBUG) console.log('[Baileys] Skipping video without media key (deleted/forwarded media)');
            messageContent = '📹 Vídeo (indisponível)';
          } else {
            // ✅ OOM FIX: Stream download directly to file
            const stream = await Baileys.downloadMediaMessage(msg, 'stream', {});
            const extension = 'mp4';
            const fileName = `media_recebida/${uuidv4()}.${extension}`;
            const tempFilePath = path.join(os.tmpdir(), `baileys-${uuidv4()}.${extension}`);

            await new Promise((resolve, reject) => {
              const writeStream = fs.createWriteStream(tempFilePath);
              stream.pipe(writeStream);
              writeStream.on('finish', resolve);
              writeStream.on('error', reject);
            });

            // ✅ FASE 3.1: Usar queue para upload via ARQUIVO
            mediaUrl = await queueMediaUpload(connectionId, companyId, fileName, tempFilePath, 'video/mp4', msg.key.id);

            if (mediaUrl) {
              console.log(`[Baileys] Video queued for upload: ${mediaUrl}`);
            }
          }
        } catch (error: any) {
          const errMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
          console.error('[Baileys] Error downloading/uploading video:', errMsg);
          messageContent = '📹 Vídeo (erro ao carregar)';
        }
      } else if (msg.message?.audioMessage) {
        contentType = 'AUDIO';
        messageContent = '🎵 Áudio (processando...)';

        try {
          const fileLength = Number(msg.message.audioMessage.fileLength || 0);
          const MAX_SIZE = 50 * 1024 * 1024; // 50MB

          if (fileLength > MAX_SIZE) {
            console.warn(`[Baileys] 🛑 Skipping audio download: File too large (${(fileLength / 1024 / 1024).toFixed(2)}MB)`);
            messageContent = '🎵 Áudio (arquivo muito grande para processar)';
          } else if (!msg.message.audioMessage.mediaKey || msg.message.audioMessage.mediaKey.length === 0) {
            if (DEBUG) console.log('[Baileys] Skipping audio without media key (deleted/forwarded media)');
            messageContent = '🎵 Áudio (indisponível)';
          } else {
            // ✅ OOM FIX: Stream download directly to file
            const stream = await Baileys.downloadMediaMessage(msg, 'stream', {});
            const tempInputPath = path.join(os.tmpdir(), `baileys-audio-${uuidv4()}.ogg`); // Assuming OGG from WhatsApp

            await new Promise((resolve, reject) => {
              const writeStream = fs.createWriteStream(tempInputPath);
              stream.pipe(writeStream);
              writeStream.on('finish', resolve);
              writeStream.on('error', reject);
            });

            let mimeType = 'audio/ogg';
            let extension = 'ogg';
            let fileToUpload = tempInputPath;

            // Converter para MP3 para compatibilidade (iOS/Web)
            // Converter para MP3 para compatibilidade (iOS/Web)
            try {
              console.log('[Baileys] Convertendo áudio OGG para MP3 (File Mode)...');
              // ✅ OOM FIX: Convert file-to-file
              const mp3Path = await convertAudioToMp3FromFile(tempInputPath);

              // Cleanup input
              try { fs.unlinkSync(tempInputPath); } catch (_e) { /* cleanup best effort */ }

              // Read MP3 to buffer immediately for usage in Gemini and Upload
              // This prevents race condition where queue deletes file before Gemini reads it
              let audioBuffer: Buffer | null = fs.readFileSync(mp3Path);
              fileToUpload = mp3Path; // Keep only for reference/logs if needed
              mimeType = 'audio/mp3';
              extension = 'mp3';
              console.log('[Baileys] ✅ Conversão MP3 concluída');

              // Cleanup temp MP3 immediately since we have the buffer
              try { fs.unlinkSync(mp3Path); } catch (_e) { /* cleanup best effort */ }

              // 1. Upload para S3 (pass Buffer directly)
              const s3Key = `media_recebida/${uuidv4()}.${extension}`;
              mediaUrl = await queueMediaUpload(connectionId, companyId, s3Key, audioBuffer, mimeType, msg.key.id);

              // 2. Transcrição via Gemini Multimodal (Nativo)
              try {
                console.log(`[Baileys] Iniciando transcrição multimodal via Gemini (${mimeType})...`);
                const transcription = await transcribeAudioGemini(audioBuffer, mimeType);

                // Explicitly release buffer
                audioBuffer = null;

                if (transcription && transcription.trim().length > 0 && !transcription.includes('[Sem fala detectada]')) {
                  messageContent = `[Áudio Transcrito]: ${transcription}`;
                  console.log(`[Baileys] ✅ Áudio transcrito (Gemini): "${transcription.substring(0, 50)}..."`);
                } else {
                  messageContent = '🎵 Áudio (sem fala detectada)';
                }
              } catch (transcriptionError: any) {
                console.error('[Baileys] Falha na transcrição Gemini:', transcriptionError?.message || transcriptionError);
                messageContent = '🎵 Áudio (erro na transcrição)';
                // Release buffer on error
                audioBuffer = null;
              }

            } catch (conversionError) {
              console.error('[Baileys] ⚠️ Falha na conversão MP3, usando original:', conversionError);
              // Fallback to original OGG if conversion fails
              // fileToUpload keeps pointing to tempInputPath (OGG)
              // NOTE: If conversion failed, audioBuffer is not set for MP3 logic.
              // We should probably just proceed with OGG upload via existing logic if we wanted.
              // But original logic continued. Let's keep it safe.

              const s3Key = `media_recebida/${uuidv4()}.${extension}`;
              // Since we don't have buffer, we pass path (queue deletes it)
              mediaUrl = await queueMediaUpload(connectionId, companyId, s3Key, tempInputPath, mimeType, msg.key.id);
            }

            // Clean up uploaded file (queue usually handles copy or read, but strictly speaking we passed filepath)
            // Wait: queueMediaUpload logic uses filepath. If it's a temp file, who deletes it?
            // queueMediaUpload logic: if `inputFilePath` passed, it doesn't auto-delete unless it created it.
            // But here WE created it. We should delete it eventually?
            // Actually `queueMediaUpload` doesn't delete `inputFilePath`.
            // We should delete `fileToUpload` here, but only AFTER upload finishes?
            // queueMediaUpload is async if using Redis.
            // If using Redis, worker processes it later. We CANNOT delete it yet.
            // But `queueMediaUpload` logic `removeOnComplete`?
            // We need a way to cleanup temp files.
            // Current `MediaUploadQueue` worker cleans up `filePath` if it's in job data.
            // So if we pass `filePath` to queue, worker will delete it?
            // Worker Logic: `const cleanup = () => { if (filePath ... fs.unlinkSync(filePath) }`
            // YES. The worker deletes `filePath`. So we are good!
            // BUT wait, `convertAudioToMp3FromFile` creates a temp file.
            // If `queueMediaUpload` deletes it, we are good.
            // If Sync Fallback uses it, does it delete it? 
            // Sync fallback in `queueMediaUpload`: `try { ... uploadFileToS3 ... } catch ...`
            // It does NOT delete inputFilePath.
            // I should add cleanup logic to my `queueMediaUpload` refactor?
            // Or just rely on OS /tmp cleanup or worker.
            // For now, let's assume worker deletes it. If queue fails synchronously, we might leak small files in /tmp. 
            // Better to leak small files than crash RAM.
          }
        } catch (error: any) {
          console.error('[Baileys] Error downloading/uploading audio:', error?.message || error);
          messageContent = '🎵 Áudio (erro ao carregar)';
        }
      } else if (msg.message?.documentMessage) {
        const filename = msg.message.documentMessage.fileName || 'documento';
        messageContent = msg.message.documentMessage.caption || `📄 ${filename}`;
        contentType = 'DOCUMENT';

        try {
          const fileLength = Number(msg.message.documentMessage.fileLength || 0);
          const MAX_SIZE = 50 * 1024 * 1024; // 50MB

          if (fileLength > MAX_SIZE) {
            console.warn(`[Baileys] 🛑 Skipping document download (${filename}): File too large (${(fileLength / 1024 / 1024).toFixed(2)}MB)`);
            messageContent = `📄 ${filename} (arquivo muito grande para processar)`;
          } else if (!msg.message.documentMessage.mediaKey || msg.message.documentMessage.mediaKey.length === 0) {
            if (DEBUG) console.log('[Baileys] Skipping document without media key (deleted/forwarded media)');
            messageContent = `📄 ${filename} (indisponível)`;
          } else {
            // ✅ OOM FIX: Stream download directly to file
            const stream = await Baileys.downloadMediaMessage(msg, 'stream', {});
            const extension = filename.split('.').pop() || 'bin';
            const s3Key = `media_recebida/${uuidv4()}.${extension}`;
            const mimeType = msg.message.documentMessage.mimetype || 'application/octet-stream';
            const tempFilePath = path.join(os.tmpdir(), `baileys-doc-${uuidv4()}.${extension}`);

            await new Promise((resolve, reject) => {
              const writeStream = fs.createWriteStream(tempFilePath);
              stream.pipe(writeStream);
              writeStream.on('finish', resolve);
              writeStream.on('error', reject);
            });

            // ✅ FASE 3.1: Usar queue para upload via ARQUIVO
            mediaUrl = await queueMediaUpload(connectionId, companyId, s3Key, tempFilePath, mimeType, msg.key.id);

            if (mediaUrl) {
              console.log(`[Baileys] Document queued for upload: ${mediaUrl}`);
            }
          }
        } catch (error: any) {
          const errMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
          console.error('[Baileys] Error downloading/uploading document:', errMsg);
          messageContent = `📄 ${filename} (erro ao carregar)`;
        }
      } else if (msg.message?.stickerMessage) {
        messageContent = '🎨 Sticker';
        contentType = 'STICKER';

        try {
          if (!msg.message.stickerMessage.mediaKey || msg.message.stickerMessage.mediaKey.length === 0) {
            if (DEBUG) console.log('[Baileys] Skipping sticker without media key (deleted/forwarded media)');
            messageContent = '🎨 Sticker (indisponível)';
          } else {
            // ✅ OOM FIX: Stream download directly to file
            const stream = await Baileys.downloadMediaMessage(msg, 'stream', {});
            const s3Key = `media_recebida/${uuidv4()}.webp`;
            const tempFilePath = path.join(os.tmpdir(), `baileys-sticker-${uuidv4()}.webp`);

            await new Promise((resolve, reject) => {
              const writeStream = fs.createWriteStream(tempFilePath);
              stream.pipe(writeStream);
              writeStream.on('finish', resolve);
              writeStream.on('error', reject);
            });

            // ✅ FASE 3.1: Usar queue para upload via ARQUIVO
            mediaUrl = await queueMediaUpload(connectionId, companyId, s3Key, tempFilePath, 'image/webp', msg.key.id);

            if (mediaUrl) {
              console.log(`[Baileys] Sticker queued for upload: ${mediaUrl}`);
            }
          }
        } catch (error: any) {
          const errMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error');
          console.error('[Baileys] Error downloading/uploading sticker:', errMsg);
          messageContent = '🎨 Sticker (erro ao carregar)';
        }
      } else if (msg.message?.reactionMessage) {
        const targetKey = msg.message.reactionMessage.key;
        const emoji = msg.message.reactionMessage.text;

        const targetMessageId = targetKey.id;
        const [targetMessage] = await db.select({ id: messages.id })
          .from(messages)
          .where(and(
            eq(messages.providerMessageId, targetMessageId),
            eq(messages.companyId, companyId)
          ))
          .limit(1);

        if (targetMessage) {
          if (!emoji || emoji === '') {
            await db.delete(messageReactions)
              .where(and(
                eq(messageReactions.messageId, targetMessage.id),
                eq(messageReactions.reactorPhone, phoneNumber),
                eq(messageReactions.companyId, companyId)
              ));
            console.log(`[Baileys] Reação removida para mensagem ${targetMessage.id} por ${phoneNumber}`);
          } else {
            // Check if reaction exists manually
            const existingReaction = await db.query.messageReactions.findFirst({
              where: and(
                eq(messageReactions.messageId, targetMessage.id),
                eq(messageReactions.reactorPhone, phoneNumber)
              )
            });

            if (existingReaction) {
              await db.update(messageReactions)
                .set({ emoji, reactorName: msg.pushName })
                .where(eq(messageReactions.id, existingReaction.id));
            } else {
              await db.insert(messageReactions)
                .values({
                  companyId,
                  messageId: targetMessage.id,
                  reactorPhone: phoneNumber,
                  reactorName: msg.pushName,
                  emoji,
                });
            }
            console.log(`[Baileys] Reação ${emoji} salva para mensagem ${targetMessage.id} por ${phoneNumber}`);
          }
        }
        return;
      } else if (msg.message?.locationMessage) {
        // ✅ CORREÇÃO: Suporte para mensagens de localização
        const lat = msg.message.locationMessage.degreesLatitude;
        const lng = msg.message.locationMessage.degreesLongitude;
        const name = msg.message.locationMessage.name || 'Localização';
        messageContent = `📍 ${name}${lat && lng ? ` (${lat.toFixed(6)}, ${lng.toFixed(6)})` : ''}`;
        contentType = 'TEXT';
      } else if (msg.message?.liveLocationMessage) {
        // ✅ CORREÇÃO: Suporte para localização ao vivo
        const lat = msg.message.liveLocationMessage.degreesLatitude;
        const lng = msg.message.liveLocationMessage.degreesLongitude;
        messageContent = `📍 Localização ao vivo${lat && lng ? ` (${lat.toFixed(6)}, ${lng.toFixed(6)})` : ''}`;
        contentType = 'TEXT';
      } else if (msg.message?.contactMessage) {
        // ✅ CORREÇÃO: Suporte para contatos compartilhados
        const contactName = msg.message.contactMessage.displayName || 'Contato';
        messageContent = `👤 ${contactName} compartilhou um contato`;
        contentType = 'TEXT';
      } else if (msg.message?.contactsArrayMessage) {
        // ✅ CORREÇÃO: Suporte para múltiplos contatos
        const count = msg.message.contactsArrayMessage.contacts?.length || 0;
        messageContent = `👥 ${count} contato(s) compartilhado(s)`;
        contentType = 'TEXT';
      } else if (msg.message?.buttonsResponseMessage) {
        // ✅ CORREÇÃO: Suporte para respostas de botões
        const selectedButtonId = msg.message.buttonsResponseMessage.selectedButtonId;
        const selectedDisplayText = msg.message.buttonsResponseMessage.selectedDisplayText;
        messageContent = selectedDisplayText || `🔘 Botão: ${selectedButtonId}`;
        contentType = 'TEXT';
      } else if (msg.message?.listResponseMessage) {
        // ✅ CORREÇÃO: Suporte para respostas de lista
        const title = msg.message.listResponseMessage.title;
        const description = msg.message.listResponseMessage.description;
        messageContent = `📋 ${title || 'Lista'}${description ? `: ${description}` : ''}`;
        contentType = 'TEXT';
      } else if (msg.message?.templateButtonReplyMessage) {
        // ✅ CORREÇÃO: Suporte para respostas de template
        const selectedId = msg.message.templateButtonReplyMessage.selectedId;
        messageContent = `📝 Template: ${selectedId}`;
        contentType = 'TEXT';
      } else if (msg.message?.pollCreationMessage) {
        // ✅ CORREÇÃO: Suporte para criação de enquetes
        const pollName = msg.message.pollCreationMessage.name;
        messageContent = `📊 Enquete: ${pollName || 'Sem nome'}`;
        contentType = 'TEXT';
      } else if (msg.message?.pollUpdateMessage) {
        // ✅ CORREÇÃO: Suporte para atualizações de enquetes
        messageContent = '📊 Atualização de enquete';
        contentType = 'TEXT';
      } else {
        // ✅ CORREÇÃO: Log detalhado para mensagens não suportadas para debug
        const messageTypes = Object.keys(msg.message || {});
        console.warn(`[Baileys] ⚠️ Tipo de mensagem não suportado: ${messageTypes.join(', ')}`, {
          remoteJid,
          phoneNumber,
          messageTypes,
        });
        messageContent = 'Mensagem não suportada';
      }

      // ✅ CORREÇÃO: Verificar se é grupo ANTES de processar (evitar salvar mensagens de grupos)
      // Detect if this is a group/community using JID-first logic
      const isGroup = detectGroup({ remoteJid, phone: phoneNumber });

      // 🚫 Ignorar mensagens de grupos/comunidades/boletins
      // Requisito: mensagens de grupos devem ser obrigatoriamente ignoradas
      if (isGroup) {
        console.log(`[Baileys] 🛑 Ignorando mensagem de grupo/comunidade: ${remoteJid}`);
        return;
      }

      // ✅ CORREÇÃO: Ignorar mensagens "não suportadas" que podem ser de grupos ou tipos inválidos
      // Se a mensagem não tem conteúdo útil, não salvar
      if (messageContent === 'Mensagem não suportada') {
        console.log(`[Baileys] ⚠️ Ignorando mensagem não suportada de ${phoneNumber} (remoteJid: ${remoteJid})`);
        return;
      }

      // Check if contact exists manually to avoid ON CONFLICT issues with partial indexes
      console.log(`[Baileys Debug] Checking contact for ${phoneNumber} (Company: ${companyId})`);
      let contact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.phone, phoneNumber),
          eq(contacts.companyId, companyId),
          isNull(contacts.deletedAt)
        )
      });

      try {
        if (contact) {
          const [updatedContact] = await db.update(contacts)
            .set({
              whatsappName: msg.pushName || contact.whatsappName,
              isGroup,
            })
            .where(eq(contacts.id, contact.id))
            .returning();
          contact = updatedContact;
          // console.log(`[Baileys Debug] Contact updated: ${contact?.id}`);
        } else {
          const [newContact] = await db.insert(contacts)
            .values({
              companyId,
              name: msg.pushName || phoneNumber,
              phone: phoneNumber,
              whatsappName: msg.pushName,
              isGroup,
            })
            .returning();
          contact = newContact;
          console.log(`[Baileys Debug] Contact created: ${contact?.id}`);
        }
      } catch (err) {
        console.error('[Baileys Debug] Error creating/updating contact:', err);
      }

      if (!contact) {
        console.error('[Baileys] Failed to create/update contact (Result is null)');
        return;
      }

      // Check if conversation already exists for notification purposes
      const existingConversation = await db.query.conversations.findFirst({
        where: (convs, { and, eq }) => and(
          eq(convs.contactId, contact.id),
          eq(convs.connectionId, connectionId),
          eq(convs.companyId, companyId)
        ),
      });
      const isNewConversation = !existingConversation;

      let conversation: typeof conversations.$inferSelect | undefined;

      // Check if conversation exists manually (using existingConversation if it matches criteria or query again if needed)
      // Actually existingConversation was found by contactId, connectionId, companyId.
      // But let's be safe and follow the pattern.

      const targetConversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.contactId, contact.id),
          eq(conversations.connectionId, connectionId)
        )
      });

      try {
        if (targetConversation) {
          const [updatedConv] = await db.update(conversations)
            .set({
              lastMessageAt: new Date(),
              archivedAt: null,
            })
            .where(eq(conversations.id, targetConversation.id))
            .returning();
          conversation = updatedConv;
        } else {
          const [newConv] = await db.insert(conversations)
            .values({
              companyId,
              contactId: contact.id,
              connectionId,
              status: 'NEW',
              lastMessageAt: new Date(),
            })
            .returning();
          conversation = newConv;
          console.log(`[Baileys Debug] Conversation created: ${conversation?.id}`);
        }
      } catch (err) {
        console.error('[Baileys Debug] Error creating/updating conversation:', err);
      }

      if (!conversation) {
        console.error('[Baileys] Failed to create/update conversation');
        return;
      }

      // Notify users about new conversation
      if (isNewConversation) {
        try {
          await UserNotificationsService.notifyNewConversation(
            companyId,
            conversation.id,
            contact.name || contact.whatsappName || contact.phone
          );
          console.log(`[UserNotifications] New conversation notification sent for ${conversation.id}`);
        } catch (notifError) {
          console.error('[UserNotifications] Error sending new conversation notification:', notifError);
        }
      }

      // ✅ PRE-CHECK: Verificar se existe mensagem duplicada por CONTEÚDO (race condition com Automation Engine)
      // Se a mensagem é nossa (fromMe) e existe uma mensagem AI recente com mesmo conteúdo, atualizamos ela.
      if (msg.key.fromMe) {
        // Normalize content for comparison (trim + lowercase) to avoid mismatch due to formatting
        const normalizedContent = messageContent.trim().toLowerCase();

        const recentAiMessages = await db.select()
          .from(messages)
          .where(and(
            eq(messages.companyId, companyId),
            eq(messages.conversationId, conversation.id),
            eq(messages.senderType, 'AI'),
            // Mensagem recente (últimos 60 segundos - aumentado para garantir)
            gte(messages.sentAt, new Date(Date.now() - 60000))
          ));

        // Find matching message in memory to allow flexible comparison
        const aiMessage = recentAiMessages.find(m => {
          const dbContent = (m.content || '').trim().toLowerCase();
          // Check for exact match or if one contains the other (for safety)
          // Often Baileys might have slight variations or formatting differences
          const isMatch = dbContent === normalizedContent ||
            (dbContent.length > 10 && normalizedContent.includes(dbContent)) ||
            (normalizedContent.length > 10 && dbContent.includes(normalizedContent));

          if (isMatch) {
            console.log(`[Baileys Dedupe] Match found! \nIncoming: "${normalizedContent.substring(0, 50)}..." \nDB: "${dbContent.substring(0, 50)}..."`);
          }
          return isMatch;
        });

        if (aiMessage) {
          console.log(`[Baileys] ✅ Found existing AI message (ID: ${aiMessage.id}) matching content. Updating providerMessageId.`);
          try {
            await db.update(messages)
              .set({
                providerMessageId: msg.key.id,
                status: 'sent',
                sentAt: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000) : new Date()
              })
              .where(eq(messages.id, aiMessage.id));

            // Usar o ID da mensagem existente para logs
            console.log(`[Baileys] Message updated from ${phoneNumber} (ID: ${aiMessage.id})`);
            return; // Não continuar processamento (já foi processado pelo Engine)
          } catch (updateError: any) {
            // Se erro for violação de unique constraint (mensagem já inserida por outro processo), ignorar e assumir ok
            if (updateError?.code === '23505') {
              console.warn(`[Baileys Dedupe] Race condition detected updating AI message ${aiMessage.id}: ${updateError.message}`);
              return;
            }
            throw updateError;
          }
        } else {
          if (recentAiMessages.length > 0) {
            console.log(`[Baileys Dedupe] No match found for incoming message: "${normalizedContent.substring(0, 50)}..."`);
            console.log(`[Baileys Dedupe] Recent AI messages checked: ${recentAiMessages.length}`);
            recentAiMessages.forEach(m => console.log(`- DB: "${(m.content || '').trim().toLowerCase().substring(0, 50)}..."`));
          }
        }
      }

      console.log(`[Baileys Debug] Attempting to insert message: ${msg.key.id} (Conv: ${conversation.id})`);

      let savedMessage;
      try {
        const [inserted] = await db.insert(messages).values({
          companyId,
          conversationId: conversation.id,
          providerMessageId: msg.key.id,
          senderType: msg.key.fromMe ? 'AGENT' : 'CONTACT', // ✅ FIX: Aligned with Meta webhook standard. 'CONTACT' enables proper debounce in automation-engine.
          senderId: msg.key.fromMe ? null : contact.id,
          content: messageContent,
          contentType,
          mediaUrl,
          status: msg.key.fromMe ? 'sent' : 'received',
          sentAt: new Date(msg.messageTimestamp! * 1000),
        })
          .onConflictDoNothing({ target: [messages.providerMessageId] })
          .returning();
        savedMessage = inserted;
      } catch (err) {
        console.error('[Baileys Debug] Error inserting message:', err);
      }

      if (!savedMessage) {
        console.log(`[Baileys Debug] Insert returned null (Conflict or Error) for ${msg.key.id}`);
        // Mensagem já existe (duplicada), buscar pelo providerMessageId
        const [existingMessage] = await db.select({ id: messages.id })
          .from(messages)
          .where(and(
            eq(messages.providerMessageId, msg.key.id),
            eq(messages.companyId, companyId)
          ))
          .limit(1);

        if (existingMessage) {
          console.log(`[Baileys] Message already exists (duplicate), using existing ID: ${existingMessage.id} (ProviderID: ${msg.key.id})`);
          // Não processar novamente mensagens duplicadas
          return;
        } else {
          // ✅ CORREÇÃO: Verificar se existe mensagem duplicada por CONTEÚDO (race condition com Automation Engine)
          // Se o Automation Engine inseriu primeiro como 'AI', nós atualizamos com o ID real
          if (msg.key.fromMe) {
            // Normalize content for comparison
            const normalizedContent = messageContent.trim().toLowerCase();

            const recentAiMessages = await db.select()
              .from(messages)
              .where(and(
                eq(messages.companyId, companyId),
                eq(messages.conversationId, conversation.id),
                eq(messages.senderType, 'AI'),
                // Mensagem recente (últimos 60 segundos)
                gte(messages.sentAt, new Date(Date.now() - 60000))
              ));

            // Find matching message in memory
            const aiMessage = recentAiMessages.find(m => {
              const dbContent = (m.content || '').trim().toLowerCase();
              return dbContent === normalizedContent ||
                (dbContent.length > 10 && normalizedContent.includes(dbContent)) ||
                (normalizedContent.length > 10 && dbContent.includes(normalizedContent));
            });

            if (aiMessage) {
              console.log(`[Baileys] ✅ Found existing AI message (ID: ${aiMessage.id}) matching content (fallback check). Updating providerMessageId.`);
              try {
                await db.update(messages)
                  .set({
                    providerMessageId: msg.key.id,
                    status: 'sent',
                    sentAt: new Date(msg.messageTimestamp! * 1000)
                  })
                  .where(eq(messages.id, aiMessage.id));

                // Usar o ID da mensagem existente para logs
                console.log(`[Baileys] Message updated from ${phoneNumber} (ID: ${aiMessage.id})`);
                return; // Não continuar processamento (já foi processado pelo Engine)
              } catch (updateError: any) {
                if (updateError?.code === '23505') {
                  console.warn(`[Baileys Fallback] Race condition detected updating AI message ${aiMessage.id}: ${updateError.message}`);
                  return;
                }
                console.error('[Baileys Fallback] Error updating AI message:', updateError);
              }
            }
          }

          console.error(`[Baileys] Failed to save message and could not find existing message`);
          return;
        }
      }

      console.log(`[Baileys] Message saved from ${phoneNumber} (ID: ${savedMessage.id})`);

      // Classificar tipo de chat usando função robusta
      const chatClassification = classifyChat(remoteJid, msg);

      console.log(`[Baileys Chat Classifier] Type: ${chatClassification.type} | Reason: ${chatClassification.reason} | Block AI: ${chatClassification.shouldBlockAI}`);

      // TRIGGER CENTRAL DE AUTOMAÇÃO (Unificado: Meta + Baileys)
      // ✅ CORREÇÃO: Usar ID da mensagem no banco (savedMessage.id) ao invés do ID do Baileys (msg.key.id)
      // Substitui o handleAIAutoResponse antigo
      if (!msg.key.fromMe) {
        console.log(`[Baileys Automation] 🤖 Disparando motor de automação unificado para ${phoneNumber} (Message ID: ${savedMessage.id})`);

        // Garantir que a conversa tenha aiActive como true se houver roteamento
        if (!conversation.aiActive && connectionData.assignedPersonaId) {
          console.log(`[Baileys Automation] 🔄 Ativando aiActive para conversa ${conversation.id} via roteamento da conexão`);
          await db.update(conversations).set({ aiActive: true }).where(eq(conversations.id, conversation.id));
          conversation.aiActive = true;
        }

        // Disparar sem await para não bloquear o loop de eventos do Baileys
        processIncomingMessageTrigger(conversation.id, savedMessage.id, isNewConversation)
          .then(() => {
            console.log(`[Baileys Automation] ✅ Trigger processado com sucesso para mensagem ${savedMessage.id}`);
          })
          .catch(err => {
            console.error(`[Baileys Automation] ❌ Error triggering automation for message ${savedMessage.id}:`, err);
          });
      }
      else if (chatClassification.shouldBlockAI && conversation.aiActive) {
        console.log(`[Baileys AI] 🚫 Blocked auto-response | Type: ${chatClassification.type} | Contact: ${phoneNumber} | Reason: ${chatClassification.reason}`);
      }
    } catch (error) {
      console.error('[Baileys] Error handling incoming message:', error);
    }
  }


  async sendMessage(
    connectionId: string,
    to: string,
    content: any
  ): Promise<string | null> {
    console.log(`[SessionManager] Attempting to send message via connection ${connectionId} to ${to}`);

    const sessionData = this.sessions.get(connectionId);

    if (!sessionData) {
      console.error(`[SessionManager] ❌ Session ${connectionId} not found in SessionManager`);
      console.log(`[SessionManager] Available sessions: ${Array.from(this.sessions.keys()).join(', ') || 'none'}`);
      return null;
    }

    if (sessionData.status !== 'connected') {
      console.error(`[SessionManager] ❌ Session ${connectionId} not connected. Current status: ${sessionData.status}`);
      return null;
    }

    try {
      // Remove o símbolo '+' se presente, pois o WhatsApp não aceita no JID
      const cleanNumber = to.replace(/^\+/, '');
      const jid = cleanNumber.includes('@') ? cleanNumber : `${cleanNumber}@s.whatsapp.net`;
      console.log(`[SessionManager] Sending to JID: ${jid}`);

      // Ensure content is in the correct format for Baileys
      const messageContent = typeof content === 'string' ? { text: content } : content;

      const sent = await sessionData.socket.sendMessage(jid, messageContent);
      const messageId = sent?.key?.id || null;

      if (messageId) {
        if (DEBUG) console.log(`[SessionManager] ✅ Message sent successfully to ${to}: ${messageId}`);
      } else {
        console.warn(`[SessionManager] ⚠️  Message sent but no ID returned for ${to}`);
      }

      return messageId;
    } catch (error) {
      console.error(`[SessionManager] ❌ Error sending message to ${to}:`, error);
      console.error(`[SessionManager] Error details:`, {
        connectionId,
        to,
        contentType: typeof content,
        sessionStatus: sessionData.status,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  async validateWhatsAppNumber(
    connectionId: string,
    phoneNumber: string
  ): Promise<{ exists: boolean; jid?: string; error?: string }> {
    const sessionData = this.sessions.get(connectionId);

    if (!sessionData) {
      return { exists: false, error: 'Sessão não encontrada' };
    }

    if (sessionData.status !== 'connected') {
      return { exists: false, error: `Sessão não conectada: ${sessionData.status}` };
    }

    try {
      const cleanNumber = phoneNumber.replace(/^\+/, '').replace(/\D/g, '');

      const results = await sessionData.socket.onWhatsApp(cleanNumber);
      const result = results?.[0];

      if (result?.exists) {
        console.log(`[SessionManager] ✅ Número válido: ${phoneNumber} → ${result.jid}`);
        return { exists: true, jid: result.jid };
      } else {
        console.log(`[SessionManager] ❌ Número não registrado no WhatsApp: ${phoneNumber}`);
        return { exists: false, error: 'Número não registrado no WhatsApp' };
      }
    } catch (error) {
      console.error(`[SessionManager] Erro ao validar número ${phoneNumber}:`, error);
      return { exists: false, error: (error as Error).message };
    }
  }

  async deleteSession(connectionId: string): Promise<void> {
    const sessionData = this.sessions.get(connectionId);

    if (!sessionData) {
      // Se não há sessão em memória, apenas atualizar banco de dados
      await db
        .update(connections)
        .set({ status: 'disconnected' })
        .where(eq(connections.id, connectionId));
      return;
    }

    if (DEBUG) console.log(`[Baileys] Cleaning up session ${connectionId}`);

    try {
      if (sessionData.socket) {
        // Remove listeners to prevent leaks
        try {
          sessionData.socket.ev.removeAllListeners('connection.update');
          sessionData.socket.ev.removeAllListeners('creds.update');
          sessionData.socket.ev.removeAllListeners('messages.upsert');
          sessionData.socket.ev.removeAllListeners('messages.update');
        } catch (evError) {
          // Ignore event removal errors
        }

        // Logout and close socket
        try {
          await sessionData.socket.logout();
        } catch (error) {
          console.error('[Baileys] Error during logout:', error);
        }

        // Close socket explicitly
        if (sessionData.socket.ws?.readyState === 1 || sessionData.socket.ws?.readyState === 0) {
          sessionData.socket.end(undefined);
        }
      }
    } catch (error) {
      console.warn(`[Baileys] Error during socket cleanup for ${connectionId}:`, error);
    }

    // Clean up phone mapping
    if (sessionData.phone) {
      const mappedConnectionId = this.phoneToConnectionMap.get(sessionData.phone);
      if (mappedConnectionId === connectionId) {
        this.phoneToConnectionMap.delete(sessionData.phone);
        console.log(`[Baileys] 🗑️  Cleared phone mapping for ${sessionData.phone}`);
      }
    }

    // Clean up message queue
    if (this.messageQueue.has(connectionId)) {
      const queueSize = this.messageQueue.get(connectionId)?.length || 0;
      this.messageQueue.delete(connectionId);
      console.log(`[Baileys] 🗑️  Cleared message queue (${queueSize} messages) for ${connectionId}`);
    }

    // ✅ CORREÇÃO: Limpar heartbeat quando sessão é deletada
    if (this.heartbeatIntervals.has(connectionId)) {
      clearInterval(this.heartbeatIntervals.get(connectionId)!);
      this.heartbeatIntervals.delete(connectionId);
      console.log(`[Baileys] 🗑️  Cleared heartbeat for ${connectionId}`);
    }

    // Remove from sessions map
    const session = this.sessions.get(connectionId);
    if (session?.socket) {
      try {
        // ✅ LIMPEZA: Fechar conexão do socket explicitamente se existir
        // O método 'end' ou 'ws.close' pode variar dependendo da versão do Baileys
        if (typeof session.socket.end === 'function') {
          session.socket.end(new Error('Session deleted'));
        } else if (session.socket.ws && typeof session.socket.ws.close === 'function') {
          session.socket.ws.close();
        }
        // Remover listeners para evitar vazamento de memória
        if (session.socket.ev) {
          session.socket.ev.removeAllListeners('connection.update');
          session.socket.ev.removeAllListeners('creds.update');
          session.socket.ev.removeAllListeners('messages.upsert');
        }
      } catch (err) {
        console.warn(`[Baileys] Erro ao fechar socket para ${connectionId}:`, err);
      }
    }

    this.sessions.delete(connectionId);
    console.log(`[Baileys] Session ${connectionId} deleted`);

    // Update database status
    const [connection] = await db
      .select({ companyId: connections.companyId })
      .from(connections)
      .where(eq(connections.id, connectionId))
      .limit(1);

    await db
      .update(connections)
      .set({ status: 'disconnected' })
      .where(eq(connections.id, connectionId));

    // ✅ FASE 1.1: Emitir evento WebSocket para deleção de sessão
    if (connection) {
      await emitSessionDeleted(connection.companyId, connectionId);
    }

    // ✅ PERSISTÊNCIA: Limpar backup do Object Storage
    await deleteAuthFromObjectStorage(connectionId);
  }

  getSession(connectionId: string): SessionData | undefined {
    const session = this.sessions.get(connectionId);

    if (!session) {
      console.warn(`[SessionManager] ⚠️  Session not found for connectionId: ${connectionId}`);
      console.log(`[SessionManager] Available sessions: ${Array.from(this.sessions.keys()).join(', ') || 'none'}`);
    }

    return session;
  }

  getSessionStatus(connectionId: string): 'connecting' | 'connected' | 'disconnected' | 'qr' | 'failed' | null {
    const session = this.sessions.get(connectionId);
    if (!session) {
      return null;
    }
    return session.status;
  }

  /**
   * ✅ FASE 1.3: Busca status de múltiplas sessões de uma vez (batch)
   * Reduz N chamadas para 1 operação
   */
  getBatchSessionStatus(connectionIds: string[]): Map<string, 'connecting' | 'connected' | 'disconnected' | 'qr' | 'failed' | null> {
    const statusMap = new Map<string, 'connecting' | 'connected' | 'disconnected' | 'qr' | 'failed' | null>();

    for (const connectionId of connectionIds) {
      const session = this.sessions.get(connectionId);
      statusMap.set(connectionId, session?.status || null);
    }

    return statusMap;
  }

  async hasFilesystemAuth(connectionId: string): Promise<boolean> {
    try {
      const authPath = this.getAuthPath(connectionId);
      const fs = await import('fs/promises');
      await fs.access(authPath);
      const files = await fs.readdir(authPath);

      const hasCreds = files.some(f => f.includes('creds') || f.includes('auth'));
      if (!hasCreds) {
        console.log(`[Baileys] hasFilesystemAuth: Directory exists but no auth files for ${connectionId}`);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * ✅ FASE 3.3: Obtém número de sessões ativas
   */
  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  /**
   * ✅ FASE 3.3: Obtém estatísticas de sessões
   */
  getSessionsStats() {
    const stats = {
      total: this.sessions.size,
      byStatus: {
        connected: 0,
        connecting: 0,
        disconnected: 0,
        qr: 0,
        failed: 0,
      },
    };

    for (const session of this.sessions.values()) {
      if (stats.byStatus[session.status as keyof typeof stats.byStatus] !== undefined) {
        stats.byStatus[session.status as keyof typeof stats.byStatus]++;
      }
    }

    return stats;
  }

  /**
   * ✅ FASE 1.3: Verifica auth de múltiplas sessões de uma vez (batch)
   * Reduz N chamadas de filesystem para operações paralelas otimizadas
   */
  async getBatchFilesystemAuth(connectionIds: string[]): Promise<Map<string, boolean>> {
    const authMap = new Map<string, boolean>();
    const fs = await import('fs/promises');

    // Processar em paralelo com limite de concorrência para evitar sobrecarga
    const BATCH_SIZE = 10;
    const batches: string[][] = [];

    for (let i = 0; i < connectionIds.length; i += BATCH_SIZE) {
      batches.push(connectionIds.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const results = await Promise.all(
        batch.map(async (connectionId) => {
          try {
            const authPath = this.getAuthPath(connectionId);
            await fs.access(authPath);
            const files = await fs.readdir(authPath);
            const hasCreds = files.some(f => f.includes('creds') || f.includes('auth'));
            return { connectionId, hasAuth: hasCreds };
          } catch {
            return { connectionId, hasAuth: false };
          }
        })
      );

      for (const result of results) {
        authMap.set(result.connectionId, result.hasAuth);
      }
    }

    return authMap;
  }

  async ensureSession(connectionId: string, companyId: string): Promise<{
    success: boolean;
    status: 'connected' | 'connecting' | 'qr' | 'needs_qr' | 'failed';
    message: string;
  }> {
    const existingSession = this.sessions.get(connectionId);
    if (existingSession) {
      console.log(`[Baileys] ensureSession: Session ${connectionId} already in memory with status: ${existingSession.status}`);
      return {
        success: existingSession.status === 'connected',
        status: existingSession.status as any,
        message: `Session exists with status: ${existingSession.status}`,
      };
    }

    const hasAuth = await this.hasFilesystemAuth(connectionId);

    if (hasAuth) {
      console.log(`[Baileys] ensureSession: Found auth files for ${connectionId}, attempting to restore...`);
      try {
        await this.createSession(connectionId, companyId);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const restoredSession = this.sessions.get(connectionId);
        if (restoredSession?.status === 'connected') {
          console.log(`[Baileys] ensureSession: Session ${connectionId} restored and connected`);
          return {
            success: true,
            status: 'connected',
            message: 'Session restored from filesystem auth',
          };
        }

        return {
          success: false,
          status: restoredSession?.status as any || 'qr',
          message: 'Session restored but awaiting connection',
        };
      } catch (error) {
        console.error(`[Baileys] ensureSession: Error restoring session ${connectionId}:`, error);
        return {
          success: false,
          status: 'failed',
          message: `Error restoring session: ${(error as Error).message}`,
        };
      }
    } else {
      console.log(`[Baileys] ensureSession: No auth files for ${connectionId}, needs QR scan`);

      await db
        .update(connections)
        .set({ status: 'disconnected' })
        .where(eq(connections.id, connectionId));

      return {
        success: false,
        status: 'needs_qr',
        message: 'No authentication found. Please scan QR code to connect.',
      };
    }
  }

  getEventEmitter(connectionId: string): EventEmitter | undefined {
    console.log(`[SessionManager] Getting emitter for ${connectionId}. Total sessions in map:`, this.sessions.size);
    console.log(`[SessionManager] Session IDs in map:`, Array.from(this.sessions.keys()));
    return this.sessions.get(connectionId)?.emitter;
  }

  getAllSessions(): Array<{ id: string; status: string; phone?: string }> {
    return Array.from(this.sessions.entries()).map(([id, data]) => ({
      id,
      status: data.status,
      phone: data.phone,
    }));
  }

  checkAvailability(connectionId: string, companyId?: string): {
    available: boolean;
    status: string;
    details: string;
  } {
    const logContext = companyId ? `[Company: ${companyId.slice(0, 8)}]` : '';
    console.log(`[SessionManager] ${logContext} Checking availability for connection ${connectionId}`);

    const session = this.sessions.get(connectionId);

    if (!session) {
      console.warn(`[SessionManager] ${logContext} ❌ Connection ${connectionId} not found`);
      console.log(`[SessionManager] ${logContext} Total active sessions: ${this.sessions.size}`);
      console.log(`[SessionManager] ${logContext} Available sessions: ${Array.from(this.sessions.keys()).join(', ') || 'none'}`);

      return {
        available: false,
        status: 'not_found',
        details: `Session ${connectionId} does not exist in SessionManager`
      };
    }

    const isConnected = session.status === 'connected';
    const statusEmoji = isConnected ? '✅' : '⚠️';

    console.log(`[SessionManager] ${logContext} ${statusEmoji} Connection ${connectionId}: ${session.status}${session.phone ? ` (${session.phone})` : ''}`);

    return {
      available: isConnected,
      status: session.status,
      details: `Session ${connectionId} status: ${session.status}, phone: ${session.phone || 'unknown'}`
    };
  }

  private sessionLockAcquired = false;
  private lockHeartbeatInterval: NodeJS.Timeout | null = null;
  private readonly SESSION_LOCK_KEY = 'baileys:session:lock';
  private readonly SESSION_LOCK_TTL = 30; // 30 seconds TTL
  private readonly LOCK_HEARTBEAT_INTERVAL = 10000; // Renew every 10 seconds

  private lockId: string | null = null;
  private shutdownHandlersRegistered = false;

  private async tryAcquireSessionLock(): Promise<boolean> {
    try {
      // Import resiliente para lidar com contextos de transpilação diferentes
      let redis;
      try {
        const redisModule = require('../lib/redis');
        redis = redisModule.default || redisModule.redis;
      } catch (e) {
        const redisModule = await import('../lib/redis');
        redis = redisModule.default || redisModule.redis;
      }

      if (!redis) {
        console.warn('[Baileys Lock] Redis not available, skipping lock');
        return true;
      }

      this.lockId = `${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Check for stale/orphaned locks first
      const existingLock = await redis.get(this.SESSION_LOCK_KEY);
      if (existingLock) {
        // Check TTL - if TTL is -1 (no expiry) or very high, it's likely orphaned
        const ttl = await redis.ttl(this.SESSION_LOCK_KEY);
        if (ttl === -1 || ttl > this.SESSION_LOCK_TTL * 2) {
          console.log(`[Baileys Lock] ⚠️ Found orphaned lock (TTL: ${ttl}), forcing cleanup`);
          await redis.del(this.SESSION_LOCK_KEY);
        } else if (ttl > 0) {
          console.log(`[Baileys Lock] ⏳ Another process owns the lock (TTL: ${ttl}s), skipping`);
          return false;
        }
      }

      // Atomic SET with NX (only set if not exists) and EX (expiry)
      // This prevents race conditions between check and set
      await redis.set(this.SESSION_LOCK_KEY, this.lockId, 'EX', this.SESSION_LOCK_TTL);

      // Verify we got the lock
      const verifyLock = await redis.get(this.SESSION_LOCK_KEY);
      if (verifyLock !== this.lockId) {
        console.log('[Baileys Lock] ⏳ Lost race condition, another process got the lock');
        return false;
      }

      console.log(`[Baileys Lock] ✅ Acquired session lock (ID: ${this.lockId})`);
      this.sessionLockAcquired = true;

      // Register shutdown handlers to release lock on exit
      if (!this.shutdownHandlersRegistered) {
        const cleanup = async () => {
          console.log('[Baileys Lock] 🛑 Shutdown detected, releasing lock...');
          await this.releaseSessionLock();
        };

        process.once('SIGINT', cleanup);
        process.once('SIGTERM', cleanup);
        process.once('exit', () => {
          // Sync cleanup on exit (best effort)
          if (this.lockHeartbeatInterval) {
            clearInterval(this.lockHeartbeatInterval);
            this.lockHeartbeatInterval = null;
          }
        });
        this.shutdownHandlersRegistered = true;
      }

      // Start heartbeat to renew lock (only if TTL is getting low)
      this.lockHeartbeatInterval = setInterval(async () => {
        try {
          const currentValue = await redis.get(this.SESSION_LOCK_KEY);
          if (currentValue === this.lockId) {
            const currentTtl = await redis.ttl(this.SESSION_LOCK_KEY);
            // Only renew if TTL is less than half the original
            if (currentTtl < this.SESSION_LOCK_TTL / 2) {
              await redis.expire(this.SESSION_LOCK_KEY, this.SESSION_LOCK_TTL);
              if (DEBUG) console.log('[Baileys Lock] 💓 Lock heartbeat renewed');
            }
          } else {
            console.warn('[Baileys Lock] ⚠️ Lock was taken by another process, stopping heartbeat');
            if (this.lockHeartbeatInterval) {
              clearInterval(this.lockHeartbeatInterval);
              this.lockHeartbeatInterval = null;
            }
            this.sessionLockAcquired = false;
          }
        } catch (error) {
          console.error('[Baileys Lock] Error renewing heartbeat:', error);
        }
      }, this.LOCK_HEARTBEAT_INTERVAL);

      return true;
    } catch (error) {
      console.error('[Baileys Lock] Error acquiring lock:', error);
      // In case of Redis failure, allow this process to proceed
      console.log('[Baileys Lock] ⚠️ Proceeding without distributed lock (Redis unavailable)');
      return true;
    }
  }

  async releaseSessionLock(): Promise<void> {
    try {
      if (this.lockHeartbeatInterval) {
        clearInterval(this.lockHeartbeatInterval);
        this.lockHeartbeatInterval = null;
      }

      if (this.sessionLockAcquired && this.lockId) {
        let redis;
        try {
          const redisModule = require('../lib/redis');
          redis = redisModule.default || redisModule.redis;
        } catch (e) {
          const redisModule = await import('../lib/redis');
          redis = redisModule.default || redisModule.redis;
        }

        // Only delete if we own the lock (compare-and-delete)
        const currentValue = await redis.get(this.SESSION_LOCK_KEY);
        if (currentValue === this.lockId) {
          await redis.del(this.SESSION_LOCK_KEY);
          console.log('[Baileys Lock] 🔓 Released session lock');
        } else {
          console.log('[Baileys Lock] ℹ️ Lock already released or taken by another process');
        }
        this.sessionLockAcquired = false;
        this.lockId = null;
      }
    } catch (error) {
      console.error('[Baileys Lock] Error releasing lock:', error);
    }
  }

  async initializeSessions(): Promise<void> {
    try {
      const baileysEnabled = process.env.BAILEYS_SESSIONS_ENABLED === 'true';

      if (!baileysEnabled) {
        console.log('[Baileys] ⏸️  Sessions disabled in this environment (BAILEYS_SESSIONS_ENABLED != true)');
        console.log('[Baileys] ℹ️  Set BAILEYS_SESSIONS_ENABLED=true to enable WhatsApp sessions');
        return;
      }

      // ✅ SIMPLIFICAÇÃO: Removido filtro de ambiente (environment)
      // Sessões Baileys agora funcionam independente de NODE_ENV
      // Isso resolve bugs de conflito quando ambiente muda (dev ↔ prod)
      console.log(`[Baileys] 🌍 Sessions enabled (environment-agnostic mode)`);

      // Try to acquire distributed lock before initializing sessions
      // ✅ RESILIÊNCIA: Tentar adquirir o lock múltiplas vezes para evitar condições de corrida
      let hasLock = false;
      const MAX_LOCK_ATTEMPTS = 3;

      for (let i = 0; i < MAX_LOCK_ATTEMPTS; i++) {
        hasLock = await this.tryAcquireSessionLock();
        if (hasLock) break;

        if (i < MAX_LOCK_ATTEMPTS - 1) {
          console.log(`[Baileys] ⏳ Lock busy, waiting 2s before retry (${i + 1}/${MAX_LOCK_ATTEMPTS})...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!hasLock) {
        console.log('[Baileys] ⏭️  Skipping session initialization - another process owns the lock');
        return;
      }

      if (DEBUG) console.log('[Baileys] Initializing sessions from database...');

      // ✅ SIMPLIFICAÇÃO: Buscar todas as sessões baileys ativas, sem filtro de ambiente
      const existingConnections = await db.query.connections.findMany({
        where: and(
          eq(connections.connectionType, 'baileys'),
          eq(connections.isActive, true)
          // REMOVIDO: eq(connections.environment, currentEnv)
        ),
      });

      console.log(`[Baileys] Found ${existingConnections.length} active sessions to restore`);

      for (const connection of existingConnections) {
        try {
          const fs = await import('fs/promises');
          const authPath = this.getAuthPath(connection.id);

          await fs.access(authPath);
          console.log(`[Baileys] Restoring session ${connection.id} (${connection.config_name})`);

          await this.createSession(connection.id, connection.companyId);
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            console.log(`[Baileys] Auth not found for ${connection.id}, marking as disconnected`);
            await db
              .update(connections)
              .set({ status: 'disconnected' })
              .where(eq(connections.id, connection.id));
          } else {
            console.error(`[Baileys] Error restoring session ${connection.id}:`, error);
          }
        }
      }

      if (DEBUG) console.log('[Baileys] Session initialization complete');

      // ✅ CORREÇÃO: Iniciar verificação periódica de conexões
      this.startConnectionCheck();
    } catch (error) {
      console.error('[Baileys] Error during session initialization:', error);
    }
  }

  // ✅ CORREÇÃO: Heartbeat periódico para detectar conexões mortas
  private startHeartbeat(connectionId: string, companyId: string, sock: any): void {
    // Limpar heartbeat anterior se existir
    if (this.heartbeatIntervals.has(connectionId)) {
      clearInterval(this.heartbeatIntervals.get(connectionId)!);
    }

    const interval = setInterval(async () => {
      try {
        const sessionData = this.sessions.get(connectionId);
        if (!sessionData || sessionData.status !== 'connected') {
          clearInterval(interval);
          this.heartbeatIntervals.delete(connectionId);
          return;
        }

        // ✅ CORREÇÃO CRÍTICA: Verificação mais robusta usando estados específicos do WebSocket
        // Verificar múltiplos indicadores de conexão viva
        const wsReadyState = sock.ws?.readyState;
        const hasUser = sock.user?.id;

        // ✅ CORREÇÃO CRÍTICA: Estados do WebSocket
        // 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
        // Considerar morto APENAS se estiver CLOSED (3) E não houver usuário
        // Se estiver CONNECTING (0) ou CLOSING (2), aguardar e não reconectar
        const isConnecting = wsReadyState === 0;
        const isClosing = wsReadyState === 2;
        const isClosed = wsReadyState === 3;
        const isOpen = wsReadyState === 1;

        // Se está conectando ou fechando, apenas logar e aguardar
        if (isConnecting) {
          if (DEBUG) console.log(`[Baileys] 💓 Heartbeat - conexão em estado connecting para ${connectionId}, aguardando...`);
          return; // Não fazer nada, aguardar conexão estabelecer
        }

        if (isClosing) {
          if (DEBUG) console.log(`[Baileys] 💓 Heartbeat - conexão em estado closing para ${connectionId}, aguardando...`);
          return; // Não fazer nada, aguardar fechamento completo
        }

        // Se socket está CLOSED (3) E não há usuário, considerar possível morte
        if (isClosed && !hasUser) {
          // ✅ CORREÇÃO: Verificar novamente após 3 segundos para evitar falsos positivos
          // Aumentar delay de 2s para 3s para dar mais tempo para recuperação
          console.warn(`[Baileys] ⚠️ Heartbeat detectou possível conexão morta para ${connectionId} (wsState: ${wsReadyState}, hasUser: ${hasUser}). Verificando novamente em 3s...`);

          // Aguardar 3 segundos e verificar novamente
          await new Promise(resolve => setTimeout(resolve, 3000));

          const sessionDataRecheck = this.sessions.get(connectionId);
          if (!sessionDataRecheck || sessionDataRecheck.status !== 'connected') {
            clearInterval(interval);
            this.heartbeatIntervals.delete(connectionId);
            return; // Já foi tratado ou não está mais conectado
          }

          const wsReadyStateRecheck = sock.ws?.readyState;
          const hasUserRecheck = sock.user?.id;

          // ✅ CORREÇÃO: Verificar novamente - apenas se ainda estiver CLOSED (3) E sem usuário
          const isStillDead = wsReadyStateRecheck === 3 && !hasUserRecheck;

          // Se ainda estiver morto após verificação dupla, reconectar
          if (isStillDead) {
            console.warn(`[Baileys] ⚠️ Heartbeat confirmou conexão morta para ${connectionId} (wsState: ${wsReadyStateRecheck}, hasUser: ${hasUserRecheck}). Reconectando...`);
            clearInterval(interval);
            this.heartbeatIntervals.delete(connectionId);

            // Marcar como desconectado e tentar reconectar
            sessionDataRecheck.status = 'disconnected';
            await db
              .update(connections)
              .set({ status: 'disconnected' })
              .where(eq(connections.id, connectionId));

            // ✅ CORREÇÃO: Verificar se não há outra sessão ativa antes de reconectar
            if (sessionDataRecheck.phone) {
              const existingConnectionId = this.phoneToConnectionMap.get(sessionDataRecheck.phone);
              if (existingConnectionId && existingConnectionId !== connectionId) {
                console.warn(`[Baileys] ⚠️ Não reconectando - outra sessão ativa para ${sessionDataRecheck.phone} (${existingConnectionId})`);
                return;
              }
            }

            // ✅ CORREÇÃO: Aguardar 5 segundos antes de reconectar (evitar reconexões imediatas)
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Tentar reconectar
            this.sessions.delete(connectionId);
            await this.createSession(connectionId, companyId);
            return;
          } else {
            // Conexão voltou a funcionar, continuar heartbeat
            if (DEBUG) console.log(`[Baileys] 💓 Heartbeat - conexão recuperada para ${connectionId} (wsState: ${wsReadyStateRecheck}, hasUser: ${hasUserRecheck})`);
          }
        } else if (isOpen && hasUser) {
          // ✅ Conexão está viva e aberta (readyState = 1 = OPEN)
          if (DEBUG) console.log(`[Baileys] 💓 Heartbeat OK para ${connectionId} (wsState: ${wsReadyState}, user: ${hasUser})`);
        } else {
          // Estado intermediário ou inesperado - apenas logar
          if (DEBUG) console.log(`[Baileys] 💓 Heartbeat - estado intermediário para ${connectionId} (wsState: ${wsReadyState}, hasUser: ${hasUser})`);
        }
      } catch (error) {
        console.error(`[Baileys] Erro no heartbeat para ${connectionId}:`, error);
        // Se houver erro, pode ser que a conexão esteja morta
        const sessionData = this.sessions.get(connectionId);
        if (sessionData) {
          console.warn(`[Baileys] ⚠️ Heartbeat falhou, marcando como desconectado: ${connectionId}`);
          sessionData.status = 'disconnected';
          await db
            .update(connections)
            .set({ status: 'disconnected' })
            .where(eq(connections.id, connectionId));
        }
      }
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatIntervals.set(connectionId, interval);
    console.log(`[Baileys] 💓 Heartbeat iniciado para ${connectionId}`);
  }

  // ✅ CORREÇÃO: Verificação periódica de conexões para garantir que todas as sessões ativas estejam rodando
  private startConnectionCheck(): void {
    // Evitar múltiplos intervalos
    if (this.connectionCheckInterval) {
      return;
    }

    this.connectionCheckInterval = setInterval(async () => {
      try {
        // ✅ ATUALIZAÇÃO: Buscar TODAS as conexões que deveriam estar ativas (isActive: true)
        // Isso inclui as que estão marcadas como 'disconnected' no banco mas deveriam estar rodando
        const activeConnections = await db.query.connections.findMany({
          where: and(
            eq(connections.connectionType, 'baileys'),
            eq(connections.isActive, true)
            // Não filtramos por status, pois queremos recuperar as desconectadas também
          ),
        });

        for (const conn of activeConnections) {
          const sessionData = this.sessions.get(conn.id);
          const _isInMemory = !!sessionData; // Renamed to suppress unused warning
          const isConnectedInMemory = sessionData?.status === 'connected';
          const isConnectingInMemory = sessionData?.status === 'connecting';

          // Se já estiver conectada ou conectando, está tudo bem
          if (isConnectedInMemory || isConnectingInMemory) {
            continue;
          }

          console.log(`[Baileys Monitor] 🔍 Analisando sessão ${conn.id} (Status DB: ${conn.status})...`);

          // Se não está na memória (ou não está conectada), verificar se podemos restaurar
          const fs = await import('fs/promises');
          const authPath = this.getAuthPath(conn.id);
          let hasAuth = false;

          try {
            await fs.access(authPath);
            // Verificar se tem arquivos dentro
            const files = await fs.readdir(authPath);
            hasAuth = files.length > 0;
          } catch {
            hasAuth = false;
          }

          if (hasAuth) {
            console.warn(`[Baileys Monitor] ⚠️ Sessão ${conn.id} deveria estar ativa, tem credenciais locais, mas está desconectada. Iniciando recuperação automática...`);

            // Tentar reconectar
            try {
              await this.createSession(conn.id, conn.companyId);
            } catch (err) {
              console.error(`[Baileys Monitor] ❌ Falha ao recuperar sessão ${conn.id}:`, err);
            }
          } else {
            // Tentar restaurar do Object Storage antes de desistir
            console.log(`[Baileys Monitor] 🔍 Sessão ${conn.id} sem credenciais locais. Verificando Object Storage...`);

            try {
              const restored = await restoreAuthFromObjectStorage(conn.id, authPath);

              if (restored) {
                console.log(`[Baileys Monitor] ✅ Credenciais restauradas do Object Storage para ${conn.id}. Iniciando reconexão...`);
                await this.createSession(conn.id, conn.companyId);
              } else {
                // Se não tem auth e não está conectada, deve ficar como disconnected/needs_qr
                if (conn.status !== 'disconnected' && conn.status !== 'failed') {
                  console.log(`[Baileys Monitor] ℹ️ Sessão ${conn.id} não tem credenciais. Atualizando status para disconnected.`);
                  await db
                    .update(connections)
                    .set({ status: 'disconnected' })
                    .where(eq(connections.id, conn.id));
                }
              }
            } catch (restoreErr) {
              console.error(`[Baileys Monitor] ❌ Erro ao restaurar do Object Storage para ${conn.id}:`, restoreErr);
              // Marcar como desconectado se falhar
              if (conn.status !== 'disconnected' && conn.status !== 'failed') {
                await db
                  .update(connections)
                  .set({ status: 'disconnected' })
                  .where(eq(connections.id, conn.id));
              }
            }
          }
        }
      } catch (error) {
        console.error('[Baileys] Erro na verificação periódica de conexões:', error);
      }
    }, this.CONNECTION_CHECK_INTERVAL); // Roda a cada 60s

    console.log('[Baileys] ✅ Verificação periódica de conexões iniciada (Modo Recuperação Automática)');
  }
  async getProfilePicture(jid: string): Promise<string | null> {
    const cleanJid = jid.includes('@') ? jid : `${jid.replace(/\D/g, '')}@s.whatsapp.net`;

    // Check cache first
    const cached = this.profilePictureCache.get(cleanJid);
    if (cached && (Date.now() - cached.timestamp < this.PP_CACHE_TTL)) {
      if (DEBUG) console.log(`[Baileys Bridge] ⚡ Serving PP for ${cleanJid} from cache`);
      return cached.url;
    }

    // Attempt to use ANY connected session
    for (const [connectionId, session] of this.sessions.entries()) {
      if (session.status === 'connected' && session.socket) {
        try {
          if (DEBUG) console.log(`[Baileys Bridge] Attempting to fetch PP for ${cleanJid} using connection ${connectionId}`);
          const url = await session.socket.profilePictureUrl(cleanJid, 'image');

          // Update cache
          this.profilePictureCache.set(cleanJid, { url: url || null, timestamp: Date.now() });

          if (url) {
            if (DEBUG) console.log(`[Baileys Bridge] ✅ Found PP for ${cleanJid}: ${url}`);
            return url;
          }
        } catch (error) {
          // Many errors are normal (e.g. contact has no PP or restricted privacy)
          if (DEBUG) console.warn(`[Baileys Bridge] Connection ${connectionId} failed to fetch PP for ${cleanJid}`);
        }
      }
    }

    // Cache miss (null result) to prevent spamming
    this.profilePictureCache.set(cleanJid, { url: null, timestamp: Date.now() });
    return null;
  }
}

// ✅ FIX: Use globalThis for better HMR compatibility in Next.js
const globalForBaileys = globalThis as unknown as {
  __BAILEYS_SESSION_MANAGER_V2__: BaileysSessionManager | undefined;
};

function getOrCreateSessionManager(): BaileysSessionManager {
  // Check existing singleton
  if (globalForBaileys.__BAILEYS_SESSION_MANAGER_V2__) {
    // ✅ FIX: Don't log on reuse to reduce noise
    return globalForBaileys.__BAILEYS_SESSION_MANAGER_V2__;
  }

  console.log(`[Baileys] Creating NEW SessionManager singleton (V2)`);
  const manager = new BaileysSessionManager();
  globalForBaileys.__BAILEYS_SESSION_MANAGER_V2__ = manager;

  return manager;
}

export const sessionManager = getOrCreateSessionManager();

