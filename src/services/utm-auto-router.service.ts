import { db } from '@/lib/db';
import { kanbanLeads, contacts, kanbanBoards, companies } from '@/lib/db/schema';
import type { UtmRoutingRule, KanbanStage } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { moveLeadToStage } from '@/lib/kanban/move-lead-to-stage';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_RULES: UtmRoutingRule[] = [
  { id: 'default-gcr',     pattern: 'evento[- ]?gcr|\\bGCR\\b',               isRegex: true,  targetBoardId: '', targetBoardName: 'FUNIL EVENTO GCR',          isActive: true, label: 'GCR'     },
  { id: 'default-edn',     pattern: 'encontro de neg[oó]cios',                  isRegex: true,  targetBoardId: '', targetBoardName: 'FUNIL EDN',                   isActive: true, label: 'EDN'     },
  { id: 'default-mentoria',pattern: 'mentoria',                                 isRegex: true,  targetBoardId: '', targetBoardName: 'FUNIL MENTORIA',             isActive: true, label: 'MENTORIA'},
  { id: 'default-casais',  pattern: 'casal[- ]?de[- ]?neg[oó]cios|encontro de casais', isRegex: true, targetBoardId: '', targetBoardName: 'FUNIL ENCONTRO DE CASAIS', isActive: true, label: 'CASAIS'},
];

// Helper to extract an array of UTMs in case there are multiple separated by comma
export function extractUtmCampaigns(customFields: unknown): string[] {
  if (!customFields || typeof customFields !== 'object') return [];
  const key = Object.keys(customFields as Record<string, unknown>).find(k =>
    k.toLowerCase().includes('utm_campaign') ||
    k.toLowerCase().includes('utm campaing') ||
    k.toLowerCase().includes('utm campaign')
  );
  if (!key) return [];
  const val = (customFields as Record<string, unknown>)[key];
  if (!val) return [];
  
  // Can be an array if already structured
  if (Array.isArray(val)) {
    return val.map(v => String(v).trim()).filter(Boolean);
  }
  
  // Split by comma in case it's a comma-separated string like "GCR, Mentoria"
  return String(val).split(',').map(v => v.trim()).filter(Boolean);
}

function matchRule(utm: string, rule: UtmRoutingRule): boolean {
  if (!rule.isActive) return false;
  if (rule.isRegex) {
    try { return new RegExp(rule.pattern, 'i').test(utm); } catch { return false; }
  }
  const parts = rule.pattern.split('|').map(p => p.trim()).filter(Boolean);
  return parts.some(p => utm.toLowerCase().includes(p.toLowerCase()));
}

function detectBoardKeywordByName(name: string): string | null {
  const n = name.toUpperCase();
  if (n.includes('GCR'))      return 'GCR';
  if (n.includes('EDN'))      return 'EDN';
  if (n.includes('MENTORIA')) return 'MENTORIA';
  if (n.includes('CASAIS') || n.includes('CASAL')) return 'CASAIS';
  return null;
}

class UtmAutoRouterService {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

  start() {
    if (this.intervalId) {
      console.log('[UtmAutoRouter] ⚠️ Service already running');
      return;
    }

    console.log('[UtmAutoRouter] 🚀 Starting UTM Auto Router service (polling every 15m)');

    // Initial run after 45s delay (let other services start first)
    setTimeout(() => {
      this.processAllCompanies();
      this.intervalId = setInterval(() => {
        this.processAllCompanies();
      }, this.POLL_INTERVAL_MS);
    }, 45000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[UtmAutoRouter] ⏹️ Service stopped');
    }
  }

  private async processAllCompanies() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    console.log('[UtmAutoRouter] 🔄 Starting audit cycle...');

