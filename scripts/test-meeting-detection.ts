// Script de teste para validar detecção automática de reuniões
// Uso: npm run tsx scripts/test-meeting-detection.ts

import { db } from '@/lib/db';
import { kanbanBoards, kanbanLeads } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface MeetingDetectionResult {
    isMeetingScheduled: boolean;
    confidence: number;
    evidence: string[];
}

function detectMeetingScheduled(conversationText: string, latestResponse: string): MeetingDetectionResult {
    const text = (conversationText + '\n' + latestResponse).toLowerCase();
    let score = 0;
    const evidence: string[] = [];

    // SINAIS MUITO FORTES de agendamento (40 pontos cada)
    const veryStrongSignals = [
        { pattern: /\b(reuni[aã]o marcada|agendado|confirmado|horário confirmado)\b/, desc: 'Confirmação explícita de agendamento' },
        { pattern: /\b(te espero|nos vemos|até.{0,15}(segunda|ter[cç]a|quarta|quinta|sexta|s[áa]bado|domingo))\b/, desc: 'Confirmação de encontro futuro' },
        { pattern: /\b(confirmo.{0,15}participa[çc][aã]o|confirmado para|vou participar)\b/, desc: 'Participação confirmada' },
    ];

    for (const signal of veryStrongSignals) {
        if (signal.pattern.test(text)) {
            score += 40;
            evidence.push(signal.desc);
        }
    }

    // SINAIS FORTES de agendamento (30 pontos cada)
    const strongSignals = [
        { pattern: /\b(envi[ae].{0,15}(2|dois|tr[eê]s|3).{0,15}hor[áa]rios?|que horas?.*prefer[eê]|hor[áa]rio.*melhor)\b/, desc: 'Solicitação de horários disponíveis' },
        { pattern: /\b(vamos marcar|pode ser|aceito|marca.{0,15}(reuni[aã]o|call|liga[çc][aã]o))\b/, desc: 'Aceitação de agendamento' },
        { pattern: /\b(segunda|ter[cç]a|quarta|quinta|sexta|s[áa]bado|domingo).{0,20}(\d{1,2}h|\d{1,2}:\d{2})\b/, desc: 'Dia e hora específicos mencionados' },
        { pattern: /\b(\d{1,2}h|\d{1,2}:\d{2}).{0,30}(segunda|ter[cç]a|quarta|quinta|sexta|s[áa]bado|domingo)\b/, desc: 'Hora e dia específicos mencionados' },
    ];

    for (const signal of strongSignals) {
        if (signal.pattern.test(text)) {
            score += 30;
            evidence.push(signal.desc);
        }
    }

    // SINAIS MÉDIOS de contexto de reunião (20 pontos cada)
    const mediumSignals = [
        { pattern: /\b(reuni[aã]o|meeting|call|chamada|liga[çc][aã]o|videochamada|videoconfer[eê]ncia)\b/, desc: 'Menção a reunião/call' },
        { pattern: /\b(agendar|marcar|encontro|bate.?papo presencial|conversar pessoalmente)\b/, desc: 'Intenção de agendar' },
        { pattern: /\b(calend[áa]rio|agenda|disponibilidade|dispon[íi]vel)\b/, desc: 'Contexto de calendário/agenda' },
        { pattern: /\b(entre.{0,10}(08h?|8h?|09h?|9h?).{0,10}(19h?|18h?))\b/, desc: 'Faixa de horário mencionada' },
    ];

    for (const signal of mediumSignals) {
        if (signal.pattern.test(text)) {
            score += 20;
            evidence.push(signal.desc);
        }
    }

    // THRESHOLD: 70 pontos = reunião marcada com alta confiança
    const confidence = Math.min(100, Math.max(0, score));
    const isMeetingScheduled = confidence >= 70;

    return {
        isMeetingScheduled,
        confidence,
        evidence
    };
}

