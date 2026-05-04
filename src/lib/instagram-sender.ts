
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

interface InstagramMessagePayload {
    recipient: {
        id: string; // IGSID (Instagram Scoped ID)
    };
    message: {
        text?: string;
        attachment?: {
            type: 'image' | 'video' | 'audio' | 'file' | 'template'; // Template for generic template
            payload: any;
        }
    };
    messaging_type?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
    tag?: string;
}

interface _InstagramMessageResponse {
    recipient_id: string;
    message_id: string;
    error?: any;
}

export async function sendInstagramMessage(
    connectionId: string,
    recipientId: string,
    content: { text?: string; mediaUrl?: string; mediaType?: 'image' | 'video' | 'audio' | 'file' }
): Promise<{ messageId: string | null; error?: string }> {
    try {
        // 1. Fetch Connection Details
        const [connection] = await db.select().from(connections).where(eq(connections.id, connectionId));

        if (!connection) {
            throw new Error('Connection not found');
        }

        if (!connection.accessToken) {
            throw new Error('Missing access token for connection');
        }

        const accessToken = decrypt(connection.accessToken);
        // Note: For Instagram, we send requests to the PAGE ID (wabaId in our schema hack) or ME if the token is page-scoped.
        // Documentation says POST /<IG_ID>/messages or /me/messages.
        // IG_ID is the Instagram Business Account ID. We should check if we store it.
        // In our plan, we decided `phoneNumberId` would effectively store the `instagramAccountId`.

        const instagramAccountId = connection.phoneNumberId;
        if (!instagramAccountId) {
            throw new Error('Instagram Account ID (stored in phoneNumberId) is missing');
        }

        // HOST SWITCHING LOGIC (Phase 10)
        // 'instagram_direct' uses graph.instagram.com (Instagram Login)
        // 'meta_api' or 'instagram' (legacy import) uses graph.facebook.com (Facebook Login)
        const isDirect = connection.connectionType === 'instagram_direct';
        const host = isDirect ? 'https://graph.instagram.com' : 'https://graph.facebook.com';

        const url = `${host}/v24.0/${instagramAccountId}/messages`;

        // 2. Construct Payload
        const payload: InstagramMessagePayload = {
            recipient: { id: recipientId },
            message: {}
        };

        if (content.text) {
            payload.message.text = content.text;
        } else if (content.mediaUrl && content.mediaType) {
            payload.message.attachment = {
                type: content.mediaType === 'file' ? 'file' :
                    content.mediaType === 'video' ? 'video' :
                        content.mediaType === 'audio' ? 'audio' : 'image',
                payload: {
                    url: content.mediaUrl,
                    is_reusable: true
                }
            };
        } else {
            throw new Error('Message must have text or media');
        }

        // 3. Send Request
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Instagram Sender] Error sending message:', data);
            return { messageId: null, error: data.error?.message || 'Unknown error from Instagram API' };
        }

        return { messageId: data.message_id };

    } catch (error) {
        console.error('[Instagram Sender] Exception:', error);
        return { messageId: null, error: (error as Error).message };
    }
}
