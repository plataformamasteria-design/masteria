// src/lib/meta-token-manager.ts

export interface TokenDebugInfo {
    app_id: string;
    type: string;
    application: string;
    data_access_expires_at: number;
    expires_at: number;
    is_valid: boolean;
    issued_at: number;
    scopes: string[];
    user_id: string;
}

export interface LongLivedTokenResponse {
    accessToken: string;
    tokenType: string;
    expiresIn: number; // seconds until expiration
}

export class MetaTokenManager {
    /**
     * Exchange a short-lived token for a long-lived token (60 days)
     * @param shortLivedToken - The short-lived access token from Graph API Explorer
     * @param appId - Facebook App ID
     * @param appSecret - Facebook App Secret
     * @returns Long-lived token information
     */
    async exchangeForLongLivedToken(
        shortLivedToken: string,
        appId: string,
        appSecret: string
    ): Promise<LongLivedTokenResponse> {
        const url = new URL('https://graph.facebook.com/v24.0/oauth/access_token');
        url.searchParams.set('grant_type', 'fb_exchange_token');
        url.searchParams.set('client_id', appId);
        url.searchParams.set('client_secret', appSecret);
        url.searchParams.set('fb_exchange_token', shortLivedToken);

        console.log('[MetaTokenManager] Exchanging short-lived token for long-lived token...');

        const response = await fetch(url.toString());
        const data = await response.json();

        if (!response.ok || data.error) {
            console.error('[MetaTokenManager] Token exchange failed:', data.error);
            throw new Error(data.error?.message || 'Failed to exchange token');
        }

        console.log(`[MetaTokenManager] ✅ Token exchanged successfully. Expires in ${data.expires_in} seconds (~${Math.floor(data.expires_in / 86400)} days)`);

        return {
            accessToken: data.access_token,
            tokenType: data.token_type || 'bearer',
            expiresIn: data.expires_in,
        };
    }

    /**
     * Get detailed information about a token including expiration date
     * @param token - Access token to debug
     * @param appId - Facebook App ID
     * @param appSecret - Facebook App Secret
     * @returns Token debug information
     */
    async debugToken(
        token: string,
        appId: string,
        appSecret: string
    ): Promise<TokenDebugInfo> {
        // Get app access token first
        const appTokenUrl = new URL('https://graph.facebook.com/v24.0/oauth/access_token');
        appTokenUrl.searchParams.set('client_id', appId);
        appTokenUrl.searchParams.set('client_secret', appSecret);
        appTokenUrl.searchParams.set('grant_type', 'client_credentials');

        const appTokenResponse = await fetch(appTokenUrl.toString());
        const appTokenData = await appTokenResponse.json();

        if (!appTokenResponse.ok || !appTokenData.access_token) {
            throw new Error('Failed to get app access token');
        }

        // Debug the user token
        const debugUrl = new URL('https://graph.facebook.com/v24.0/debug_token');
        debugUrl.searchParams.set('input_token', token);
        debugUrl.searchParams.set('access_token', appTokenData.access_token);

        const response = await fetch(debugUrl.toString());
        const data = await response.json();

        if (!response.ok || data.error) {
            console.error('[MetaTokenManager] Token debug failed:', data.error);
            throw new Error(data.error?.message || 'Failed to debug token');
        }

        return data.data;
    }

    /**
     * Check if a token is expiring soon (within 7 days)
     * @param expiresAt - Token expiration date
     * @returns True if token expires within 7 days
     */
    isTokenExpiringSoon(expiresAt: Date): boolean {
        const now = new Date();
        const daysUntilExpiration = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntilExpiration <= 7 && daysUntilExpiration > 0;
    }

    /**
     * Check if a token has already expired
     * @param expiresAt - Token expiration date
     * @returns True if token has expired
     */
    isTokenExpired(expiresAt: Date): boolean {
        return new Date() > expiresAt;
    }

    /**
     * Validate that a token is still active by making a test API call
     * @param token - Access token to validate
     * @returns True if token is valid
     */
    async validateToken(token: string): Promise<boolean> {
        try {
            const url = `https://graph.facebook.com/v24.0/me?access_token=${token}`;
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok || data.error) {
                console.log('[MetaTokenManager] Token validation failed:', data.error?.message);
                return false;
            }

            console.log('[MetaTokenManager] ✅ Token is valid (Account ID:', data.id, ')');
            return true;
        } catch (error) {
            console.error('[MetaTokenManager] Token validation error:', error);
            return false;
        }
    }

    /**
     * Calculate days until token expiration
     * @param expiresAt - Token expiration date
     * @returns Number of days until expiration (negative if expired)
     */
    getDaysUntilExpiration(expiresAt: Date): number {
        const now = new Date();
        const daysUntilExpiration = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return Math.floor(daysUntilExpiration);
    }

    /**
     * Get human-readable expiration status
     * @param expiresAt - Token expiration date
     * @returns Status message
     */
    getExpirationStatus(expiresAt: Date): string {
        const days = this.getDaysUntilExpiration(expiresAt);

        if (days < 0) {
            return `Expirado há ${Math.abs(days)} dias`;
        } else if (days === 0) {
            return 'Expira hoje';
        } else if (days === 1) {
            return 'Expira amanhã';
        } else if (days <= 7) {
            return `Expira em ${days} dias ⚠️`;
        } else {
            return `Expira em ${days} dias`;
        }
    }
}

// Export singleton instance
export const metaTokenManager = new MetaTokenManager();
