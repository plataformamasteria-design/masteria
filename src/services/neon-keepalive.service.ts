/**
 * Neon Database Keep-Alive Service
 * 
 * Prevents the Neon Free Tier endpoint from suspending due to inactivity
 * by executing a lightweight query every 4 minutes.
 * 
 * Why 4 minutes? Neon suspends after ~5 minutes, so we ping at 4min to be safe.
 */

import { db } from '@/lib/db';

class NeonKeepAliveService {
    private intervalId: NodeJS.Timeout | null = null;
    private readonly PING_INTERVAL = 4 * 60 * 1000; // 4 minutes
    private isRunning = false;
    private consecutiveFailures = 0;
    private readonly MAX_FAILURES = 3;

    /**
     * Start the keep-alive service
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ [Neon Keep-Alive] Service already running');
            return;
        }

        console.log(`🏓 [Neon Keep-Alive] Starting service (ping every 4 minutes)`);

        // Immediate ping on startup
        this.ping();

        // Schedule recurring pings
        this.intervalId = setInterval(() => {
            this.ping();
        }, this.PING_INTERVAL);

        this.isRunning = true;
        console.log('✅ [Neon Keep-Alive] Service started');
    }

    /**
     * Stop the keep-alive service
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.isRunning = false;
            console.log('⏹️ [Neon Keep-Alive] Service stopped');
        }
    }

    /**
     * Execute a lightweight ping query
     */
    private async ping() {
        try {
            const startTime = Date.now();
            await db.execute('SELECT 1 as keepalive');
            const duration = Date.now() - startTime;

            this.consecutiveFailures = 0; // Reset on success
            console.log(`🏓 [Neon Keep-Alive] Ping successful (${duration}ms)`);
        } catch (error: any) {
            this.consecutiveFailures++;
            console.error(`❌ [Neon Keep-Alive] Ping failed (${this.consecutiveFailures}/${this.MAX_FAILURES}):`, error.message);

            // If too many consecutive failures, log a warning
            if (this.consecutiveFailures >= this.MAX_FAILURES) {
                console.error(`🚨 [Neon Keep-Alive] ${this.MAX_FAILURES} consecutive failures - database may be offline`);
            }
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            pingInterval: this.PING_INTERVAL,
            consecutiveFailures: this.consecutiveFailures,
        };
    }
}

// Singleton instance
export const neonKeepAlive = new NeonKeepAliveService();

// Graceful shutdown
process.on('SIGTERM', () => {
    neonKeepAlive.stop();
});

process.on('SIGINT', () => {
    neonKeepAlive.stop();
});
