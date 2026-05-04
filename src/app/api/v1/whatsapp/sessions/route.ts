import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
// ✅ FASE 2.2: Service Layer
import { sessionService } from '@/services/session/session.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();

    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // ✅ FASE 2.2: Usar Service Layer
    const result = await sessionService.createSession(companyId, name.trim());

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create session' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      session: result.session,
    });
  } catch (error) {
    console.error('[API] Error creating Baileys session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const companyId = await getCompanyIdFromSession();

    // ✅ FASE 2.2: Usar Service Layer
    const sessions = await sessionService.listSessions(companyId);

    return NextResponse.json({
      sessions: sessions.map(s => ({
        id: s.id,
        name: s.name,
        status: s.effectiveStatus,
        runtimeStatus: s.runtimeStatus,
        hasAuth: s.hasAuth,
        phone: s.phone,
        lastConnected: s.lastConnected,
        isActive: s.isActive,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('[API] Error fetching Baileys sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
