// src/lib/facebookApiService.ts
'use server';

import { db } from '@/lib/db';
import { connections } from './db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './crypto';
import * as CircuitBreaker from './circuit-breaker';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v21.0';

interface SendTemplateArgs {
    connectionId?: string;
    connection?: typeof connections.$inferSelect;
    to: string;
    templateName: string;
    languageCode: string;
    components: Record<string, unknown>[];
}

// Helper para lidar com erros de entrega relacionados ao 9º dígito
async function executeWithPhoneFallback<T>(
    originalPhone: string,
    operation: (phoneToTry: string) => Promise<T>
): Promise<T> {
    try {
        return await operation(originalPhone);
    } catch (error: any) {
        const isDeliveryError = error.metaCode === 131026 || error.metaCode === 131009 || error.code === 400 || error.code === 404;
        
        if (isDeliveryError) {
            const { getPhoneVariations } = await import('@/lib/utils');
            const variations = getPhoneVariations(originalPhone);
            const digitsOnlyOriginal = originalPhone.replace(/\D/g, '');
            
            // Busca a variação que é diferente do número atual testado
            const fallbackPhone = variations.find(v => v.replace(/\D/g, '') !== digitsOnlyOriginal);
            
            if (fallbackPhone) {
                console.log(`[Facebook API] Fallback ativo: Tentando variação do número ${fallbackPhone} (Original falhou: ${originalPhone})`);
                try {
                    const result = await operation(fallbackPhone);
                    console.log(`[Facebook API] ✅ Fallback com sucesso para ${fallbackPhone}. Auto-corrigindo banco de dados...`);
                    
                    // Auto-corrige o banco de forma assíncrona
                    import('@/lib/db').then(({ db }) => {
                        import('./db/schema').then(({ contacts }) => {
                            import('drizzle-orm').then(({ eq }) => {
                                db.update(contacts)
                                  .set({ phone: fallbackPhone })
                                  .where(eq(contacts.phone, originalPhone))
                                  .execute()
                                  .catch(e => console.error("[Facebook API] Erro ao auto-corrigir telefone no fallback:", e));
                            });
                        });
                    });
                    
                    return result;
                } catch (fallbackError: any) {
                    console.error(`[Facebook API] Fallback também falhou para ${fallbackPhone}. Retornando erro original.`);
                    throw error; // Retorna o erro original
                }
            }
        }
        throw error;
    }
}


