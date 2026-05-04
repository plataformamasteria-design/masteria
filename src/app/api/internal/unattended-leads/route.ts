import { NextRequest, NextResponse } from 'next/server';
import { 
  detectUnattendedLeads, 
  runRecoveryBatch,
  getUnattendedLeadsSummary 
} from '@/services/unattended-leads-detector.service';

function validateInternalAuth(request: NextRequest): { valid: boolean; error?: string } {
  const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
  
  if (!INTERNAL_SECRET) {
    console.error('[Unattended Leads API] CRITICAL: INTERNAL_API_SECRET not configured');
    return { valid: false, error: 'Server configuration error' };
  }
  
  const authHeader = request.headers.get('x-internal-auth');
  if (!authHeader || authHeader !== INTERNAL_SECRET) {
    return { valid: false, error: 'Unauthorized' };
  }
  
  return { valid: true };
}

export async function GET(request: NextRequest) {
  const auth = validateInternalAuth(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.error === 'Server configuration error' ? 500 : 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || undefined;
    const action = searchParams.get('action') || 'detect';

    if (action === 'summary' && companyId) {
      const summary = await getUnattendedLeadsSummary(companyId);
      return NextResponse.json({
        success: true,
        ...summary,
      });
    }

    const unattendedLeads = await detectUnattendedLeads(companyId);

    return NextResponse.json({
      success: true,
      count: unattendedLeads.length,
      leads: unattendedLeads.map(lead => ({
        ...lead,
        lastUserMessageAt: lead.lastUserMessageAt.toISOString(),
        lastAIMessageAt: lead.lastAIMessageAt?.toISOString() || null,
      })),
    });
  } catch (error: any) {
    console.error('[Unattended Leads API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = validateInternalAuth(request);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: auth.error === 'Server configuration error' ? 500 : 401 });
  }

  try {
    const body = await request.json();
    const { companyId, maxLeads = 10 } = body;

    console.log(`[Unattended Leads API] Starting batch recovery (companyId: ${companyId || 'all'}, maxLeads: ${maxLeads})`);

    const result = await runRecoveryBatch(companyId, maxLeads);

    return NextResponse.json({
      success: true,
      totalUnattended: result.unattendedLeads.length,
      processed: result.processedCount,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('[Unattended Leads API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
