// src/app/api/v1/utm-routing-rules/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { companies, kanbanBoards } from '@/lib/db/schema';
import type { UtmRoutingRule } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { apiCache } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

const ruleSchema = z.object({
  id: z.string(),
  pattern: z.string().min(1),
  isRegex: z.boolean(),
  targetBoardId: z.string().uuid(),
  targetBoardName: z.string(),
  isActive: z.boolean(),
  label: z.string().optional(),
});

/**
 * GET /api/v1/utm-routing-rules
 * Retorna as regras UTM da empresa + lista de todos os funis disponíveis para configuração.
 */
export async function GET(_request: NextRequest) {
  const authResult = await requireCompanyIdOr401();
  if (authResult instanceof NextResponse) return authResult;
  const { companyId } = authResult;

  const [company] = await db
    .select({ utmRoutingRules: companies.utmRoutingRules })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

  const allBoards = await db
    .select({ id: kanbanBoards.id, name: kanbanBoards.name })
    .from(kanbanBoards)
    .where(and(eq(kanbanBoards.companyId, companyId)));

  return NextResponse.json({
    rules: company.utmRoutingRules ?? [],
    availableBoards: allBoards,
  });
}

/**
 * PUT /api/v1/utm-routing-rules
 * Body: { rules: UtmRoutingRule[] }
 * Salva as regras UTM da empresa.
 */
export async function PUT(request: NextRequest) {
  const authResult = await requireCompanyIdOr401();
  if (authResult instanceof NextResponse) return authResult;
  const { companyId } = authResult;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = z.object({ rules: z.array(ruleSchema) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  await db
    .update(companies)
    .set({ utmRoutingRules: parsed.data.rules as UtmRoutingRule[], updatedAt: new Date() })
    .where(eq(companies.id, companyId));

  // Invalidar cache de auditorias UTM desta empresa
  apiCache.invalidatePattern(`utm-audit:${companyId}`);

  console.log(`[UTMRules] Empresa ${companyId}: ${parsed.data.rules.length} regras salvas`);

  return NextResponse.json({ saved: parsed.data.rules.length });
}
