import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Sparkles, Loader2, BookOpen, Check, Wand2, ChevronRight, ChevronLeft,
    Building2, UserCog, Target, ListChecks, ShieldCheck, ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { motion, AnimatePresence } from "framer-motion";
import {
    type WizardFormData,
    WizardFormSchema,
    GeneratedOutputSchema,
    DEFAULT_FORM,
    NICHE_OPTIONS,
    CONVERSION_GOALS,
    PERSONA_OPTIONS,
    LANGUAGE_STYLES,
    CONVERSATION_TONES,
    PAIN_TYPES,
    SALE_CYCLES,
    SERVICE_STAGES,
    STEP_LABELS,
    PRECONFIGURED_TEMPLATES,
    buildMasterSystemPrompt,
} from "./promptGeneratorConfig";

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

const STEP_ICONS = [Building2, UserCog, Target, ListChecks, ShieldCheck];

// ─── Step Components ─────────────────────────────────────────

function StepNegocio({ form, set }: { form: WizardFormData; set: (p: Partial<WizardFormData>) => void }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Nome do Negócio *</Label>
                <Input placeholder="Ex: Clínica Sorriso Perfeito" value={form.businessName} onChange={e => set({ businessName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Nicho *</Label>
                <Select value={form.niche} onValueChange={v => set({ niche: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o nicho" /></SelectTrigger>
                    <SelectContent>{NICHE_OPTIONS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
                {form.niche === "Outro (personalizado)" && (
                    <Input placeholder="Descreva o nicho..." value={form.customNiche} onChange={e => set({ customNiche: e.target.value })} className="mt-2" />
                )}
            </div>
            <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Principais Serviços *</Label>
                <Textarea placeholder="Liste todos os serviços que o agente deve conhecer e triar..." value={form.services} onChange={e => set({ services: e.target.value })} className="min-h-[80px]" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Diferenciais Competitivos</Label>
                <Textarea placeholder="O que destaca seu negócio dos concorrentes?" value={form.differentials} onChange={e => set({ differentials: e.target.value })} className="min-h-[60px]" />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Localização</Label>
                <Input placeholder="Ex: São Paulo, SP" value={form.location} onChange={e => set({ location: e.target.value })} />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Faixa de Preço</Label>
                <Input placeholder="Ex: R$ 200 - R$ 5.000" value={form.pricing} onChange={e => set({ pricing: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Objetivo Final da Conversa *</Label>
                <Select value={form.conversionGoal} onValueChange={v => set({ conversionGoal: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONVERSION_GOALS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
        </div>
    );
}

function StepAtendente({ form, set }: { form: WizardFormData; set: (p: Partial<WizardFormData>) => void }) {
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Nome do Atendente</Label>
                    <Input placeholder="Ex: Roberta" value={form.attendantName} onChange={e => set({ attendantName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Linguagem Padrão</Label>
                    <Select value={form.languageStyle} onValueChange={v => set({ languageStyle: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{LANGUAGE_STYLES.map(l => <SelectItem key={l.value} value={l.value}><span className="font-medium">{l.label}</span> — <span className="text-muted-foreground">{l.desc}</span></SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Persona do Agente</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PERSONA_OPTIONS.map(p => (
                        <div key={p.value} onClick={() => set({ persona: p.value })}
                            className={`cursor-pointer rounded-lg border p-3 transition-all ${form.persona === p.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30"}`}>
                            <p className="text-sm font-semibold">{p.label}</p>
                            <p className="text-xs text-muted-foreground">{p.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Tons Dominantes (selecione 2-4)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CONVERSATION_TONES.map(t => {
                        const active = form.dominantTones.includes(t.value);
                        return (
                            <div key={t.value} onClick={() => {
                                const tones = active ? form.dominantTones.filter(x => x !== t.value) : [...form.dominantTones, t.value];
                                set({ dominantTones: tones });
                            }}
                                className={`cursor-pointer rounded-lg border p-2.5 transition-all ${active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30"}`}>
                                <div className="flex items-center gap-2">
                                    <span className="text-base">{t.icon}</span>
                                    <span className="text-xs font-semibold">{t.label}</span>
                                    {active && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">{t.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function StepEstrategia({ form, set }: { form: WizardFormData; set: (p: Partial<WizardFormData>) => void }) {
    return (
        <div className="space-y-5">
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
                <p className="text-xs text-muted-foreground"><strong className="text-primary">MQL/SQL Automático:</strong> O prompt gerado incluirá lógica de detecção automática. Aqui você define o perfil do lead para calibrar a estratégia.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Tipo de Dor do Lead</Label>
                    <Select value={form.painType} onValueChange={v => set({ painType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PAIN_TYPES.map(p => <SelectItem key={p.value} value={p.value}><span className="font-medium">{p.label}</span> — <span className="text-muted-foreground">{p.desc}</span></SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Ciclo de Venda</Label>
                    <Select value={form.saleCycle} onValueChange={v => set({ saleCycle: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SALE_CYCLES.map(c => <SelectItem key={c.value} value={c.value}><span className="font-medium">{c.label}</span> — <span className="text-muted-foreground">{c.desc}</span></SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Objeções Comuns do Nicho</Label>
                <Textarea placeholder="Ex: 'É caro', 'Tenho medo do resultado', 'Preciso pensar'..." value={form.commonObjections} onChange={e => set({ commonObjections: e.target.value })} className="min-h-[80px]" />
            </div>
        </div>
    );
}

function StepEtapas({ form, set }: { form: WizardFormData; set: (p: Partial<WizardFormData>) => void }) {
    return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Habilite as etapas de atendimento e personalize cada uma se necessário.</p>
            {SERVICE_STAGES.map(s => {
                const enabled = form.enabledStages.includes(s.key);
                return (
                    <div key={s.key} className={`rounded-lg border p-3 transition-all ${enabled ? "border-primary/30 bg-primary/[0.02]" : "border-border opacity-60"}`}>
                        <div className="flex items-center gap-3">
                            <Checkbox checked={enabled} onCheckedChange={c => {
                                const stages = c ? [...form.enabledStages, s.key] : form.enabledStages.filter(x => x !== s.key);
                                set({ enabledStages: stages });
                            }} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">{s.label}</p>
                                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                            </div>
                        </div>
                        {enabled && (
                            <Input placeholder={`Personalizar: ${s.desc}...`} className="mt-2 text-xs h-8"
                                value={form.stageNotes?.[s.key] ?? ""}
                                onChange={e => set({ stageNotes: { ...form.stageNotes, [s.key]: e.target.value } })}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function StepRegras({ form, set }: { form: WizardFormData; set: (p: Partial<WizardFormData>) => void }) {
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Máx caracteres/msg: {form.maxCharsPerMsg}</Label>
                    <Slider value={[form.maxCharsPerMsg]} onValueChange={([v]) => set({ maxCharsPerMsg: v })} min={100} max={400} step={10} />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Emojis Permitidos</Label>
                    <Input placeholder="🤍 ✨ 😊 👍" value={form.allowedEmojis} onChange={e => set({ allowedEmojis: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Máx msgs seguidas</Label>
                    <Select value={String(form.maxConsecutiveMsgs)} onValueChange={v => set({ maxConsecutiveMsgs: Number(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "mensagem" : "mensagens"}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Restrições (o que NÃO fazer)</Label>
                <Textarea placeholder="Ex: Não dar preços, não diagnosticar, não prometer resultados..." value={form.restrictions} onChange={e => set({ restrictions: e.target.value })} className="min-h-[70px]" />
            </div>
            <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Contingência Emocional</Label>
                <Textarea placeholder="Como reagir a emergências, reclamações, situações emocionais..." value={form.emotionalContingency} onChange={e => set({ emotionalContingency: e.target.value })} className="min-h-[70px]" />
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────

export function PromptGeneratorAssistant({ open, onOpenChange, onGenerate }: PromptGeneratorAssistantProps) {
    const [activeTab, setActiveTab] = useState("wizard");
    const [step, setStep] = useState(0);
    const [generating, setGenerating] = useState(false);
    const [form, setFormRaw] = useState<WizardFormData>({ ...DEFAULT_FORM });
    const { currentOrganization } = useOrganization();

    const set = (partial: Partial<WizardFormData>) => setFormRaw(prev => ({ ...prev, ...partial }));

    const canAdvance = useMemo(() => {
        switch (step) {
            case 0: return !!(form.businessName.trim() && form.niche && form.services.trim() && form.conversionGoal);
            case 1: return !!(form.persona && form.languageStyle && form.dominantTones.length >= 1);
            case 2: return !!(form.painType && form.saleCycle);
            case 3: return form.enabledStages.length >= 3;
            case 4: return true;
            default: return false;
        }
    }, [step, form]);

    const filledSteps = useMemo(() => {
        const flags = [false, false, false, false, false];
        flags[0] = !!(form.businessName && form.niche && form.services && form.conversionGoal);
        flags[1] = !!(form.persona && form.languageStyle && form.dominantTones.length >= 1);
        flags[2] = !!(form.painType && form.saleCycle);
        flags[3] = form.enabledStages.length >= 3;
        flags[4] = true;
        return flags;
    }, [form]);

    const handleGenerate = async () => {
        const parsed = WizardFormSchema.safeParse(form);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message ?? "Preencha os campos obrigatórios";
            toast({ variant: "destructive", title: "Validação", description: firstError });
            return;
        }
        if (!currentOrganization?.id) return;

        try {
            setGenerating(true);
            const systemMessage = buildMasterSystemPrompt(parsed.data);
            const userBriefing = `Gere o prompt completo de atendimento para: ${form.businessName} (${form.niche}). Siga TODAS as instruções do system message. Retorne APENAS o JSON.`;

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

            let generatedFields: Array<{ key: string; value: string }> = [];
            try {
                const cleaned = (data.output || "").replace(/```json|```/g, "").trim();
                const raw = JSON.parse(cleaned);
                const validated = GeneratedOutputSchema.safeParse(raw);
                generatedFields = validated.success ? validated.data : raw;
            } catch {
                generatedFields = [{ key: "Prompt Gerado", value: data.output }];
            }

            const finalFields: PromptField[] = generatedFields.map(f => ({
                ...f,
                id: `${f.key}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }));

            onGenerate(finalFields);
            onOpenChange(false);
            toast({ title: "Prompt Master Gerado!", description: `${finalFields.length} campos criados com metodologia MQL/SQL.` });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Erro desconhecido";
            toast({ variant: "destructive", title: "Erro na geração", description: message });
        } finally {
            setGenerating(false);
        }
    };

    const handleApplyTemplate = (template: typeof PRECONFIGURED_TEMPLATES[0]) => {
        const finalFields: PromptField[] = template.fields.map(f => ({
            ...f,
            id: `${f.key}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));
        onGenerate(finalFields);
        onOpenChange(false);
        toast({ title: "Template Aplicado!", description: `Modelo "${template.name}" com ${finalFields.length} campos.` });
    };

    const STEPS = [StepNegocio, StepAtendente, StepEstrategia, StepEtapas, StepRegras];
    const CurrentStep = STEPS[step];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <DialogTitle className="text-xl">Gerador de Prompt Master</DialogTitle>
                    </div>
                    <DialogDescription>
                        Crie prompts profissionais com metodologia MQL/SQL, tons adaptativos e etapas de atendimento.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col px-6">
                    <TabsList className="w-full justify-start h-11 border-b border-border rounded-none p-1">
                        <TabsTrigger value="wizard" className="gap-2">
                            <Wand2 className="h-4 w-4" />
                            Gerar com I.A
                        </TabsTrigger>
                        <TabsTrigger value="templates" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            Templates Prontos
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{PRECONFIGURED_TEMPLATES.length}</Badge>
                        </TabsTrigger>
                    </TabsList>

                    {/* ─── WIZARD TAB ─── */}
                    <TabsContent value="wizard" className="flex-1 mt-0 flex flex-col">
                        {/* Progress */}
                        <div className="flex items-center gap-1 py-4">
                            {STEP_LABELS.map((s, i) => {
                                const Icon = STEP_ICONS[i];
                                const isCurrent = i === step;
                                const isDone = i < step || filledSteps[i];
                                return (
                                    <div key={i} className="flex items-center gap-1 flex-1">
                                        <button onClick={() => i <= step && setStep(i)}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all w-full justify-center
                        ${isCurrent ? "bg-primary text-primary-foreground" : isDone ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                            <Icon className="h-3.5 w-3.5 shrink-0" />
                                            <span className="hidden sm:inline">{s.title}</span>
                                        </button>
                                        {i < 4 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Step Content */}
                        <ScrollArea className="flex-1 h-[340px] pr-2">
                            <AnimatePresence mode="wait">
                                <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                    <CurrentStep form={form} set={set} />
                                </motion.div>
                            </AnimatePresence>
                        </ScrollArea>

                        {/* Navigation */}
                        <div className="py-4 border-t border-border flex items-center justify-between gap-2">
                            <Button variant="ghost" onClick={() => step === 0 ? onOpenChange(false) : setStep(step - 1)} className="gap-1">
                                <ChevronLeft className="h-4 w-4" />
                                {step === 0 ? "Cancelar" : "Voltar"}
                            </Button>
                            <div className="text-[10px] text-muted-foreground uppercase font-bold">{step + 1} / 5</div>
                            {step < 4 ? (
                                <Button onClick={() => setStep(step + 1)} disabled={!canAdvance} className="gap-1">
                                    Próximo <ChevronRight className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button onClick={handleGenerate} disabled={generating} className="gap-2 min-w-[180px] bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90">
                                    {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4" /> Gerar Prompt Master</>}
                                </Button>
                            )}
                        </div>
                    </TabsContent>

                    {/* ─── TEMPLATES TAB ─── */}
                    <TabsContent value="templates" className="flex-1 mt-0 h-[450px]">
                        <ScrollArea className="h-full pr-4 py-4">
                            <div className="grid grid-cols-1 gap-3">
                                {PRECONFIGURED_TEMPLATES.map(t => (
                                    <div key={t.name} className="group border border-border rounded-xl p-4 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer" onClick={() => handleApplyTemplate(t)}>
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
                                                <ArrowRight className="h-4 w-4 text-primary" />
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
