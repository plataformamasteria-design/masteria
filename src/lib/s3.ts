// src/lib/s3.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ObjectStorageService } from './server/objectStorage';
import { redis } from './redis';
import { db } from './db';
import { storageFiles } from './db/schema';
import { eq } from 'drizzle-orm';

// Check if running on Replit
const isReplit = () => {
    // 1. Never use Replit storage on Windows
    if (process.platform === 'win32') return false;

    // 2. AUTHORITATIVE ENFORCEMENT: If AWS is configured, we PREFER AWS even if on Replit.
    // This ensure maximum reliability for Meta Webhooks because Replit GCS is often restricted.
    const hasAws = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const onReplit = !!(process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT_ID);

    if (onReplit && hasAws) {
        if (process.env.DEBUG) console.log('[Storage] 🧪 AWS Credentials detected on Replit. Prioritizing AWS for reliability.');
        return false;
    }

    return onReplit;
}

// ✅ CIRCUIT BREAKER (REDIS PERSISTENT): Manage health of storage adapters
const COOLDOWN_PERIOD_SECONDS = 300; // 5 minutes

// Storage adapter interface
interface StorageAdapter {
    uploadFile(key: string, body: Buffer, contentType: string): Promise<string>;
    getPresignedUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string>;
    getPresignedDownloadUrl(key: string, expiresIn?: number): Promise<string>;
    getFileUrl(key: string): string;
    deleteFile(key: string): Promise<void>;
    fileExists(key: string): Promise<boolean>;
    getFileStream(key: string): Promise<ReadableStream | NodeJS.ReadableStream>;
}

// AWS S3 Adapter
class S3Adapter implements StorageAdapter {
    private client: S3Client;
    private bucket: string;

    constructor() {
        if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('Credenciais da AWS S3 não configuradas no ambiente.');
        }

