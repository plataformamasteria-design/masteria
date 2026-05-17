import { useState, useEffect } from "react";
import { Node } from "@xyflow/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Bot, Save, Plus, HelpCircle, BrainCircuit } from "lucide-react";
import { updateAiNodeConfig } from "@/app/actions/automations-builder";
import { useToast } from "@/hooks/use-toast";

interface RobotDataDashboardProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    aiNode: Node | undefined;
    automationId: string;
    onSaveSuccess: (newPrompt: string, newLearningNotes: string) => void;
}

export function RobotDataDashboard({ isOpen, onOpenChange, aiNode, automationId, onSaveSuccess }: RobotDataDashboardProps) {
    const { toast } = useToast();
    
    const [prompt, setPrompt] = useState("");
    const [faq, setFaq] = useState("");
    
    const [ifSays, setIfSays] = useState("");
    const [doThis, setDoThis] = useState("");
    
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && aiNode) {
            const nodeData = aiNode.data as any;
            const config = nodeData.config || {};
            setPrompt(config.system_message || nodeData.system_message || config.prompt || nodeData.prompt || "");
            setFaq(config.learning_notes || nodeData.learning_notes || "");
            setIfSays("");
            setDoThis("");
        }
    }, [isOpen, aiNode]);

    const handleAddRule = () => {
        if (!ifSays.trim() || !doThis.trim()) return;
        
        const newRule = `- Se o lead falar isso "${ifSays.trim()}", Fale isso "${doThis.trim()}";`;
        const updatedFaq = faq ? `${faq}\n${newRule}` : newRule;
        
        setFaq(updatedFaq);
        setIfSays("");
        setDoThis("");
    };

    const handleSave = async () => {
        if (!aiNode) return;
        setIsSaving(true);
        try {
            await updateAiNodeConfig(automationId, aiNode.id, prompt, faq);
            toast({ title: "Dados salvos com sucesso!" });
            onSaveSuccess(prompt, faq);
            onOpenChange(false);
        } catch (error: any) {
            console.error("Failed to save robot data:", error);
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (!aiNode) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl">
                <DialogHeader className="p-6 pb-4 border-b border-neutral-100 bg-white/50">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight text-neutral-800">
                        <Bot className="h-6 w-6 text-violet-600" />
                        Dados do Robô
                    </DialogTitle>
                    <DialogDescription className="text-neutral-500">
                        Ajuste o prompt base e as regras de F.A.Q (Memória) que a I.A. deve seguir durante os atendimentos.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-neutral-50/30">
                    
                    {/* PROMPT SECTION */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2 uppercase tracking-wide">
                                <BrainCircuit className="h-4 w-4 text-violet-500" />
                                Prompt do Robô
                            </h3>
                        </div>
                        <Textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="min-h-[200px] resize-y bg-white border-neutral-200 focus-visible:ring-violet-500 rounded-xl font-medium text-sm text-neutral-700 shadow-sm leading-relaxed"
                            placeholder="Você é um assistente virtual focado em..."
                        />
                    </div>

                    <div className="h-px w-full bg-neutral-200/60" />

                    {/* F.A.Q SECTION */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2 uppercase tracking-wide">
                                <HelpCircle className="h-4 w-4 text-amber-500" />
                                F.A.Q (Memória de Aprendizado)
                            </h3>
                        </div>

                        {/* Quick Add Rule */}
                        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-3">
                            <span className="text-xs font-semibold text-neutral-500 uppercase">Adicionar Regra Rápida</span>
                            <div className="flex gap-3">
                                <div className="flex-1 space-y-1.5">
                                    <span className="text-[11px] text-neutral-400 font-medium">Se o lead falar isso...</span>
                                    <Input 
                                        placeholder="Ex: onde estão localizados?" 
                                        value={ifSays}
                                        onChange={(e) => setIfSays(e.target.value)}
                                        className="h-9 text-xs rounded-lg"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && ifSays && doThis) {
                                                e.preventDefault();
                                                handleAddRule();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="flex-1 space-y-1.5">
                                    <span className="text-[11px] text-neutral-400 font-medium">Faça isso...</span>
                                    <Input 
                                        placeholder="Ex: Estamos no centro da cidade" 
                                        value={doThis}
                                        onChange={(e) => setDoThis(e.target.value)}
                                        className="h-9 text-xs rounded-lg"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && ifSays && doThis) {
                                                e.preventDefault();
                                                handleAddRule();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="flex items-end pb-[2px]">
                                    <Button 
                                        variant="secondary" 
                                        size="sm" 
                                        onClick={handleAddRule}
                                        disabled={!ifSays.trim() || !doThis.trim()}
                                        className="h-9 bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Textarea 
                            value={faq}
                            onChange={(e) => setFaq(e.target.value)}
                            className="min-h-[150px] resize-y bg-white border-neutral-200 focus-visible:ring-amber-500 rounded-xl font-medium text-sm text-neutral-700 shadow-sm leading-relaxed"
                            placeholder="- Se o lead falar isso..., Fale isso..."
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-neutral-100 bg-neutral-50/80 flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl text-neutral-600">
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20"
                    >
                        {isSaving ? "Salvando..." : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Salvar Alterações
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
