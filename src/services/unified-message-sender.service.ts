// Service module — importado por Server Actions. NÃO adicionar 'use server' aqui.

import { db } from '@/lib/db';
import { connections, messageTemplates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendWhatsappTextMessage, sendWhatsappTemplateMessage, sendInstagramMessage, sendWhatsappMediaMessage, sendWhatsappInteractiveMessage } from '@/lib/facebookApiService';
import { evolutionApiService } from '@/services/evolution-api.service';
import { convertMp3ToOgg, getAudioDurationInSeconds } from '@/services/audio-converter.service';
import { formatJid } from '@/lib/utils/whatsapp';

export interface UnifiedSendOptions {
  provider: 'apicloud' | 'evolution';
  connectionId: string;
  to: string;
  message: string;
  templateId?: string;
  templateName?: string;
  templateParams?: Record<string, string>;
  mediaUrl?: string;
  mediaBuffer?: Buffer; // ✅ New: Support for direct buffer sending
  mediaType?: 'audio' | 'image' | 'video' | 'document';
  mediaFileName?: string; // ✅ New: Pass the correct filename for documents
  isVoice?: boolean;
  buttons?: { id: string, title: string }[];
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendUnifiedMessage(options: UnifiedSendOptions): Promise<SendResult> {
  const { connectionId, to, message, templateId, templateName: providedTemplateName, templateParams: _templateParams, mediaType, isVoice } = options;
  let { mediaUrl, mediaBuffer } = options;

  // Normalize provider: ensure it's exactly 'apicloud' or 'evolution'
  let provider = options.provider;
  if (provider !== 'apicloud' && provider !== 'evolution') {
    const normalized = String(provider || '').toLowerCase().trim();
    if (normalized.includes('meta') || normalized.includes('api') || normalized.includes('cloud')) {
      console.log(`[UNIFIED-SENDER] ⚠️ Provider normalized: "${provider}" → "apicloud"`);
      provider = 'apicloud';
    } else if (normalized.includes('evolution') || normalized.includes('baileys')) {
      provider = 'evolution';
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

    // ✅ FIX: Universal Media Fetcher
    // Download media if a URL is provided and buffer is absent.
    // Solves Meta API 503 errors with private S3/Supabase buckets.
    // We avoid fetching huge buffers for Evolution API unless it's audio (which needs conversion)
    // OR if the file is stored in our own backend (localhost or api/storage), as external APIs might not reach it.
    const needsBuffer = provider === 'apicloud' || mediaType === 'audio' || (mediaUrl && (mediaUrl.includes('localhost') || mediaUrl.includes('api/storage')));

    if (mediaUrl && mediaUrl.startsWith('http') && !mediaBuffer && mediaType && needsBuffer) {
      try {
          // ✅ FIX: Se o arquivo foi feito upload em localhost (ex: dev) mas agora roda em prod,
          // o fetch interno deve apontar para o app real ou usar o domínio configurado.
          if (mediaUrl.includes('localhost') && process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
              mediaUrl = mediaUrl.replace(/http:\/\/localhost:\d+/, process.env.NEXT_PUBLIC_APP_URL);
          }

          console.log(`[UNIFIED-SENDER] 📥 Fetching remote media as buffer: ${mediaUrl.substring(0, 80)}...`);
          const resp = await fetch(mediaUrl, { signal: AbortSignal.timeout(20000) });
          if (resp.ok) {
              const arrBuf = await resp.arrayBuffer();
              mediaBuffer = Buffer.from(arrBuf);
              console.log(`[UNIFIED-SENDER] ✅ Fetched media buffer (${mediaBuffer.length} bytes)`);
          } else {
              console.warn(`[UNIFIED-SENDER] ⚠️ Failed to fetch mediaUrl (${resp.status}). Will pass URL directly.`);
          }
      } catch (fetchErr) {
          console.warn('[UNIFIED-SENDER] ⚠️ Could not fetch mediaUrl as buffer, passing URL directly:', fetchErr);
      }
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

        // ✅ Handle Interactive Message for APICloud (Meta API)
        if (options.buttons && options.buttons.length > 0) {
          try {
            console.log(`[UNIFIED-SENDER] Sending interactive message via APICloud to ${to}`);
            const result = await sendWhatsappInteractiveMessage({
              connectionId,
              to,
              text: message,
              buttons: options.buttons
            });
            console.log(`[UNIFIED-SENDER] ✅ Interactive message sent via APICloud to ${to}`, result);
            return { success: true, messageId: (result as any)?.messages?.[0]?.id };
          } catch (error) {
            console.error(`[UNIFIED-SENDER] ❌ Failed to send interactive message via APICloud:`, error);
            return { success: false, error: (error as Error).message };
          }
        }

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
              filename: options.mediaFileName || (mediaType === 'document' ? mediaUrl?.split('?')[0].split('/').pop() : undefined),
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

    } else if (provider === 'evolution') {
      // Send via Evolution API
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
          // ✅ FIX Bug #3: MIME type detectado pela extensão real do arquivo
          const getMimeType = (type: string, url?: string) => {
              const ext = (url || '').split('?')[0].split('.').pop()?.toLowerCase() || '';
              if (type === 'audio') return url?.endsWith('.wav') ? 'audio/wav' : 'audio/ogg; codecs=opus';
              if (type === 'image') {
                  if (ext === 'png') return 'image/png';
                  if (ext === 'gif') return 'image/gif';
                  if (ext === 'webp') return 'image/webp';
                  return 'image/jpeg';
              }
              if (type === 'video') return 'video/mp4';
              if (type === 'document') {
                  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                  if (ext === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                  if (ext === 'txt') return 'text/plain';
                  if (ext === 'csv') return 'text/csv';
                  return 'application/pdf'; // default para pdf e outros
              }
              return 'application/octet-stream';
          };
          // Evolution API requires strict base64 WITHOUT the 'data:mimetype;base64,' prefix
          const mediaBase64 = finalBuffer ? finalBuffer.toString('base64') : mediaUrl!;

          // Derivar nome real do arquivo da URL (sem query string)
          const rawFileName = (mediaUrl || '').split('?')[0].split('/').pop() || '';
          const resolvedFileName = options.mediaFileName || (mediaType === 'document' ? (rawFileName || 'document.pdf') : undefined);

          const result = await evolutionApiService.sendMedia(
             connection.sessionName || connection.id,
             number,
             mediaType,
             mediaBase64,
             message || '',
             resolvedFileName,
             getMimeType(mediaType, mediaUrl)
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
        let errorMessage = (error as Error).message;
        
        // Formatar erros comuns para o usuário final
        if (errorMessage.includes('Connection Closed') || errorMessage.includes('connecting')) {
            errorMessage = 'O celular/instância desta conexão está desconectado. Verifique a conexão no painel de configurações.';
        } else if (errorMessage.includes('is not exists') || errorMessage.includes('not found')) {
            errorMessage = 'A instância do WhatsApp não existe ou foi excluída.';
        } else if (errorMessage.includes('{')) {
            try {
                // Tenta extrair a mensagem se for um JSON da Evolution API
                const jsonPart = errorMessage.substring(errorMessage.indexOf('{'));
                const parsed = JSON.parse(jsonPart);
                if (parsed?.response?.message) {
                    errorMessage = Array.isArray(parsed.response.message) ? parsed.response.message[0] : parsed.response.message;
                } else if (parsed?.error) {
                    errorMessage = parsed.error;
                }
            } catch (e) {}
        }
        
        return { success: false, error: errorMessage };
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
