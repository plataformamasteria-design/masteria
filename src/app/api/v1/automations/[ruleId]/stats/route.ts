import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { automationNodeStats } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth.config';

export async function GET(req: NextRequest, props: { params: Promise<{ ruleId: string }> }) {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ruleId } = await props.params;

    const stats = await db.query.automationNodeStats.findMany({
      where: and(
        eq(automationNodeStats.automationId, ruleId),
        eq(automationNodeStats.companyId, session.user.companyId)
      )
    });

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('[Automations Stats GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
