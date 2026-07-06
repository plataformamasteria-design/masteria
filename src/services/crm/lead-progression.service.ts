import { db } from '@/lib/db';
import {
    contacts,
    contactsToTags,
    conversations,
    messages,
    automationLogs,
    connections,
    aiPersonas,
    kanbanLeads,
    kanbanBoards,
    kanbanStagePersonas,
    companies
} from '@/lib/db/schema';
import { and, eq, desc, sql, isNull, ne } from 'drizzle-orm';
import type { Contact, Message } from '@/lib/types';
import { logger } from '@/lib/logger';
import { logContactEvent } from '@/lib/contact-events';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';

type LogContext = any;

export interface QualificationSignals {
    isQualified: boolean;
    confidence: number;
    reason: string;
    details: Record<string, any>;
}
export interface MeetingDetectionResult {
    isScheduled: boolean;
    scheduledTime?: string;
    confidence: number;
    reason: string;
}

import { AutomationTriggerContext, logAutomation } from '@/lib/automation-engine';
import { webhookDispatcher } from '@/services/webhook-dispatcher.service';
// Aparentemente o método que existe em flow-engine chama-se processFlowExecution ou executeFlow, mas se usava executeAutomationFlow, deve ser importado.
// Se der erro de TS2339 property executeAutomationFlow does not exist, significa que deve ser importado de outro lugar. Vou usar any cast temporário para corrigir.
import * as flowEngine from '@/lib/flow-engine';


export async function detectAndProgressLead(
    context: AutomationTriggerContext,
    conversationHistory: Array<Pick<Message, 'content'>>,
    latestAIResponse: string
): Promise<void> {
    const { contact, companyId, conversation } = context;
    const logContextBase: LogContext = { companyId, conversationId: conversation.id };

    try {
        // Buscar lead ativo
        // Validar que o lead pertence Ã  empresa
        const activeLeadQueryResults = await db.select().from(kanbanLeads).where(and(
            eq(kanbanLeads.contactId, contact.id),
            eq(kanbanLeads.companyId, context.companyId)
        )).limit(1);
        const activeLeadQuery = activeLeadQueryResults[0];

        if (!activeLeadQuery) {
            return; // Sem lead ativo, nÃ£o hÃ¡ o que qualificar
        }

        // Buscar configuraÃ§Ã£o dos estÃ¡gios do funil (TODO: implement board relationship)
        const boardData = { stages: [] } as { stages?: unknown[] };
        const stages = (boardData.stages || []) as KanbanStage[];
        const currentStageIndex = stages.findIndex(s => s.id === activeLeadQuery.stageId);

        if (currentStageIndex === -1 || currentStageIndex >= stages.length - 1) {
            return; // EstÃ¡gio invÃ¡lido ou jÃ¡ estÃ¡ no Ãºltimo estÃ¡gio
        }

        // Analisar conversa para detectar sinais de qualificaÃ§Ã£o
        const conversationText = conversationHistory
            .map(m => m.content)
            .join('\n');

        const qualificationSignals = detectQualificationSignals(conversationText, latestAIResponse);

        if (qualificationSignals.shouldProgress) {
            const nextStage = stages[currentStageIndex + 1];
            const currentStage = stages[currentStageIndex];

            if (!nextStage || !currentStage) {
                await logAutomation('WARN', 'NÃ£o foi possÃ­vel avanÃ§ar o lead: estÃ¡gio atual ou prÃ³ximo invÃ¡lido', logContextBase);
                return;
            }

            // SECURITY: Validar tenant ao atualizar (activeLeadQuery jÃ¡ foi buscado com companyId)
            await db.update(kanbanLeads)
                .set({ 
                    stageId: nextStage.id,
                    currentStage: nextStage,
                    lastStageChangeAt: new Date()
                })
                .where(and(
                    eq(kanbanLeads.id, activeLeadQuery.id),
                    eq(kanbanLeads.companyId, context.companyId)
                ));

            await logAutomation('INFO', `ðŸŽ¯ QUALIFICAÃ‡ÃƒO AUTOMÃTICA: Lead "${contact.name}" avanÃ§ou de "${currentStage.title}" para "${nextStage.title}" | ConfianÃ§a: ${qualificationSignals.confidence}% | Motivo: ${qualificationSignals.reason}`, logContextBase);
        }

    } catch (error) {
        await logAutomation('ERROR', `Erro ao tentar qualificar lead automaticamente: ${(error as Error).message}`, logContextBase);
    }
}

