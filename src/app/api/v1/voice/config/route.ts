import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest) {
  try {
    const retellConfigured = !!process.env.RETELL_API_KEY;
    const twilioConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    const openRouterConfigured = !!process.env.OPENROUTER_API_KEY;

    logger.info('Voice config fetched (direct from env)');

    return NextResponse.json({
      success: true,
      data: {
        config: {
          retellApiKey: retellConfigured ? '***configured***' : null,
          twilioAccountSid: twilioConfigured ? '***configured***' : null,
          openRouterApiKey: openRouterConfigured ? '***configured***' : null,
        },
        status: {
          retell: {
            configured: retellConfigured,
            status: retellConfigured ? 'connected' : 'not_tested',
          },
          twilio: {
            configured: twilioConfigured,
            status: twilioConfigured ? 'connected' : 'not_tested',
          },
          openrouter: {
            configured: openRouterConfigured,
            status: openRouterConfigured ? 'connected' : 'not_tested',
          },
        },
        note: 'Configuration is read directly from environment variables. No external API dependency.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching voice config', { error });
    return NextResponse.json(
      { error: 'Falha ao buscar configuração de voz', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
