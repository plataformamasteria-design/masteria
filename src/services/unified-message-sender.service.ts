'use server';

import { db } from '@/lib/db';
import { connections, messageTemplates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendWhatsappTextMessage, sendWhatsappTemplateMessage, sendInstagramMessage, sendWhatsappMediaMessage } from '@/lib/facebookApiService';
import { evolutionApiService } from '@/services/evolution-api.service';
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
      // Send via Evolution API (Replacing Baileys)
      try {
        const phoneJid = formatJid(to);
        const number = phoneJid?.split('@')[0]; // Evolution uses just the number

        if (!number) {
           console.error(`[UNIFIED-SENDER] ❌ Invalid number formatting for ${to}`);
           return { success: false, error: 'Número inválido' };
        }

        // ✅ Handle Media Message
        if ((mediaUrl || mediaBuffer) && mediaType) {
          
          let durationSeconds: number | undefined;
          let finalBuffer = mediaBuffer;

          if (mediaType === 'audio' && finalBuffer) {
              try {
                console.log('[UNIFIED-SENDER] 🎵 [Evolution] Converting audio buffer to OGG Opus...');
                finalBuffer = await convertMp3ToOgg(finalBuffer);
                console.log(`[UNIFIED-SENDER] ✅ [Evolution] Conversion complete. Size: ${finalBuffer.length}`);
              } catch (err) {
                console.error('[UNIFIED-SENDER] ⚠️ [Evolution] Audio conversion failed:', err);
              }
          }

          // Evolution API requires a URL or base64 string
          const getMimeType = (type: string, url?: string) => {
              if (type === 'audio') return url?.endsWith('.wav') ? 'audio/wav' : 'audio/ogg; codecs=opus';
              if (type === 'image') return 'image/jpeg';
              if (type === 'video') return 'video/mp4';
              if (type === 'document') return 'application/pdf';
              return 'application/octet-stream';
          };
          const mediaBase64 = finalBuffer ? `data:${getMimeType(mediaType, mediaUrl)};base64,${finalBuffer.toString('base64')}` : mediaUrl!;

          const result = await evolutionApiService.sendMedia(
             connection.sessionName || connection.id,
             number,
             mediaType,
             mediaBase64,
             message || '',
             mediaType === 'document' ? (mediaUrl?.split('/').pop() || 'document.pdf') : undefined
          );

          if (!result?.key?.id) {
             console.error(`[UNIFIED-SENDER] ❌ Evolution media send returned no ID for ${connectionId}`);
             return { success: false, error: 'Falha ao enviar mídia pela Evolution API.' };
          }

          console.log(`[UNIFIED-SENDER] ✅ Media (${mediaType}) sent via Evolution API to ${to} — messageId: ${result.key.id}`);
          return { success: true, messageId: result.key.id };
        }

        if (!message) {
          console.warn(`[UNIFIED-SENDER] No message for Evolution API to ${to}, skipping`);
          return { success: false, error: 'Nenhuma mensagem fornecida' };
        }

        const result = await evolutionApiService.sendMessage(connection.sessionName || connection.id, number, message);
        
        if (!result?.key?.id) {
          console.error(`[UNIFIED-SENDER] ❌ Evolution sendMessage returned no ID for ${connectionId} — session may not be connected`);
          return { success: false, error: 'Instância não está conectada ou houve erro no envio.' };
        }
        
        console.log(`[UNIFIED-SENDER] ✅ Message sent via Evolution API to ${to} — messageId: ${result.key.id}`);
        return { success: true, messageId: result.key.id };
      } catch (error) {
        console.error(`[UNIFIED-SENDER] ❌ Failed to send via Evolution API:`, error);
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