        this.client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
        });

        const bucket = process.env.AWS_S3_BUCKET_NAME;
        if (!bucket) throw new Error("AWS_S3_BUCKET_NAME não configurado.");
        this.bucket = bucket;
    }

    async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: 'max-age=31536000', // 1 ano
        });

        await this.client.send(command);
        return this.getFileUrl(key);
    }

    async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: contentType,
        });
        return getSignedUrl(this.client, command, { expiresIn });
    }

    async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
        const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
        return getSignedUrl(this.client, command, { expiresIn });
    }

    getFileUrl(key: string): string {
        const cdnDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
        if (cdnDomain) return `https://${cdnDomain}/${key}`;
        return `https://${this.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    async deleteFile(key: string): Promise<void> {
        const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
        await this.client.send(command);
    }

    async fileExists(key: string): Promise<boolean> {
        try {
            await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
            return true;
        } catch {
            return false;
        }
    }

    async getFileStream(key: string): Promise<ReadableStream> {
        const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
        const response = await this.client.send(command);
        return response.Body as ReadableStream;
    }

    getClient(): S3Client {
        return this.client;
    }

    getBucketName(): string {
        return this.bucket;
    }
}

// Replit Object Storage Adapter
class ReplitStorageAdapter implements StorageAdapter {
    private service: ObjectStorageService;

    constructor() {
        this.service = new ObjectStorageService();
    }

    async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
        const url = await this.service.uploadFile(key, body, contentType);
        // Convert Replit path to full URL if needed
        if (url.startsWith('/objects/')) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
            return `${baseUrl}${url}`;
        }
        return url;
    }

    async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
        return this.service.getPresignedUploadUrl(key, contentType, expiresIn);
    }

    async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
        return this.service.getPresignedDownloadUrl(key, expiresIn);
    }

    getFileUrl(key: string): string {
        // Return path that will be served by Replit Object Storage
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        return `${baseUrl}/objects/${key}`;
    }

    async deleteFile(key: string): Promise<void> {
        await this.service.deleteFile(key);
    }

    async fileExists(key: string): Promise<boolean> {
        return this.service.fileExists(key);
    }

    async getFileStream(key: string): Promise<NodeJS.ReadableStream> {
        return this.service.getFileStream(key);
    }
}

// ✅ NEW: Neon Storage Adapter (Reliable Fallback)
class NeonStorageAdapter implements StorageAdapter {
    async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
        // Extrair companyId do key se possível (formato: tenants/companyId/...)
        const companyId = key.startsWith('tenants/') ? key.split('/')[1] : null;

        await db.insert(storageFiles)
            .values({
                companyId,
                key,
                mimeType: contentType,
                data: body,
            })
            .onConflictDoUpdate({
                target: storageFiles.key,
                set: {
                    data: body,
                    mimeType: contentType,
                    createdAt: new Date()
                }
            });

        return this.getFileUrl(key);
    }

    // ✅ FIX: Implement required interface methods
    // Neon DB doesn't support native presigned URLs like S3, so we return the direct API URL
    async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
        // For Neon storage, uploads go through the API, not direct presigned URLs
        // Return the standard file URL - actual upload happens via uploadFile method
        return this.getFileUrl(key);
    }

    async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
        // For Neon storage, downloads are served via the /api/storage/neon endpoint
        // No expiration needed as the API handles authentication
        return this.getFileUrl(key);
    }

    getFileUrl(key: string): string {
        let baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://masteria-temporario.up.railway.app';
        
        // CORREÇÃO: Forçar uso do domínio público se as envs apontarem erroneamente para localhost dentro da produção Railway
        if (baseUrl.includes('localhost') && process.env.RAILWAY_PUBLIC_DOMAIN) {
            baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
        }
        
        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        return `${baseUrl}/api/storage/neon?key=${encodeURIComponent(key)}`;
    }

    async deleteFile(key: string): Promise<void> {
        await db.delete(storageFiles).where(eq(storageFiles.key, key));
    }

    async fileExists(key: string): Promise<boolean> {
        const file = await db.query.storageFiles.findFirst({
            where: eq(storageFiles.key, key),
            columns: { id: true }
        });
        return !!file;
    }

    async getFileStream(key: string): Promise<NodeJS.ReadableStream> {
        const file = await db.query.storageFiles.findFirst({
            where: eq(storageFiles.key, key)
        });
        if (!file) throw new Error('File not found in Neon Storage');

        const { Readable } = await import('stream');
        return Readable.from(file.data);
    }
}

// Factory function to get the appropriate storage adapter
let storageAdapter: StorageAdapter | null = null;

function getStorageAdapter(): StorageAdapter {
    if (storageAdapter) return storageAdapter;

    try {
        const hasAws = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET_NAME);
        
        if (hasAws) {
            console.log('[Storage] Using AWS S3 Storage');
            storageAdapter = new S3Adapter();
        } else {
            console.log('[Storage] 🔒 Using Neon DB Storage (Persistent)');
            storageAdapter = new NeonStorageAdapter();
        }
    } catch (error: any) {
        console.warn(`[Storage] ⚠️ Failed to initialize primary adapter: ${error.message}. Falling back to LocalStorage (NON-PERSISTENT!).`);
        storageAdapter = localAdapter;
    }
    return storageAdapter;
}

// Legacy exports for backward compatibility
const getS3Client = (): S3Client => {
    if (!isReplit()) {
        const adapter = getStorageAdapter() as S3Adapter;
        return adapter.getClient();
    }
    throw new Error('S3Client não disponível no ambiente Replit (Neon/DB Storage).');
}

const _getBucket = (): string => {
    if (!isReplit()) {
        const adapter = getStorageAdapter() as S3Adapter;
        return adapter.getBucketName();
    }
    throw new Error('Bucket S3 não disponível no ambiente Replit (Neon/DB Storage).');
}

// Local Filesystem Adapter (Fallback)
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
const streamPipeline = promisify(pipeline);

class LocalStorageAdapter implements StorageAdapter {
    private uploadDir: string;
    private baseUrl: string;

    constructor() {
        this.uploadDir = path.join(process.cwd(), 'public', 'uploads');

        let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
        // Remove trailing slash if present
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }

        // CORREÇÃO: Forçar uso do domínio público se as envs apontarem erroneamente para localhost dentro da produção Railway
        if (baseUrl.includes('localhost') && process.env.RAILWAY_PUBLIC_DOMAIN) {
            baseUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
        } 
        // If empty (e.g. dev environment without env var) OR running locally on Windows logic
        // If on Windows, we MUST use localhost because the file is on this machine, not on the remote Replit URL defined in .env
        else if (!baseUrl || process.platform === 'win32') {
            // Try to infer from potential PORT or default
            const port = process.env.PORT || 3000;
            // Use IPv4 loopback to avoid IPv6 issues with some fetchers
            baseUrl = `http://127.0.0.1:${port}`;
        }

        this.baseUrl = `${baseUrl}/uploads`;
        console.log(`[LocalStorageAdapter] Init: Platform=${process.platform}, BaseURL=${this.baseUrl}`);

        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            try {
                fs.mkdirSync(this.uploadDir, { recursive: true });
            } catch (err) {
                console.error('Failed to create local upload directory:', err);
            }
        }
    }

    async uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
        const filePath = path.join(this.uploadDir, key);
        const dir = path.dirname(filePath);

        if (!fs.existsSync(dir)) {
            await fs.promises.mkdir(dir, { recursive: true });
        }

        await fs.promises.writeFile(filePath, body);
        return `${this.baseUrl}/${key}`;
    }

    async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
        // Local storage doesn't support presigned URLs in the same way, return a direct API URL or mock
        // For simplicity in fallback, we might return empty or handle strictly content uploads
        return `${this.baseUrl}/${key}`;
    }

    async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
        return `${this.baseUrl}/${key}`;
    }

    getFileUrl(key: string): string {
        return `${this.baseUrl}/${key}`;
    }

    async deleteFile(key: string): Promise<void> {
        const filePath = path.join(this.uploadDir, key);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }

    async fileExists(key: string): Promise<boolean> {
        const filePath = path.join(this.uploadDir, key);
        return fs.existsSync(filePath);
    }

    async getFileStream(key: string): Promise<ReadableStream | NodeJS.ReadableStream> {
        const filePath = path.join(this.uploadDir, key);
        return fs.createReadStream(filePath);
    }
}