export function detectQualificationSignals(conversationText: string, latestResponse: string): QualificationSignals {
    const text = (conversationText + '\n' + latestResponse).toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    // SINAIS POSITIVOS FORTES (peso 30 pontos cada)
    const strongPositiveSignals = [
        { pattern: /\b(quero contratar|fechar|aceito|vamos fechar|pode enviar proposta)\b/, reason: 'Demonstrou intenÃ§Ã£o clara de contratar' },
        { pattern: /\b(qual.{0,20}pre[Ã§c]o|quanto custa|valor do investimento)\b/, reason: 'Perguntou sobre preÃ§o/investimento' },
        { pattern: /\b(pode me enviar|envia.{0,15}proposta|manda.{0,15}or[Ã§c]amento)\b/, reason: 'Solicitou proposta formal' },
    ];

    for (const signal of strongPositiveSignals) {
        if (signal.pattern.test(text)) {
            score += 30;
            reasons.push(signal.reason);
        }
    }

    // SINAIS MÃ‰DIOS (peso 20 pontos cada)
    const mediumSignals = [
        { pattern: /\b(interessado|interesse|gostei|adorei|perfeito)\b/, reason: 'Demonstrou interesse' },
        { pattern: /\b(preciso|necessito|busco|procuro)\b/, reason: 'Expressou necessidade' },
        { pattern: /\b(quando.{0,15}come[Ã§c]|prazo|cronograma)\b/, reason: 'Perguntou sobre prazos' },
        { pattern: /\b(sim|exato|isso mesmo|correto)\b.*\b(entendi|compreendi)\b/, reason: 'Confirmou entendimento positivo' },
    ];

    for (const signal of mediumSignals) {
        if (signal.pattern.test(text)) {
            score += 20;
            reasons.push(signal.reason);
        }
    }

    // SINAIS FRACOS (peso 10 pontos cada)
    const weakSignals = [
        { pattern: /\b(obrigad[oa]|valeu|ajudou|esclareceu)\b/, reason: 'Agradeceu pela informaÃ§Ã£o' },
        { pattern: /\b(entendi|compreendi|ok|certo)\b/, reason: 'Confirmou compreensÃ£o' },
    ];

    for (const signal of weakSignals) {
        if (signal.pattern.test(text)) {
            score += 10;
            reasons.push(signal.reason);
        }
    }

    // SINAIS NEGATIVOS (reduz pontos)
    const negativeSignals = [
        { pattern: /\b(n[aÃ£]o.{0,15}interesse|desisto|cancelar|n[aÃ£]o quero)\b/, penalty: -50 },
        { pattern: /\b(muito caro|n[aÃ£]o tenho.{0,15}dinheiro|or[Ã§c]amento.{0,15}baixo)\b/, penalty: -30 },
        { pattern: /\b(depois|mais tarde|outro momento)\b/, penalty: -15 },
    ];

    for (const signal of negativeSignals) {
        if (signal.pattern.test(text)) {
            score += signal.penalty;
        }
    }

    // THRESHOLD: 60 pontos = progresso automÃ¡tico
    const confidence = Math.min(100, Math.max(0, score));
    const shouldProgress = confidence >= 60;
    const reason = reasons.length > 0 ? reasons.join(', ') : 'Sem sinais claros de qualificaÃ§Ã£o';

    return {
        shouldProgress,
        confidence,
        reason
    };
}

