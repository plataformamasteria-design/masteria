// src/lib/metaMediaUpload.ts
'use server';

/**
 * Uploads media directly to Meta's WhatsApp Cloud API servers.
 * This is more reliable than using hosted URLs (link) which may return 503.
 * 
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media#upload-media
 */

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v21.0';

interface UploadMediaResult {
    id: string;
}

/**
 * Upload a media file to Meta's servers and get a media_id.
 * 
 * @param phoneNumberId - The WhatsApp Business Phone Number ID
 * @param accessToken - The access token for the connection
 * @param buffer - The media file as a Buffer
 * @param mimeType - The MIME type of the media (e.g., 'audio/ogg' or 'audio/ogg; codecs=opus')
 * @param filename - Optional filename for the upload
 * @returns The media_id that can be used in message payloads
 */
export async function uploadMediaToMeta(
    phoneNumberId: string,
    accessToken: string,
    buffer: Buffer,
    mimeType: string,
    filename?: string
): Promise<string> {
    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${phoneNumberId}/media`;

    // Meta requires multipart/form-data for media uploads
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');

    // Convert Buffer to Blob for FormData
    const blob = new Blob([buffer], { type: mimeType });
    const finalFilename = filename || `media.${getExtensionForMime(mimeType)}`;
    formData.append('file', blob, finalFilename);
    formData.append('type', mimeType);

    console.log(`[Meta Media Upload] Uploading ${buffer.length} bytes to ${url} (${mimeType})`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            // Don't set Content-Type for FormData - browser/node will set it with boundary
        },
        body: formData,
        signal: AbortSignal.timeout(60000), // 60s timeout for uploads
    });

    const responseData = await response.json() as UploadMediaResult | { error?: { message: string; code?: number } };

    if (!response.ok || 'error' in responseData) {
        const error = (responseData as any).error;
        console.error('[Meta Media Upload] Upload failed:', responseData);
        throw new Error(`Meta media upload failed: ${error?.message || JSON.stringify(responseData)}`);
    }

    const mediaId = (responseData as UploadMediaResult).id;
    console.log(`[Meta Media Upload] ✅ Upload successful. Media ID: ${mediaId}`);

    return mediaId;
}

/**
 * Helper to get file extension from MIME type
 */
function getExtensionForMime(mimeType: string): string {
    const mimeMap: Record<string, string> = {
        'audio/ogg': 'ogg',
        'audio/ogg; codecs=opus': 'ogg',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/aac': 'aac',
        'audio/amr': 'amr',
        'audio/mp4': 'm4a',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'video/mp4': 'mp4',
        'video/3gpp': '3gp',
        'application/pdf': 'pdf',
    };

    const baseMime = mimeType.split(';')[0].trim();
    return mimeMap[baseMime] || mimeMap[mimeType] || 'bin';
}