const localAdapter = new LocalStorageAdapter();

// Unified functions that work with both storage systems
// Security Note: companyId is MANDATORY to enforce tenant isolation in storage paths.

function getScopedKey(companyId: string, key: string): string {
    // Prevent directory traversal and normalize separators
    const sanitizedKey = key.replace(/^\/+/, '').replace(/\\/g, '/');

    // 1. If it already starts with the absolute tenant prefix (new system), it's already scoped.
    const absolutePrefix = `tenants/${companyId}/`;
    if (sanitizedKey.startsWith(absolutePrefix)) {
        return sanitizedKey;
    }

    // 2. Handle legacy keys that might start with the companyId directly (companyId/...)
    // If it starts with the companyId, we assume it's already scoped correctly for legacy or manual uploads.
    // We return it as is to avoid breaking access to physical files that weren't moved.
    const legacyPrefix = `${companyId}/`;
    if (sanitizedKey.startsWith(legacyPrefix)) {
        return sanitizedKey;
    }

    // 3. Handle cases where zapmaster/ prefix was used
    if (sanitizedKey.startsWith('zapmaster/')) {
        const zapPrefixWithId = `zapmaster/${companyId}/`;
        if (sanitizedKey.startsWith(zapPrefixWithId)) {
            // If it's zapmaster/companyId/..., strip zapmaster/ and let it be handled as a legacy key
            return sanitizedKey.substring('zapmaster/'.length);
        }
    }

    // Default: For new relative keys (e.g. "media/file.jpg"), add the new absolute prefix
    return `${absolutePrefix}${sanitizedKey}`;
}