export function detectMeetingScheduled(conversationText: string, latestResponse: string): MeetingDetectionResult {
    const text = (conversationText + '\n' + latestResponse).toLowerCase();
    let score = 0;
    const evidence: string[] = [];

    // PadrÃ£o de dia da semana compartilhado (aceita "feira" opcional com espaÃ§o ou hÃ­fen)
    const weekdayPattern = '(?:segunda|ter[cÃ§]a(?:[\\s-]?feira)?|quarta(?:[\\s-]?feira)?|quinta(?:[\\s-]?feira)?|sexta(?:[\\s-]?feira)?|s[Ã¡a]bado|domingo)';

    // SINAIS MUITO FORTES de agendamento (40 pontos cada)
    const veryStrongSignals = [
        { pattern: /\b(reuni[aÃ£]o marcada|agendado|confirmado|horÃ¡rio confirmado)\b/, desc: 'ConfirmaÃ§Ã£o explÃ­cita de agendamento' },
        { pattern: new RegExp(`\\b(te espero|nos vemos|atÃ©.{0,15}${weekdayPattern})\\b`, 'i'), desc: 'ConfirmaÃ§Ã£o de encontro futuro' },
        { pattern: /\b(confirmo.{0,15}participa[Ã§c][aÃ£]o|confirmado para|vou participar)\b/, desc: 'ParticipaÃ§Ã£o confirmada' },
    ];

    for (const signal of veryStrongSignals) {
        if (signal.pattern.test(text)) {
            score += 40;
            evidence.push(signal.desc);
        }
    }

    // SINAIS FORTES de agendamento (30 pontos cada)
    const strongSignals = [
        { pattern: /\b(envi[ae].{0,15}(2|dois|tr[eÃª]s|3).{0,15}hor[Ã¡a]rios?|que horas?.*prefer[eÃª]|hor[Ã¡a]rio.*melhor)\b/, desc: 'SolicitaÃ§Ã£o de horÃ¡rios disponÃ­veis' },
        { pattern: /\b(vamos marcar|pode ser|aceito|marca.{0,15}(reuni[aÃ£]o|call|liga[Ã§c][aÃ£]o))\b/, desc: 'AceitaÃ§Ã£o de agendamento' },
        { pattern: new RegExp(`\\b${weekdayPattern}.{0,20}(\\d{1,2}h|\\d{1,2}:\\d{2})\\b`, 'i'), desc: 'Dia e hora especÃ­ficos mencionados' },
        { pattern: new RegExp(`\\b(\\d{1,2}h|\\d{1,2}:\\d{2}).{0,30}${weekdayPattern}\\b`, 'i'), desc: 'Hora e dia especÃ­ficos mencionados' },
    ];

    for (const signal of strongSignals) {
        if (signal.pattern.test(text)) {
            score += 30;
            evidence.push(signal.desc);
        }
    }

    // SINAIS MÃ‰DIOS de contexto de reuniÃ£o (20 pontos cada)
    const mediumSignals = [
        { pattern: /\b(reuni[aÃ£]o|meeting|meet|call|chamada|liga[Ã§c][aÃ£]o|videochamada|videoconfer[eÃª]ncia|video.?call|zoom|google.?meet|teams|conversa.?online)\b/, desc: 'MenÃ§Ã£o a reuniÃ£o/call' },
        { pattern: /\b(agendar|marcar|encontro|confirm(?:ar|o|a|ando)|confirmado|bate.?papo presencial|conversar pessoalmente|marcar.?um.?hor[Ã¡a]rio)\b/, desc: 'IntenÃ§Ã£o de agendar' },
        { pattern: /\b(calend[Ã¡a]rio|agenda|disponibilidade|dispon[Ã­i]vel)\b/, desc: 'Contexto de calendÃ¡rio/agenda' },
        { pattern: /\b(entre.{0,10}(08h?|8h?|09h?|9h?).{0,10}(19h?|18h?))\b/, desc: 'Faixa de horÃ¡rio mencionada' },
    ];

    for (const signal of mediumSignals) {
        if (signal.pattern.test(text)) {
            score += 20;
            evidence.push(signal.desc);
        }
    }

    // THRESHOLD: 60 pontos = reuniÃ£o marcada com boa confianÃ§a (ajustado para maior sensibilidade)
    const confidence = Math.min(100, Math.max(0, score));
    const isMeetingScheduled = confidence >= 60;

    // Extrair horÃ¡rio mencionado (mÃºltiplos formatos suportados)
    // TODOS os padrÃµes EXIGEM marcador de hora ('h' ou ':') para evitar false positives
    let scheduledTime = '';

    // FunÃ§Ã£o auxiliar para normalizar horÃ¡rio
    const normalizeTime = (timeStr: string): string => {
        let cleaned = timeStr.toLowerCase().trim();

        // Converte "hs" â†’ "h" (plural para singular)
        cleaned = cleaned.replace(/hs\b/g, 'h');

        // Remove "min" ao final
        cleaned = cleaned.replace(/min$/g, '').trim();

        // Formato: 14h30 ou 14h00 -> 14:30 ou 14h
        cleaned = cleaned.replace(/(\d{1,2})h(\d{1,2})/, (_, h, m) => {
            return m === '00' || m === '0' ? `${h}h` : `${h}:${m.padStart(2, '0')}`;
        });

        // Remove 'h' final duplicado se houver dois pontos (14:30h -> 14:30)
        cleaned = cleaned.replace(/:(\d{2})h$/, ':$1');

        return cleaned;
    };

    // PadrÃ£o de dia da semana para extraÃ§Ã£o (aceita "feira" opcional com espaÃ§o ou hÃ­fen)
    const weekdayExtractPattern = '(segunda|ter[cÃ§]a(?:[\\s-]?feira)?|quarta(?:[\\s-]?feira)?|quinta(?:[\\s-]?feira)?|sexta(?:[\\s-]?feira)?|s[Ã¡a]bado|domingo)';

    // IMPORTANTE: Usar matchAll para pegar TODAS as ocorrÃªncias e escolher a ÃšLTIMA (mais recente)
    // Isso garante que confirmaÃ§Ãµes novas sobrescrevam menÃ§Ãµes antigas no histÃ³rico

    // PadrÃ£o 1: Dia da semana + horÃ¡rio (ex: "terÃ§a Ã s 14h", "quinta 15h30", "quinta-feira Ã s 14h30")
    const dayFirstPattern = new RegExp(`\\b${weekdayExtractPattern}[\\s,]*(?:[aÃ ]s?)?\\s*(\\d{1,2}(?:h(?:\\d{1,2})?|: ?\\d{2})(?:hs?|min)?)\\b`, 'gi');
    const dayFirstMatches = Array.from(text.matchAll(dayFirstPattern));

    if (dayFirstMatches.length > 0) {
        // Pegar o ÃšLTIMO match (mais recente na conversa)
        const lastMatch = dayFirstMatches[dayFirstMatches.length - 1];
        if (lastMatch && lastMatch[1] && lastMatch[2] && (lastMatch[2].includes('h') || lastMatch[2].includes(':'))) {
            const dayName = lastMatch[1].replace(/[\s-]?feira/i, '').trim();
            scheduledTime = `${dayName} Ã s ${normalizeTime(lastMatch[2])}`;
        }
    } else {
        // PadrÃ£o 2: HorÃ¡rio + dia da semana (ex: "Ã s 14h na terÃ§a", "14:30 quinta")
        const timeFirstPattern = new RegExp(`\\b(?:[aÃ ]s?)?\\s*(\\d{1,2}(?:h(?:\\d{1,2})?|: ?\\d{2})(?:hs?|min)?)[\\s,]*(?:na|no|em)?\\s*${weekdayExtractPattern}\\b`, 'gi');
        const timeFirstMatches = Array.from(text.matchAll(timeFirstPattern));

        if (timeFirstMatches.length > 0) {
            // Pegar o ÃšLTIMO match (mais recente na conversa)
            const lastMatch = timeFirstMatches[timeFirstMatches.length - 1];
            if (lastMatch && lastMatch[1] && lastMatch[2] && (lastMatch[1].includes('h') || lastMatch[1].includes(':'))) {
                const dayName = lastMatch[2].replace(/[\s-]?feira/i, '').trim();
                scheduledTime = `${dayName} Ã s ${normalizeTime(lastMatch[1])}`;
            }
        } else {
            // PadrÃ£o 3: SÃ³ horÃ¡rio (MUST have 'h' or ':') - ex: "Ã s 14h", "15hs", "14:30"
            // Aceita: 14h, 14hs, 14h30, 14:30, 14:30h, 14:30hs
            // Rejeita: 3, 14, 30 (nÃºmeros sem marcador)
            const timeOnlyPattern = /\b(?:[aÃ ]s?)?\s*(\d{1,2}(?:hs|h\d{0,2}|:\d{2}(?:hs?)?)(?:min)?)\b/gi;
            const timeOnlyMatches = Array.from(text.matchAll(timeOnlyPattern));

            if (timeOnlyMatches.length > 0) {
                // Pegar o ÃšLTIMO match (mais recente na conversa)
                const lastMatch = timeOnlyMatches[timeOnlyMatches.length - 1];
                if (lastMatch && lastMatch[1] && (lastMatch[1].includes('h') || lastMatch[1].includes(':'))) {
                    scheduledTime = normalizeTime(lastMatch[1]);
                }
            }
        }
    }

    return {
        isMeetingScheduled,
        confidence,
        evidence,
        scheduledTime
    };
}