// Casos de teste
const testCases = [
    {
        name: 'Confirmação Explícita com Dia e Hora',
        conversation: 'Lead: Oi, quero saber mais sobre o workshop\nIA: Posso agendar uma call?',
        response: 'Lead: Sim! Confirmado para terça às 14h',
        shouldDetect: true,
        expectedConfidence: '>= 90'
    },
    {
        name: 'Reunião Marcada (palavra-chave forte)',
        conversation: 'Lead: Podemos conversar?',
        response: 'IA: Perfeito! Reunião marcada para amanhã às 10h',
        shouldDetect: true,
        expectedConfidence: '>= 70'
    },
    {
        name: 'Te espero + dia',
        conversation: 'Lead: Ok, pode ser',
        response: 'IA: Ótimo! Te espero na quinta então',
        shouldDetect: true,
        expectedConfidence: '>= 70'
    },
    {
        name: 'Apenas interesse sem confirmar',
        conversation: 'Lead: Tenho interesse',
        response: 'IA: Que bom!',
        shouldDetect: false,
        expectedConfidence: '< 70'
    },
    {
        name: 'Vamos marcar (aceitação)',
        conversation: 'Lead: Gostei da proposta',
        response: 'Lead: Vamos marcar uma call para conversar melhor',
        shouldDetect: true,
        expectedConfidence: '>= 70'
    },
    {
        name: 'Participação confirmada',
        conversation: 'Lead: Recebi o convite',
        response: 'Lead: Confirmo minha participação no evento',
        shouldDetect: true,
        expectedConfidence: '>= 70'
    }
];

async function runTests() {
    console.log('🧪 TESTE DE DETECÇÃO AUTOMÁTICA DE REUNIÕES\n');
    console.log('='.repeat(60));

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        const result = detectMeetingScheduled(testCase.conversation, testCase.response);
        
        const isCorrect = result.isMeetingScheduled === testCase.shouldDetect;
        const symbol = isCorrect ? '✅' : '❌';
        
        console.log(`\n${symbol} ${testCase.name}`);
        console.log(`   Conversa: "${testCase.response}"`);
        console.log(`   Detectado: ${result.isMeetingScheduled ? 'SIM' : 'NÃO'}`);
        console.log(`   Confiança: ${result.confidence}% (esperado: ${testCase.expectedConfidence})`);
        
        if (result.evidence.length > 0) {
            console.log(`   Evidências: ${result.evidence.join(', ')}`);
        }
        
        if (isCorrect) {
            passed++;
        } else {
            failed++;
            console.log(`   ⚠️  FALHOU: Esperava ${testCase.shouldDetect ? 'detectar' : 'NÃO detectar'}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 RESULTADO FINAL:`);
    console.log(`   ✅ Passou: ${passed}/${testCases.length}`);
    console.log(`   ❌ Falhou: ${failed}/${testCases.length}`);
    console.log(`   📈 Taxa de acerto: ${((passed / testCases.length) * 100).toFixed(1)}%`);

    // Verificar configuração do banco
    console.log('\n' + '='.repeat(60));
    console.log('\n🔍 VERIFICANDO CONFIGURAÇÃO DO BANCO DE DADOS\n');

    try {
        const board = await db.query.kanbanBoards.findFirst({
            where: eq(kanbanBoards.name, 'Workshop - Terça')
        });

        if (!board) {
            console.log('❌ Funil "Workshop - Terça" não encontrado');
            return;
        }

        const stages = board.stages as any[];
        const meetingStage = stages.find((s: any) => s.semanticType === 'meeting_scheduled');

        if (meetingStage) {
            console.log('✅ Estágio com semanticType="meeting_scheduled" encontrado:');
            console.log(`   - ID: ${meetingStage.id}`);
            console.log(`   - Título: ${meetingStage.title}`);
            console.log(`   - Tipo: ${meetingStage.type}`);
            console.log(`   - Tipo Semântico: ${meetingStage.semanticType}`);
        } else {
            console.log('❌ Nenhum estágio com semanticType="meeting_scheduled" encontrado');
            console.log('\nEstágios disponíveis:');
            stages.forEach((s: any) => {
                console.log(`   - ${s.title} (semanticType: ${s.semanticType || 'não definido'})`);
            });
        }

        // Contar leads no funil
        const leadsCount = await db.select({ count: db.$count() })
            .from(kanbanLeads)
            .where(eq(kanbanLeads.boardId, board.id));

        console.log(`\n📊 Leads no funil: ${leadsCount[0]?.count || 0}`);

    } catch (error) {
        console.error('❌ Erro ao verificar banco:', error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ TESTES CONCLUÍDOS!\n');
}

runTests().catch(console.error);
