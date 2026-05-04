import { NextRequest, NextResponse } from 'next/server';
import { baileysBridge as sessionManager } from '@/lib/baileys-bridge-client';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const host = request.headers.get('host') || '';
    if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      return NextResponse.json({ error: 'Internal endpoint only' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { connectionId } = body;

    if (connectionId) {
      const connection = await db.query.connections.findFirst({
        where: eq(connections.id, connectionId),
      });

      if (!connection) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
      }

      const hasAuth = await sessionManager.hasFilesystemAuth(connectionId);
      if (!hasAuth) {
        return NextResponse.json({
          error: 'No saved credentials',
          needsQRCode: true
        }, { status: 400 });
      }

      console.log(`[Internal] Resuming session ${connectionId}...`);
      await sessionManager.deleteSession(connectionId);
      await sessionManager.createSession(connectionId, connection.companyId);

      return NextResponse.json({
        success: true,
        message: `Session ${connectionId} resuming`,
        phone: connection.phone,
      });
    }

    const connectedSessions = await db.query.connections.findMany({
      where: and(
        eq(connections.status, 'connected'),
        eq(connections.connectionType, 'baileys')
      ),
    });

    const results = [];
    for (const conn of connectedSessions) {
      const hasAuth = await sessionManager.hasFilesystemAuth(conn.id);
      const runtimeStatus = sessionManager.getSessionStatus(conn.id);

      if (hasAuth && !runtimeStatus) {
        console.log(`[Internal] Auto-resuming session ${conn.id} (${conn.phone})...`);
        try {
          await sessionManager.deleteSession(conn.id);
          await sessionManager.createSession(conn.id, conn.companyId);
          results.push({
            id: conn.id,
            phone: conn.phone,
            status: 'resumed',
          });
        } catch (error: any) {
          results.push({
            id: conn.id,
            phone: conn.phone,
            status: 'error',
            error: error.message,
          });
        }
      } else if (runtimeStatus) {
        results.push({
          id: conn.id,
          phone: conn.phone,
          status: 'already_active',
          runtimeStatus,
        });
      } else {
        results.push({
          id: conn.id,
          phone: conn.phone,
          status: 'no_auth',
          needsQRCode: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${connectedSessions.length} sessions`,
      sessions: results,
    });
  } catch (error: any) {
    console.error('[Internal] Error resuming sessions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resume sessions' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const connectedSessions = await db.query.connections.findMany({
      where: and(
        eq(connections.status, 'connected'),
        eq(connections.connectionType, 'baileys')
      ),
      columns: {
        id: true,
        phone: true,
        status: true,
        config_name: true,
        lastConnected: true,
      },
    });

    const results = await Promise.all(
      connectedSessions.map(async (conn) => {
        const hasAuth = await sessionManager.hasFilesystemAuth(conn.id);
        const runtimeStatus = sessionManager.getSessionStatus(conn.id);
        return {
          id: conn.id,
          phone: conn.phone,
          name: conn.config_name,
          dbStatus: conn.status,
          hasAuth,
          runtimeStatus: runtimeStatus || 'none',
          needsResume: hasAuth && !runtimeStatus,
        };
      })
    );

    return NextResponse.json({
      sessions: results,
      needsResume: results.filter(r => r.needsResume).length,
    });
  } catch (error: any) {
    console.error('[Internal] Error checking sessions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