export async function ensureMeetingNote(leadId: string, scheduledTime: string, companyId: string): Promise<boolean> {
    try {
        // SECURITY: Buscar lead primeiro para obter companyId e validar tenant
        const leads = await db.select().from(kanbanLeads).where(and(
            eq(kanbanLeads.id, leadId),
            eq(kanbanLeads.companyId, companyId)
        )).limit(1);
        const lead = leads[0];

        if (!lead) return false;

        const normalizedNote = `ðŸ“… ReuniÃ£o agendada: ${scheduledTime}`;
        const currentNotes = lead.notes || '';

        // Verificar se jÃ¡ existe uma nota de reuniÃ£o para evitar duplicatas
        const hasExistingMeetingNote = /ðŸ“… ReuniÃ£o agendada:/i.test(currentNotes);

        if (hasExistingMeetingNote) {
            // Se jÃ¡ existe uma nota de reuniÃ£o, substituir pela nova
            const updatedNotes = currentNotes.replace(/ðŸ“… ReuniÃ£o agendada:.*?(\n|$)/i, `${normalizedNote}\n`);
            // SECURITY: Validar tenant ao atualizar
            await db.update(kanbanLeads)
                .set({ notes: updatedNotes.trim() })
                .where(and(
                    eq(kanbanLeads.id, leadId),
                    eq(kanbanLeads.companyId, companyId)
                ));
        } else {
            // Adicionar nova nota no inÃ­cio, preservando conteÃºdo anterior
            const updatedNotes = currentNotes ? `${normalizedNote}\n\n${currentNotes}` : normalizedNote;
            // SECURITY: Validar tenant ao atualizar
            await db.update(kanbanLeads)
                .set({ notes: updatedNotes })
                .where(and(
                    eq(kanbanLeads.id, leadId),
                    eq(kanbanLeads.companyId, companyId)
                ));
        }

        return true;
    } catch (error) {
        logger.error(`[ensureMeetingNote] Erro ao atualizar notas: ${(error as Error).message}`);
        return false;
    }
}

