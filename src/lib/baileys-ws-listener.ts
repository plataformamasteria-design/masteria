/**
 * Baileys WebSocket Listener
 * Connects to the Baileys microservice via Socket.IO to receive real-time events.
 * Re-emits events through the MasterIA Socket.IO server to the frontend.
 * Handles incoming message events to trigger automation engine.
 * 
 * ✅ v2: Auto-reconnection with exponential backoff, heartbeat keepAlive,
 *        auto-resume sessions on reconnect, and media processing pipeline.
 */

import { io as ioClient, Socket } from 'socket.io-client';
import { getSocketIO } from '@/lib/socket';
import { SessionCache } from '@/lib/cache/session-cache';
// 🔧 BUG FIX: Removido import estático para evitar circular dependency no worker
// O NextJS no bundle server quebra com "TypeError: a is not a function" se o fluxo for circular
// Usaremos um import dinâmico na hora da execução do evento via Promise.
const BAILEYS_SERVICE_URL = process.env.BAILEYS_SERVICE_URL || 'http://localhost:3001';

let baileysSocket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 100; // ↑ Increased from 50
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let monitorInterval: ReturnType<typeof setInterval> | null = null;

// ━━━ Cache: conversationId → companyId ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Evita DB roundtrip a cada mensagem recebida. TTL implícito pelo LRU simples.
const convCompanyCache = new Map<string, string>();
const CACHE_MAX_SIZE = 500; // Limite para não crescer indefinidamente

function cacheSet(conversationId: string, companyId: string): void {
    if (convCompanyCache.size >= CACHE_MAX_SIZE) {
        // Remover a entrada mais antiga (first key)
        const firstKey = convCompanyCache.keys().next().value;
        if (firstKey) convCompanyCache.delete(firstKey);
    }
    convCompanyCache.set(conversationId, companyId);
}

// ✅ Heartbeat: Ping the microservice every 30s to keep connection alive
function startHeartbeat(): void {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
        if (baileysSocket?.connected) {
            baileysSocket.emit('ping');
        } else {
            console.warn('[BaileysWS] ❤️ Heartbeat: Socket disconnected, attempting reconnect...');
            baileysSocket?.connect();
        }
    }, 30_000); // 30 seconds
}

