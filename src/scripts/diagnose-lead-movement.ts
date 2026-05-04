/**
 * Diagnóstico: Verificar por que lead não foi movido após agendamento
 * Contato: +5564999526870
 */
import { db } from '../lib/db';
import { contacts, kanbanLeads, kanbanBoards, aiScheduledMeetings, conversations } from '../lib/db/schema';
import { eq, and, like } from 'drizzle-orm';

async function diagnose() {
    console.log('🔍 Diagnóstico: Lead não movido após agendamento');
    console.log('================================================\n');

    // 1. Encontrar o contato
    const contactResults = await db.select().from(contacts)
        .where(like(contacts.phone, '%64999526870%'))
        .limit(5);

    if (contactResults.length === 0) {
        console.log('❌ Contato +5564999526870 não encontrado no banco.');
        process.exit(1);
    }

    for (const contact of contactResults) {
        console.log(`📱 Contato: ${contact.name} (${contact.phone})`);
        console.log(`   ID: ${contact.id}`);
        console.log(`   CompanyId: ${contact.companyId}`);

        // 2. Verificar lead no Kanban
        const leads = await db.select().from(kanbanLeads)
            .where(eq(kanbanLeads.contactId, contact.id));

        if (leads.length === 0) {
            console.log('   ⚠️ NENHUM lead encontrado no Kanban para este contato!');
        } else {
            for (const lead of leads) {
                console.log(`\n   🎯 Lead ID: ${lead.id}`);
                console.log(`   BoardId: ${lead.boardId}`);
                console.log(`   StageId atual: ${lead.stageId}`);
                console.log(`   Notes: ${lead.notes || 'Sem notas'}`);

                // 3. Verificar board e stages
                const [board] = await db.select().from(kanbanBoards)
                    .where(eq(kanbanBoards.id, lead.boardId))
                    .limit(1);

                if (board) {
                    console.log(`\n   📋 Board: "${board.name}"`);
                    const stages = (board.stages || []) as any[];
                    console.log(`   Total stages: ${stages.length}`);

                    for (const stage of stages) {
                        const isCurrent = stage.id === lead.stageId ? ' ← ATUAL' : '';
                        const hasSemantic = stage.semanticType ? ` (semantic: ${stage.semanticType})` : '';
                        console.log(`      - "${stage.title}" [${stage.type}]${hasSemantic}${isCurrent}`);
                    }

                    // Verificar se existe stage com meeting_scheduled
                    const meetingStage = stages.find((s: any) => s.semanticType === 'meeting_scheduled');
                    if (meetingStage) {
                        console.log(`\n   ✅ Stage "meeting_scheduled" EXISTE: "${meetingStage.title}" (${meetingStage.id})`);
                    } else {
                        console.log(`\n   ❌ NENHUM stage com semanticType="meeting_scheduled" neste board!`);
                        console.log(`   ⚠️ ESTA É A CAUSA DO BUG: O board "${board.name}" não tem um stage com semanticType definido.`);
                    }
                }
            }
        }

        // 4. Verificar reuniões agendadas
        const meetings = await db.select().from(aiScheduledMeetings)
            .where(eq(aiScheduledMeetings.contactId, contact.id));

        if (meetings.length === 0) {
            console.log('\n   ⚠️ Nenhuma reunião agendada encontrada para este contato.');
        } else {
            console.log(`\n   📅 Reuniões agendadas: ${meetings.length}`);
            for (const m of meetings) {
                console.log(`      - "${m.title}" | ${m.scheduledAt} | Status: ${m.status} | Meet: ${m.meetLink || 'N/A'}`);
                console.log(`        kanbanLeadId: ${m.kanbanLeadId || 'NULL'}`);
            }
        }
    }

    console.log('\n✅ Diagnóstico concluído');
    process.exit(0);
}

diagnose().catch(e => { console.error(e); process.exit(1); });