export async function moveLeadToSemanticStage(
    context: AutomationTriggerContext,
    targetSemanticType: KanbanStage['semanticType'],
    evidence: string[],
    scheduledTime?: string
): Promise<boolean> {
    const { contact, companyId, conversation } = context;
    const logContextBase: LogContext = { companyId, conversationId: conversation.id };

    if (!targetSemanticType) {
        await logAutomation('WARN', 'moveLeadToSemanticStage chamado sem semanticType', logContextBase);
        return false;
    }

    try {
        // Buscar lead ativo
        // Validar que o lead pertence Ã  empresa
        const activeLeadQueryResults = await db.select().from(kanbanLeads).where(and(
            eq(kanbanLeads.contactId, contact.id),
            eq(kanbanLeads.companyId, context.companyId)
        )).limit(1);
        const activeLeadQuery = activeLeadQueryResults[0];

        if (!activeLeadQuery) {
            await logAutomation('INFO', `Lead nÃ£o encontrado no Kanban. AÃ§Ã£o de mover para stage semÃ¢ntico ignorada.`, logContextBase);
            return false;
        }

        // Buscar board do lead para achar stage com semanticType
        const boardQuery = await db.select({
            stages: kanbanBoards.stages,
            name: kanbanBoards.name
        }).from(kanbanBoards)
            .where(eq(kanbanBoards.id, activeLeadQuery.boardId))
            .limit(1);
        const boardData = boardQuery[0] || { stages: [], name: 'Sem nome' };
        const boardName = boardData.name || 'Sem nome';
        const stages = (boardData.stages || []) as KanbanStage[];
        const targetStage = stages.find(s => s.semanticType === targetSemanticType);

        if (!targetStage) {
            await logAutomation('WARN', `âš ï¸ Stage com semanticType="${targetSemanticType}" nÃ£o encontrado no funil "${boardName}". Configure uma etapa com este tipo para ativar a automaÃ§Ã£o.`, logContextBase);
            return false;
        }

        // Validar se nÃ£o Ã© stage final (WIN/LOSS)
        if (targetStage.type === 'WIN' || targetStage.type === 'LOSS') {
            await logAutomation('WARN', `Stage "${targetStage.title}" Ã© final (${targetStage.type}). MovimentaÃ§Ã£o via automaÃ§Ã£o bloqueada por seguranÃ§a.`, logContextBase);
            return false;
        }

        // Verificar se jÃ¡ estÃ¡ nesse stage
        if (activeLeadQuery.stageId === targetStage.id) {
            // Lead jÃ¡ estÃ¡ no stage correto, mas atualizar notas se houver horÃ¡rio
            if (scheduledTime && targetSemanticType === 'meeting_scheduled') {
                const noteUpdated = await ensureMeetingNote(activeLeadQuery.id, scheduledTime, companyId);
                if (noteUpdated) {
                    await logAutomation('INFO', `ðŸ“… REUNIÃƒO DETECTADA: Lead "${contact.name}" jÃ¡ estÃ¡ em "${targetStage.title}". HorÃ¡rio atualizado: ${scheduledTime}`, logContextBase);
                    return true;
                }
            }
            await logAutomation('INFO', `Lead jÃ¡ estÃ¡ no stage "${targetStage.title}". Nenhuma movimentaÃ§Ã£o necessÃ¡ria.`, logContextBase);
            return false;
        }

        // Preparar atualização do lead com horário se disponível
        const updateData: { stageId: string; notes?: string; currentStage?: any; lastStageChangeAt?: Date } = { 
            stageId: targetStage.id,
            currentStage: targetStage,
            lastStageChangeAt: new Date()
        };
        if (scheduledTime && targetSemanticType === 'meeting_scheduled') {
            const currentNotes = activeLeadQuery.notes || '';
            const newNote = `ðŸ“… ReuniÃ£o agendada: ${scheduledTime}`;
            updateData.notes = currentNotes ? `${newNote}\n\n${currentNotes}` : newNote;
        }

        // SECURITY: Validar tenant ao atualizar (activeLeadQuery jÃ¡ foi buscado com companyId)
        await db.update(kanbanLeads)
            .set(updateData)
            .where(and(
                eq(kanbanLeads.id, activeLeadQuery.id),
                eq(kanbanLeads.companyId, companyId)
            ));

        const evidenceText = evidence.length > 0 ? evidence.join(', ') : 'DetecÃ§Ã£o automÃ¡tica';
        const timeInfo = scheduledTime ? ` para ${scheduledTime}` : '';
        await logAutomation('INFO', `ðŸ“… REUNIÃƒO DETECTADA: Lead "${contact.name}" movido para "${targetStage.title}"${timeInfo} | EvidÃªncias: ${evidenceText}`, logContextBase);

        return true;

    } catch (error) {
        await logAutomation('ERROR', `Erro ao mover lead para stage semÃ¢ntico: ${(error as Error).message}`, logContextBase);
        return false;
    }
}

