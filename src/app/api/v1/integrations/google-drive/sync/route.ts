// src/app/api/v1/integrations/google-drive/sync/route.ts
import { NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { googleDriveSyncService } from '@/services/google-drive-sync.service';
import { db } from '@/lib/db';
import { googleDriveCredentials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET - Get sync status for the current company
 */
export async function GET() {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [credential] = await db.select().from(googleDriveCredentials)
            .where(and(
                eq(googleDriveCredentials.companyId, session.user.companyId),
                eq(googleDriveCredentials.isActive, true)
            ))
            .limit(1);

        if (!credential) {
            return NextResponse.json({
                connected: false,
                folderId: null,
                folderName: null,
                personaId: null,
                lastSyncAt: null,
            });
        }

        return NextResponse.json({
            connected: true,
            folderId: credential.folderId,
            folderName: credential.folderName,
            personaId: credential.personaId,
            lastSyncAt: credential.lastSyncAt,
        });
    } catch (error) {
        console.error('[GoogleDrive Sync] GET Error:', error);
        return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 });
    }
}

/**
 * POST - Trigger manual sync
 */
export async function POST() {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const [credential] = await db.select().from(googleDriveCredentials)
            .where(and(
                eq(googleDriveCredentials.companyId, session.user.companyId),
                eq(googleDriveCredentials.isActive, true)
            ))
            .limit(1);

        if (!credential) {
            return NextResponse.json({ error: 'Google Drive not connected' }, { status: 404 });
        }

        if (!credential.folderId || !credential.personaId) {
            return NextResponse.json({
                error: 'Please select a folder and agent before syncing'
            }, { status: 400 });
        }

        // Force full rescan by clearing lastSyncAt for manual sync
        const credentialForSync = { ...credential, lastSyncAt: null };
        const result = await googleDriveSyncService.syncFolder(credentialForSync);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('[GoogleDrive Sync] POST Error:', error);
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
}
