// src/app/api/v1/leads/utm-audit/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { kanbanLeads, contacts, kanbanBoards, companies } from '@/lib/db/schema';
import type { UtmRoutingRule, KanbanStage } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';

export const dynamic = 'force-dynamic';

// ─── Regras padrão embutidas (usadas quando a empresa ainda não configurou) ───
const DEFAULT_RULES: UtmRoutingRule[] = [
  { id: 'default-gcr',     pattern: 'evento[- ]?gcr|\\bGCR\\b',               isRegex: true,  targetBoardId: '', targetBoardName: 'FUNIL EVENTO GCR',          isActive: true, label: 'GCR'     },
  { id: 'default-edn',     pattern: 'encontro de neg[oó]cios',                  isRegex: true,  targetBoardId: '', targetBoardName: 'FUNIL EDN',                   isActive: true, label: 'EDN'     },
  { id: 'default-mentoria',pattern: 'mentoria',                                 isRegex: true,  targetBoardId: '', targetBoardName: 'FUNIL MENTORIA',             isActive: true, label: 'MENTORIA'},
  { id: 'default-casais',  pattern: 'casal[- ]?de[- ]?neg[oó]cios|encontro de casais', isRegex: true, targetBoardId: '', targetBoardName: 'FUNIL ENCONTRO DE CASAIS', isActive: true, label: 'CASAIS'},
];

// ─── Extração de utm_campaign ─────────────────────────────────────────────────
function extractUtmCampaign(customFields: unknown): string | null {
  if (!customFields || typeof customFields !== 'object') return null;
  const key = Object.keys(customFields as Record<string, unknown>).find(k =>
    k.toLowerCase().includes('utm_campaign') ||
    k.toLowerCase().includes('utm campaing') ||
    k.toLowerCase().includes('utm campaign')
  );
  if (!key) return null;
  const val = (customFields as Record<string, unknown>)[key];
  return val ? String(val).trim() : null;
}

// ─── Match UTM contra uma regra ───────────────────────────────────────────────
function matchRule(utm: string, rule: UtmRoutingRule): boolean {
  if (!rule.isActive) return false;
  if (rule.isRegex) {
    try { return new RegExp(rule.pattern, 'i').test(utm); } catch { return false; }
  }
  // Suporta múltiplos padrões separados por | mesmo sem isRegex
  const parts = rule.pattern.split('|').map(p => p.trim()).filter(Boolean);
  return parts.some(p => utm.toLowerCase().includes(p.toLowerCase()));
}

// ─── Detecta keyword do board pelo NOME (separado do matching UTM) ────────────
// Usado apenas para identificar qual é o "funil atual" pelo seu nome
function detectBoardKeywordByName(name: string): string | null {
  const n = name.toUpperCase();
  if (n.includes('GCR'))      return 'GCR';
  if (n.includes('EDN'))      return 'EDN';
  if (n.includes('MENTORIA')) return 'MENTORIA';
  if (n.includes('CASAIS') || n.includes('CASAL')) return 'CASAIS';
  return null;
}

// ─── Encontra a etapa de mesmo título no funil destino ───────────────────────
function findMatchingStage(sourceStageId: string, sourceStages: KanbanStage[], targetStages: KanbanStage[]): KanbanStage | null {
  const sourceStage = sourceStages.find(s => s.id === sourceStageId);
  if (!sourceStage) return null;
  return targetStages.find(s =>
    s.title.toLowerCase().trim() === sourceStage.title.toLowerCase().trim()
  ) ?? null;
}

/**
 * GET /api/v1/leads/utm-audit?boardId=<id>
 *
 * Retorna leads cujo utm_campaign indica um funil diferente do atual.
 * Para cada lead inclui:
 * - currentStageName: nome da etapa atual
 * - suggestedStageId: id da etapa equivalente no destino (null se não existe)
 * - suggestedStageOptions: lista de etapas do funil destino (para seleção manual)
 */