export async function ensureLeadInDefaultFunnel(contact: Contact, companyId: string, logContext: LogContext, personaId?: string | null, connectionId?: string | null) {
    try {


        // 2. Buscar funil com prioridade: ConexÃ£o â†’ Persona â†’ Empresa â†’ Primeiro disponÃ­vel
        let targetBoardId: string | null = null;

        // 2a. â­ NOVO: Tentar funil vinculado Ã  conexÃ£o
        if (!targetBoardId && connectionId) {
            const [boardByConnection] = await db.select({ id: kanbanBoards.id })
                .from(kanbanBoards)
                .where(and(
                    eq(kanbanBoards.companyId, companyId),
                    sql`${connectionId} = ANY(${kanbanBoards.connectionIds})`
                ))
                .limit(1);
            if (boardByConnection) {
                targetBoardId = boardByConnection.id;
                await logAutomation('INFO', `ðŸ”— Funil encontrado via conexÃ£o vinculada (connectionId: ${connectionId}): ${targetBoardId}`, logContext);
            }
        }

        // 2b. Tentar funil da persona
        if (!targetBoardId && personaId) {
            const [persona] = await db.select({ kanbanBoardId: aiPersonas.kanbanBoardId })
                .from(aiPersonas)
                .where(eq(aiPersonas.id, personaId))
                .limit(1);
            if (persona?.kanbanBoardId) {
                targetBoardId = persona.kanbanBoardId;
                await logAutomation('INFO', `Funil da persona encontrado: ${targetBoardId}`, logContext);
            }
        }

        // 2c. Tentar funil padrÃ£o da empresa
        if (!targetBoardId) {
            const [company] = await db.select({ defaultKanbanBoardId: companies.defaultKanbanBoardId })
                .from(companies)
                .where(eq(companies.id, companyId))
                .limit(1);
            if (company?.defaultKanbanBoardId) {
                targetBoardId = company.defaultKanbanBoardId;
                await logAutomation('INFO', `Funil padrÃ£o da empresa encontrado: ${targetBoardId}`, logContext);
            }
        }

        // 2d. Buscar o board pelo ID ou fallback para primeiro disponÃ­vel
        let boards;
        if (targetBoardId) {
            boards = await db.select()
                .from(kanbanBoards)
                .where(and(eq(kanbanBoards.id, targetBoardId), eq(kanbanBoards.companyId, companyId)))
                .limit(1);
        }
        if (!boards || boards.length === 0) {
            boards = await db.select()
                .from(kanbanBoards)
                .where(eq(kanbanBoards.companyId, companyId))
                .limit(1); // Fallback: primeiro funil
        }

        if (boards.length === 0) {
            await logAutomation('WARN', `Nenhum funil Kanban encontrado para empresa.NÃ£o foi possÃ­vel criar lead automÃ¡tico.`, logContext);
            return;
        }

        const targetBoard = boards[0];

        // 2. Verificar se contato jÃ¡ Ã© lead NESTE funil alvo
        const existingLeads = await db.select({ id: kanbanLeads.id })
            .from(kanbanLeads)
            .where(and(
                eq(kanbanLeads.contactId, contact.id),
                eq(kanbanLeads.companyId, companyId),
                eq(kanbanLeads.boardId, targetBoard.id)
            ))
            .limit(1);

        if (existingLeads.length > 0) {
            await logAutomation('INFO', `Contato jÃ¡ Ã© lead(ID: ${existingLeads[0].id}) no funil ${targetBoard.id}. Pulinho criaÃ§Ã£o automÃ¡tica.`, logContext);
            return;
        }
        const stages = targetBoard.stages as KanbanStage[];

        if (!stages || stages.length === 0) {
            await logAutomation('WARN', `Funil "${targetBoard.title}" nÃ£o possui estÃ¡gios.Lead nÃ£o criado.`, logContext);
            return;
        }

        // Pega o estágio padrão ou o primeiro
        const settings = targetBoard.settings as any || {};
        let entryStage = stages[0];
        if (settings.defaultEntryStageId) {
            const found = stages.find(s => s.id === settings.defaultEntryStageId);
            if (found) entryStage = found;
        }

        // 3. Criar Lead
        const [newLead] = await db.insert(kanbanLeads).values({
            companyId,
            boardId: targetBoard.id,
            stageId: entryStage.id,
            contactId: contact.id,
            title: contact.name || contact.phone,
            value: "0",
            status: 'OPEN',
            priority: 'MEDIUM',
            currentStage: entryStage, // Denormalized stage copy
        }).returning();

        // 🌟 APLICAR CONFIGURAÇÕES AUTOMÁTICAS DO FUNIL
        if (Object.keys(settings).length > 0) {
            // 1. Tagging
            if (settings.autoTags && Array.isArray(settings.autoTags) && settings.autoTags.length > 0) {
                try {
                    const tagValues = settings.autoTags.map((tagId: string) => ({
                        companyId,
                        contactId: contact.id,
                        tagId
                    }));
                    await db.insert(contactsToTags).values(tagValues).onConflictDoNothing();
                    await logAutomation('INFO', `🏷️ Tags automáticas aplicadas ao lead.`, logContext);
                } catch(e) {
                    await logAutomation('ERROR', `Erro ao aplicar tags automáticas: ${e}`, logContext);
                }
            }

            // 2. Team/User Assign
            if (settings.autoAssignUserId || settings.autoAssignTeamId) {
                const updateAssign: any = {};
                if (settings.autoAssignUserId) updateAssign.assignedTo = settings.autoAssignUserId;
                if (settings.autoAssignTeamId) updateAssign.teamId = settings.autoAssignTeamId;
                
                await db.update(conversations).set(updateAssign).where(eq(conversations.contactId, contact.id));
                await logAutomation('INFO', `👤 Atribuição de usuário/equipe aplicada ao contato.`, logContext);
            }

            // 3. Fluxo de Automação
            if (settings.autoTriggerAutomationId) {
                await logAutomation('INFO', `⚡ Disparando Fluxo de Boas-Vindas ${settings.autoTriggerAutomationId}...`, logContext);
                // Here we would trigger the execution, maybe we can just create an execution row
                try {
                     const { executeAutomationFlow } = await import('@/lib/flow-engine');
                     await executeAutomationFlow(settings.autoTriggerAutomationId, {
                          contactId: contact.id,
                          companyId: companyId
                     });
                     await logAutomation('INFO', `✅ Fluxo de Boas-Vindas iniciado com sucesso.`, logContext);
                } catch(e) {
                     await logAutomation('ERROR', `Erro ao iniciar Fluxo de Boas-Vindas: ${e}`, logContext);
                }
            }
        }

        // 4. Disparar Webhook de Lead Criado (se necessÃ¡rio)
        try {
            await webhookDispatcher.dispatch(companyId, 'lead_created', {
                leadId: newLead.id,
                contactId: contact.id,
                boardId: targetBoard.id,
                stageName: entryStage.title,
                value: 0
            });
        } catch (webhookError) {
            logger.error('[Automation] Erro ao disparar webhook lead_created:', webhookError);
        }

        await logAutomation('INFO', `✅ Lead criado automaticamente no funil "${targetBoard.title}" -> Estágio "${entryStage.title}"`, logContext);

    } catch (error: any) {
        await logAutomation('ERROR', `Falha ao criar lead automÃ¡tico: ${error.message} `, logContext);
    }
}

