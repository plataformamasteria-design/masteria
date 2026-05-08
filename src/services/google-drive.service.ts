/**
 * Google Drive Service
 * Handles OAuth authentication and Drive API operations
 * Reuses the same Google Cloud project credentials as Google Calendar
 */

import { google, drive_v3 } from 'googleapis';
import { db } from '@/lib/db';
import { googleDriveCredentials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// OAuth2 Configuration (same project as Calendar)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_DRIVE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/integrations/google-drive/callback`;

// Drive-specific scopes
const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
];

export class GoogleDriveService {
    private oauth2Client: InstanceType<typeof google.auth.OAuth2>;

    constructor() {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            console.warn('[GoogleDrive] Missing OAuth credentials - service will be disabled');
        }
        this.oauth2Client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            REDIRECT_URI
        );
    }

    /**
     * Generate OAuth authorization URL for Drive access
     */
    getAuthUrl(state: string, redirectUri?: string): string {
        const client = redirectUri ? new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri) : this.oauth2Client;
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            state,
            prompt: 'consent',
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async getTokensFromCode(code: string, redirectUri?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiry: Date | null;
    }> {
        const client = redirectUri ? new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirectUri) : this.oauth2Client;
        const { tokens } = await client.getToken(code);

        return {
            accessToken: tokens.access_token || '',
            refreshToken: tokens.refresh_token || '',
            expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        };
    }

    /**
     * Refresh access token if expired
     */
    async refreshAccessToken(refreshToken: string): Promise<{
        accessToken: string;
        expiry: Date | null;
    }> {
        // Create isolated client to prevent cross-tenant credential leaks
        const client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            REDIRECT_URI
        );
        client.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await client.refreshAccessToken();

        return {
            accessToken: credentials.access_token || '',
            expiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        };
    }

    /**
     * Get authenticated Drive client for a company
     */
    async getDriveClient(companyId: string): Promise<drive_v3.Drive | null> {
        const [credential] = await db.select().from(googleDriveCredentials)
            .where(and(
                eq(googleDriveCredentials.companyId, companyId),
                eq(googleDriveCredentials.isActive, true)
            ))
            .limit(1);

        if (!credential) {
            console.log(`[GoogleDrive] No credentials found for company ${companyId}`);
            return null;
        }

        // Check if token needs refresh
        if (credential.tokenExpiry && new Date() >= credential.tokenExpiry) {
            try {
                const { accessToken, expiry } = await this.refreshAccessToken(credential.refreshToken);

                await db.update(googleDriveCredentials)
                    .set({
                        accessToken,
                        tokenExpiry: expiry,
                    })
                    .where(eq(googleDriveCredentials.id, credential.id));

                credential.accessToken = accessToken;
            } catch (error) {
                console.error('[GoogleDrive] Failed to refresh token:', error);
                return null;
            }
        }

        // Create a NEW OAuth2 client per request to prevent cross-tenant data leak
        const client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            REDIRECT_URI
        );
        client.setCredentials({
            access_token: credential.accessToken,
            refresh_token: credential.refreshToken,
        });

        return google.drive({ version: 'v3', auth: client });
    }

    /**
     * Get Drive client from a specific credential record
     */
    async getDriveClientFromCredential(credential: typeof googleDriveCredentials.$inferSelect): Promise<drive_v3.Drive | null> {
        // Check if token needs refresh
        if (credential.tokenExpiry && new Date() >= credential.tokenExpiry) {
            try {
                const { accessToken, expiry } = await this.refreshAccessToken(credential.refreshToken);

                await db.update(googleDriveCredentials)
                    .set({ accessToken, tokenExpiry: expiry })
                    .where(eq(googleDriveCredentials.id, credential.id));

                credential.accessToken = accessToken;
            } catch (error) {
                console.error('[GoogleDrive] Failed to refresh token:', error);
                return null;
            }
        }

        const client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            REDIRECT_URI
        );
        client.setCredentials({
            access_token: credential.accessToken,
            refresh_token: credential.refreshToken,
        });

        return google.drive({ version: 'v3', auth: client });
    }

    /**
     * List folders in the user's Drive (own + shared + shared drives)
     */
    async listFolders(companyId: string, searchQuery?: string): Promise<{ id: string; name: string }[]> {
        const drive = await this.getDriveClient(companyId);
        if (!drive) return [];

        try {
            const allFolders: { id: string; name: string }[] = [];

            // Build base query
            let baseQuery = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
            if (searchQuery) {
                baseQuery += ` and name contains '${searchQuery.replace(/'/g, "\\'")}'`;
            }

            // 1. List folders from My Drive + Shared Drives
            const response = await drive.files.list({
                q: baseQuery,
                fields: 'files(id, name)',
                pageSize: 500,
                orderBy: 'name',
                includeItemsFromAllDrives: true,
                supportsAllDrives: true,
                corpora: 'allDrives',
            });

            for (const f of response.data.files || []) {
                if (f.id && f.name) {
                    allFolders.push({ id: f.id, name: f.name });
                }
            }

            // 2. Also list Shared Drive roots themselves
            try {
                const sharedDrives = await drive.drives.list({
                    pageSize: 50,
                    fields: 'drives(id, name)',
                });
                for (const d of sharedDrives.data.drives || []) {
                    if (d.id && d.name) {
                        // Check if already included
                        if (!allFolders.some(f => f.id === d.id)) {
                            allFolders.push({ id: d.id, name: `🗂️ ${d.name} (Drive Compartilhado)` });
                        }
                    }
                }
            } catch (e) {
                console.log('[GoogleDrive] Could not list shared drives (might not have access):', e);
            }

            // Sort alphabetically
            allFolders.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

            console.log(`[GoogleDrive] Listed ${allFolders.length} folders${searchQuery ? ` (search: "${searchQuery}")` : ''}`);
            return allFolders;
        } catch (error) {
            console.error('[GoogleDrive] Failed to list folders:', error);
            return [];
        }
    }

    /**
     * List PDF/CSV files in a specific folder
     */
    async listFilesInFolder(
        drive: drive_v3.Drive,
        folderId: string,
        modifiedAfter?: Date
    ): Promise<Array<{
        id: string;
        name: string;
        mimeType: string;
        modifiedTime: string;
        size: string;
    }>> {
        try {
            let query = `'${folderId}' in parents and trashed = false and (mimeType = 'application/pdf' or mimeType = 'text/csv')`;

            if (modifiedAfter) {
                query += ` and modifiedTime > '${modifiedAfter.toISOString()}'`;
            }

            console.log(`[GoogleDrive] Listing files with query: ${query}`);

            const response = await drive.files.list({
                q: query,
                fields: 'files(id, name, mimeType, modifiedTime, size)',
                pageSize: 100,
                orderBy: 'modifiedTime desc',
                includeItemsFromAllDrives: true,
                supportsAllDrives: true,
            });

            const files = (response.data.files || []).map(f => ({
                id: f.id || '',
                name: f.name || '',
                mimeType: f.mimeType || '',
                modifiedTime: f.modifiedTime || '',
                size: f.size || '0',
            }));

            console.log(`[GoogleDrive] Found ${files.length} file(s) in folder ${folderId}:`, files.map(f => f.name));
            return files;
        } catch (error) {
            console.error('[GoogleDrive] Failed to list files:', error);
            return [];
        }
    }

    /**
     * Download a file from Drive as a Buffer
     */
    async downloadFile(drive: drive_v3.Drive, fileId: string): Promise<Buffer | null> {
        try {
            const response = await drive.files.get(
                { fileId, alt: 'media', supportsAllDrives: true },
                { responseType: 'arraybuffer' }
            );

            return Buffer.from(response.data as ArrayBuffer);
        } catch (error) {
            console.error(`[GoogleDrive] Failed to download file ${fileId}:`, error);
            return null;
        }
    }

    /**
     * Get connection status for a company
     */
    async getConnectionStatus(companyId: string): Promise<{
        connected: boolean;
        folderId?: string;
        folderName?: string;
        personaId?: string;
        lastSyncAt?: Date | null;
    }> {
        const [credential] = await db.select().from(googleDriveCredentials)
            .where(and(
                eq(googleDriveCredentials.companyId, companyId),
                eq(googleDriveCredentials.isActive, true)
            ))
            .limit(1);

        if (!credential) {
            return { connected: false };
        }

        return {
            connected: true,
            folderId: credential.folderId || undefined,
            folderName: credential.folderName || undefined,
            personaId: credential.personaId || undefined,
            lastSyncAt: credential.lastSyncAt,
        };
    }

    /**
     * Disconnect Drive (soft delete) + stop watching
     */
    async disconnect(companyId: string): Promise<void> {
        // Get credential to stop any active watch
        const [credential] = await db.select().from(googleDriveCredentials)
            .where(and(
                eq(googleDriveCredentials.companyId, companyId),
                eq(googleDriveCredentials.isActive, true)
            ))
            .limit(1);

        if (credential?.watchChannelId && credential?.watchResourceId) {
            try {
                await this.stopWatch(credential);
            } catch (error) {
                console.error('[GoogleDrive] Failed to stop watch on disconnect:', error);
            }
        }

        await db.update(googleDriveCredentials)
            .set({ isActive: false })
            .where(and(
                eq(googleDriveCredentials.companyId, companyId),
                eq(googleDriveCredentials.isActive, true)
            ));
        console.log(`[GoogleDrive] Disconnected for company ${companyId}`);
    }

    /**
     * Register a push notification watch channel for changes
     * Uses the Changes API to monitor for new/modified files
     */
    async registerWatch(credential: typeof googleDriveCredentials.$inferSelect): Promise<{
        channelId: string;
        resourceId: string;
        expiration: Date;
    } | null> {
        const drive = await this.getDriveClientFromCredential(credential);
        if (!drive) {
            console.error('[GoogleDrive] Cannot register watch: no Drive client');
            return null;
        }

        try {
            // Generate unique channel ID
            const channelId = `masteria_${credential.companyId}_${Date.now()}`;

            // Build webhook URL
            const appUrl = process.env.NEXT_PUBLIC_APP_URL;
            if (!appUrl) {
                console.error('[GoogleDrive] NEXT_PUBLIC_APP_URL not set, cannot register webhook');
                return null;
            }
            const webhookUrl = `${appUrl}/api/v1/integrations/google-drive/webhook`;

            // Set expiration to ~23 hours (Google max is 24h)
            const expirationMs = Date.now() + (23 * 60 * 60 * 1000);

            // First, get the current start page token for changes
            const startTokenResponse = await drive.changes.getStartPageToken({
                supportsAllDrives: true,
            });
            const startPageToken = startTokenResponse.data.startPageToken;
            console.log(`[GoogleDrive Watch] Start page token: ${startPageToken}`);

            // Register the watch channel
            const watchResponse = await drive.changes.watch({
                pageToken: startPageToken || '1',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                requestBody: {
                    id: channelId,
                    type: 'web_hook',
                    address: webhookUrl,
                    token: `masteria_${credential.companyId}`,
                    expiration: expirationMs.toString(),
                },
            });

            const resourceId = watchResponse.data.resourceId || '';
            const expiration = new Date(parseInt(watchResponse.data.expiration || '0'));

            console.log(`[GoogleDrive Watch] ✅ Channel registered:`, {
                channelId,
                resourceId,
                expiration: expiration.toISOString(),
                webhookUrl,
            });

            // Save channel info to DB
            await db.update(googleDriveCredentials)
                .set({
                    watchChannelId: channelId,
                    watchResourceId: resourceId,
                    watchExpiry: expiration,
                })
                .where(eq(googleDriveCredentials.id, credential.id));

            return { channelId, resourceId, expiration };
        } catch (error) {
            console.error('[GoogleDrive Watch] Failed to register watch:', error);
            return null;
        }
    }

    /**
     * Stop an active watch channel
     */
    async stopWatch(credential: typeof googleDriveCredentials.$inferSelect): Promise<void> {
        if (!credential.watchChannelId || !credential.watchResourceId) {
            console.log('[GoogleDrive Watch] No active channel to stop');
            return;
        }

        const drive = await this.getDriveClientFromCredential(credential);
        if (!drive) return;

        try {
            await drive.channels.stop({
                requestBody: {
                    id: credential.watchChannelId,
                    resourceId: credential.watchResourceId,
                },
            });

            console.log(`[GoogleDrive Watch] ⏹️ Channel stopped: ${credential.watchChannelId}`);

            // Clear channel info from DB
            await db.update(googleDriveCredentials)
                .set({
                    watchChannelId: null,
                    watchResourceId: null,
                    watchExpiry: null,
                })
                .where(eq(googleDriveCredentials.id, credential.id));
        } catch (error) {
            console.error('[GoogleDrive Watch] Failed to stop channel:', error);
            // Clear DB even if stop fails (channel may have already expired)
            await db.update(googleDriveCredentials)
                .set({
                    watchChannelId: null,
                    watchResourceId: null,
                    watchExpiry: null,
                })
                .where(eq(googleDriveCredentials.id, credential.id));
        }
    }

    /**
     * Renew a watch channel that is about to expire
     * Creates a new channel and stops the old one
     */
    async renewWatch(credential: typeof googleDriveCredentials.$inferSelect): Promise<void> {
        console.log(`[GoogleDrive Watch] 🔄 Renewing channel for company ${credential.companyId}`);

        // Stop the old channel first
        if (credential.watchChannelId) {
            await this.stopWatch(credential);
        }

        // Re-fetch credential to get clean state
        const [refreshedCred] = await db.select().from(googleDriveCredentials)
            .where(eq(googleDriveCredentials.id, credential.id))
            .limit(1);

        if (refreshedCred && refreshedCred.isActive && refreshedCred.folderId) {
            await this.registerWatch(refreshedCred);
        }
    }
}

// Singleton instance
export const googleDriveService = new GoogleDriveService();