export async function sendWhatsappTemplateMessage({
    connectionId,
    connection: providedConnection,
    to,
    templateName,
    languageCode,
    components,
}: SendTemplateArgs): Promise<Record<string, unknown>> {

    // Verifica circuit breaker para Meta API
    if (CircuitBreaker.isOpen('meta')) {
        const stats = CircuitBreaker.getStats('meta');
        const resetIn = stats.openUntil ? Math.ceil((stats.openUntil - Date.now()) / 1000) : 0;
        throw new Error(`Meta API circuit breaker está ABERTO. Tente novamente em ${resetIn}s.`);
    }

    let connection: typeof connections.$inferSelect;

    if (providedConnection) {
        connection = providedConnection;
    } else if (connectionId) {
        const [fetchedConnection] = await db.select().from(connections).where(eq(connections.id, connectionId));
        if (!fetchedConnection) {
            throw new Error(`Conexão com ID ${connectionId} não encontrada.`);
        }
        connection = fetchedConnection;
    } else {
        throw new Error('Nem connectionId nem connection foram fornecidos.');
    }

    if (!connection.accessToken) {
        throw new Error(`Token de acesso não configurado para a conexão ${connection.config_name}`);
    }
    const accessToken = decrypt(connection.accessToken);
    if (!accessToken) {
        throw new Error(`Falha ao desencriptar o token de acesso para a conexão ${connection.config_name}`);
    }

    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${connection.phoneNumberId}/messages`;

    return executeWithPhoneFallback(to, async (phoneToTry) => {
        const payload = {
            messaging_product: 'whatsapp',
            to: phoneToTry.replace(/\D/g, ''), // Remove tudo que não for dígito
            type: 'template',
            template: {
                name: templateName,
                language: {
                    code: languageCode,
                },
                components,
            },
        };

        if (process.env.NODE_ENV !== 'production') console.debug(`[Facebook API] Enviando payload para ${phoneToTry}:`, JSON.stringify(payload, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000), // Timeout de 15s
        });

        const responseData = await response.json() as { error?: { message: string, code?: number, error_subcode?: number } };

        if (!response.ok) {
            console.error(`[Facebook API] Erro para ${phoneToTry}:`, JSON.stringify(responseData, null, 2));

            // Só registra falha no circuit breaker para erros de servidor (5xx) ou rate limit (429)
            if (response.status >= 500 || response.status === 429) {
                CircuitBreaker.recordFailure('meta');
            }

            const metaError = responseData.error;
            const error = new Error(metaError?.message || 'Falha ao enviar mensagem de modelo via WhatsApp.');
            Object.assign(error, { 
                code: response.status, 
                metaCode: metaError?.code,
                metaSubcode: metaError?.error_subcode,
                response: { status: response.status } 
            });
            throw error;
        }

        // Registra sucesso no circuit breaker
        CircuitBreaker.recordSuccess('meta');

        if (process.env.NODE_ENV !== 'production') console.debug(`[Facebook API] Sucesso para ${phoneToTry}. Resposta:`, JSON.stringify(responseData, null, 2));
        return responseData;
    });
}


interface SendTextArgs {
    connectionId: string;
    to: string;
    text: string;
}

export async function sendWhatsappTextMessage({ connectionId, to, text }: SendTextArgs): Promise<Record<string, unknown>> {
    // Verifica circuit breaker para Meta API
    if (CircuitBreaker.isOpen('meta')) {
        const stats = CircuitBreaker.getStats('meta');
        const resetIn = stats.openUntil ? Math.ceil((stats.openUntil - Date.now()) / 1000) : 0;
        throw new Error(`Meta API circuit breaker está ABERTO. Tente novamente em ${resetIn}s.`);
    }

    const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId));
    if (!connection) {
        throw new Error(`Conexão com ID ${connectionId} não encontrada.`);
    }

    if (!connection.accessToken) {
        throw new Error(`Token de acesso não configurado para a conexão ${connection.config_name}`);
    }
    const accessToken = decrypt(connection.accessToken);
    if (!accessToken) {
        throw new Error(`Falha ao desencriptar o token de acesso para a conexão ${connection.config_name}`);
    }

    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${connection.phoneNumberId}/messages`;

    return executeWithPhoneFallback(to, async (phoneToTry) => {
        const payload = {
            messaging_product: 'whatsapp',
            to: phoneToTry.replace(/\D/g, ''),
            type: 'text',
            text: {
                body: text,
                preview_url: true,
            },
        };

        if (process.env.NODE_ENV !== 'production') console.debug('[Facebook API - Text] Enviando payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000),
        });

        const responseData = await response.json() as { error?: { message: string, code?: number, error_subcode?: number } };

        if (!response.ok) {
            console.error(`[Facebook API - Text] Erro para ${phoneToTry}:`, JSON.stringify(responseData, null, 2));

            if (response.status >= 500 || response.status === 429) {
                CircuitBreaker.recordFailure('meta');
            }

            const metaError = responseData.error;
            const error = new Error(metaError?.message || 'Falha ao enviar mensagem de texto via WhatsApp.');
            Object.assign(error, {
                code: response.status,
                metaCode: metaError?.code,
                metaSubcode: metaError?.error_subcode,
                response: { status: response.status }
            });
            throw error;
        }

        CircuitBreaker.recordSuccess('meta');
        console.log(`[Facebook API - Text] Sucesso para ${phoneToTry}.`);
        return responseData;
    });
}

interface SendInteractiveArgs {
    connectionId: string;
    to: string;
    text: string;
    buttons: { id: string, title: string, type?: 'reply' | 'url', url?: string }[];
}