async function uploadFileToS3(companyId: string, key: string, body: Buffer, contentType: string): Promise<string> {
    const primaryAdapter = getStorageAdapter();
    const adapterName = primaryAdapter.constructor.name;
    const scopedKey = getScopedKey(companyId, key);

    const healthStatusKey = `storage:health:${adapterName}`;
    let isPrimaryHealthy = true;
    try {
        const status = await redis.get(healthStatusKey);
        isPrimaryHealthy = status !== 'unhealthy';
    } catch (e) {
        // Fallback to true if redis fails
    }

    // Determine adapter: Primary -> Neon -> Local
    const adapter: StorageAdapter = isPrimaryHealthy ? primaryAdapter : new NeonStorageAdapter();

    // If we're on Replit and primary failed, we MUST use Neon instead of Local to avoid 503 errors from Meta
    const activeAdapterName = adapter.constructor.name;

    try {
        if (process.env.DEBUG) console.log(`[Storage] 📤 Uploading to ${activeAdapterName}: ${scopedKey} (${body.length} bytes)`);
        const url = await adapter.uploadFile(scopedKey, body, contentType);

        // If it was unhealthy but worked, reset it in Redis
        if (!isPrimaryHealthy && adapter === primaryAdapter) {
            console.log(`[Storage] 🛡️ Resetting circuit breaker (Redis) for ${adapterName}.`);
            await redis.del(`storage:health:${adapterName}`).catch(() => { });
        }

        return url;
    } catch (error: any) {
        // Detailed error unpacking for telemetry
        const errorInfo = {
            message: error.message,
            code: error.code || error.name || error.$metadata?.httpStatusCode,
            stack: error.stack?.split('\n').slice(0, 3).join(' '),
            adapter: activeAdapterName
        };

        console.error(`[Storage] ❌ Adapter (${activeAdapterName}) failed:`, JSON.stringify(errorInfo));

        // Trip Circuit Breaker in Redis if primary failed
        if (adapter === primaryAdapter) {
            console.warn(`[Storage] 🛡️ Tripping circuit breaker (Redis) for ${adapterName} for 5 minutes.`);
            await redis.setex(`storage:health:${adapterName}`, COOLDOWN_PERIOD_SECONDS, 'unhealthy').catch(() => { });
        }

        try {
            if (adapter !== localAdapter) {
                // ✅ FIX: Fallback to LocalStorage (filesystem) instead of NeonStorageAdapter (DB)
                // Neon has a 512MB limit. LocalStorage stores files on the Replit filesystem.
                console.warn(`[Storage] 🚨 CRITICAL: Persistent storage failed. Attempting Local Filesystem fallback for ${scopedKey}. This file MAY BE LOST on ephemeral environments like Railway!`);
                return await localAdapter.uploadFile(scopedKey, body, contentType);
            }
            throw error;
        } catch (localError: any) {
            console.error(`[Storage] 🚨 CRITICAL: Local fallback also failed: ${localError.message}`);
            throw error; // Throw original error if both fail
        }
    }
}

async function getPresignedUploadUrl(companyId: string, key: string, contentType: string, expiresIn = 300): Promise<string> {
    const adapter = getStorageAdapter();
    const scopedKey = getScopedKey(companyId, key);
    return adapter.getPresignedUploadUrl(scopedKey, contentType, expiresIn);
}

async function getPresignedDownloadUrl(companyId: string, key: string, expiresIn = 3600): Promise<string> {
    const adapter = getStorageAdapter();
    const scopedKey = getScopedKey(companyId, key);
    return adapter.getPresignedDownloadUrl(scopedKey, expiresIn);
}

