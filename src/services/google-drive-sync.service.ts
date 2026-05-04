/**
 * Google Drive Sync Service
 * Handles automatic synchronization of files from Google Drive folders
 * into MasterIA's External Sources system
 */

import { db } from '@/lib/db';
import { googleDriveCredentials, personaExternalSources } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { googleDriveService } from './google-drive.service';
import { ExternalSourceService } from './external-source.service';
import { getStorageProvider } from '@/lib/s3';

export class GoogleDriveSyncService {

    /**
     * Sync all active Drive connections + renew expiring channels
     * Called periodically by background service (polling fallback)
     */
    async syncAllActive(): Promise<void> {
        // First, renew any expiring watch channels
        await this.renewExpiredChannels();

        const credentials = await db.select().from(googleDriveCredentials)
            .where(and(
                eq(googleDriveCredentials.isActive, true),
            ));

        const now = new Date();

        for (const cred of credentials) {
            // Skip if no folder or persona configured
            if (!cred.folderId || !cred.personaId) {
                continue;
            }

            // Polling fallback: check every 15 min (push handles real-time)
            const intervalMs = (cred.syncIntervalMinutes || 15) * 60 * 1000;
            if (cred.lastSyncAt && (now.getTime() - cred.lastSyncAt.getTime()) < intervalMs) {
                continue;
            }

            try {
                console.log(`[GoogleDriveSync] Polling fallback sync for company ${cred.companyId}`);
                await this.syncFolder(cred);
            } catch (error) {
                console.error(`[GoogleDriveSync] Error syncing credential ${cred.id}:`, error);
            }
        }
    }

    /**
     * Renew watch channels that are about to expire (within 1 hour)
     */
    async renewExpiredChannels(): Promise<void> {
        const credentials = await db.select().from(googleDriveCredentials)
            .where(and(
                eq(googleDriveCredentials.isActive, true),
            ));

        const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

        for (const cred of credentials) {
            if (!cred.folderId) continue;

            // Renew if channel is expiring within 1 hour or has no channel
            const needsRenewal = !cred.watchChannelId ||
                (cred.watchExpiry && cred.watchExpiry <= oneHourFromNow);

            if (needsRenewal) {
                try {
                    console.log(`[GoogleDriveSync] Renewing watch channel for company ${cred.companyId}`);
                    await googleDriveService.renewWatch(cred);
                } catch (error) {
                    console.error(`[GoogleDriveSync] Failed to renew channel for ${cred.companyId}:`, error);
                }
            }
        }
    }

    /**
     * Sync a specific Drive folder
     */
    async syncFolder(credential: typeof googleDriveCredentials.$inferSelect): Promise<{
        imported: number;
        skipped: number;
        errors: number;
    }> {
        const result = { imported: 0, skipped: 0, errors: 0 };

        if (!credential.folderId || !credential.personaId) {
            console.warn(`[GoogleDriveSync] Missing folderId or personaId for credential ${credential.id}`);
            return result;
        }

        const drive = await googleDriveService.getDriveClientFromCredential(credential);
        if (!drive) {
            console.error(`[GoogleDriveSync] Could not get Drive client for credential ${credential.id}`);
            return result;
        }

        // List files in the folder (optionally only modified since last sync)
        const files = await googleDriveService.listFilesInFolder(
            drive,
            credential.folderId,
            credential.lastSyncAt || undefined
        );

        if (files.length === 0) {
            console.log(`[GoogleDriveSync] No new files found in folder ${credential.folderName || credential.folderId}`);
            // Update lastSyncAt even if no files
            await db.update(googleDriveCredentials)
                .set({ lastSyncAt: new Date() })
                .where(eq(googleDriveCredentials.id, credential.id));
            return result;
        }

        console.log(`[GoogleDriveSync] Found ${files.length} file(s) to process`);

        // Get existing sources to avoid duplicates
        const existingSources = await db.select({
            originalFileName: personaExternalSources.originalFileName,
        }).from(personaExternalSources)
            .where(eq(personaExternalSources.personaId, credential.personaId));

        const existingNames = new Set(existingSources.map(s => s.originalFileName).filter(Boolean));

        for (const file of files) {
            try {
                // Skip if already imported (by filename)
                if (existingNames.has(file.name)) {
                    console.log(`[GoogleDriveSync] Skipping already imported: ${file.name}`);
                    result.skipped++;
                    continue;
                }

                // Download file from Drive
                const buffer = await googleDriveService.downloadFile(drive, file.id);
                if (!buffer) {
                    console.error(`[GoogleDriveSync] Failed to download: ${file.name}`);
                    result.errors++;
                    continue;
                }

                // Determine source type from mime type
                const sourceType = file.mimeType === 'text/csv' ? 'csv' as const : 'pdf' as const;

                // Upload to storage
                const storage = getStorageProvider();
                const s3Key = `external-sources/${credential.companyId}/${credential.personaId}/${Date.now()}_${file.name}`;

                await storage.uploadFile(s3Key, buffer, file.mimeType);

                // Create external source using the static method
                const source = await ExternalSourceService.create({
                    personaId: credential.personaId,
                    companyId: credential.companyId,
                    name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for display
                    sourceType,
                    s3Key,
                    originalFileName: file.name,
                });

                // Sync the source (process PDF content into RAG sections)
                await ExternalSourceService.syncSource(source.id);

                console.log(`[GoogleDriveSync] ✅ Imported: ${file.name}`);
                result.imported++;
            } catch (error) {
                console.error(`[GoogleDriveSync] Error importing file ${file.name}:`, error);
                result.errors++;
            }
        }

        // Update lastSyncAt
        await db.update(googleDriveCredentials)
            .set({ lastSyncAt: new Date() })
            .where(eq(googleDriveCredentials.id, credential.id));

        console.log(`[GoogleDriveSync] Sync complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`);
        return result;
    }
}

// Singleton instance
export const googleDriveSyncService = new GoogleDriveSyncService();

