import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
// ✅ FASE 2.2: Service Layer
import { sessionService } from '@/services/session/session.service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyIdFromSession();

    // ✅ FASE 2.2: Usar Service Layer
    const session = await sessionService.getSession(id, companyId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      name: session.name,
      status: session.effectiveStatus,
      phone: session.phone,
      lastConnected: session.lastConnected,
      isActive: session.isActive,
    });
  } catch (error) {
    console.error('[API] Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyIdFromSession();

    // ✅ FASE 2.2: Usar Service Layer
    const result = await sessionService.deleteSession(id, companyId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: result.message === 'Session not found' ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error('[API] Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const companyId = await getCompanyIdFromSession();

    const body = await request.json();
    const { action } = body;

    if (action === 'reconnect') {
      // ✅ FASE 2.2: Usar Service Layer
      const result = await sessionService.reconnectSession(id, companyId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: result.error === 'Session not found' ? 404 : 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Session reconnecting',
      });
    }

    if (action === 'resume') {
      // ✅ FASE 2.2: Usar Service Layer
      const result = await sessionService.resumeSession(id, companyId);

      if (!result.success) {
        return NextResponse.json(
          { 
            error: result.error,
            needsQRCode: result.error?.includes('No saved credentials'),
          },
          { status: result.error?.includes('No saved credentials') ? 400 : 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Session resuming with existing credentials',
      });
    }

    if (action === 'disconnect') {
      // ✅ FASE 2.2: Usar Service Layer
      const result = await sessionService.disconnectSession(id, companyId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Session disconnected',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[API] Error reconnecting session:', error);
    return NextResponse.json(
      { error: 'Failed to reconnect session' },
      { status: 500 }
    );
  }
}