export async function sendWhatsappInteractiveMessage({ connectionId, to, text, buttons }: SendInteractiveArgs): Promise<Record<string, unknown>> {
    // Verifica circuit breaker para Meta API
    if (CircuitBreaker.isOpen('meta')) {
        const stats = CircuitBreaker.getStats('meta');
        const resetIn = stats.openUntil ? Math.ceil((stats.openUntil - Date.now()) / 1000) : 0;
        throw new Error(`Meta API circuit breaker está ABERTO. Tente novamente em ${resetIn}s.`);
    }

    const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId));
    if (!connection) {
        throw new Error(`Conexão com ID ${connectionId} não encontrada.`);
    }

    if (!connection.accessToken) {
        throw new Error(`Token de acesso não configurado para a conexão ${connection.config_name}`);
    }
    const accessToken = decrypt(connection.accessToken);
    if (!accessToken) {
        throw new Error(`Falha ao desencriptar o token de acesso para a conexão ${connection.config_name}`);
    }

    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${connection.phoneNumberId}/messages`;

    return executeWithPhoneFallback(to, async (phoneToTry) => {
        const urlButton = buttons.find(b => b.type === 'url' && b.url);
        const replyButtons = buttons.filter(b => b.type !== 'url').slice(0, 3);
        
        let interactiveConfig: any = {};
        
        if (urlButton && urlButton.url) {
            // Se tiver URL, a Meta exige que o tipo da mensagem interativa seja 'cta_url' e SÓ pode ter esse botão
            interactiveConfig = {
                type: 'cta_url',
                body: { text: text || 'Acesse o link abaixo:' },
                action: {
                    name: 'cta_url',
                    parameters: {
                        display_text: String(urlButton.title).slice(0, 20),
                        url: urlButton.url
                    }
                }
            };
            
            // Fallback: se tiverem botões de reply junto com link, adiciona no texto da mensagem para não perder
            if (replyButtons.length > 0) {
                interactiveConfig.body.text += '\n\nOutras opções:\n' + replyButtons.map((b, i) => `- ${b.title}`).join('\n');
            }
        } else {
            // Comportamento padrão: botões de resposta rápida
            interactiveConfig = {
                type: 'button',
                body: { text: text || 'Selecione uma opção' },
                action: {
                    buttons: replyButtons.map((btn) => ({
                        type: 'reply',
                        reply: {
                            id: String(btn.id).slice(0, 256),
                            title: String(btn.title).slice(0, 20)
                        }
                    }))
                }
            };
        }

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phoneToTry.replace(/\D/g, ''),
            type: 'interactive',
            interactive: interactiveConfig
        };

        if (process.env.NODE_ENV !== 'production') console.debug('[Facebook API - Interactive] Enviando payload:', JSON.stringify(payload, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000),
        });

        const responseData = await response.json() as { error?: { message: string, code?: number, error_subcode?: number } };

        if (!response.ok) {
            console.error(`[Facebook API - Interactive] Erro para ${phoneToTry}:`, JSON.stringify(responseData, null, 2));

            if (response.status >= 500 || response.status === 429) {
                CircuitBreaker.recordFailure('meta');
            }

            const metaError = responseData.error;
            const error = new Error(metaError?.message || 'Falha ao enviar mensagem interativa via WhatsApp.');
            Object.assign(error, {
                code: response.status,
                metaCode: metaError?.code,
                metaSubcode: metaError?.error_subcode,
                response: { status: response.status }
            });
            throw error;
        }

        CircuitBreaker.recordSuccess('meta');
        console.log(`[Facebook API - Interactive] Sucesso para ${phoneToTry}.`);
        return responseData;
    });
}

interface SendMediaArgs {
    connectionId: string;
    to: string;
    type: 'audio' | 'image' | 'video' | 'document';
    url?: string;
    mediaBuffer?: Buffer; // ✅ NEW: Buffer for direct upload to Meta
    mimeType?: string;    // ✅ NEW: MIME type for buffer upload
    caption?: string;
    filename?: string;
    isVoice?: boolean;
}

export async function sendWhatsappMediaMessage({ connectionId, to, type, url, mediaBuffer, mimeType, caption, filename, isVoice }: SendMediaArgs): Promise<Record<string, unknown>> {
    // Verifica circuit breaker para Meta API
    if (CircuitBreaker.isOpen('meta')) {
        const stats = CircuitBreaker.getStats('meta');
        const resetIn = stats.openUntil ? Math.ceil((stats.openUntil - Date.now()) / 1000) : 0;
        throw new Error(`Meta API circuit breaker está ABERTO. Tente novamente em ${resetIn}s.`);
    }

    const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId));
    if (!connection) {
        throw new Error(`Conexão com ID ${connectionId} não encontrada.`);
    }

    if (!connection.accessToken) {
        throw new Error(`Token de acesso não configurado para a conexão ${connection.config_name}`);
    }
    const accessToken = decrypt(connection.accessToken);
    if (!accessToken) {
        throw new Error(`Falha ao desencriptar o token de acesso para a conexão ${connection.config_name}`);
    }

    const apiUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${connection.phoneNumberId}/messages`;

    // ✅ FIX: Upload buffer to Meta and use 'id' for reliable delivery
    //    Using 'link' causes 503 errors when Meta can't access our Neon storage
    const mediaObject: any = {};

    if (mediaBuffer && connection.phoneNumberId) {
        // Upload to Meta's servers for reliable delivery
        const { uploadMediaToMeta } = await import('./metaMediaUpload');
        const uploadMime = mimeType || (type === 'audio' ? 'audio/ogg' : 'application/octet-stream');

        console.log(`[Facebook API - ${type}] Uploading ${mediaBuffer.length} bytes to Meta servers...`);
        const mediaId = await uploadMediaToMeta(
            connection.phoneNumberId,
            accessToken,
            mediaBuffer,
            uploadMime,
            filename
        );

        mediaObject.id = mediaId;
        console.log(`[Facebook API - ${type}] Media uploaded successfully`);
    } else if (url) {
        // Fallback to link (less reliable for Replit-hosted media)
        mediaObject.link = url;
        console.log(`[Facebook API - ${type}] Using link: ${url}`);
    } else {
        throw new Error(`Nenhum buffer ou URL fornecido para enviar ${type}.`);
    }

    if (type !== 'audio' && caption) {
        mediaObject.caption = caption;
    }

    if (type === 'document' && filename) {
        mediaObject.filename = filename;
    }

    // ✅ Suporte para Voice Messages (PTT)
    if (type === 'audio' && isVoice) {
        mediaObject.voice = true;
    }

    return executeWithPhoneFallback(to, async (phoneToTry) => {
        const payload = {
            messaging_product: 'whatsapp',
            to: phoneToTry.replace(/\D/g, ''),
            type: type,
            [type]: mediaObject,
        };

        if (process.env.NODE_ENV !== 'production') console.debug(`[Facebook API - ${type}] Enviando payload:`, JSON.stringify(payload, null, 2));

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000), // Maior timeout para mídia
        });

        const responseData = await response.json() as { error?: { message: string, code?: number, error_subcode?: number } };

        if (!response.ok) {
            console.error(`[Facebook API - ${type}] Erro para ${phoneToTry}:`, JSON.stringify(responseData, null, 2));
            // Só registra falha no circuit breaker para erros de servidor (5xx) ou rate limit (429)
            if (response.status >= 500 || response.status === 429) {
                CircuitBreaker.recordFailure('meta');
            }
            const metaError = responseData.error;
            const error = new Error(metaError?.message || `Falha ao enviar mensagem de ${type} via WhatsApp.`);
            Object.assign(error, {
                code: response.status,
                metaCode: metaError?.code,
                metaSubcode: metaError?.error_subcode,
                response: { status: response.status }
            });
            throw error;
        }

        CircuitBreaker.recordSuccess('meta');
        console.log(`[Facebook API - ${type}] Sucesso para ${phoneToTry}.`);
        return responseData;
    });
}



