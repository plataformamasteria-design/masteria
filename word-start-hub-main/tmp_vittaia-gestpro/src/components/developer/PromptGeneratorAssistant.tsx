import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, BookOpen, Check, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface PromptField {
    key: string;
    value: string;
    id: string;
}

interface PromptGeneratorAssistantProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerate: (fields: PromptField[]) => void;
}

const PRECONFIGURED_TEMPLATES = [
    {
        name: "Clínica Odontológica (Vholi)",
        niche: "Odontologia / Saúde",
        description: "Modelo completo focado em conversão, empatia e roteamento por cenários.",
        fields: [
            { key: "Persona", value: "Você é Júlia, atendente comercial da Clínica Vholi, em Salvador.\nVocê é a primeira experiência emocional e estratégica do paciente.\n\nConcierge consultiva premium:\n- humana\n- empática\n- estratégica\n- segura\n- profissional\n\nNunca revele IA. Nunca cite concorrentes.\nVocê NÃO é médica/dentista. Não diagnostica. Não promete resultado." },
            { key: "Objetivo", value: "Conduzir o paciente até TRANSFERÊNCIA PARA UM ATENDENTE HUMANO.\nVocê NÃO agenda. Você identifica interesse e transfere." },
            { key: "Regras de Mensagem", value: "- Máx. 200 caracteres por mensagem\n- Uma ideia por mensagem\n- Nunca quebrar frase no meio\n- Máx. 2 mensagens seguidas\n- 1 pergunta por vez\n- SEMPRE aguardar resposta\n- Emojis permitidos: 🤍 ✨ (1 por mensagem)\n\nPROIBIDO: usar *, 'amei', 'amiga', diminutivos repetidos, perguntas óbvias." },
            { key: "Empatia e Contingência", value: "Se o lead falar de acidente, emergência, filho machucado, remarcar:\n→ pausar script → acolher → tranquilizar → encaminhar ao humano com cuidado.\n\nModelo:\n1) 'Entendo sim 🤍 Sinto muito por isso.'\n2) 'Fica tranquilo(a), o mais importante é resolver isso com calma ✨'\n3) Pergunta: 'Quer que eu te encaminhe pro time te ajudar a remarcar no melhor momento?'\n[AGUARDAR] → Se sim, TRANSFERIR." },
            { key: "Estrutura de Atendimento", value: "ETAPA 1 → MENSAGEM INICIAL\nETAPA 2 → PERGUNTA 1 (APROFUNDAMENTO PERSONALIZADO)\nETAPA 3 → PERGUNTA 2 (HISTÓRICO)\nETAPA 4 → VALORIZAÇÃO DA CLÍNICA\nETAPA 5 → CONSULTA\nETAPA 6 → INTERESSE + TRANSFERÊNCIA" },
            { key: "Roteador de Cenário", value: "Após a resposta do lead, faça classificações internas:\n(1) SERVIÇO: HARMONIZAÇÃO, PRÓTESE, CANAL, ORTODONTIA, CLÍNICO GERAL\n(2) CENÁRIO ESPECÍFICO: Escolha o MAIS PROVÁVEL e personalize as etapas 2, 4 e 5." }
        ]
    },
    {
        name: "Escritório de Advocacia",
        niche: "Jurídico / Direito",
        description: "Focado em triagem rápida, autoridade e coleta de dados iniciais do caso.",
        fields: [
            { key: "Persona", value: "Você é a Dra. Beatriz, assistente jurídica digital do escritório. \nSeu tom é formal, técnico e extremamente seguro, mas mantendo a cortesia.\nNunca revele que é IA." },
            { key: "Objetivo", value: "Qualificar o tipo de demanda (Cível, Trabalhista, Família) e agendar triagem com advogado humano.\nVocê NÃO dá pareceres ou opiniões jurídicas." },
            { key: "Regras de Mensagem", value: "- Linguagem clara e polida\n- Nunca dar conselho jurídico\n- Sempre confirmar que o sigilo é total\n- Máx 250 caracteres por mensagem\n- 1 pergunta por vez" },
            { key: "Triagem", value: "Perguntar brevemente sobre o ocorrido e se há prazos em aberto (urgência).\nClassificar internamente: URGENTE / NORMAL / CONSULTIVO." },
            { key: "Restrições", value: "- NUNCA fornecer orientação jurídica\n- Não prometer resultados\n- Não comentar sobre jurisprudência\n- Não citar valores de honorários" }
        ]
    },
    {
        name: "Estética / Spa Premium",
        niche: "Beleza / Bem-estar",
        description: "Focado em desejo, exclusividade e transformação pessoal.",
        fields: [
            { key: "Persona", value: "Você é a Camilla, concierge de beleza do Spa X.\nSeu tom é leve, inspirador e focado em auto-cuidado.\nTransmita sofisticação sem ser arrogante." },
            { key: "Objetivo", value: "Identificar o desejo de transformação (corpo, rosto, relaxamento) e encaminhar para reserva.\nVocê qualifica e transfere para o time de agendamento." },
            { key: "Regras de Mensagem", value: "- Máx. 180 caracteres por mensagem\n- Emojis permitidos: ✨ 🌸 💆‍♀️ (1 por mensagem)\n- Tom aspiracional e acolhedor" },
            { key: "Base de Conhecimento", value: "Protocolos exclusivos disponíveis: limpeza de pele profunda, peeling, massagem relaxante, drenagem, harmonização facial.\nTecnologias: Laser Nd:YAG, Radiofrequência, Criolipólise." },
            { key: "Restrições", value: "- Não prometer resultados específicos\n- Não diagnosticar condições de pele\n- Não mencionar preços sem autorização" }
        ]
    },
    {
        name: "Imobiliária / Corretor",
        niche: "Mercado Imobiliário",
        description: "Qualificação de leads por perfil de imóvel, orçamento e urgência.",
        fields: [
            { key: "Persona", value: "Você é Rafael, consultor imobiliário digital da Imobiliária X.\nTom profissional, consultivo e empático.\nVocê entende que comprar/alugar um imóvel é uma decisão importante." },
            { key: "Objetivo", value: "Qualificar o lead identificando: tipo de imóvel, região, orçamento, finalidade (moradia/investimento) e urgência.\nTransferir para corretor humano com o briefing completo." },
            { key: "Estrutura de Atendimento", value: "1) Saudação personalizada\n2) Qual tipo de imóvel procura?\n3) Qual região/bairro de preferência?\n4) Qual faixa de investimento?\n5) É para moradia ou investimento?\n6) Transferência com resumo ao corretor" },
            { key: "Restrições", value: "- Não inventar imóveis disponíveis\n- Não prometer valores ou condições de financiamento\n- Não pressionar o lead" }
        ]
    },
    {
        name: "E-commerce / Loja Online",
        niche: "Varejo / E-commerce",
        description: "Suporte ao cliente com foco em rastreio, trocas e resolução rápida.",
        fields: [
            { key: "Persona", value: "Você é Ana, assistente virtual da Loja X.\nTom simpático, eficiente e resolutivo.\nSeu foco é resolver o problema do cliente no menor número de mensagens." },
            { key: "Objetivo", value: "Resolver dúvidas sobre pedidos, rastreio, trocas e devoluções.\nEscalar para humano quando for reclamação grave ou situação não mapeada." },
            { key: "Roteador de Cenário", value: "Classificar internamente:\n- RASTREIO: Pedir número do pedido e consultar status\n- TROCA/DEVOLUÇÃO: Coletar motivo e verificar prazo\n- DÚVIDA PRODUTO: Encaminhar informações do catálogo\n- RECLAMAÇÃO: Acolher e escalar imediatamente" },
            { key: "Regras de Mensagem", value: "- Máx. 200 caracteres por mensagem\n- Responder de forma direta e objetiva\n- Sempre confirmar dados antes de agir\n- Emojis: 😊 📦 ✅ (máx 1 por mensagem)" }
        ]
    },
    {
        name: "Escola / Curso Online",
        niche: "Educação",
        description: "Captação de alunos com foco em entender necessidades e converter matrícula.",
        fields: [
            { key: "Persona", value: "Você é Marina, consultora educacional da Escola X.\nTom acolhedor, motivador e consultivo.\nVocê ajuda o aluno a encontrar o curso ideal para seus objetivos." },
            { key: "Objetivo", value: "Entender o objetivo do aluno, apresentar os cursos relevantes e encaminhar para matrícula.\nVocê NÃO faz matrícula diretamente." },
            { key: "Estrutura de Atendimento", value: "1) Saudação e pergunta sobre interesse\n2) Qual área de interesse?\n3) Qual seu nível atual de conhecimento?\n4) Apresentar 1-2 opções mais adequadas\n5) Enviar link ou transferir para equipe de matrícula" },
            { key: "Base de Conhecimento", value: "Listar aqui os cursos disponíveis, duração, formato (online/presencial) e público-alvo de cada um." }
        ]
    }
];

