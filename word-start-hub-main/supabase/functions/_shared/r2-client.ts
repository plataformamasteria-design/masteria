/**
 * Cloudflare R2 Storage Client for Supabase Edge Functions
 * Uses S3-compatible API with aws4fetch for request signing
 * 
 * Required environment variables:
 * - R2_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_BUCKET_NAME
 * - R2_PUBLIC_URL (e.g. https://pub-xxx.r2.dev)
 */

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

let _r2Client: AwsClient | null = null;

function getR2Config() {
    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucketName = Deno.env.get("R2_BUCKET_NAME") || "vitta-chat-files";
    const publicUrl = Deno.env.get("R2_PUBLIC_URL");

    if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
        return null;
    }

    return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

function getR2Client(): AwsClient | null {
    if (_r2Client) return _r2Client;

    const config = getR2Config();
    if (!config) return null;

    _r2Client = new AwsClient({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        service: "s3",
        region: "auto",
    });

    return _r2Client;
}

/**
 * Upload bytes to Cloudflare R2 and return the public URL.
 * Falls back to null if R2 is not configured.
 */
export async function uploadToR2(
    bytes: Uint8Array,
    storagePath: string,
    contentType: string
): Promise<string | null> {
    const config = getR2Config();
    const client = getR2Client();

    if (!config || !client) {
        console.warn("[r2-client] R2 not configured, skipping upload");
        return null;
    }

    const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${storagePath}`;

    try {
        const response = await client.fetch(endpoint, {
            method: "PUT",
            headers: {
                "Content-Type": contentType,
                "Content-Length": String(bytes.length),
            },
            // @ts-ignore - aws4fetch doesn't strictly mirror all native DOM BodyInit types
            body: bytes,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[r2-client] Upload failed (${response.status}):`, errorText);
            return null;
        }

        // Return the public URL
        const publicUrl = `${config.publicUrl}/${storagePath}`;
        console.log(`[r2-client] ✅ Uploaded to R2: ${publicUrl}`);
        return publicUrl;
    } catch (error) {
        console.error("[r2-client] Upload error:", error);
        return null;
    }
}

/**
 * Upload a File/Blob to R2 (useful for proxy endpoint)
 */
export async function uploadBlobToR2(
    blob: Blob,
    storagePath: string,
    contentType: string
): Promise<string | null> {
    const buffer = await blob.arrayBuffer();
    return uploadToR2(new Uint8Array(buffer), storagePath, contentType);
}

/**
 * Check if R2 is configured and available
 */
export function isR2Configured(): boolean {
    return getR2Config() !== null;
}
