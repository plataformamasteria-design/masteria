import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { db } from '@/lib/db';
import { automationRules, automationFlows } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { resolveAIKeys } from '@/lib/ai-keys-resolver';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    const body = await request.json();
    const { ruleId, nodeId, virtual_history, system_message, existing_notes, manualUpdate, reflection_prompt, is_sandbox } = body;

    if (!ruleId || !nodeId) {
        return NextResponse.json({ error: 'ruleId e nodeId são obrigatórios' }, { status: 400 });
    }

    // Se for uma automação nova que não foi salva ainda no DB, mock o retorno para a UI
    if (ruleId === 'new') {
        let newNotes = existing_notes || '';
        let learnedNote = '';
        let tokensUsed = 0;
        
        // Em rascunho 'new', se for reflection e não houver chave (precisamos do companyId para pegar a chave),
        // pode falhar se não houver session. Mas 'new' só existe no editor interno (que tem sessão).
        if (!manualUpdate && virtual_history && virtual_history.length >= 3) {
            if (!session?.user?.companyId) return NextResponse.json({ error: 'Sessão necessária para novos fluxos' }, { status: 401 });
            // Aqui faríamos a reflexão, mas para simplificar, vamos deixar falhar amigavelmente se faltar chave
            return NextResponse.json({ success: true, learnedNote: 'Rascunho não testável sem DB', fullNotes: newNotes, tokens: 0 });
        }
        return NextResponse.json({ success: true, learnedNote, fullNotes: newNotes, tokens: tokensUsed });
    }

    // 1. Fetch flow BEFORE authorization to get the companyId
    let flowData: any = null;
    let isV4 = false;
    let ruleV3: any = null;
    let flowCompanyId: string | null = null;

    let flowV4 = await db.query.automationFlows.findFirst({
        where: eq(automationFlows.id, ruleId)
    });

    if (flowV4 && flowV4.visualData) {
        isV4 = true;
        flowData = typeof flowV4.visualData === 'string' ? JSON.parse(flowV4.visualData) : flowV4.visualData;
        flowCompanyId = flowV4.companyId;
    } else {
        ruleV3 = await db.query.automationRules.findFirst({
            where: eq(automationRules.id, ruleId)
        });
        if (ruleV3) {
            flowData = typeof ruleV3.flowData === 'string' ? JSON.parse(ruleV3.flowData) : ruleV3.flowData;
            flowCompanyId = ruleV3.companyId;
        }
    }

    if (!flowData) {
        if (manualUpdate) {
            return NextResponse.json({ message: 'Automação não encontrada. Publique antes de salvar.' }, { status: 404 });
        }
        return NextResponse.json({ success: true, learnedNote: '', fullNotes: existing_notes || '', tokens: 0, warning: 'Rascunho não publicado, salvo apenas localmente.' });
    }

    // 2. Authorization
    if (manualUpdate) {
        // Manual updates require a valid session with matching companyId or superadmin
        if (!session?.user?.companyId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        if (session.user.role !== 'superadmin' && session.user.companyId !== flowCompanyId) {
            return NextResponse.json({ error: 'Não autorizado para esta automação' }, { status: 403 });
        }
    }

    let learnedNote = '';
    let tokensUsed = 0;
    let newNotes = existing_notes || '';

    if (!manualUpdate) {
        if (!virtual_history || !Array.isArray(virtual_history) || virtual_history.length < 3) {
          return NextResponse.json({ message: 'Histórico insuficiente para gerar aprendizado' }, { status: 200 });
        }

        const resolvedKeys = await resolveAIKeys(flowCompanyId!);
        const apiKey = resolvedKeys.openaiApiKey || process.env.OPENAI_API_KEY_AGENTS1 || process.env.OPENAI_API_KEY;

        if (!apiKey) {
          return NextResponse.json({ error: 'OpenAI API key missing' }, { status: 500 });
        }

        const formattedHistory = virtual_history
          .map((msg: any) => `${msg.role === 'user' ? 'LEAD' : 'I.A'}: ${msg.content}`)
          .join('\n');

        const openai = new OpenAI({ apiKey });
        
        const customInstruction = reflection_prompt || `Com base no que a I.A já devia saber (1 e 2) e no que ela fez no atendimento recente (3), faça uma investigação profunda do comportamento dela.\nSe ela errou algo que não estava nas instruções, ou se não seguiu algo que estava na memória, formule UMA ÚNICA NOTA (máx 2-3 frases) de aprendizado direto para ser ADICIONADA à memória dela na próxima vez.\nA nota deve ser uma instrução direta e imperativa. Exemplo: "Nunca dê preços antes de perguntar o nome do cliente" ou "Você ignorou a instrução X, preste atenção nela."`;

        const prompt = `Você é um supervisor de qualidade de I.A.
        
1. INSTRUÇÕES ORIGINAIS DA I.A:
${system_message || '(Sem instruções originais)'}

2. MEMÓRIA DE APRENDIZADO ATUAL:
${existing_notes || '(Nenhuma memória anterior)'}

3. ATENDIMENTO RECENTE:
${formattedHistory}

${customInstruction}

REGRAS OBRIGATÓRIAS DE SAÍDA:
- Se o atendimento tiver falhas, retorne APENAS a nova nota de aprendizado.
- Se o atendimento foi perfeito e não há absolutamente NADA a corrigir ou adicionar, responda exatamente "NADA A MELHORAR".`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'system', content: prompt }],
          temperature: 0.3,
        });

        learnedNote = completion.choices[0]?.message?.content?.trim() || '';
        tokensUsed = completion.usage?.total_tokens || 0;

        if (!learnedNote || learnedNote.toUpperCase().includes('NADA A MELHORAR')) {
          return NextResponse.json({ message: 'Nenhum aprendizado necessário gerado', tokens: tokensUsed }, { status: 200 });
        }

        newNotes = existing_notes 
            ? `${existing_notes}\n- ${learnedNote}` 
            : `- ${learnedNote}`;
    }

    // 3. Injetar a memória aprendida de volta no FlowData (no config do Nó de IA)

    if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
        if (manualUpdate) return NextResponse.json({ message: 'Nós não encontrados no fluxo' }, { status: 404 });
        return NextResponse.json({ success: true, learnedNote, fullNotes: newNotes, tokens: tokensUsed });
    }

    const targetNode = flowData.nodes.find((n: any) => n.id === nodeId);
    if (!targetNode) {
        if (manualUpdate) return NextResponse.json({ message: 'Nó do Agente IA não encontrado no banco' }, { status: 404 });
        return NextResponse.json({ success: true, learnedNote, fullNotes: newNotes, tokens: tokensUsed });
    }

    // Atualiza o learning_notes (suporta V3 aninhado e V4 plano)
    if (!targetNode.data.config) targetNode.data.config = {};
    targetNode.data.config.learning_notes = newNotes;
    targetNode.data.learning_notes = newNotes;

    // Apenas salva no banco de dados se não for modo Sandbox (usuários deslogados ou simulador standalone)
    const isSandboxMode = is_sandbox === true || !session?.user?.companyId;

    if (!isSandboxMode) {
        if (isV4) {
            await db.update(automationFlows)
                .set({ visualData: flowData })
                .where(eq(automationFlows.id, ruleId));
        } else if (ruleV3) {
            const updatedActions = [...(ruleV3.actions as any[])];
            updatedActions[0].value = JSON.stringify(flowData);
            await db.update(automationRules)
                .set({ actions: updatedActions as any })
                .where(eq(automationRules.id, ruleId));
        }
    }

    return NextResponse.json({ 
        success: true, 
        learnedNote, 
        fullNotes: newNotes, 
        tokens: tokensUsed,
        sandbox: isSandboxMode
    });
  } catch (error) {
    console.error('[SimulatorMemory POST] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