export async function GET(request: NextRequest) {
  const authResult = await requireCompanyIdOr401();
  if (authResult instanceof NextResponse) return authResult;
  const { companyId } = authResult;

  const { searchParams } = new URL(request.url);
  const boardId = searchParams.get('boardId');
  if (!boardId) return NextResponse.json({ error: 'boardId obrigatório' }, { status: 400 });

  // Carregar board atual + regras da empresa em paralelo
  const [currentBoard] = await db
    .select({ id: kanbanBoards.id, name: kanbanBoards.name, stages: kanbanBoards.stages })
    .from(kanbanBoards)
    .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.companyId, companyId)));

  if (!currentBoard) return NextResponse.json({ error: 'Funil não encontrado' }, { status: 404 });

  const [company] = await db
    .select({ utmRoutingRules: companies.utmRoutingRules })
    .from(companies)
    .where(eq(companies.id, companyId));

  // Usar regras da empresa; se vazias, usar defaults
  const companyRules: UtmRoutingRule[] = (company?.utmRoutingRules ?? []).filter(r => r.isActive);
  const hasCustomRules = companyRules.length > 0;

  // Buscar todos os boards para resolver targetBoardId nos defaults
  const allBoards = await db
    .select({ id: kanbanBoards.id, name: kanbanBoards.name, stages: kanbanBoards.stages })
    .from(kanbanBoards)
    .where(eq(kanbanBoards.companyId, companyId));

  // Construir mapa id → board para acesso rápido
  const boardById = new Map(allBoards.map(b => [b.id, b]));

  // Resolver regras: se são defaults, preencher targetBoardId pelo nome do board
  let activeRules: UtmRoutingRule[];
  if (hasCustomRules) {
    activeRules = companyRules;
  } else {
    // Mapa nome parcial → board id para defaults
    const boardByKeyword = new Map<string, string>();
    for (const b of allBoards) {
      const kw = detectBoardKeywordByName(b.name);
      if (kw) boardByKeyword.set(kw, b.id);
    }
    activeRules = DEFAULT_RULES.map(r => ({
      ...r,
      targetBoardId: r.label ? (boardByKeyword.get(r.label) ?? '') : '',
    })).filter(r => r.targetBoardId !== '');
  }

  // Detectar keyword do funil atual (para excluir leads que "já estão corretos")
  const currentKeyword = detectBoardKeywordByName(currentBoard.name);
  const currentStages = (currentBoard.stages as KanbanStage[]) || [];

  // Buscar todos os leads do board com customFields
  const leadsRaw = await db
    .select({
      leadId: kanbanLeads.id,
      stageId: kanbanLeads.stageId,
      contactId: contacts.id,
      contactName: contacts.name,
      contactPhone: contacts.phone,
      customFields: contacts.customFields,
    })
    .from(kanbanLeads)
    .innerJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
    .where(and(eq(kanbanLeads.boardId, boardId), eq(kanbanLeads.companyId, companyId)));

  type MismatchItem = {
    leadId: string;
    stageId: string;
    currentStageName: string;
    contactId: string;
    contactName: string;
    contactPhone: string;
    utmCampaign: string;
    matchedRuleId: string;
    matchedRuleLabel: string;
    suggestedBoardId: string;
    suggestedBoardName: string;
    suggestedStageId: string | null;      // null = não encontrou etapa equivalente
    suggestedStageName: string | null;
    suggestedStageOptions: { id: string; title: string }[];
  };

  const mismatches: MismatchItem[] = [];
  let totalWithUtm = 0;

  for (const row of leadsRaw) {
    let cf = row.customFields as unknown;
    if (typeof cf === 'string') { try { cf = JSON.parse(cf); } catch { cf = {}; } }

    const utm = extractUtmCampaign(cf);
    if (!utm) continue;
    totalWithUtm++;

    // Encontrar primeira regra que faz match
    const matchedRule = activeRules.find(r => matchRule(utm, r));
    if (!matchedRule) continue;

    // Verificar se a regra aponta para o próprio board atual
    if (matchedRule.targetBoardId === boardId) continue;

    // Verificar também pelo keyword do funil (para defaults sem boardId correto)
    if (!matchedRule.targetBoardId) continue;
    const targetBoard = boardById.get(matchedRule.targetBoardId);
    if (!targetBoard) continue;

    // Evitar falsos positivos: se o funil atual é o destino
    if (targetBoard.id === boardId) continue;

    const targetStages = (targetBoard.stages as KanbanStage[]) || [];

    // Buscar etapa de mesmo nome no funil destino
    const matchingStage = findMatchingStage(row.stageId, currentStages, targetStages);
    const currentStage = currentStages.find(s => s.id === row.stageId);

    mismatches.push({
      leadId: row.leadId,
      stageId: row.stageId,
      currentStageName: currentStage?.title ?? row.stageId,
      contactId: row.contactId,
      contactName: row.contactName || '',
      contactPhone: row.contactPhone || '',
      utmCampaign: utm,
      matchedRuleId: matchedRule.id,
      matchedRuleLabel: matchedRule.label ?? matchedRule.pattern,
      suggestedBoardId: targetBoard.id,
      suggestedBoardName: targetBoard.name,
      suggestedStageId: matchingStage?.id ?? null,
      suggestedStageName: matchingStage?.title ?? null,
      suggestedStageOptions: targetStages
        .filter(s => s.type !== 'LOSS')
        .map(s => ({ id: s.id, title: s.title })),
    });
  }

  return NextResponse.json({
    boardId,
    boardName: currentBoard.name,
    totalLeads: leadsRaw.length,
    totalWithUtm,
    mismatchCount: mismatches.length,
    mismatches,
    usingDefaultRules: !hasCustomRules,
  });
}