// ============================================================
// INSTAGRAM MESSAGE SENDING
// Uses Instagram Graph API (different from WhatsApp Cloud API)
// ============================================================

interface SendInstagramMessageArgs {
    connectionId: string;
    recipientId: string; // Instagram-scoped user ID (IGSID)
    text: string;
}

/**
 * Send a message to an Instagram user using the Instagram Graph API.
 * This uses the Page/IG Account's /me/messages endpoint.
 * 
 * Docs: https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
 */
export async function sendInstagramMessage({ connectionId, recipientId, text }: SendInstagramMessageArgs): Promise<Record<string, unknown>> {
    const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId));
    if (!connection) {
        throw new Error(`Conexão com ID ${connectionId} não encontrada.`);
    }

    if (!connection.accessToken) {
        throw new Error(`Token de acesso não configurado para a conexão ${connection.config_name}`);
    }
    const accessToken = decrypt(connection.accessToken);
    if (!accessToken) {
        throw new Error(`Falha ao desencriptar o token de acesso para a conexão ${connection.config_name}`);
    }

    // For Instagram, we use the Instagram Graph API
    // The endpoint is: POST /{ig-user-id}/messages or /me/messages with page token
    // For Instagram connections, the IG Account ID is stored in phoneNumberId
    const igAccountId = connection.phoneNumberId;
    if (!igAccountId) {
        throw new Error(`Instagram Account ID não configurado para a conexão ${connection.config_name}`);
    }

    // Clean the recipient ID (remove 'ig:' prefix if present)
    const cleanRecipientId = recipientId.startsWith('ig:') ? recipientId.substring(3) : recipientId;

    // CRITICAL CORRECTION: For Instagram Business Messaging via Page Tokens,
    // we must use graph.facebook.com with the Page ID, NOT graph.instagram.com.
    // The recipientId is the IG-Scoped ID.
    // Reference: https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
    const pageId = connection.wabaId; // In this system, wabaId stores the Parent Page ID for Instagram connections
    if (!pageId) {
        throw new Error(`Facebook Page ID (wabaId) não configurado para a conexão ${connection.config_name}. Reimporte a conexão.`);
    }
    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/messages`;

    const payload = {
        recipient: {
            id: cleanRecipientId,
        },
        message: {
            text: text,
        },
    };

    console.log('[Instagram API] Enviando mensagem:', JSON.stringify({ to: cleanRecipientId, text: text.substring(0, 50) + '...' }));

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
    });

    const responseData = await response.json() as { error?: { message: string; code?: number }; recipient_id?: string; message_id?: string };

    if (!response.ok) {
        console.error(`[Instagram API] Erro para ${cleanRecipientId}:`, JSON.stringify(responseData, null, 2));
        const error = new Error(responseData.error?.message || 'Falha ao enviar mensagem via Instagram.');
        Object.assign(error, { code: response.status, response: { status: response.status } });
        throw error;
    }

    console.log(`[Instagram API] ✅ Sucesso para ${cleanRecipientId}. Message ID: ${responseData.message_id}`);
    return responseData;
}

export async function getMediaUrl(mediaId: string, accessToken: string): Promise<string | null> {
    try {
        const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${mediaId}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            signal: AbortSignal.timeout(15000), // Timeout de 15s
        });
        const data = await response.json() as { url?: string; error?: { message: string } };
        if (!response.ok) {
            console.error(`[Facebook API - Media URL] Erro para mediaId ${mediaId}:`, data);
            return null;
        }
        return data.url || null;
    } catch (error) {
        console.error(`[Facebook API - Media URL] Falha crítica ao buscar URL da mídia ${mediaId}:`, error);
        return null;
    }
}
export async function getInstagramUserProfile(igsid: string, accessToken: string): Promise<{ name: string; profile_pic?: string } | null> {
    try {
        const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${igsid}?fields=name,profile_pic&access_token=${accessToken}`;
        const response = await fetch(url, {
            signal: AbortSignal.timeout(10000),
        });

        const data = await response.json() as { name?: string; profile_pic?: string; error?: any };

        if (!response.ok || data.error) {
            console.error(`[Instagram Profile] Erro ao buscar perfil para ${igsid}:`, data.error);
            return null;
        }

        return {
            name: data.name || 'Usuário Instagram',
            profile_pic: data.profile_pic
        };
    } catch (error) {
        console.error(`[Instagram Profile] Falha crítica ao buscar perfil para ${igsid}:`, error);
        return null;
    }
}