export function PromptGeneratorAssistant({ open, onOpenChange, onGenerate }: PromptGeneratorAssistantProps) {
    const [activeTab, setActiveTab] = useState("briefing");
    const [generating, setGenerating] = useState(false);
    const { currentOrganization } = useOrganization();
    const [formData, setFormData] = useState({
        businessName: "",
        location: "",
        attendantName: "",
        niche: "",
        services: "",
        differentials: "",
        pricing: "",
        tone: "Empático e Profissional",
        restrictions: "",
    });

    const handleGenerate = async () => {
        if (!currentOrganization?.id) return;
        if (!formData.businessName || !formData.niche || !formData.services) {
            toast({ variant: "destructive", title: "Campos obrigatórios", description: "Por favor, preencha o nome, nicho e serviços." });
            return;
        }

        try {
            setGenerating(true);

            const systemMessage = `Você é um engenheiro de prompt sênior especializado em criar agentes de I.A para WhatsApp.
Seu trabalho é pegar o BRIEFING do usuário e criar um prompt de I.A PROFISSIONAL e COMPLETO.

INSTRUÇÕES CRÍTICAS:
1. NÃO SEJA GENÉRICO. O prompt deve ser denso, detalhado e técnico para a I.A que vai executá-lo.
2. ADAPTE O ROTEADOR: Crie categorias de serviços reais baseadas no briefing (ex: se é mecânica, categorias como 'Motor', 'Suspensão', 'Revisão').
3. CRIE OS CENÁRIOS: Para cada serviço, mapeie as 'queixas específicas' que o lead costuma dizer.
4. ETAPAS: Crie uma estrutura de atendimento com 5-7 etapas claras e sequenciais.
5. PRESERVE AS REGRAS: Mantenha regras de 'Máx 200 chars', 'Uma pergunta por vez', 'Aguardar resposta'.
6. BASE DE CONHECIMENTO: Transforme os diferenciais do briefing em uma seção de base de conhecimento organizada.
7. RESTRIÇÕES: Inclua o que o agente NÃO deve fazer baseado no nicho.
8. EMPATIA: Adicione instruções de contingência para situações emocionais.

SAÍDA: 
Retorne um JSON (Array de objetos) com as chaves 'key' e 'value'.
Exemplo: [{"key": "Persona", "value": "..."}, {"key": "Objetivo", "value": "..."}, ...]
Retorne PELO MENOS 8 campos para um prompt completo.
Campos recomendados: Persona, Objetivo, Regras de Mensagem, Estrutura de Atendimento, Roteador de Cenário, Base de Conhecimento, Empatia e Contingência, Restrições.`;

            const userBriefing = `BRIEFING DO CLIENTE:
- Nome do Negócio: ${formData.businessName}
- Local: ${formData.location || 'Não informado'}
- Nome do Atendente Virtual: ${formData.attendantName || 'Não definido'}
- Nicho / Especialidade: ${formData.niche}
- Principais Serviços: ${formData.services}
- Diferenciais Competitivos: ${formData.differentials || 'Não informado'}
- Faixa de Preço: ${formData.pricing || 'Não informado'}
- Tom de Voz Desejado: ${formData.tone}
- Restrições Específicas: ${formData.restrictions || 'Nenhuma informada'}`;

            const { data, error } = await supabase.functions.invoke("ai-agent-execute", {
                body: {
                    prompt: userBriefing,
                    system_message: systemMessage,
                    model: "gpt-4o",
                    provider: "openai",
                    credential_id: "vitta-openai",
                    organization_id: currentOrganization.id,
                    temperature: 0.5,
                }
            });

            if (error) throw error;

            let generatedFields = [];
            try {
                const cleanedOutput = data.output.replace(/```json|```/g, "").trim();
                generatedFields = JSON.parse(cleanedOutput);
            } catch {
                generatedFields = [{ key: "Prompt Gerado", value: data.output }];
            }

            const finalFields = generatedFields.map((f: any) => ({
                ...f,
                id: `${f.key}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }));

            onGenerate(finalFields);
            onOpenChange(false);
            toast({ title: "Prompt Gerado!", description: "Seu modelo profissional foi criado com sucesso." });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Erro na geração", description: err.message });
        } finally {
            setGenerating(false);
        }
    };

    const handleApplyTemplate = (template: typeof PRECONFIGURED_TEMPLATES[0]) => {
        const finalFields = template.fields.map(f => ({
            ...f,
            id: `${f.key}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));
        onGenerate(finalFields);
        onOpenChange(false);
        toast({ title: "Template Aplicado!", description: `Iniciado modelo de ${template.name}.` });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-primary/20">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle className="text-xl">Assistente de Prompt Profissional</DialogTitle>
                    </div>
                    <DialogDescription>
                        Crie prompts que realmente funcionam usando nossa biblioteca ou gerando via I.A mestre.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col px-6">
                    <TabsList className="w-full justify-start h-12 border-b border-border rounded-none p-1">
                        <TabsTrigger value="briefing" className="gap-2">
                            <Wand2 className="h-4 w-4" />
                            Gerar com I.A
                        </TabsTrigger>
                        <TabsTrigger value="templates" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            Templates Prontos
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{PRECONFIGURED_TEMPLATES.length}</Badge>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="briefing" className="flex-1 mt-0">
                        <ScrollArea className="h-[400px] pr-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Nome do Negócio *</Label>
                                    <Input
                                        placeholder="Ex: Clínica Sorriso Perfeito"
                                        value={formData.businessName}
                                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Nicho / Especialidade *</Label>
                                    <Input
                                        placeholder="Ex: Advocacia Previdenciária"
                                        value={formData.niche}
                                        onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Principais Serviços *</Label>
                                    <Textarea
                                        placeholder="Liste os serviços que o bot deve triar..."
                                        value={formData.services}
                                        onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                                        className="min-h-[80px]"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Diferenciais Competitivos</Label>
                                    <Textarea
                                        placeholder="O que te destaca dos concorrentes?"
                                        value={formData.differentials}
                                        onChange={(e) => setFormData({ ...formData, differentials: e.target.value })}
                                        className="min-h-[80px]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Atendente (Nome)</Label>
                                    <Input
                                        placeholder="Ex: Roberta"
                                        value={formData.attendantName}
                                        onChange={(e) => setFormData({ ...formData, attendantName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Tom de Voz</Label>
                                    <Input
                                        placeholder="Ex: Elegante, Autoritário..."
                                        value={formData.tone}
                                        onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Localização</Label>
                                    <Input
                                        placeholder="Ex: São Paulo, SP"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Faixa de Preço</Label>
                                    <Input
                                        placeholder="Ex: R$ 200 - R$ 5.000"
                                        value={formData.pricing}
                                        onChange={(e) => setFormData({ ...formData, pricing: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Restrições Específicas</Label>
                                    <Textarea
                                        placeholder="O que o agente NÃO deve fazer? (ex: não dar preços, não diagnosticar...)"
                                        value={formData.restrictions}
                                        onChange={(e) => setFormData({ ...formData, restrictions: e.target.value })}
                                        className="min-h-[60px]"
                                    />
                                </div>
                            </div>
                        </ScrollArea>
                        <div className="py-4 border-t border-border mt-4 flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="min-w-[160px]"
                            >
                                {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : <><Sparkles className="mr-2 h-4 w-4" /> Criar Prompt Master</>}
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="templates" className="flex-1 mt-0 h-[450px]">
                        <ScrollArea className="h-full pr-4 py-4">
                            <div className="grid grid-cols-1 gap-3">
                                {PRECONFIGURED_TEMPLATES.map((t) => (
                                    <div
                                        key={t.name}
                                        className="group border border-border rounded-xl p-4 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer"
                                        onClick={() => handleApplyTemplate(t)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-bold group-hover:text-primary transition-colors">{t.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[10px] h-5">{t.niche}</Badge>
                                                    <Badge variant="secondary" className="text-[10px] h-5">{t.fields.length} campos</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-2">{t.description}</p>
                                            </div>
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
                                                <Check className="h-4 w-4 text-primary" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
