'use server';

import { db } from '@/lib/db';
import { connections, messageTemplates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendWhatsappTextMessage, sendWhatsappTemplateMessage, sendInstagramMessage, sendWhatsappMediaMessage } from '@/lib/facebookApiService';
import { baileysBridge as sessionManager } from '@/lib/baileys-bridge-client';
import { convertMp3ToOgg, getAudioDurationInSeconds } from '@/services/audio-converter.service';
import { formatJid } from '@/lib/utils/whatsapp';

export interface UnifiedSendOptions {
  provider: 'apicloud' | 'baileys';
  connectionId: string;
  to: string;
  message: string;
  templateId?: string;
  templateName?: string;
  templateParams?: Record<string, string>;
  mediaUrl?: string;
  mediaBuffer?: Buffer; // ✅ New: Support for direct buffer sending
  mediaType?: 'audio' | 'image' | 'video' | 'document';
  isVoice?: boolean;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendUnifiedMessage(options: UnifiedSendOptions): Promise<SendResult> {
  const { connectionId, to, message, templateId, templateName: providedTemplateName, templateParams: _templateParams, mediaUrl, mediaType, isVoice } = options;
  let { mediaBuffer } = options;

  // Normalize provider: ensure it's exactly 'apicloud' or 'baileys'
  let provider = options.provider;
  if (provider !== 'apicloud' && provider !== 'baileys') {
    const normalized = String(provider || '').toLowerCase().trim();
    if (normalized.includes('meta') || normalized.includes('api') || normalized.includes('cloud')) {
      console.log(`[UNIFIED-SENDER] ⚠️ Provider normalized: "${provider}" → "apicloud"`);
      provider = 'apicloud';
    } else if (normalized.includes('baileys')) {
      provider = 'baileys';
    } else {
      console.error(`[UNIFIED-SENDER] ❌ Unknown provider: "${provider}" (raw: "${options.provider}")`);
      return { success: false, error: `Provedor inválido: "${provider}"` };
    }
  }

  try {
    // Fetch connection
    const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId));
    if (!connection) {
      return { success: false, error: `Conexão ${connectionId} não encontrada` };
    }