// ============================================================
// WHATSAPP CALLING API (Graph API)
// ============================================================

interface CallingSettings {
    calling: {
        status: 'ENABLED' | 'DISABLED';
        call_icon_visibility?: 'DEFAULT' | 'ALWAYS_SHOW' | 'NEVER_SHOW';
        call_hours?: {
            status: 'ENABLED' | 'DISABLED';
            timezone_id: string;
            weekly_operating_hours?: Array<{
                day_of_week: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
                open_time: string; // HHMM
                close_time: string; // HHMM
            }>;
        };
        callback_permission_status?: 'ENABLED' | 'DISABLED';
        sip?: {
            status: 'ENABLED' | 'DISABLED';
        };
    };
}

export async function configureCallingSettings(connectionId: string, settings: CallingSettings): Promise<any> {
    const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId));
    if (!connection) throw new Error(`Conexão ${connectionId} não encontrada.`);

    if (!connection.accessToken) throw new Error(`Token não configurado para ${connection.config_name}`);
    const accessToken = decrypt(connection.accessToken);

    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${connection.phoneNumberId}/settings`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Erro ao configurar chamadas: ${JSON.stringify(data)}`);
    }
    return data;
}

export async function getCallingSettings(connectionId: string): Promise<any> {
    const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId));
    if (!connection) throw new Error(`Conexão ${connectionId} não encontrada.`);

    if (!connection.accessToken) throw new Error(`Token não configurado para ${connection.config_name}`);
    const accessToken = decrypt(connection.accessToken);

    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${connection.phoneNumberId}/settings`;

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Erro ao buscar configurações de chamada: ${JSON.stringify(data)}`);
    }
    return data;
}