function stopHeartbeat(): void {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// ✅ Auto-resume all sessions after reconnecting to microservice
async function autoResumeOnReconnect(): Promise<void> {
    try {
        const { baileysBridge } = require('./baileys-bridge-client');
        const isHealthy = await baileysBridge.healthCheck();
        if (!isHealthy) {
            console.warn('[BaileysWS] ⚠️ Microservice not healthy yet, skipping auto-resume');
            return;
        }
        console.log('[BaileysWS] 🔄 Auto-resuming all sessions after reconnection...');
        const result = await baileysBridge.resumeAllSessions();
        console.log(`[BaileysWS] ✅ Sessions resumed: ${result.success} success, ${result.failed} failed`);
    } catch (err) {
        console.error('[BaileysWS] ❌ Error auto-resuming sessions:', err);
    }
}

export function initBaileysWSListener(): void {
    if (baileysSocket?.connected) {
        console.log('[BaileysWS] Already connected to Baileys service');
        return;
    }

    // Cleanup previous socket if exists
    if (baileysSocket) {
        baileysSocket.removeAllListeners();
        baileysSocket.disconnect();
        baileysSocket = null;
    }

    console.log(`[BaileysWS] Connecting to Baileys service at ${BAILEYS_SERVICE_URL}...`);

    baileysSocket = ioClient(BAILEYS_SERVICE_URL, {
        path: '/baileys-ws',
        transports: ['websocket', 'polling'], // ✅ Added polling fallback
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000, // ✅ Cap at 30s (exponential backoff)
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        timeout: 30000, // ✅ Increased from 10s to 30s
    });

    baileysSocket.on('connect', () => {
        console.log('[BaileysWS] ✅ Connected to Baileys microservice');
        reconnectAttempts = 0;
        startHeartbeat();

        // ✅ Auto-resume sessions on (re)connection — non-blocking
        autoResumeOnReconnect().catch(err => {
            console.error('[BaileysWS] Error in autoResumeOnReconnect:', err);
        });
    });

    baileysSocket.on('disconnect', (reason) => {
        console.warn(`[BaileysWS] ⚠️ Disconnected from Baileys service: ${reason}`);
        stopHeartbeat();

        // ✅ If server-initiated disconnect, force reconnect
        if (reason === 'io server disconnect' || reason === 'transport close') {
            console.log('[BaileysWS] 🔄 Server-side disconnect detected, forcing reconnect...');
            setTimeout(() => {
                baileysSocket?.connect();
            }, 2000);
        }
    });

    baileysSocket.on('connect_error', (error) => {
        reconnectAttempts++;
        if (reconnectAttempts <= 3 || reconnectAttempts % 10 === 0) {
            console.error(`[BaileysWS] Connection error (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`, error.message);
        }
        // ✅ If max attempts reached, retry from scratch after 60s
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.warn('[BaileysWS] 🔁 Max reconnect attempts reached. Retrying in 60s...');
            reconnectAttempts = 0;
            baileysSocket?.disconnect();
            setTimeout(() => {
                initBaileysWSListener();
            }, 60_000);
        }
    });

    // ✅ Pong response for keepAlive verification
    baileysSocket.on('pong', () => {
        // Silently acknowledge — connection is alive
    });

    // Forward session events to MasterIA frontend
    const sessionEvents = [
        'whatsapp:session:created',
        'whatsapp:session:updated',
        'whatsapp:session:deleted',
        'whatsapp:session:qr',
        'whatsapp:session:status',
    ];

    for (const event of sessionEvents) {
        baileysSocket.on(event, async (data: any) => {
            try {
                const io = getSocketIO();
                if (!io) return;

                io.emit(event, data);

                // Invalidate session cache on changes
                if (data?.id || data?.sessionId) {
                    const sessionId = data.id || data.sessionId;
                    if (data.companyId) {
                        await SessionCache.invalidateOnChange(data.companyId, sessionId);
                    }
                }
            } catch (error) {
                console.error(`[BaileysWS] Error forwarding event ${event}:`, error);
            }
        });
    }

    // Handle incoming messages from Baileys
    baileysSocket.on('baileys:incoming-message', async (data: {
        connectionId: string;
        contactPhone: string;
        contactName: string;
        messageContent: string;
        messageType: string;
        messageId: string;
        conversationId: string;
        savedMessageId: string;
        isFromMe: boolean;
        mediaUrl?: string;
        rawMsg?: any;
    }) => {
        try {
            // ━━━ STEP 1: Emitir eventos realtime IMEDIATOS (fast-path com cache) ━━━━━━━
            // Checamos o cache primeiro para evitar DB roundtrip
            const cachedCompanyId = convCompanyCache.get(data.conversationId);

            // ✅ IGNORAR TRANSCRIÇÃO ANTECIPADA: Se for áudio, limpar a transcrição do microserviço
            // Isso garante que o áudio vai apenas como '🎵 Áudio' para o DB, ativando o player nativo na UI
            // A transcrição será feita pontualmente e apenas pelo Agente de IA.
            if (data.messageType?.toUpperCase() === 'AUDIO') {
                data.messageContent = '🎵 Áudio';
                // Como o whatsmeow-service grava no DB antes de emitir o socket, precisamos sobrescrever o DB aqui:
                import('@/lib/db').then(async ({ db }) => {
                    const { messages } = await import('@/lib/db/schema');
                    const { eq } = await import('drizzle-orm');
                    await db.update(messages)
                        .set({ content: '🎵 Áudio' })
                        .where(eq(messages.id, data.savedMessageId))
                        .catch(err => console.error('[BaileysWS] Falha ao sanitizar transcrição prévia no DB:', err));
                });
            }

            const emitRealtimeEvents = (companyId: string) => {
                import('@/lib/socket').then(({ emitToCompany }) => {
                    // Fast-path: payload completo para append direto no frontend
                    emitToCompany(companyId, 'chat:new-message', {
                        conversationId: data.conversationId,
                        messageId: data.savedMessageId,
                        connectionId: data.connectionId,
                        contactPhone: data.contactPhone,
                        contactName: data.contactName,
                        content: data.messageContent,
                        contentType: data.messageType?.toUpperCase() || 'TEXT',
                        isFromMe: data.isFromMe,
                        // senderType explícito para evitar ambiguidade no frontend
                        senderType: data.isFromMe ? 'AGENT' : 'CONTACT',
                        mediaUrl: data.mediaUrl,
                        timestamp: new Date().toISOString(),
                    });
                    // Slow-path: força refresh da lista completa (backup)
                    emitToCompany(companyId, 'inbox:update', { timestamp: Date.now() });
                }).catch(err => console.error('[BaileysWS] Erro ao emitir eventos realtime:', err));
            };

            if (cachedCompanyId) {
                // ⚡ INSTANT: companyId em cache — zero latencia de DB
                emitRealtimeEvents(cachedCompanyId);
            } else {
                // Primeira vez nesta conversa — buscar no DB e cachear
                import('@/lib/db').then(async ({ db }) => {
                    const { conversations } = await import('@/lib/db/schema');
                    const { eq } = await import('drizzle-orm');
                    const [conv] = await db.select({ companyId: conversations.companyId })
                        .from(conversations)
                        .where(eq(conversations.id, data.conversationId))
                        .limit(1);

                    if (conv) {
                        cacheSet(data.conversationId, conv.companyId);
                        emitRealtimeEvents(conv.companyId);
                    }
                }).catch(err => console.error('[BaileysWS] Erro ao buscar companyId para emit:', err));
            }

            // ✅ STEP 2: Trigger automation engine (non-blocking)
            if (!data.isFromMe) {
                console.log(`[BaileysWS] 🤖 Triggering automation for message ${data.savedMessageId}`);
                // 🔧 BUG FIX: Uso de import() assíncrono para resolver 'a is not a function' Circular Dependency Error do Webpack
                import('@/lib/automation-engine').then(({ processIncomingMessageTrigger }) => {
                    processIncomingMessageTrigger(data.conversationId, data.savedMessageId, false)
                        .then(() => {
                            console.log(`[BaileysWS] ✅ Automation triggered for message ${data.savedMessageId}`);
                        })
                        .catch(err => {
                            console.error(`[BaileysWS] ❌ Automation error for message ${data.savedMessageId}:`, err);
                        });
                }).catch(err => {
                    console.error('[BaileysWS] ❌ Falha ao importar dinamicamente automation-engine:', err);
                });
            }

            // ✅ STEP 3: Process media in background if present
            if (data.mediaUrl && data.savedMessageId) {
                processMediaInBackground(data.savedMessageId, data.mediaUrl, data.messageType, data.conversationId).catch(err => {
                    console.error(`[BaileysWS] ❌ Background media processing error:`, err);
                });
            }
        } catch (error) {
            console.error('[BaileysWS] Error processing incoming message event:', error);
        }
    });

    // ✅ Start connection monitor (checks every 5 minutes)
    startConnectionMonitor();
}

