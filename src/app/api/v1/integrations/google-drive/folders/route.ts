// src/app/api/v1/integrations/google-drive/folders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { googleDriveService } from '@/services/google-drive.service';
import { db } from '@/lib/db';
import { googleDriveCredentials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET - List folders from connected Google Drive (supports ?search=query)
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || undefined;

        const folders = await googleDriveService.listFolders(session.user.companyId, search);
        return NextResponse.json({ folders });
    } catch (error) {
        console.error('[GoogleDrive Folders] GET Error:', error);
        return NextResponse.json({ error: 'Failed to list folders' }, { status: 500 });
    }
}

/**
 * POST - Save selected folder and persona association
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getUserSession();
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { folderId, folderName, personaId } = body;

        if (!folderId) {
            return NextResponse.json({ error: 'folderId is required' }, { status: 400 });
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

        await db.update(googleDriveCredentials)
            .set({
                folderId,
                folderName: folderName || folderId,
                personaId: personaId || credential.personaId,
            })
            .where(eq(googleDriveCredentials.id, credential.id));

        // Auto-register push notification watch channel
        try {
            // Stop existing channel if any
            if (credential.watchChannelId) {
                await googleDriveService.stopWatch(credential);
            }

            // Re-fetch credential with updated folder info
            const [updatedCred] = await db.select().from(googleDriveCredentials)
                .where(eq(googleDriveCredentials.id, credential.id))
                .limit(1);

            if (updatedCred) {
                const watchResult = await googleDriveService.registerWatch(updatedCred);
                if (watchResult) {
                    console.log(`[GoogleDrive Folders] ✅ Watch channel registered for folder ${folderId}`);
                } else {
                    console.warn(`[GoogleDrive Folders] ⚠️ Could not register watch channel (push notifications will not work, polling fallback active)`);
                }
            }
        } catch (watchError) {
            console.error('[GoogleDrive Folders] Watch registration failed (non-blocking):', watchError);
            // Don't fail the folder save if watch registration fails
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[GoogleDrive Folders] POST Error:', error);
        return NextResponse.json({ error: 'Failed to save folder' }, { status: 500 });
    }
}
