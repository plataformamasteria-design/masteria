// src/lib/media-cleanup.ts
import { db } from '@/lib/db';
import { mediaAssets } from '@/lib/db/schema';
import { lt, eq } from 'drizzle-orm';
import { deleteFileFromS3 } from '@/lib/s3';

// Cleanup de mídia não utilizada (> 30 dias)
export async function cleanupUnusedMedia(): Promise<{ deleted: number; errors: string[] }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const errors: string[] = [];
    let deleted = 0;

    try {
        // Buscar mídia antiga não referenciada em campanhas
        const unusedMedia = await db
            .select()
            .from(mediaAssets)
            .where(lt(mediaAssets.createdAt, thirtyDaysAgo));

        for (const asset of unusedMedia) {
            try {
                await deleteFileFromS3(asset.companyId, asset.s3Key);
                await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
                deleted++;
            } catch (error) {
                errors.push(`Erro ao deletar ${asset.name}: ${(error as Error).message}`);
            }
        }

        return { deleted, errors };
    } catch (error) {
        throw new Error(`Erro no cleanup: ${(error as Error).message}`);
    }
}

// Cron job para executar cleanup
export async function scheduleMediaCleanup() {
    if (process.env.NODE_ENV === 'production') {
        setInterval(cleanupUnusedMedia, 24 * 60 * 60 * 1000); // Diário
    }
}