    try {
      // Get all companies
      const allCompanies = await db.select({
        id: companies.id,
        utmRoutingRules: companies.utmRoutingRules
      }).from(companies);

      for (const comp of allCompanies) {
        await this.processCompany(comp);
      }
      console.log('[UtmAutoRouter] ✅ Audit cycle completed');
    } catch (err: any) {
      console.error('[UtmAutoRouter] ❌ Error in audit cycle:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processCompany(company: { id: string, utmRoutingRules: unknown }) {
    try {
      const companyId = company.id;
      
      // Load all boards for company
      const allBoards = await db
        .select({ id: kanbanBoards.id, name: kanbanBoards.name, stages: kanbanBoards.stages })
        .from(kanbanBoards)
        .where(eq(kanbanBoards.companyId, companyId));

      if (allBoards.length === 0) return;

      const boardById = new Map(allBoards.map(b => [b.id, b]));

      // Resolve rules
      const companyRules: UtmRoutingRule[] = ((company.utmRoutingRules as UtmRoutingRule[]) ?? []).filter(r => r.isActive);
      const hasCustomRules = companyRules.length > 0;

      let activeRules: UtmRoutingRule[];
      if (hasCustomRules) {
        activeRules = companyRules;
      } else {
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

      if (activeRules.length === 0) return; // No rules to apply

      // Get all leads
      const allLeads = await db
        .select({
          leadId: kanbanLeads.id,
          boardId: kanbanLeads.boardId,
          stageId: kanbanLeads.stageId,
          contactId: contacts.id,
          contactName: contacts.name,
          contactPhone: contacts.phone,
          customFields: contacts.customFields,
        })
        .from(kanbanLeads)
        .innerJoin(contacts, eq(kanbanLeads.contactId, contacts.id))
        .where(eq(kanbanLeads.companyId, companyId));

      // Group leads by contactId
      const leadsByContact = new Map<string, typeof allLeads>();
      for (const lead of allLeads) {
        if (!leadsByContact.has(lead.contactId)) leadsByContact.set(lead.contactId, []);
        leadsByContact.get(lead.contactId)!.push(lead);
      }

      let totalMoved = 0;
      let totalCreated = 0;

      for (const [contactId, existingLeads] of leadsByContact.entries()) {
        const customFields = existingLeads[0].customFields;
        const utms = extractUtmCampaigns(customFields);
        if (utms.length === 0) continue;

        // Find all target boards from all UTMs
        const targetBoardIds = new Set<string>();
        for (const utm of utms) {
          const matchedRule = activeRules.find(r => matchRule(utm, r));
          if (matchedRule && matchedRule.targetBoardId && boardById.has(matchedRule.targetBoardId)) {
            targetBoardIds.add(matchedRule.targetBoardId);
          }
        }

        if (targetBoardIds.size === 0) continue; // None of the UTMs matched a rule

        // Logic for Multi-Funnel Resolution
        const targetBoardsList = Array.from(targetBoardIds);
        const existingBoardIds = new Set(existingLeads.map(l => l.boardId));
        
        // Boards we still need to place this contact in
        const missingBoards = targetBoardsList.filter(tb => !existingBoardIds.has(tb));
        
        // Leads in boards that are NOT in targetBoardIds (wrong boards)
        const wrongLeads = existingLeads.filter(l => !targetBoardIds.has(l.boardId));

        for (const missingBoardId of missingBoards) {
          const targetBoard = boardById.get(missingBoardId);
          if (!targetBoard) continue;
          
          const stages = (targetBoard.stages as KanbanStage[]) || [];
          if (stages.length === 0) continue;
          
          // Mover existing lead or Create a new one
          if (wrongLeads.length > 0) {
            const leadToMove = wrongLeads.shift()!; // Remove it from wrongLeads so we don't move it again
            
            // Tentar encontrar etapa equivalente (ex: Entrou -> Entrou)
            const currentBoard = boardById.get(leadToMove.boardId);
            const currentStages = (currentBoard?.stages as KanbanStage[]) || [];
            const currentStageObj = currentStages.find(s => s.id === leadToMove.stageId);
            
            let newStageId = stages[0].id; // default to first stage
            if (currentStageObj) {
              const matchingStage = stages.find(s => s.title.toLowerCase().trim() === currentStageObj.title.toLowerCase().trim());
              if (matchingStage) newStageId = matchingStage.id;
            }

            // Atualiza Board e invoca moveLeadToStage para disparar automações e webhooks
            await db.update(kanbanLeads)
                .set({ boardId: missingBoardId })
                .where(eq(kanbanLeads.id, leadToMove.leadId));

            await moveLeadToStage({
                leadId: leadToMove.leadId,
                newStageId: newStageId,
                companyId: companyId
            });

            totalMoved++;
            console.log(`[UtmAutoRouter] Movi lead ${leadToMove.leadId} de ${leadToMove.boardId} para ${missingBoardId}`);
          } else {
            // Se não há leads "errados" sobrando, devemos clonar o lead (criar um novo)
            const newStage = stages[0];
            const [newLead] = await db.insert(kanbanLeads).values({
                id: uuidv4(),
                companyId,
                boardId: missingBoardId,
                stageId: newStage.id,
                contactId: contactId,
                title: existingLeads[0].contactName || 'Lead',
                currentStage: newStage as any,
                lastStageChangeAt: new Date(),
                notes: `Criado via UTM Auto Router (UTM detectada).`
            }).returning();

            // Disparar automações de entrada para o novo lead
            // Simulamos uma movimentação de "undefined" para a primeira etapa
            await moveLeadToStage({
                leadId: newLead.id,
                newStageId: newStage.id,
                companyId: companyId
            });

            totalCreated++;
            console.log(`[UtmAutoRouter] Criei clone do lead para contato ${contactId} no board ${missingBoardId}`);
          }
        }
      }

      if (totalMoved > 0 || totalCreated > 0) {
        console.log(`[UtmAutoRouter] 📊 Resumo p/ ${companyId}: Movidos=${totalMoved}, Criados=${totalCreated}`);
      }

    } catch (err: any) {
      console.error(`[UtmAutoRouter] ❌ Error processing company:`, err.message);
    }
  }
}

export const utmAutoRouterService = new UtmAutoRouterService();
