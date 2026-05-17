import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { db } from '@/lib/db';
import { automationRules, automationFlows, automationNodes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
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
        
        const customInstruction = reflection_prompt || `Com base no que a I.A já devia saber (1 e 2) e no que ela fez no atendimento recente (3), faça uma investigação profunda da conversa.\nSe o LEAD (usuário) der qualquer ORDEM, REGRA ou RESTRIÇÃO (ex: "Não anote isso", "Meu nome é X", "Não fale sobre Y"), OU se a I.A cometeu um erro óbvio, extraia UMA ÚNICA NOTA (máx 2-3 frases) de aprendizado direto para ser ADICIONADA à memória.\nA nota deve ser imperativa e incorporar a regra do Lead. Exemplo: "Você deve tratar o usuário como Mark sempre que ele pedir" ou "Nunca anote a idade do cliente se ele proibir".`;

        const prompt = `Você é o SUPERVISOR DE APRENDIZADO DE UMA I.A.
Sua única função é ler a CONVERSA abaixo e extrair NOVAS REGRAS DE COMPORTAMENTO para a I.A usar no futuro.

1. INSTRUÇÕES ATUAIS DA I.A:
${system_message || '(Nenhuma)'}

2. MEMÓRIA ATUAL DA I.A:
${existing_notes || '(Nenhuma)'}

3. CONVERSA PARA ANÁLISE:
${formattedHistory}

=== INSTRUÇÃO DE AVALIAÇÃO ===
Verifique a CONVERSA (3) procurando rigorosamente por:
A) O Lead (humano) deu alguma ORDEM, RESTRIÇÃO ou REGRA que a I.A deve seguir? (ex: "Me chame de X", "Não anote Y", "A partir de agora faça Z").
B) A I.A cometeu algum erro óbvio que violou as instruções (1) ou a memória (2)?

ATENÇÃO: Mesmo que a I.A tenha recusado a regra do humano durante a conversa, VOCÊ DEVE EXTRAIR A REGRA ditada pelo humano.

${customInstruction}

REGRAS OBRIGATÓRIAS DE SAÍDA:
Você deve retornar EXCLUSIVAMENTE um objeto JSON válido com a seguinte estrutura:
{
  "has_new_rule": boolean, // true se (A) ou (B) aconteceram, false caso contrário
  "reasoning": "string", // explique brevemente o raciocínio
  "extracted_rule": "string" // a nova nota de aprendizado imperativa. null ou string vazia se has_new_rule for false
}`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          response_format: { type: "json_object" },
          messages: [{ role: 'system', content: prompt }],
          temperature: 0.2,
        });

        const content = completion.choices[0]?.message?.content?.trim() || '{}';
        tokensUsed = completion.usage?.total_tokens || 0;

        let parsed: any = {};
        try {
            parsed = JSON.parse(content);
        } catch (e) {
            console.error('[SimulatorMemory POST] Error parsing JSON from OpenAI:', content);
        }

        if (!parsed.has_new_rule || !parsed.extracted_rule) {
          return NextResponse.json({ message: 'Nenhum aprendizado necessário gerado', tokens: tokensUsed, debug_reasoning: parsed.reasoning }, { status: 200 });
        }

        learnedNote = parsed.extracted_rule;

        newNotes = existing_notes 
            ? `${existing_notes}\n- ${learnedNote}` 
            : `- ${learnedNote}`;
    }

    // 3. Injetar a memória aprendida de volta no FlowData (no config do Nó de IA)

    if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
        if (manualUpdate) return NextResponse.json({ message: 'Nós não encontrados no fluxo' }, { status: 404 });
        return NextResponse.json({ success: true, learnedNote, fullNotes: newNotes, tokens: tokensUsed, debug: 'nodes_array_missing' });
    }

    const targetNode = flowData.nodes.find((n: any) => n.id === nodeId);
    if (!targetNode) {
        if (manualUpdate) return NextResponse.json({ message: 'Nó do Agente IA não encontrado no banco' }, { status: 404 });
        return NextResponse.json({ success: true, learnedNote, fullNotes: newNotes, tokens: tokensUsed, debug: { error: 'target_node_not_found', passed_nodeId: nodeId, available_nodes: flowData.nodes.map((n:any)=>n.id) } });
    }

    // Atualiza o learning_notes (suporta V3 aninhado e V4 plano)
    if (!targetNode.data.config) targetNode.data.config = {};
    targetNode.data.config.learning_notes = newNotes;
    targetNode.data.learning_notes = newNotes;

    if (manualUpdate && reflection_prompt !== undefined) {
        targetNode.data.config.reflection_prompt = reflection_prompt;
        targetNode.data.reflection_prompt = reflection_prompt;
    }

    // Salva no banco de dados independentemente de ser Standalone, pois o usuário deseja usar o link para treinar a IA
    const isSandboxMode = is_sandbox === true || !session?.user?.companyId;

    if (isV4) {
        // Atualiza visualData
        const setPayload: any = { visualData: flowData };
        
        // Atualiza também o executionLogic (steps) para garantir que a IA use em produção
        if (flowV4.executionLogic && Array.isArray(flowV4.executionLogic)) {
            const newSteps = [...flowV4.executionLogic];
            const aiStep = newSteps.find((s: any) => s.id === nodeId);
            if (aiStep) {
                if (!aiStep.data) aiStep.data = {};
                if (!aiStep.data.config) aiStep.data.config = {};
                aiStep.data.learning_notes = newNotes;
                aiStep.data.config.learning_notes = newNotes;
                if (manualUpdate && reflection_prompt !== undefined) {
                    aiStep.data.reflection_prompt = reflection_prompt;
                    aiStep.data.config.reflection_prompt = reflection_prompt;
                }
            }
            setPayload.executionLogic = newSteps;
        }

        await db.update(automationFlows)
            .set(setPayload)
            .where(eq(automationFlows.id, ruleId));
            
        // IMPORTANTE: O Editor V4 agora carrega os nós da tabela automationNodes e não do visualData.
        // Precisamos atualizar o config do nó específico na tabela relacional.
        const dbNode = await db.query.automationNodes.findFirst({
            where: and(
                eq(automationNodes.automationId, ruleId),
                eq(automationNodes.id, nodeId)
            )
        });

        if (dbNode) {
            const updatedConfig = { ...(dbNode.config as any) || {} };
            updatedConfig.learning_notes = newNotes;
            if (manualUpdate && reflection_prompt !== undefined) {
                updatedConfig.reflection_prompt = reflection_prompt;
            }
            await db.update(automationNodes)
                .set({ config: updatedConfig })
                .where(and(
                    eq(automationNodes.automationId, ruleId),
                    eq(automationNodes.id, nodeId)
                ));
        }
            
        // Limpa o cache para o Editor de Automações exibir o dado fresco
        revalidatePath(`/automacoes`, 'layout');
        revalidatePath(`/management`, 'layout');
    } else if (ruleV3) {
        const updatedActions = [...(ruleV3.actions as any[])];
        updatedActions[0].value = JSON.stringify(flowData);
        await db.update(automationRules)
            .set({ actions: updatedActions as any })
            .where(eq(automationRules.id, ruleId));
    }

    return NextResponse.json({ 
        success: true, 
        learnedNote, 
        fullNotes: newNotes, 
        tokens: tokensUsed,
        sandbox: false // Mock para indicar que foi salvo
    });
  } catch (error) {
    console.error('[SimulatorMemory POST] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