// ✅ Background media processing: download from temporary URL, upload to S3, update DB
async function processMediaInBackground(
    messageId: string,
    mediaUrl: string,
    messageType: string,
    conversationId: string,
): Promise<void> {
    try {
        // Skip if already an S3 URL
        if (mediaUrl.includes('s3.') || mediaUrl.includes('cloudfront.net') || mediaUrl.includes('amazonaws.com')) {
            return;
        }

        console.log(`[BaileysWS] 📸 Processing media for message ${messageId}...`);

        let fetchUrl = mediaUrl;
        try {
            const urlObj = new URL(mediaUrl);
            const isLocal = urlObj.hostname === '127.0.0.1' || urlObj.hostname === 'localhost';
            // Rewrite URL if it points to a local address or a generic railway domain that might be inaccessible directly
            if (isLocal || urlObj.hostname.includes('railway.app') || urlObj.hostname.includes('railway.internal')) {
                if (BAILEYS_SERVICE_URL) {
                    const serviceUrlObj = new URL(BAILEYS_SERVICE_URL);
                    fetchUrl = `${serviceUrlObj.origin}${urlObj.pathname}${urlObj.search}`;
                    console.log(`[BaileysWS] 🔄 Rewrote media URL: ${mediaUrl} -> ${fetchUrl}`);
                }
            }
        } catch (err) {
            console.warn(`[BaileysWS] ⚠️ Invalid media URL format: ${mediaUrl}`);
        }

        const mediaResponse = await fetch(fetchUrl, { signal: AbortSignal.timeout(30_000) });
        if (!mediaResponse.ok) {
            console.warn(`[BaileysWS] ⚠️ Failed to download media: ${mediaResponse.statusText}`);
            return;
        }

        const arrayBuffer = await mediaResponse.arrayBuffer();
        const mediaBuffer = Buffer.from(arrayBuffer);

        if (mediaBuffer.length === 0) {
            console.warn('[BaileysWS] ⚠️ Empty media buffer, skipping');
            return;
        }

        const { uploadFileToS3 } = await import('@/lib/s3');
        const { v4: uuidv4 } = await import('uuid');

        let extension = 'bin';
        if (messageType.toLowerCase().includes('image')) extension = 'jpg';
        else if (messageType.toLowerCase().includes('video')) extension = 'mp4';
        else if (messageType.toLowerCase().includes('audio')) extension = 'ogg';
        else if (messageType.toLowerCase().includes('document')) extension = 'pdf';

        const s3Key = `media_baileys/${uuidv4()}.${extension}`;
        const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';

        // We need companyId for S3 upload — get it from the conversation
        const { db } = await import('@/lib/db');
        const { conversations, messages } = await import('@/lib/db/schema');
        const { eq } = await import('drizzle-orm');

        const [conv] = await db.select({ companyId: conversations.companyId })
            .from(conversations)
            .where(eq(conversations.id, conversationId))
            .limit(1);

        if (!conv) return;

        const s3Url = await uploadFileToS3(conv.companyId, s3Key, mediaBuffer, contentType);

        if (s3Url) {
            await db.update(messages)
                .set({ mediaUrl: s3Url })
                .where(eq(messages.id, messageId));

            // ✅ v2: Update the conversation's lastMessageAt so the frontend polling (/api/v1/conversations/status) 
            // detects the change, forcing the inbox to re-fetch and render the media instead of the "Processando..." spinner!
            await db.update(conversations)
                .set({
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(conversations.id, conversationId));

            console.log(`[BaileysWS] ✅ Media uploaded to S3 and DB updated: ${s3Url}`);

            // Notificar frontend via SSE/Socket.IO (scoped por empresa)
            const { emitToCompany } = await import('@/lib/socket');
            // Fast-path: atualizar a URL de mídia na mensagem sem refetch
            emitToCompany(conv.companyId, 'chat:message-updated', {
                messageId,
                conversationId,
                mediaUrl: s3Url,
            });
            // Slow-path backup
            emitToCompany(conv.companyId, 'inbox:update', { timestamp: Date.now() });
        }
    } catch (err) {
        console.error(`[BaileysWS] ❌ Error processing media for message ${messageId}:`, err);
    }
}

// ✅ Connection monitor: ensures listener stays connected
function startConnectionMonitor(): void {
    if (monitorInterval) clearInterval(monitorInterval);

    monitorInterval = setInterval(() => {
        if (!baileysSocket?.connected) {
            console.warn('[BaileysWS] 🔍 Monitor: Socket disconnected, reinitializing...');
            initBaileysWSListener();
        }
    }, 5 * 60_000); // Every 5 minutes
}

export function disconnectBaileysWS(): void {
    stopHeartbeat();
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
    if (baileysSocket) {
        baileysSocket.removeAllListeners();
        baileysSocket.disconnect();
        baileysSocket = null;
        console.log('[BaileysWS] Disconnected from Baileys service');
    }
}

export function isBaileysWSConnected(): boolean {
    return baileysSocket?.connected || false;
}
