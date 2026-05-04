/**
 * Script para diagnosticar semantic types no kanban
 * Verifica se os stages têm semanticType corretamente configurado
 */

import { db } from '@/lib/db';
import { kanbanBoards } from '@/lib/db/schema';

async function diagnoseMeetingSemanticTypes() {
    console.log('🔍 Diagnóstico: Tipos Semânticos de Reunião\n');

    try {
        // Buscar todos os boards
        const boards = await db.select().from(kanbanBoards);

        console.log(`📊 Total de boards: ${boards.length}\n`);

        for (const board of boards) {
            console.log(`\n📋 Board: ${board.name} (${board.id})`);
            console.log(`   Company: ${board.companyId}`);

            const stages = (board.stages || []) as any[];

            console.log(`   Stages (${stages.length}):`);

            for (const stage of stages) {
                const hasSemanticType = stage.semanticType && stage.semanticType !== null;
                const isMeetingStage = stage.semanticType === 'meeting_scheduled';

                const icon = isMeetingStage ? '✅' : hasSemanticType ? '⚠️' : '❌';

                console.log(`      ${icon} "${stage.title}" (${stage.id})`);
                console.log(`          Type: ${stage.type || 'undefined'}`);
                console.log(`          SemanticType: ${stage.semanticType || 'NENHUM'}`);

                if (isMeetingStage) {
                    console.log(`          🎯 STAGE DE REUNIÃO ENCONTRADO!`);
                }
            }
        }

        // Resumo final
        console.log('\n\n📈 RESUMO:');
        let totalStages = 0;
        let stagesWithSemanticType = 0;
        let meetingStages = 0;

        for (const board of boards) {
            const stages = (board.stages || []) as any[];
            totalStages += stages.length;
            stagesWithSemanticType += stages.filter((s: any) => s.semanticType).length;
            meetingStages += stages.filter((s: any) => s.semanticType === 'meeting_scheduled').length;
        }

        console.log(`   Total de stages: ${totalStages}`);
        console.log(`   Com semanticType: ${stagesWithSemanticType}`);
        console.log(`   Stages "meeting_scheduled": ${meetingStages}`);

        if (meetingStages === 0) {
            console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
            console.log('   Nenhum stage tem semanticType = "meeting_scheduled"');
            console.log('   O código de auto-movimento não encontrará o stage de destino!');
        } else {
            console.log('\n✅ Configuração aparentemente correta!');
        }

    } catch (error) {
        console.error('❌ Erro ao diagnosticar:', error);
        throw error;
    }
}

diagnoseMeetingSemanticTypes()
    .then(() => {
        console.log('\n✅ Diagnóstico concluído');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Erro:', error);
        process.exit(1);
    });
