/**
 * GET/POST /api/marketing/leadgen-config
 * Gerencia a configuração de roteamento de formulários Meta para o Kanban.
 *
 * Config armazenada em: marketing_credentials.credentials.leadgen_config (JSONB)
 * Estrutura:
 *   { defaultBoardId, defaultStageId, formMappings: [{formId, formName, boardId, stageId}] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { marketingCredentials } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { eq, and } from 'drizzle-orm';
import type { LeadgenRoutingConfig } from '@/lib/meta-leadgen-kanban';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketing/leadgen-config
 * Retorna a configuração atual de roteamento de formulários.
 */
export async function GET() {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const [cred] = await db.select({
      credentials: marketingCredentials.credentials,
    })
      .from(marketingCredentials)
      .where(and(
        eq(marketingCredentials.companyId, companyId),
        eq(marketingCredentials.platform, 'meta')
      ))
      .limit(1);

    if (!cred?.credentials) {
      return NextResponse.json({ config: null, connected: false });
    }

    // external-api: untyped — Meta OAuth credentials stored as JSONB
    const credentials = cred.credentials as Record<string, any>;
    const config: LeadgenRoutingConfig = credentials.leadgen_config || {
      defaultBoardId: null,
      defaultStageId: null,
      formMappings: [],
    };

    return NextResponse.json({ config, connected: true });
  } catch (err: any) {
    console.error('[api/marketing/leadgen-config GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/marketing/leadgen-config
 * Salva a configuração de roteamento de formulários.
 * Body: LeadgenRoutingConfig
 */
export async function POST(req: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const config: LeadgenRoutingConfig = {
      defaultBoardId: body.defaultBoardId || null,
      defaultStageId: body.defaultStageId || null,
      formMappings: Array.isArray(body.formMappings) ? body.formMappings : [],
    };

    // Validar estrutura mínima
    for (const mapping of (config.formMappings || [])) {
      if (!mapping.formId || !mapping.boardId || !mapping.stageId) {
        return NextResponse.json({
          error: 'Cada mapeamento de formulário precisa de formId, boardId e stageId'
        }, { status: 400 });
      }
    }

    // Atualizar apenas o campo leadgen_config dentro de credentials (merge)
    const [existing] = await db.select({ credentials: marketingCredentials.credentials })
      .from(marketingCredentials)
      .where(and(
        eq(marketingCredentials.companyId, companyId),
        eq(marketingCredentials.platform, 'meta')
      ))
      .limit(1);

    if (!existing) {
      return NextResponse.json({
        error: 'Conta Meta não conectada. Conecte primeiro em Integrações.'
      }, { status: 404 });
    }

    // Mescla: mantém todos os campos de credentials, atualiza apenas leadgen_config
    const mergedCredentials = {
      ...(existing.credentials || {}),
      leadgen_config: config,
    };

    await db.update(marketingCredentials)
      .set({ credentials: mergedCredentials })
      .where(and(
        eq(marketingCredentials.companyId, companyId),
        eq(marketingCredentials.platform, 'meta')
      ));

    console.log(`[leadgen-config] ✅ Config salva para empresa ${companyId}:`, JSON.stringify(config, null, 2));

    return NextResponse.json({ ok: true, config });
  } catch (err: any) {
    console.error('[api/marketing/leadgen-config POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
