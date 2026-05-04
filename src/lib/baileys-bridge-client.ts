/**
 * Baileys Bridge Client
 * HTTP client that replaces direct imports of sessionManager.
 * Communicates with the standalone Baileys microservice via REST API.
 * 
 * ✅ v2: Auto-retry with exponential backoff for transient failures
 */

const BAILEYS_SERVICE_URL = process.env.BAILEYS_SERVICE_URL || 'http://localhost:3001';
const BAILEYS_SERVICE_API_KEY = process.env.BAILEYS_SERVICE_API_KEY || '';

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 1000; // 1s, 2s, 4s

interface BridgeRequestOptions {
    method: 'GET' | 'POST' | 'DELETE';
    path: string;
    body?: Record<string, any>;
    timeout?: number;
    retries?: number; // Allow overriding max retries per call
}

async function bridgeRequest<T = any>(options: BridgeRequestOptions): Promise<T> {
    const { method, path, body, timeout = 30000, retries = MAX_RETRIES } = options;
    const url = `${BAILEYS_SERVICE_URL}/api${path}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (BAILEYS_SERVICE_API_KEY) {
        headers['x-api-key'] = BAILEYS_SERVICE_API_KEY;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Baileys service returned ${response.status}`);
            }

            return data as T;
        } catch (error: any) {
            lastError = error;
            clearTimeout(timeoutId);

            const isRetryable = (
                error.name === 'AbortError' ||
                error.code === 'ECONNREFUSED' ||
                error.code === 'ECONNRESET' ||
                error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                error.message?.includes('fetch failed') ||
                error.cause?.code === 'ECONNREFUSED'
            );

            if (isRetryable && attempt < retries) {
                const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
                console.warn(`[BaileysBridge] ⚠️ Request ${method} ${path} failed (attempt ${attempt}/${retries}): ${error.message}. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            if (error.name === 'AbortError') {
                throw new Error(`Baileys service request timed out after ${timeout}ms: ${method} ${path}`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw lastError || new Error(`bridgeRequest failed after ${retries} attempts`);
}

/**
 * Bridge client that exposes the same public API as the original sessionManager
 */
class BaileysBridgeClient {
    async createSession(connectionId: string, companyId: string): Promise<void> {
        await bridgeRequest({
            method: 'POST',
            path: `/sessions/${connectionId}/create`,
            body: { companyId },
        });
    }

    async sendMessage(connectionId: string, to: string, content: any): Promise<string | null> {
        try {
            const result = await bridgeRequest<{ success: boolean; messageId?: string }>({
                method: 'POST',
                path: `/sessions/${connectionId}/send`,
                body: { to, content },
                timeout: 60000, // Messages can take longer
            });
            return result.messageId || null;
        } catch (error) {
            console.error(`[BaileysBridge] ❌ Error sending message via ${connectionId}:`, error);
            return null;
        }
    }

    async ensureSession(connectionId: string, companyId: string): Promise<{
        success: boolean;
        status: 'connected' | 'connecting' | 'qr' | 'needs_qr' | 'failed';
        message: string;
    }> {
        return bridgeRequest({
            method: 'POST',
            path: `/sessions/${connectionId}/ensure`,
            body: { companyId },
        });
    }

    async deleteSession(connectionId: string): Promise<void> {
        await bridgeRequest({
            method: 'DELETE',
            path: `/sessions/${connectionId}`,
        });
    }

    getSession(connectionId: string): undefined {
        // Runtime session data lives in the microservice.
        // For status, use getSessionStatus() which calls the API.
        console.warn('[BaileysBridge] getSession() is not available via bridge. Use getSessionStatus() or getSessionStatusAsync().');
        return undefined;
    }

    async getSessionStatusAsync(connectionId: string): Promise<{
        connectionId: string;
        status: string | null;
        phone: string | null;
        qr: string | null;
    }> {
        return bridgeRequest({
            method: 'GET',
            path: `/sessions/${connectionId}/status`,
        });
    }

    getSessionStatus(connectionId: string): null {
        // Synchronous status is not available via bridge.
        // Callers should migrate to getSessionStatusAsync().
        console.warn('[BaileysBridge] getSessionStatus() is synchronous and unavailable via bridge. Use getSessionStatusAsync().');
        return null;
    }

    async getQRCode(connectionId: string): Promise<{ qr: string | null; status: string }> {
        return bridgeRequest({
            method: 'GET',
            path: `/sessions/${connectionId}/qr`,
        });
    }

    async getSessionsStats(): Promise<{
        total: number;
        byStatus: { connected: number; connecting: number; disconnected: number; qr: number; failed: number };
    }> {
        return bridgeRequest({
            method: 'GET',
            path: '/sessions/stats',
        });
    }

    async getBatchSessionStatus(connectionIds: string[]): Promise<Record<string, string | null>> {
        return bridgeRequest({
            method: 'POST',
            path: '/sessions/batch-status',
            body: { connectionIds },
        });
    }

    async resumeAllSessions(): Promise<{ success: number; failed: number }> {
        return bridgeRequest({
            method: 'POST',
            path: '/sessions/resume-all',
            timeout: 120000, // Resume can take long
        });
    }

    async validateWhatsAppNumber(connectionId: string, phoneNumber: string): Promise<{
        exists: boolean;
        jid?: string;
        error?: string;
    }> {
        return bridgeRequest({
            method: 'POST',
            path: `/sessions/${connectionId}/validate-number`,
            body: { phoneNumber },
        });
    }

    async getProfilePicture(jid: string): Promise<string | null> {
        try {
            // Use any available connected session
            const result = await bridgeRequest<{ url: string | null }>({
                method: 'GET',
                path: `/sessions/any/profile-picture?jid=${encodeURIComponent(jid)}`,
            });
            return result.url;
        } catch {
            return null;
        }
    }

    async clearFilesystemAuth(connectionId: string): Promise<void> {
        await bridgeRequest({
            method: 'POST',
            path: `/sessions/${connectionId}/clear-auth`,
        });
    }

    /**
     * Get active session count from microservice stats
     */
    async getActiveSessionsCount(): Promise<number> {
        try {
            const stats = await this.getSessionsStats();
            return stats.total;
        } catch {
            return 0;
        }
    }

    /**
     * Check session availability (delegates to status check)
     */
    async checkAvailability(connectionId: string, companyId?: string): Promise<{
        available: boolean;
        status: string;
        details: string;
    }> {
        try {
            const statusData = await this.getSessionStatusAsync(connectionId);
            const isConnected = statusData.status === 'connected';
            return {
                available: isConnected,
                status: statusData.status || 'not_found',
                details: `Session ${connectionId} status: ${statusData.status}, phone: ${statusData.phone || 'unknown'}`,
            };
        } catch {
            return {
                available: false,
                status: 'not_found',
                details: `Could not reach Baileys service for session ${connectionId}`,
            };
        }
    }

    /**
     * Check if filesystem auth exists for a connection
     */
    async hasFilesystemAuth(connectionId: string): Promise<boolean> {
        try {
            const statusData = await this.getSessionStatusAsync(connectionId);
            // If session has a status, auth likely exists
            return statusData.status !== null && statusData.status !== 'needs_qr';
        } catch {
            return false;
        }
    }

    /**
     * Batch check filesystem auth (delegates to batch status)
     */
    async getBatchFilesystemAuth(connectionIds: string[]): Promise<Map<string, boolean>> {
        try {
            const statuses = await this.getBatchSessionStatus(connectionIds);
            const map = new Map<string, boolean>();
            for (const [id, status] of Object.entries(statuses)) {
                map.set(id, status !== null);
            }
            return map;
        } catch {
            return new Map();
        }
    }

    /**
     * Get event emitter - not available via bridge (returns undefined)
     */
    getEventEmitter(_connectionId: string): undefined {
        console.warn('[BaileysBridge] getEventEmitter() not available via bridge. Events come via WebSocket.');
        return undefined;
    }

    /**
     * Get all sessions from the microservice
     */
    async getAllSessions(): Promise<Array<{ id: string; status: string; phone?: string }>> {
        try {
            const health = await bridgeRequest<{
                sessions: { total: number; byStatus: Record<string, number> };
            }>({ method: 'GET', path: '/../health' });
            // Health endpoint doesn't list individual sessions.
            // Return empty until a dedicated endpoint is added.
            return [];
        } catch {
            return [];
        }
    }

    /**
     * Check microservice availability
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${BAILEYS_SERVICE_URL}/health`, {
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Request retroactive message history from Whatsapp device
     */
    async syncHistory(connectionId: string, jid: string): Promise<boolean> {
        try {
            const result = await bridgeRequest<{ success: boolean }>({
                method: 'POST',
                path: `/sessions/${connectionId}/sync-history`,
                body: { jid },
                timeout: 30000,
            });
            return result.success;
        } catch (error) {
            console.error(`[BaileysBridge] ❌ Error syncing history via ${connectionId}:`, error);
            throw error;
        }
    }
}

// Singleton export matching the original `sessionManager` export pattern
export const baileysBridge = new BaileysBridgeClient();
