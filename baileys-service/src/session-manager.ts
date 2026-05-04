/**
 * Baileys Session Manager — Multi-session WhatsApp management.
 * Drop-in replacement for the Go SessionManager, ported from old-session-manager.ts.
 *
 * Key improvements over the Go version:
 * - Real Baileys library (not WhatsMeow reimplementation)
 * - PostgreSQL auth state (survives deploys)
 * - Async mutex per connectionId (no race conditions)
 * - No aggressive Store.Delete (no FK violations)
 * - setImmediate for message processing (no event loop blocking)
 */

import { Boom } from '@hapi/boom';
import { Pool } from 'pg';
import { logger } from './utils/logger';
import { baileysLogger } from './utils/logger';
import { classifyChat } from './utils/chat-classifier';
import { usePostgresAuthState, clearAuthState, hasAuthState } from './auth-state-postgres';
import {
  emitSessionCreated,
  emitSessionUpdated,
  emitSessionDeleted,
  emitQRCodeUpdated,
  emitConnectionStatusChanged,
  emitIncomingMessage,
} from './socket/emitter';

// Baileys imports
import makeWASocket, {
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
  type WASocket,
  type BaileysEventMap,
} from '@whiskeysockets/baileys';

// Types
interface SessionData {
  socket: WASocket | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'qr' | 'failed' | 'invalid';
  phone?: string;
  companyId: string;
  qr?: string;
  retryCount: number;
  lastActivity: number;
}

interface SessionStats {
  total: number;
  byStatus: Record<string, number>;
}

export class SessionManager {
  private sessions = new Map<string, SessionData>();
  private locks = new Map<string, Promise<void>>();
  private db: Pool;

