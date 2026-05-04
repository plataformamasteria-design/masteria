// src/app/api/v1/integrations/google-drive/webhook/route.ts
/**
 * Google Drive Push Notification Webhook Receiver
 * Receives notifications from Google when files change in monitored folders
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { googleDriveCredentials } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { googleDriveSyncService } from '@/services/google-drive-sync.service';

export const dynamic = 'force-dynamic';

/**
 * POST - Receive Google Drive push notifications
 * Google sends notifications here when files change in watched folders
 */
export async function POST(request: NextRequest) {
    try {
        // Extract Google notification headers
        const channelId = request.headers.get('x-goog-channel-id');
        const resourceState = request.headers.get('x-goog-resource-state');
        const resourceId = request.headers.get('x-goog-resource-id');
        const channelToken = request.headers.get('x-goog-channel-token');
        const messageNumber = request.headers.get('x-goog-message-number');

        console.log(`[GoogleDrive Webhook] Received notification:`, {
            channelId,
            resourceState,
            resourceId,
            channelToken,
            messageNumber,
        });

        // Validate that we have a channel ID
        if (!channelId) {
            console.warn('[GoogleDrive Webhook] No channel ID in request');
            return NextResponse.json({ error: 'Missing channel ID' }, { status: 400 });
        }

        // Ignore sync messages (initial confirmation)
        if (resourceState === 'sync') {
            console.log('[GoogleDrive Webhook] Sync confirmation received, ignoring');
            return NextResponse.json({ ok: true });
        }

        // Find the credential associated with this channel
        const [credential] = await db.select().from(googleDriveCredentials)
            .where(eq(googleDriveCredentials.watchChannelId, channelId))
            .limit(1);

        if (!credential) {
            console.warn(`[GoogleDrive Webhook] No credential found for channel ${channelId}`);
            return NextResponse.json({ ok: true }); // Return 200 to stop Google retrying
        }

        // Validate token if present
        if (channelToken && channelToken !== `masteria_${credential.companyId}`) {
            console.warn(`[GoogleDrive Webhook] Token mismatch for channel ${channelId}`);
            return NextResponse.json({ ok: true });
        }

        // Only process relevant state changes
        const actionableStates = ['change', 'update', 'add'];
        if (!actionableStates.includes(resourceState || '')) {
            console.log(`[GoogleDrive Webhook] Ignoring state: ${resourceState}`);
            return NextResponse.json({ ok: true });
        }

        console.log(`[GoogleDrive Webhook] 🔔 Change detected! Triggering sync for company ${credential.companyId}`);

        // Trigger sync asynchronously (don't block the webhook response)
        // Use a full rescan since we got a push notification
        const credentialForSync = { ...credential, lastSyncAt: null };
        googleDriveSyncService.syncFolder(credentialForSync)
            .then((result) => {
                console.log(`[GoogleDrive Webhook] ✅ Sync complete:`, result);
            })
            .catch((error) => {
                console.error(`[GoogleDrive Webhook] ❌ Sync failed:`, error);
            });

        // Return 200 immediately as Google expects quick response
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[GoogleDrive Webhook] Error:', error);
        // Always return 200 to prevent Google from retrying
        return NextResponse.json({ ok: true });
    }
}
