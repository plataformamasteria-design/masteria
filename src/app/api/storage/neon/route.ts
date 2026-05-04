import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { storageFiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Serves files stored in the Neon database (BYTEA columns).
 * URL format: /api/storage/neon?key=tenants/companyId/media_recebida/uuid.ext
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
        return new NextResponse('Missing key parameter', { status: 400 });
    }

    try {
        const file = await db.query.storageFiles.findFirst({
            where: eq(storageFiles.key, key),
        });

        if (!file || !file.data) {
            console.warn(`[NeonStorageAPI] ❓ File not found: ${key}`);
            return new NextResponse('File not found', { status: 404 });
        }

        const data = Buffer.from(file.data); // Garantir que seja um Buffer
        console.log(`[NeonStorageAPI] 📦 Serving ${key} (${data.length} bytes, type: ${file.mimeType})`);

        return new NextResponse(data, {
            headers: {
                'Content-Type': file.mimeType || 'application/octet-stream',
                'Content-Length': data.length.toString(),
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Content-Disposition': `inline; filename="${key.split('/').pop()}"`,
            },
        });
    } catch (error: any) {
        console.error(`[NeonStorageAPI] ❌ Error fetching key ${key}:`, error);
        return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