  constructor(databaseUrl: string) {
    this.db = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('neon') ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
    });

    // Start background tasks
    this.startSessionGC();
  }

  // --- Async Mutex ---

  private async withLock<T>(connectionId: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any existing operation on this connectionId
    while (this.locks.has(connectionId)) {
      await this.locks.get(connectionId);
    }

    let resolve: () => void;
    const promise = new Promise<void>((r) => { resolve = r; });
    this.locks.set(connectionId, promise);

    try {
      return await fn();
    } finally {
      this.locks.delete(connectionId);
      resolve!();
    }
  }

  // --- Session Lifecycle ---

  async createSession(connectionId: string, companyId: string): Promise<void> {
    return this.withLock(connectionId, async () => {
      // Check if session already exists and is active
      const existing = this.sessions.get(connectionId);
      if (existing) {
        const s = existing.status;
        if (s === 'connected' || s === 'connecting' || s === 'qr') {
          logger.info({ connectionId, status: s }, 'Session already active, skipping creation');
          return;
        }
      }

      await this._doCreateSession(connectionId, companyId);
    });
  }

  private async _doCreateSession(connectionId: string, companyId: string): Promise<void> {
    logger.info({ connectionId, companyId }, '🔌 Creating Baileys session');

    // Load auth state from PostgreSQL
    const { state, saveCreds } = await usePostgresAuthState(connectionId);
    const { version } = await fetchLatestBaileysVersion();

    logger.info({ connectionId, version }, '📦 Baileys version loaded');

    const sessionData: SessionData = {
      socket: null,
      status: 'connecting',
      companyId,
      retryCount: 0,
      lastActivity: Date.now(),
    };
    this.sessions.set(connectionId, sessionData);

    // Emit creation event
    emitSessionCreated(companyId, { id: connectionId, status: 'connecting' });

    // Create WASocket
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: baileysLogger,
      browser: Browsers.macOS('Chrome'),
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect: false,
      getMessage: async () => undefined,
    });

    sessionData.socket = sock;

    // --- Event Handlers ---

    sock.ev.on('connection.update', async (update) => {
      try {
        await this.handleConnectionUpdate(connectionId, companyId, update, sessionData);
      } catch (err) {
        logger.error({ connectionId, err }, '❌ Error in connection.update handler');
      }
    });

    sock.ev.on('creds.update', async () => {
      await saveCreds();
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Non-blocking: process messages in background
      setImmediate(() => {
        this.handleMessagesUpsert(connectionId, companyId, messages, type, sessionData)
          .catch((err) => logger.error({ connectionId, err }, '❌ Error processing messages'));
      });
    });

    sock.ev.on('messages.update', async (updates) => {
      setImmediate(() => {
        this.handleMessagesUpdate(connectionId, updates)
          .catch((err) => logger.error({ connectionId, err }, '❌ Error processing message updates'));
      });
    });
  }

  private async handleConnectionUpdate(
    connectionId: string,
    companyId: string,
    update: Partial<BaileysEventMap['connection.update']>,
    sessionData: SessionData
  ): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    // QR Code
    if (qr) {
      if (sessionData.qr === qr && sessionData.status === 'qr') return; // deduplicate
      logger.info({ connectionId }, '📱 QR Code generated');
      sessionData.qr = qr;
      sessionData.status = 'qr';
      sessionData.lastActivity = Date.now();

      await this.db.query(
        `UPDATE connections SET qr_code = $1, status = 'connecting' WHERE id = $2`,
        [qr, connectionId]
      );

      emitQRCodeUpdated(companyId, connectionId, qr);
      emitConnectionStatusChanged(companyId, connectionId, 'qr');
    }

    // Connection closed
    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message;
      logger.warn({ connectionId, statusCode, errorMessage }, '🔌 Connection closed');

      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        // ⚠️ CRITICAL: Do NOT delete auth state. Just mark as invalid.
        logger.warn({ connectionId }, '🛑 Logged out (401) — marking as invalid, NOT deleting auth');
        sessionData.status = 'invalid';

        await this.db.query(
          `UPDATE connections SET status = 'invalid', qr_code = NULL WHERE id = $1`,
          [connectionId]
        );
        emitConnectionStatusChanged(companyId, connectionId, 'invalid');
        emitSessionUpdated(companyId, { id: connectionId, status: 'invalid' });

        // Clean up memory only (not DB)
        this.cleanupSession(connectionId);

      } else if (statusCode === 440) {
        // Conflict — another session with same number
        logger.warn({ connectionId }, '⚠️ Conflict (440) — another device connected');
        sessionData.status = 'disconnected';

        await this.db.query(
          `UPDATE connections SET status = 'disconnected', qr_code = NULL WHERE id = $1`,
          [connectionId]
        );
        emitConnectionStatusChanged(companyId, connectionId, 'disconnected');
        this.cleanupSession(connectionId);

      } else {
        // Transient error — let Baileys auto-reconnect or retry
        sessionData.retryCount++;
        const delay = Math.min(5000 * Math.pow(1.3, sessionData.retryCount - 1), 45000);
        logger.info({ connectionId, statusCode, retryCount: sessionData.retryCount, delay }, '🔄 Reconnecting...');

        sessionData.status = 'connecting';
        emitConnectionStatusChanged(companyId, connectionId, 'connecting');

        // Cleanup and retry after delay
        this.cleanupSession(connectionId);
        setTimeout(async () => {
          try {
            await this._doCreateSession(connectionId, companyId);
          } catch (err) {
            logger.error({ connectionId, err }, '❌ Reconnection failed');
          }
        }, delay);
      }
    }

    // Connected
    if (connection === 'open') {
      const phone = sessionData.socket?.user?.id?.split(':')[0] || '';
      logger.info({ connectionId, phone }, '✅ Connected');

      sessionData.status = 'connected';
      sessionData.phone = phone;
      sessionData.retryCount = 0;
      sessionData.lastActivity = Date.now();
      sessionData.qr = undefined;

      const now = new Date();
      await this.db.query(
        `UPDATE connections SET status = 'connected', phone = $1, qr_code = NULL, 
         is_active = true, last_connected = $2 WHERE id = $3`,
        [phone, now, connectionId]
      );

      emitConnectionStatusChanged(companyId, connectionId, 'connected', phone);
      emitSessionUpdated(companyId, {
        id: connectionId,
        status: 'connected',
        phone,
        isActive: true,
        lastConnected: now,
      });
    }
  }

  private async handleMessagesUpsert(
    connectionId: string,
    companyId: string,
    messages: any[],
    type: string,
    sessionData: SessionData
  ): Promise<void> {
    if (type !== 'notify' && type !== 'append') return;

    for (const msg of messages) {
      if (!msg.message) continue;

      // For append (history), only process recent messages (< 5 min)
      if (type === 'append') {
        const msgTime = typeof msg.messageTimestamp === 'number'
          ? msg.messageTimestamp * 1000
          : (msg.messageTimestamp?.low || 0) * 1000;
        if (!msgTime || Date.now() - msgTime > 300000) continue;
      }

      const remoteJid = msg.key.remoteJid || '';
      const classification = classifyChat(remoteJid, msg);
      const phoneNumber = remoteJid.split('@')[0] || '';
      const fromMe = msg.key.fromMe || false;

      // Extract message content
      const messageContent = this.extractMessageContent(msg);
      const contentType = this.detectContentType(msg);
      const messageID = msg.key.id || '';

      sessionData.lastActivity = Date.now();

      // Save to database
      try {
        // Check duplicate
        const dup = await this.db.query(
          'SELECT id FROM messages WHERE provider_message_id = $1 LIMIT 1',
          [messageID]
        );
        if (dup.rows.length > 0) continue;

        // Upsert contact
        const pushName = msg.pushName || '';
        const contactResult = await this.upsertContact(companyId, phoneNumber, pushName, fromMe);
        if (!contactResult) continue;
        const { contactId, contactName } = contactResult;

        // Upsert conversation
        const conversationId = await this.upsertConversation(companyId, contactId, connectionId);
        if (!conversationId) continue;

        // Save message
        const savedMsgId = await this.saveMessage(
          companyId, conversationId, messageID, contactId,
          messageContent, contentType, fromMe, msg.messageTimestamp
        );
        if (!savedMsgId) continue;

        logger.info({ connectionId, phone: phoneNumber, msgId: savedMsgId, fromMe }, '💬 Message saved');

        // Emit to Next.js for automation trigger
        if (!fromMe && !classification.shouldBlockAI) {
          emitIncomingMessage(companyId, {
            connectionId,
            contactPhone: phoneNumber,
            contactName,
            messageContent,
            messageType: contentType,
            messageId: savedMsgId,
            conversationId,
            savedMessageId: savedMsgId,
            isFromMe: false,
            rawMsg: {
              pushName,
              messageTimestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : undefined,
              remoteJid,
            },
          });
        }
      } catch (err) {
        logger.error({ connectionId, messageID, err }, '❌ Error processing message');
      }
    }
  }

  private async handleMessagesUpdate(connectionId: string, updates: any[]): Promise<void> {
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

        if (newStatus) {
          await this.db.query(
            `UPDATE messages SET status = $1 WHERE provider_message_id = $2`,
            [newStatus, key.id]
          );
        }
      } catch (err) {
        logger.error({ err }, '❌ Error updating message status');
      }
    }
  }

  // --- Public API Methods ---

  async deleteSession(connectionId: string): Promise<void> {
    return this.withLock(connectionId, async () => {
      logger.info({ connectionId }, '🗑️ Deleting session');
      this.cleanupSession(connectionId);

      await this.db.query(
        `UPDATE connections SET status = 'disconnected', qr_code = NULL WHERE id = $1`,
        [connectionId]
      );
    });
  }

  async sendMessage(connectionId: string, to: string, content: any): Promise<string | null> {
    const session = this.sessions.get(connectionId);
    if (!session?.socket || session.status !== 'connected') {
      throw new Error(`Session ${connectionId} is not connected (status: ${session?.status || 'not found'})`);
    }

    // Format JID
    const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;

    try {
      let result: any;

      if (typeof content === 'string') {
        result = await session.socket.sendMessage(jid, { text: content });
      } else if (content.text) {
        result = await session.socket.sendMessage(jid, { text: content.text });
      } else if (content.image) {
        result = await session.socket.sendMessage(jid, {
          image: { url: content.image },
          caption: content.caption || '',
        });
      } else if (content.audio) {
        result = await session.socket.sendMessage(jid, {
          audio: { url: content.audio },
          mimetype: 'audio/mp4',
          ptt: content.ptt !== false,
        });
      } else {
        result = await session.socket.sendMessage(jid, content);
      }

      session.lastActivity = Date.now();
      return result?.key?.id || null;
    } catch (err) {
      logger.error({ connectionId, to, err }, '❌ Send message failed');
      throw err;
    }
  }

  ensureSession(connectionId: string, companyId: string): {
    success: boolean;
    status: string;
    message: string;
  } {
    const session = this.sessions.get(connectionId);
    if (!session) {
      return { success: false, status: 'needs_qr', message: 'Session not found' };
    }
    return {
      success: session.status === 'connected',
      status: session.status,
      message: `Session is ${session.status}`,
    };
  }

  getSession(connectionId: string): SessionData | undefined {
    return this.sessions.get(connectionId);
  }

  getSessionStatus(connectionId: string): string | null {
    return this.sessions.get(connectionId)?.status || null;
  }

  getSessionsStats(): SessionStats {
    const byStatus: Record<string, number> = {};
    for (const [, session] of this.sessions) {
      byStatus[session.status] = (byStatus[session.status] || 0) + 1;
    }
    return { total: this.sessions.size, byStatus };
  }

  getBatchSessionStatus(connectionIds: string[]): Record<string, string | null> {
    const result: Record<string, string | null> = {};
    for (const id of connectionIds) {
      result[id] = this.sessions.get(id)?.status || null;
    }
    return result;
  }

  async resumeAllSessions(): Promise<{ success: number; failed: number }> {
    logger.info('🔄 Starting auto-resume of active sessions...');

    const result = await this.db.query(
      `SELECT id, company_id FROM connections 
       WHERE status = 'connected' AND connection_type = 'baileys'`
    );

    logger.info({ count: result.rows.length }, 'Found sessions to resume');
    let success = 0;
    let failed = 0;

    for (const row of result.rows) {
      try {
        const hasAuth = await hasAuthState(row.id);
        if (!hasAuth) {
          logger.warn({ connectionId: row.id }, '⚠️ No auth state, marking as disconnected');
          await this.db.query(
            `UPDATE connections SET status = 'disconnected' WHERE id = $1`,
            [row.id]
          );
          failed++;
          continue;
        }

        await this.createSession(row.id, row.company_id);
        success++;
      } catch (err) {
        logger.error({ connectionId: row.id, err }, '❌ Failed to resume session');
        failed++;
      }
    }

    logger.info({ success, failed }, '✅ Auto-resume complete');
    return { success, failed };
  }

  async validateWhatsAppNumber(connectionId: string, phoneNumber: string): Promise<{
    exists: boolean;
    jid?: string;
  }> {
    const session = this.sessions.get(connectionId);
    if (!session?.socket || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
    const results = await session.socket.onWhatsApp(jid);
    const result = results?.[0];
    return {
      exists: Boolean(result?.exists),
      jid: result?.jid || undefined,
    };
  }

  async getProfilePicture(jid: string): Promise<string | null> {
    // Use any connected session
    for (const [, session] of this.sessions) {
      if (session.status === 'connected' && session.socket) {
        try {
          const url = await session.socket.profilePictureUrl(jid, 'image');
          return url || null;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  async clearAuth(connectionId: string): Promise<void> {
    this.cleanupSession(connectionId);
    await clearAuthState(connectionId);
  }

  async syncChatHistory(connectionId: string, jidStr: string): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session?.socket || session.status !== 'connected') {
      throw new Error('Session not connected');
    }
    // Baileys handles history sync natively via events
    logger.info({ connectionId, jid: jidStr }, '📜 History sync requested');
  }

  getAllSessionsList(): Array<{ id: string; status: string; phone?: string }> {
    const result: Array<{ id: string; status: string; phone?: string }> = [];
    for (const [id, session] of this.sessions) {
      result.push({ id, status: session.status, phone: session.phone });
    }
    return result;
  }

  // --- Private Helpers ---

  private cleanupSession(connectionId: string): void {
    const session = this.sessions.get(connectionId);
    if (session?.socket) {
      try {
        session.socket.end(undefined);
      } catch {
        // ignore cleanup errors
      }
    }
    this.sessions.delete(connectionId);
  }

  private extractMessageContent(msg: any): string {
    const m = msg.message;
    if (!m) return '';

    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.documentMessage?.caption) return m.documentMessage.caption;
    if (m.contactMessage?.displayName) return `[Contact: ${m.contactMessage.displayName}]`;
    if (m.locationMessage) return `[Location: ${m.locationMessage.degreesLatitude}, ${m.locationMessage.degreesLongitude}]`;
    if (m.reactionMessage) return `[Reaction: ${m.reactionMessage.text}]`;
    if (m.stickerMessage) return '[Sticker]';
    if (m.audioMessage) return '[Audio]';
    if (m.imageMessage) return '[Image]';
    if (m.videoMessage) return '[Video]';
    if (m.documentMessage) return `[Document: ${m.documentMessage.fileName || 'file'}]`;

    return '[Unknown message type]';
  }

  private detectContentType(msg: any): string {
    const m = msg.message;
    if (!m) return 'unknown';

    if (m.conversation || m.extendedTextMessage) return 'text';
    if (m.imageMessage) return 'image';
    if (m.videoMessage) return 'video';
    if (m.audioMessage) return 'audio';
    if (m.documentMessage) return 'document';
    if (m.stickerMessage) return 'sticker';
    if (m.contactMessage) return 'contact';
    if (m.locationMessage) return 'location';
    if (m.reactionMessage) return 'reaction';

    return 'unknown';
  }

  private async upsertContact(
    companyId: string,
    phone: string,
    pushName: string,
    fromMe: boolean
  ): Promise<{ contactId: string; contactName: string } | null> {
    const existing = await this.db.query(
      `SELECT id, name, whatsapp_name FROM contacts 
       WHERE phone = $1 AND company_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [phone, companyId]
    );

    const validPushName = !fromMe && pushName ? pushName : '';

    if (existing.rows.length === 0) {
      const name = validPushName || phone;
      const result = await this.db.query(
        `INSERT INTO contacts (id, company_id, name, phone, whatsapp_name, is_group, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, false, 'ACTIVE')
         RETURNING id, name`,
        [companyId, name, phone, validPushName || null]
      );
      return { contactId: result.rows[0].id, contactName: result.rows[0].name };
    }

    const row = existing.rows[0];

    // Update WhatsApp name if available
    if (validPushName) {
      await this.db.query(
        `UPDATE contacts SET whatsapp_name = $1 WHERE id = $2`,
        [validPushName, row.id]
      );
    }

    const contactName = row.whatsapp_name || row.name;
    return { contactId: row.id, contactName };
  }

  private async upsertConversation(
    companyId: string,
    contactId: string,
    connectionId: string
  ): Promise<string | null> {
    const existing = await this.db.query(
      `SELECT id FROM conversations 
       WHERE contact_id = $1 AND connection_id = $2 AND company_id = $3 LIMIT 1`,
      [contactId, connectionId, companyId]
    );

    if (existing.rows.length > 0) {
      const convId = existing.rows[0].id;
      await this.db.query(
        `UPDATE conversations SET last_message_at = NOW(), archived_at = NULL WHERE id = $1`,
        [convId]
      );
      return convId;
    }

    const result = await this.db.query(
      `INSERT INTO conversations (id, company_id, contact_id, connection_id, status, last_message_at, ai_active, contact_type, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'NEW', NOW(), true, 'PASSIVE', NOW(), NOW())
       RETURNING id`,
      [companyId, contactId, connectionId]
    );
    return result.rows[0]?.id || null;
  }

  private async saveMessage(
    companyId: string,
    conversationId: string,
    providerMessageId: string,
    contactId: string,
    content: string,
    contentType: string,
    fromMe: boolean,
    timestamp: any
  ): Promise<string | null> {
    const senderType = fromMe ? 'AGENT' : 'CONTACT';
    const sentAt = typeof timestamp === 'number'
      ? new Date(timestamp * 1000)
      : new Date();

    try {
      const result = await this.db.query(
        `INSERT INTO messages (id, company_id, conversation_id, provider_message_id, sender_type, sender_id, content, content_type, status, sent_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'received', $8, NOW())
         ON CONFLICT (provider_message_id) DO NOTHING
         RETURNING id`,
        [companyId, conversationId, providerMessageId, senderType, contactId, content, contentType, sentAt]
      );
      return result.rows[0]?.id || null;
    } catch (err) {
      logger.error({ err, providerMessageId }, '❌ Error saving message');
      return null;
    }
  }

  // --- Background Tasks ---

  private startSessionGC(): void {
    setInterval(() => {
      for (const [id, session] of this.sessions) {
        try {
          const age = Date.now() - session.lastActivity;

          // Watchdog: warn about inactive connected sessions
          if (session.status === 'connected' && age > 600000) {
            logger.warn({ connectionId: id, inactiveMinutes: Math.floor(age / 60000) },
              '🐕 [WATCHDOG] Session inactive for a long time');
          }

          // GC: clean zombie connecting sessions (> 15 min)
          if (session.status === 'connecting' && age > 900000) {
            logger.error({ connectionId: id }, '🧹 [GC] Stuck connecting session, cleaning up');
            this.cleanupSession(id);
          }
        } catch (err) {
          logger.error({ connectionId: id, err }, '🚨 [GC] Error during session check');
        }
      }
    }, 120000); // Every 2 minutes
  }
}
