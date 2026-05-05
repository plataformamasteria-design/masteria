// src/services/token-refresh.service.ts

import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, and, lt, isNotNull, or } from 'drizzle-orm';
import { metaTokenManager } from '@/lib/meta-token-manager';
import { decrypt } from '@/lib/crypto';

export class TokenRefreshService {
    /**
     * Scan all Meta API connections and refresh tokens expiring within 7 days
     */
    async refreshExpiringTokens(): Promise<void> {
        console.log('[TokenRefreshService] 🔄 Starting scheduled token refresh scan...');

        try {
            // Calculate date 7 days from now
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

            // Find all Meta API connections with tokens expiring within 7 days
            const expiringConnections = await db
                .select()
                .from(connections)
                .where(
                    and(
                        or(
                            eq(connections.connectionType, 'meta_api'),
                            eq(connections.connectionType, 'instagram'),
                            eq(connections.connectionType, 'instagram_direct')
                        ),
                        isNotNull(connections.tokenExpiresAt),
                        lt(connections.tokenExpiresAt, sevenDaysFromNow)
                    )
                );

            console.log(`[TokenRefreshService] Found ${expiringConnections.length} connections with expiring tokens`);

            let refreshedCount = 0;
            let failedCount = 0;

            for (const connection of expiringConnections) {
                try {
                    await this.refreshConnectionToken(connection.id);
                    refreshedCount++;
                } catch (error) {
                    console.error(`[TokenRefreshService] Failed to refresh token for connection ${connection.id}:`, error);
                    failedCount++;

                    // Record the failure
                    await db
                        .update(connections)
                        .set({
                            tokenRefreshFailedAt: new Date(),
                            tokenRefreshError: error instanceof Error ? error.message : 'Unknown error',
                        })
                        .where(eq(connections.id, connection.id));
                }
            }

            console.log(`[TokenRefreshService] ✅ Token refresh complete. Refreshed: ${refreshedCount}, Failed: ${failedCount}`);
        } catch (error) {
            console.error('[TokenRefreshService] ❌ Token refresh scan failed:', error);
        }
    }

    /**
     * Attempt to refresh a specific connection's token
     * Note: Meta does not support automatic refresh for user tokens.
     * This method validates the token and updates metadata.
     */
    async refreshConnectionToken(connectionId: string): Promise<void> {
        const [connection] = await db
            .select()
            .from(connections)
            .where(eq(connections.id, connectionId));

        if (!connection) {
            throw new Error('Connection not found');
        }

        if (!connection.accessToken || !connection.appId || !connection.appSecret) {
            throw new Error('Connection missing required credentials');
        }

        console.log(`[TokenRefreshService] Refreshing token for connection: ${connection.config_name}`);

        // Decrypt tokens
        const currentToken = decrypt(connection.accessToken);
        const appSecret = decrypt(connection.appSecret);

        // Validate current token
        const isValid = await metaTokenManager.validateToken(currentToken);

        if (!isValid) {
            throw new Error('Current token is invalid and cannot be refreshed automatically. Manual intervention required.');
        }

        // Get token debug info to update expiration date
        const debugInfo = await metaTokenManager.debugToken(
            currentToken,
            connection.appId,
            appSecret
        );

        // Update token metadata
        let newExpiresAt: Date | null = null;
        if (debugInfo.expires_at && debugInfo.expires_at > 0) {
            newExpiresAt = new Date(debugInfo.expires_at * 1000);
        }

        await db
            .update(connections)
            .set({
                tokenExpiresAt: newExpiresAt,
                tokenLastRefreshed: new Date(),
                tokenRefreshFailedAt: null,
                tokenRefreshError: null,
            })
            .where(eq(connections.id, connectionId));

        console.log(`[TokenRefreshService] ✅ Token metadata updated for ${connection.config_name}`);
    }

    /**
     * Send notification to company admins when token cannot be auto-refreshed
     * TODO: Implement email/in-app notifications
     */
    async notifyTokenExpirationWarning(
        companyId: string,
        connectionId: string,
        expiresAt: Date
    ): Promise<void> {
        const daysUntilExpiration = metaTokenManager.getDaysUntilExpiration(expiresAt);

        console.warn(
            `[TokenRefreshService] ⚠️ Token expiration warning for connection ${connectionId} in company ${companyId}. ` +
            `Expires in ${daysUntilExpiration} days. Manual renewal required.`
        );

        // TODO: Send email notification
        // TODO: Create in-app notification
    }

    /**
     * Get summary of all connections with token status
     */
    async getTokenHealthSummary(): Promise<{
        total: number;
        valid: number;
        expiringSoon: number;
        expired: number;
    }> {
        const allConnections = await db
            .select()
            .from(connections)
            .where(
                or(
                    eq(connections.connectionType, 'meta_api'),
                    eq(connections.connectionType, 'instagram'),
                    eq(connections.connectionType, 'instagram_direct')
                )
            );

        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        let valid = 0;
        let expiringSoon = 0;
        let expired = 0;

        for (const conn of allConnections) {
            if (!conn.tokenExpiresAt) {
                continue; // Skip connections without expiration data
            }

            if (conn.tokenExpiresAt < now) {
                expired++;
            } else if (conn.tokenExpiresAt < sevenDaysFromNow) {
                expiringSoon++;
            } else {
                valid++;
            }
        }

        return {
            total: allConnections.length,
            valid,
            expiringSoon,
            expired,
        };
    }
}

// Export singleton instance
export const tokenRefreshService = new TokenRefreshService();