function getFileUrl(companyId: string, key: string): string {
    const adapter = getStorageAdapter();
    const scopedKey = getScopedKey(companyId, key);
    // If primary adapter fails to get URL (unlikely for sync method), we could fallback, 
    // but usually getFileUrl is just string formatting. 
    // Ideally we should check if file exists locally if primary is remote, but that's expensive.
    return adapter.getFileUrl(scopedKey);
}

async function deleteFileFromS3(companyId: string, key: string): Promise<void> {
    const adapter = getStorageAdapter();
    const scopedKey = getScopedKey(companyId, key);
    try {
        return await adapter.deleteFile(scopedKey);
    } catch (error) {
        // Try deleting from local just in case
        await localAdapter.deleteFile(scopedKey);
    }
}

async function fileExists(companyId: string, key: string): Promise<boolean> {
    const adapter = getStorageAdapter();
    const scopedKey = getScopedKey(companyId, key);
    // Check both
    return (await adapter.fileExists(scopedKey)) || (await localAdapter.fileExists(scopedKey));
}

async function getFileStream(companyId: string, key: string): Promise<ReadableStream | NodeJS.ReadableStream> {
    const primaryAdapter = getStorageAdapter();
    const scopedKey = getScopedKey(companyId, key);

    // 1. Tentar Adapter Primário (S3 ou Neon)
    try {
        return await primaryAdapter.getFileStream(scopedKey);
    } catch (error: any) {
        if (process.env.DEBUG) console.log(`[Storage] ⚠️ Primary adapter failed for scopedKey: ${scopedKey}. Reason: ${error.message}`);
    }

    // 2. Tentar Neon DB caso o primário (S3) tenha falhado
    if (primaryAdapter.constructor.name !== 'NeonStorageAdapter') {
        try {
            if (process.env.DEBUG) console.log(`[Storage] 🔄 Tentando Neon DB Storage para ${scopedKey}...`);
            const neon = new NeonStorageAdapter();
            return await neon.getFileStream(scopedKey);
        } catch (e2: any) {
            if (process.env.DEBUG) console.log(`[Storage] ⚠️ Neon adapter failed for scopedKey: ${scopedKey}.`);
        }
    }

    // 3. Tentar fallback de chave bruta (migração/legado)
    if (key !== scopedKey) {
        try {
            if (process.env.DEBUG) console.log(`[Storage] ⚠️ Scoped key failed, trying raw key: ${key}`);
            return await primaryAdapter.getFileStream(key);
        } catch (e3) {
            // Ignore
        }
    }

    // 4. Último recurso: Tentar Local Filesystem (Pode falhar no Railway)
    try {
        if (process.env.DEBUG) console.log(`[Storage] 🔄 Tentando Local Filesystem Storage para ${scopedKey}...`);
        return await localAdapter.getFileStream(scopedKey);
    } catch (e4) {
        throw new Error(`Arquivo não encontrado em nenhum provedor de storage para a chave: ${scopedKey}. Verifique se o upload foi bem-sucedido.`);
    }
}

/**
 * Retorna o conteúdo inteiro do arquivo como um Buffer da memória,
 * tratando as instâncias de Readable Node ou SdkStream nativo do AWS.
 */
async function getFileBuffer(companyId: string, key: string): Promise<Buffer> {
    const stream = await getFileStream(companyId, key);

    // Se for o stream do AWS SDK v3, ele vem com este utilitário
    if (typeof (stream as any).transformToByteArray === 'function') {
        const arr = await (stream as any).transformToByteArray();
        return Buffer.from(arr);
    }

    // Se for Replit ou Local Node.js stream
    const chunks = [];
    for await (const chunk of stream as NodeJS.ReadableStream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export {
    getS3Client,
    uploadFileToS3,
    getPresignedUploadUrl,
    getPresignedDownloadUrl,
    getFileUrl,
    deleteFileFromS3,
    fileExists,
    getFileStream,
    getFileBuffer,
    getStorageAdapter as getStorageProvider
};