    if (provider === 'apicloud') {
      // ✅ Detect if this is an Instagram recipient
      const isInstagram = to.startsWith('ig:') || connection.connectionType === 'instagram';

      if (isInstagram) {
        // ========================================
        // INSTAGRAM MESSAGE SENDING
        // ========================================
        try {
          if (!message) {
            console.warn(`[UNIFIED-SENDER] No message for Instagram ${to}, skipping`);
            return { success: false, error: 'Nenhuma mensagem fornecida' };
          }

          console.log(`[UNIFIED-SENDER] 📸 Sending Instagram message to ${to}`);
          const result = await sendInstagramMessage({
            connectionId,
            recipientId: to,
            text: message,
          });
          console.log(`[UNIFIED-SENDER] ✅ Instagram message sent to ${to}`, result);
          return { success: true, messageId: (result as any)?.message_id };
        } catch (error) {
          console.error(`[UNIFIED-SENDER] ❌ Failed to send via Instagram API:`, error);
          return { success: false, error: (error as Error).message };
        }
      } else {
        // ========================================
        // WHATSAPP MESSAGE SENDING
        // ========================================

        // ✅ Handle Media Message for APICloud (Meta API)
        if ((mediaUrl || mediaBuffer) && mediaType) {
          try {
            console.log(`[UNIFIED-SENDER] Sending media (${mediaType}) via APICloud to ${to}`);

            // Auto-detect voice note intent for audio type
            const shouldSendAsVoice = isVoice || (mediaType === 'audio' && (!mediaUrl || !mediaUrl.endsWith('.mp3'))); // Assume non-mp3 audios (like ogg/wav) might be voice notes if not specified

            // ✅ FIX: Determine MIME type for buffer upload
            let mimeType: string | undefined;
            if (mediaBuffer) {
              if (mediaType === 'audio') {
                mimeType = 'audio/ogg; codecs=opus'; // Default for voice messages

                // ✅ FIX: Static Noise Issue (Chiado)
                // If providing a buffer (likely MP3 from TTS) for a Voice Note, verify/convert to OGG Opus
                try {
                  console.log('[UNIFIED-SENDER] 🎵 Converting audio buffer to OGG Opus for compatibility...');
                  // Always convert to ensure correct codec for WhatsApp PTT
                  // This handles MP3 -> OGG Opus conversion
                  mediaBuffer = await convertMp3ToOgg(mediaBuffer);
                  console.log(`[UNIFIED-SENDER] ✅ Conversion complete. New size: ${mediaBuffer.length} bytes`);
                } catch (convErr) {
                  console.error('[UNIFIED-SENDER] ⚠️ Failed to convert audio to OGG. Sending original buffer (might cause static).', convErr);
                }

              } else if (mediaType === 'image') {
                mimeType = 'image/jpeg';
              } else if (mediaType === 'video') {
                mimeType = 'video/mp4';
              } else if (mediaType === 'document') {
                mimeType = 'application/pdf';
              }
            }

            const result = await sendWhatsappMediaMessage({
              connectionId,
              to,
              type: mediaType,
              url: mediaUrl,
              mediaBuffer: mediaBuffer, // ✅ NEW: Direct upload to Meta
              mimeType: mimeType,        // ✅ NEW: For Meta upload
              caption: message,
              filename: mediaType === 'document' ? mediaUrl?.split('/').pop() : undefined,
              isVoice: shouldSendAsVoice
            });
            console.log(`[UNIFIED-SENDER] ✅ Media message sent via APICloud to ${to}`, result);

            // ✅ MEMORY: Liberar mediaBuffer após envio bem-sucedido
            mediaBuffer = undefined;

            return { success: true, messageId: (result as any)?.messages?.[0]?.id };
          } catch (error) {
            console.error(`[UNIFIED-SENDER] ❌ Failed to send media via APICloud:`, error);
            return { success: false, error: (error as Error).message };
          }
        }
      }

      // ========================================
      // WHATSAPP MESSAGE SENDING (Original logic)
      // ========================================
      // ✅ v2.10.7: Use template if templateId is provided
      if (templateId) {
        try {
          // Fetch template info
          const [template] = await db.select().from(messageTemplates).where(eq(messageTemplates.id, templateId));
          if (!template) {
            console.warn(`[UNIFIED-SENDER] Template ${templateId} not found, falling back to text`);
          } else {
            const templateName = providedTemplateName || template.name;
            const languageCode = template.language || 'pt_BR';

            // Build components array with body parameters
            const components: Record<string, unknown>[] = [];

            // Extract template components from DB
            const templateComponents = template.components as any[] | null;

            // NOTE: For HEADER IMAGE templates, we do NOT send a header component.
            // Meta API automatically uses the image registered with the template.
            // The header_handle URLs in template.components are temporary CDN examples
            // and expire — they must NOT be used for actual message sending.

            // Extract body text to find {{N}} variables
            const bodyComponent = templateComponents?.find((c: any) => c.type === 'BODY');
            const bodyText = bodyComponent?.text || '';
            const bodyVariables = bodyText.match(/\{\{(\d+)\}\}/g) || [];

            if (bodyVariables.length > 0) {
              const bodyParams = bodyVariables.map((placeholder: string) => {
                const varKey = placeholder.replace(/\{|\}/g, '');
                // Use templateParams if available, otherwise use defaults
                const paramValue = options.templateParams?.[varKey] ||
                  (varKey === '1' ? 'Cliente' : '');
                return { type: 'text', text: paramValue || 'N/A' };
              });

              components.push({ type: 'body', parameters: bodyParams });
              console.log(`[UNIFIED-SENDER] 📋 Template "${templateName}" has ${bodyVariables.length} body param(s):`,
                bodyParams.map((p: any) => p.text));
            }

            console.log(`[UNIFIED-SENDER] Sending template: ${templateName} (${languageCode}) to ${to} with ${components.length} component(s)`);

            const result = await sendWhatsappTemplateMessage({
              connectionId,
              to,
              templateName,
              languageCode,
              components,
            });
            console.log(`[UNIFIED-SENDER] ✅ Template message sent via APICloud to ${to}`, result);
            return { success: true, messageId: (result as any)?.messages?.[0]?.id };
          }
        } catch (error) {
          console.warn(`[UNIFIED-SENDER] Failed to send template, falling back to text:`, error);
        }
      }

      // Fallback: Send as text (WhatsApp)
      try {
        // Only send text if message is not empty
        if (!message) {
          console.warn(`[UNIFIED-SENDER] No message and no valid template for ${to}, skipping`);
          return { success: false, error: 'Nenhuma mensagem ou template válido fornecido' };
        }

        const result = await sendWhatsappTextMessage({
          connectionId,
          to,
          text: message,
        });
        console.log(`[UNIFIED-SENDER] ✅ Text message sent via APICloud to ${to}`, result);
        return { success: true, messageId: (result as any)?.messages?.[0]?.id };
      } catch (error) {
        console.error(`[UNIFIED-SENDER] ❌ Failed to send via APICloud:`, error);
        return { success: false, error: (error as Error).message };
      }

    } else if (provider === 'baileys') {
      // Send via Baileys
      try {
        const phoneJid = formatJid(to);

        // ✅ Handle Media Message
        if ((mediaUrl || mediaBuffer) && mediaType) {
          let mediaContent: any = {};

          if (mediaType === 'audio') {
            // Send as PTT (Voice Note)
            // Check extension to set correct mimetype
            const isWav = mediaUrl?.endsWith('.wav');
            const mimetype = isWav ? 'audio/wav' : 'audio/ogg; codecs=opus';

            // ✅ FIX: Static Noise Issue (Chiado) for Baileys
            let durationSeconds: number | undefined;

            if (mediaBuffer) {
              try {
                console.log('[UNIFIED-SENDER] 🎵 [Baileys] Converting audio buffer to OGG Opus...');
                // Note: IF input is already OGG, ffmpeg handles it gracefully
                mediaBuffer = await convertMp3ToOgg(mediaBuffer);
                console.log(`[UNIFIED-SENDER] ✅ [Baileys] Conversion complete. Size: ${mediaBuffer.length}`);

                // ✅ FIX: Calculate duration for correct display (0:00 issue)
                console.log('[UNIFIED-SENDER] ⏱️ [Baileys] Calculating audio duration...');
                durationSeconds = await getAudioDurationInSeconds(mediaBuffer);
                console.log(`[UNIFIED-SENDER] ✅ [Baileys] Audio Duration: ${durationSeconds}s`);

              } catch (err) {
                console.error('[UNIFIED-SENDER] ⚠️ [Baileys] Audio conversion/duration failed:', err);
              }
            }

            mediaContent = {
              audio: mediaBuffer || { url: mediaUrl }, // ✅ Prefer Buffer if available
              mimetype: mimetype,
              ptt: true,
              seconds: durationSeconds // ✅ Inject Duration
            };
          } else if (mediaType === 'image') {
            mediaContent = {
              image: mediaBuffer || { url: mediaUrl },
              caption: message || ''
            };
          } else if (mediaType === 'video') {
            mediaContent = {
              video: mediaBuffer || { url: mediaUrl },
              caption: message || ''
            };
          } else if (mediaType === 'document') {
            mediaContent = {
              document: mediaBuffer || { url: mediaUrl },
              caption: message || '',
              mimetype: 'application/pdf', // Default, maybe improve later
              fileName: mediaUrl?.split('/').pop() || 'document.pdf'
            };
          }

          if (Object.keys(mediaContent).length > 0) {
            const mediaMessageId = await sessionManager.sendMessage(connectionId, phoneJid, mediaContent);
            if (!mediaMessageId) {
              console.error(`[UNIFIED-SENDER] ❌ Baileys media sendMessage returned null for ${connectionId}`);
              return { success: false, error: 'Sessão Baileys não conectada para envio de mídia.' };
            }
            console.log(`[UNIFIED-SENDER] ✅ Media (${mediaType}) sent via Baileys to ${to} — messageId: ${mediaMessageId}`);
            return { success: true, messageId: mediaMessageId };
          }
        }

        if (!message) {
          console.warn(`[UNIFIED-SENDER] No message for Baileys to ${to}, skipping`);
          return { success: false, error: 'Nenhuma mensagem fornecida' };
        }

        const realMessageId = await sessionManager.sendMessage(connectionId, phoneJid, message);
        if (!realMessageId) {
          console.error(`[UNIFIED-SENDER] ❌ Baileys sendMessage returned null for ${connectionId} — session may not be connected`);
          return { success: false, error: 'Sessão Baileys não está conectada ou houve erro no envio.' };
        }
        console.log(`[UNIFIED-SENDER] ✅ Message sent via Baileys to ${to} — messageId: ${realMessageId}`);
        return { success: true, messageId: realMessageId };
      } catch (error) {
        console.error(`[UNIFIED-SENDER] ❌ Failed to send via Baileys:`, error);
        return { success: false, error: (error as Error).message };
      }
    }

    return { success: false, error: 'Provedor inválido' };
  } catch (error) {
    console.error(`[UNIFIED-SENDER] Error:`, error);
    return { success: false, error: (error as Error).message };
  }
}

export async function interpolateTemplate(template: string, params: Record<string, string>): Promise<string> {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}
