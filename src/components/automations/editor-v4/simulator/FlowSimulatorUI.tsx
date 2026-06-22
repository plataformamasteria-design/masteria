import { useState, useRef, useEffect } from "react";
import { Node, Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    X, Play, RotateCcw, Send, Bot, User, Clock, GitBranch,
    Zap, ArrowRightLeft, Image, Mic, FileText, Video,
    Brain, ChevronRight, Gauge, Smartphone, UserSearch,
    Paperclip, Timer, BarChart3, Target, Sparkles, CheckCheck, StickyNote, Settings,
    Rocket, MessageCircle, CheckCircle2, XCircle, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';
import { useFlowSimulator, SimMessage, FlowCorrection, FlowSimulatorUIProps, MEDIA_ICONS } from "./useFlowSimulator";
import { RobotDataDashboard } from "./RobotDataDashboard";
import { ThemeToggle } from "@/components/theme-toggle";

export function FlowSimulatorUI({ nodes, edges, automationId, onClose, onHighlightNode, onCorrectionsGenerated, onMemoryUpdated, standalone, disableLearning }: FlowSimulatorUIProps) {
    const props = { nodes, edges, automationId, onClose, onHighlightNode, onCorrectionsGenerated, onMemoryUpdated, standalone, disableLearning };
    const {
        messages,
        currentNodeId,
        isRunning,
        waitingInput,
        routeChoice,
        userInput,
        setUserInput,
        speed,
        setSpeed,
        simFinished,
        analysisRunning,
        selectedLead,
        setSelectedLead,
        leadSearch,
        setLeadSearch,
        leadResults,
        showLeadSelector,
        setShowLeadSelector,
        searchingLeads,
        tokensUsed,
        useVirtualLead,
        setUseVirtualLead,
        timeoutCountdown,
        fileInputRef,
        messagesEndRef,
        cycleSpeed,
        handleSendInput,
        simulateUserInput,
        handleMediaAttach,
        handleRouteSelect,
        startSimulation,
        stopSimulation,
        runServiceAnalysis,
        runAutomationAnalysis,
        fullReset,
        downloadLog,
        currentLeadName,
        selectedLeadRef,
        isVirtualRef,
        learningDecision,
        triggerLearning
    } = useFlowSimulator(props);

    const [showRobotData, setShowRobotData] = useState(false);
    const aiNode = nodes.find(n => n.type === 'ai_agent');

    // Auto scroll hook
    const containerContent = (
        <>
            {/* iPhone Frame */}
            <div className={cn(
                "flex flex-col bg-zinc-50 dark:bg-[#09090b] relative overflow-hidden w-full h-full",
                standalone 
                    ? "sm:max-w-[400px] sm:h-[85vh] sm:border-[4px] sm:border-zinc-800 sm:rounded-[2.5rem] sm:shadow-2xl sm:ring-1 sm:ring-zinc-950" 
                    : "shadow-2xl ring-1 ring-zinc-950 border-[4px] border-zinc-800 rounded-[2.5rem]"
            )}>

                <div className={cn(
                    "absolute top-0 inset-x-0 h-6 justify-center z-20 pointer-events-none",
                    standalone ? "hidden sm:flex" : "flex"
                )}>
                    <div className="w-[120px] h-[22px] bg-zinc-800 rounded-b-xl" />
                </div>

                {/* Header */}
                <div className={cn(
                    "shrink-0 bg-primary pb-3 px-4 flex items-center gap-3 shadow-sm z-10 drag-handle",
                    !standalone && "cursor-grab active:cursor-grabbing",
                    standalone ? "pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-8" : "pt-8"
                )}>
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/10 pointer-events-none">
                        <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0 select-none">
                        <p className="text-[15px] font-semibold text-white leading-tight truncate">
                            {useVirtualLead ? "Master I.A Virtual" : "Atendimento Real"}
                        </p>
                        <p className="text-[11px] text-primary-foreground/70 truncate">
                            {isRunning
                                ? "online simulando..."
                                : simFinished
                                    ? `concluído • ${tokensUsed} tokens`
                                    : showLeadSelector
                                        ? "aguardando lead"
                                        : `com ${currentLeadName}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 rounded-full" onClick={cycleSpeed}>
                            <span className="text-xs font-bold">{speed}x</span>
                        </Button>
                        {!standalone && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 rounded-full" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 bg-zinc-50 dark:bg-[#09090b]">
                    <div className="p-4 space-y-2.5 min-h-full pb-8">
                        {/* Empty state config */}
                        {showLeadSelector && !isRunning && !simFinished && (
                            <div className="flex flex-col items-center justify-center py-6 gap-4">
                                <div className="bg-primary/10 text-primary text-[11px] px-4 py-2 rounded-xl text-center shadow-sm w-full font-medium border border-primary/20">
                                    Simulador Master I.A
                                </div>
                                <div className="w-full bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-neutral-100 dark:border-zinc-800 space-y-4">
                                    <p className="text-xs text-neutral-600 text-center">
                                        Para iniciar a validação da automação, clique abaixo:
                                    </p>

                                    <Button
                                        onClick={() => {
                                            isVirtualRef.current = true;
                                            selectedLeadRef.current = null;
                                            setSelectedLead(null);
                                            setUseVirtualLead(true);
                                            setShowLeadSelector(false);
                                            startSimulation();
                                        }}
                                        className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-10 shadow-sm"
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Validador de Fluxo
                                    </Button>

                                    {aiNode && !disableLearning && (
                                        <Button
                                            onClick={() => setShowRobotData(true)}
                                            variant="outline"
                                            className="w-full text-primary border-primary/20 hover:bg-primary/5 rounded-xl h-10 shadow-sm"
                                        >
                                            <Settings className="h-4 w-4 mr-2" />
                                            Dados do Robô
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Rendering Chat Messages */}
                        {messages.map((msg) => (
                            <MessageBubble key={msg.id} message={msg} nodes={nodes} onButtonClick={simulateUserInput} />
                        ))}

                        {/* Route Choice System Message */}
                        {routeChoice && (
                            <div className="my-3 space-y-1.5 flex flex-col items-center">
                                <div className="bg-primary/5 text-primary border border-primary/10 text-[11px] px-4 py-2 rounded-xl text-center shadow-sm w-fit font-medium flex items-center gap-2">
                                    <GitBranch className="h-3 w-3" /> Desvio Condicional Ativo
                                </div>
                                <div className="w-full space-y-1.5 px-4 mt-2">
                                    {routeChoice.options.map((opt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleRouteSelect(opt.targetNodeId)}
                                            className="w-full text-left px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm border border-neutral-200 dark:border-zinc-800 text-neutral-700 dark:text-zinc-300 text-xs hover:border-primary dark:hover:border-primary hover:shadow-md transition-all flex items-center gap-3"
                                        >
                                            <div className="h-6 w-6 rounded-full bg-neutral-100 flex items-center justify-center shrink-0">
                                                <ChevronRight className="h-3 w-3 text-neutral-500" />
                                            </div>
                                            <span className="flex-1 font-medium">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Learning Memory Decision */}
                        {simFinished && learningDecision === 'pending' && (
                            <div className="mt-4 flex flex-col items-center gap-2">
                                <div className="bg-primary/10 border border-primary/20 text-primary text-[10px] px-3 py-1.5 rounded-lg shadow-sm text-center font-medium">
                                    Simulação de Automação Concluída
                                </div>
                                <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-neutral-100 dark:border-zinc-800 space-y-3 mt-2">
                                    <div className="flex flex-col items-center text-center">
                                        <div className="h-10 w-10 rounded-full flex items-center justify-center border border-neutral-200 mb-2">
                                            <Brain className="h-5 w-5 text-primary" />
                                        </div>
                                        <h4 className="text-[12px] font-bold text-neutral-800">Memória de Aprendizado</h4>
                                        <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                                            Deseja que a I.A. analise este atendimento e aprenda com ele para melhorar respostas futuras?
                                        </p>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                        <Button 
                                            onClick={() => triggerLearning(false)} 
                                            className="flex-1 bg-primary hover:bg-primary/90 text-white h-9 text-[11px] font-medium shadow-sm"
                                        >
                                            <Brain className="h-3.5 w-3.5 mr-1.5" />
                                            Gerar Aprendizado
                                        </Button>
                                        <Button 
                                            onClick={() => triggerLearning(true)} 
                                            variant="outline"
                                            className="flex-1 border-neutral-200 text-neutral-600 hover:bg-neutral-50 h-9 text-[11px] font-medium"
                                        >
                                            <X className="h-3.5 w-3.5 mr-1.5" />
                                            Não Gerar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Post-Simulation Actions */}
                        {simFinished && learningDecision !== 'pending' && learningDecision !== 'generating' && !analysisRunning && (
                            <div className="mt-4 flex flex-col items-center gap-2">
                                <div className="bg-primary/10 border border-primary/20 text-primary text-[10px] px-3 py-1.5 rounded-lg shadow-sm text-center font-medium">
                                    Simulação de Automação Concluída
                                </div>
                                <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl p-3 shadow-sm border border-neutral-100 dark:border-zinc-800 space-y-2 mt-2">
                                    <p className="text-[11px] text-neutral-500 text-center font-medium mb-1">Ações Pós-Simulação</p>

                                    {!standalone && (
                                        <>
                                            <button
                                                onClick={runServiceAnalysis}
                                                className="w-full flex items-center gap-3 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 text-neutral-700 dark:text-zinc-300 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors"
                                            >
                                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                    <BarChart3 className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <p className="text-xs font-semibold">Analisar Atendimento</p>
                                                    <p className="text-[9px] text-primary/70">Qualidade e IA</p>
                                                </div>
                                                <Sparkles className="h-4 w-4 text-primary/50" />
                                            </button>

                                            <button
                                                onClick={runAutomationAnalysis}
                                                className="w-full flex items-center gap-3 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 text-neutral-700 dark:text-zinc-300 px-3 py-2.5 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors"
                                            >
                                                <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-neutral-500">
                                                    <Target className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <p className="text-xs font-semibold">Analisar Traqueamento</p>
                                                    <p className="text-[9px] text-amber-600/70">CRM e Metas</p>
                                                </div>
                                                <Sparkles className="h-4 w-4 text-amber-300" />
                                            </button>
                                        </>
                                    )}

                                    <button
                                        onClick={downloadLog}
                                        className="w-full flex items-center gap-3 bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 text-neutral-700 dark:text-zinc-300 px-3 py-2.5 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
                                    >
                                        <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-neutral-500">
                                            <FileText className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="text-xs font-semibold">Exportar Log (Txt)</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={fullReset}
                                        className="w-full flex items-center gap-3 bg-neutral-100 dark:bg-zinc-800 text-neutral-700 dark:text-zinc-300 px-3 py-2.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-zinc-700 transition-colors"
                                    >
                                        <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-neutral-500">
                                            <RotateCcw className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="text-xs font-semibold">Reiniciar Simulação</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {analysisRunning && (
                            <div className="flex justify-center my-3">
                                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-zinc-800 px-4 py-2 flex items-center gap-3">
                                    <div className="flex gap-1.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                                    </div>
                                    <span className="text-[11px] text-primary font-medium">
                                        {analysisRunning === 'service' ? 'IA analisando...' : 'IA mapeando...'}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* Footer Input */}
                <div className={cn(
                    "shrink-0 bg-white dark:bg-zinc-950 relative z-10 border-t border-neutral-200 dark:border-zinc-800",
                    standalone ? "px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:pb-2" : "p-2"
                )}>
                    {/* Floating Timeout Indicator */}
                    {waitingInput && timeoutCountdown !== null && (
                        <button 
                            type="button"
                            onClick={() => simulateUserInput("__TIMEOUT__")}
                            className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white px-3 py-1.5 rounded-full shadow-md border border-red-200 flex items-center gap-1.5 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                            title="Pular espera"
                        >
                            <Timer className="h-3 w-3 text-red-500 animate-pulse" />
                            <span className="text-[11px] font-bold text-red-600 flex items-center gap-1.5">
                                {timeoutCountdown}s
                                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded-[4px] text-[9px] uppercase tracking-wider hover:bg-red-200">Pular</span>
                            </span>
                        </button>
                    )}

                    {waitingInput ? (
                        <form onSubmit={(e) => { e.preventDefault(); handleSendInput(); }} className="flex items-center gap-2">
                            {/* Paperclip alternative for media */}
                            <div className="flex bg-neutral-50 dark:bg-zinc-900 rounded-full h-10 items-center justify-center px-2 shrink-0 border border-neutral-200 dark:border-zinc-800">
                                <button type="button" onClick={() => handleMediaAttach("image")} className="h-8 w-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-primary transition-colors">
                                    <Image className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => handleMediaAttach("audio")} className="h-8 w-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-primary transition-colors">
                                    <Mic className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => handleMediaAttach("document")} className="h-8 w-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-primary transition-colors">
                                    <Paperclip className="h-4 w-4" />
                                </button>
                            </div>

                            <Input
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Mensagem"
                                className="flex-1 h-10 text-[13px] bg-neutral-50 dark:bg-zinc-900 border-neutral-200 dark:border-zinc-800 text-neutral-800 dark:text-zinc-200 placeholder:text-neutral-400 dark:placeholder:text-zinc-500 rounded-full px-4 shadow-sm focus-visible:ring-0 focus-visible:border-primary"
                                autoFocus
                            />

                            <Button type="submit" size="icon" className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 shadow-sm text-white shrink-0" disabled={!userInput.trim()}>
                                <Send className="h-4 w-4 -ml-0.5" />
                            </Button>
                        </form>
                    ) : (
                        <div className="flex items-center h-10 w-full px-1 gap-2">
                            {isRunning ? (
                                <div className="flex-1 flex items-center justify-center px-4 h-full bg-primary/5 rounded-full border border-primary/10 text-primary font-medium text-[11px] gap-2 shadow-sm">
                                    <div className="flex gap-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                                    </div>
                                    Processando fluxo...
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center px-4 h-full bg-neutral-100 dark:bg-zinc-900 rounded-full border border-neutral-200 dark:border-zinc-800 text-neutral-400 dark:text-zinc-500 font-medium text-[11px] shadow-inner">
                                    {simFinished ? "Automação finalizada" : "Aguardando início"}
                                </div>
                            )}

                            {!isRunning && !simFinished && !showLeadSelector && (
                                <Button size="icon" variant="outline" className="h-10 w-10 rounded-full shrink-0 border-neutral-200 dark:border-zinc-800 text-neutral-500 hover:text-black dark:hover:text-white bg-white dark:bg-zinc-900" onClick={fullReset} title="Resetar Tudo">
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            )}

                            {(isRunning || simFinished) && (
                                <Button size="icon" variant="outline" className="h-10 w-10 rounded-full shrink-0 border-neutral-200 text-neutral-500 hover:text-red-500 bg-white" onClick={fullReset} title="Resetar">
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <RobotDataDashboard 
                isOpen={showRobotData}
                onOpenChange={setShowRobotData}
                aiNode={aiNode}
                automationId={automationId}
                onSaveSuccess={(newPrompt, newNotes) => {
                    if (aiNode && onMemoryUpdated) {
                        onMemoryUpdated(aiNode.id, newNotes);
                    }
                }}
            />
        </>
    );

    if (standalone) {
        return (
            <div className="flex w-full h-[100dvh] sm:items-center sm:justify-center bg-zinc-100 dark:bg-zinc-950 sm:p-4 overflow-hidden relative">
                <div className="absolute top-4 right-4 z-50">
                    <ThemeToggle />
                </div>
                {containerContent}
            </div>
        );
    }

    return (
        <motion.div
            key="simulator"
            drag
            dragHandle=".drag-handle"
            dragMomentum={false}
            style={{ right: 32, top: 64 }}
            className="fixed h-[80vh] max-h-[850px] min-h-[500px] w-[380px] z-[60] flex flex-col"
        >
            {containerContent}
        </motion.div>
    );
}


const EMOJI_TO_ICON: Record<string, React.ElementType> = {
    "🚀": Rocket,
    "🤖": Bot,
    "💬": MessageCircle,
    "✅": CheckCircle2,
    "📤": Send,
    "⏳": Clock,
    "⏱️": Timer,
    "🔀": GitBranch,
    "❌": XCircle,
    "⚠️": AlertTriangle,
    "🧠": Brain,
};

// -- Message Bubble --
function MessageBubble({ message, nodes, onButtonClick }: { message: SimMessage; nodes: Node[]; onButtonClick?: (text: string) => void }) {
    if (message.type === "typing") {
        return (
            <div className="flex justify-start my-1 px-2">
                <div className="bg-white dark:bg-zinc-900 rounded-[1.25rem] rounded-tl-sm px-4 py-2.5 shadow-sm border border-neutral-100 dark:border-zinc-800 w-fit">
                    <div className="flex gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-zinc-600 animate-bounce [animation-delay:0ms]" />
                        <div className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-zinc-600 animate-bounce [animation-delay:150ms]" />
                        <div className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-zinc-600 animate-bounce [animation-delay:300ms]" />
                    </div>
                </div>
            </div>
        );
    }

    if (message.type === "system") {
        let content = message.content;
        let Icon = null;
        
        for (const [emoji, IconComponent] of Object.entries(EMOJI_TO_ICON)) {
            if (content.startsWith(emoji)) {
                Icon = IconComponent;
                content = content.replace(emoji, "").trim();
                break;
            }
        }

        return (
            <div className="flex justify-center my-3">
                <div className="bg-primary/5 dark:bg-primary/10 rounded-xl px-3 py-1.5 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.05)] border border-primary/10 dark:border-primary/20 flex items-center gap-1.5">
                    {Icon && <Icon className="h-3 w-3 text-primary shrink-0" />}
                    <p className="text-[10px] text-primary text-center font-medium tracking-wide">
                        {content}
                    </p>
                </div>
            </div>
        );
    }

    // Internal Message (Nota) -> Left Side with yellow background
    if (message.type === "internal") {
        return (
            <div className="flex justify-start my-1 px-2">
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-[1.25rem] rounded-tl-[4px] px-4 py-2.5 max-w-[85%] shadow-sm relative pb-6 border border-amber-200 dark:border-amber-900/50">
                    <div className="flex items-center gap-1.5 mb-1 text-amber-600 dark:text-amber-500">
                        <StickyNote className="h-3 w-3" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Nota Interna</span>
                    </div>
                    <p className="text-[13px] text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-[1.3] font-medium w-full overflow-hidden">
                        {message.content}
                    </p>
                    <div className="absolute bottom-1 right-2 flex items-center justify-end">
                        <span className="text-[10px] text-amber-500/80 font-medium tracking-tight">
                            {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // User Message (Lead) -> Right side
    if (message.type === "user") {
        return (
            <div className="flex justify-end my-1 px-2">
                <div className="bg-primary rounded-[1.25rem] rounded-tr-[4px] px-4 py-2.5 max-w-[85%] shadow-sm relative pb-6">
                    {message.media && (
                        <div className="rounded-xl overflow-hidden mb-1.5 border border-primary/20 bg-white/10">
                            {message.media.type === "audio" && message.media.url ? (
                                <div className="p-2 flex items-center justify-center">
                                    <audio controls className="w-[240px] max-w-full" src={message.media.url} />
                                </div>
                            ) : message.media.type === "video" && message.media.url ? (
                                <video controls className="max-h-48 w-full object-cover" src={message.media.url} />
                            ) : message.media.url && message.media.type === "image" ? (
                                <img
                                    src={message.media.url}
                                    alt={message.media.name || "media"}
                                    className="max-h-48 w-full object-cover"
                                />
                            ) : message.media.url ? (
                                <div 
                                    className="p-3 bg-white/10 dark:bg-black/20 flex items-center justify-center gap-2 cursor-pointer hover:bg-white/20 transition-colors"
                                    onClick={() => window.open(message.media!.url, '_blank')}
                                    title="Abrir arquivo"
                                >
                                    <FileText className="h-5 w-5 text-white" />
                                    <span className="text-xs text-white truncate max-w-[150px]">{message.media.name || "Arquivo anexo"}</span>
                                </div>
                            ) : (
                                <div className="p-3 bg-white/10 dark:bg-black/20 flex items-center justify-center gap-2">
                                    <FileText className="h-5 w-5 text-white" />
                                    <span className="text-xs text-white truncate max-w-[150px]">{message.media.name || "Arquivo anexo"}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {!!message.content && (
                        <p className="text-[13px] text-white whitespace-pre-wrap leading-[1.3] font-normal w-full overflow-hidden">
                            {message.content.replace(/^(🖼️|🎵|📎)\s/, '')}
                        </p>
                    )}
                    <div className="absolute bottom-1 right-2 flex items-center justify-end gap-1">
                        <span className="text-[10px] text-primary-foreground/70 font-medium">
                            {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/50 ml-0.5" />
                    </div>
                </div>
            </div>
        );
    }

    // Bot Message -> Left Side
    const MediaIcon = message.nodeType ? MEDIA_ICONS[message.nodeType] : null;

    return (
        <div className="flex justify-start my-1 px-2">
            <div className="bg-white dark:bg-zinc-900 rounded-[1.25rem] rounded-tl-[4px] px-4 py-2.5 max-w-[85%] shadow-sm relative pb-6 border border-neutral-100 dark:border-zinc-800">
                {message.media && (
                    <div className="rounded-xl overflow-hidden mb-1.5 border border-neutral-100 dark:border-zinc-800 bg-neutral-100 dark:bg-zinc-800">
                        {message.media.type === "audio" && message.media.url ? (
                            <div className="p-2 bg-neutral-50 dark:bg-zinc-900 flex items-center justify-center">
                                <audio controls className="w-[240px] max-w-full" src={message.media.url} />
                            </div>
                        ) : message.media.type === "video" && message.media.url ? (
                            <video controls className="max-h-48 w-full object-cover" src={message.media.url} />
                    ) : message.media.type === "image" && message.media.url ? (
                            // Simulation image with discreet watermark overlay
                            <div className="relative">
                                <img
                                    src={message.media.url}
                                    alt={message.media.name || "Simulação"}
                                    className="max-h-64 w-full object-contain cursor-pointer block"
                                    onClick={() => window.open(message.media!.url, '_blank')}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                />
                                {/* Discreet watermark — only shown for simulation images with a caption */}
                                {message.media.caption && (
                                    <div className="absolute bottom-1.5 right-1.5 pointer-events-none">
                                        <span
                                            className="text-[8px] font-semibold text-white tracking-wide px-1.5 py-0.5 rounded-md"
                                            style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(2px)' }}
                                        >
                                            ✨ {message.media.caption}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : message.media.type === "document" && message.media.url ? (
                            <div 
                                className="p-4 bg-neutral-100 dark:bg-zinc-800 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-neutral-200 dark:hover:bg-zinc-700 transition-colors"
                                onClick={() => window.open(message.media!.url, '_blank')}
                                title="Abrir documento"
                            >
                                <FileText className="h-8 w-8 text-neutral-400 dark:text-zinc-500" />
                                <span className="text-xs text-neutral-600 dark:text-zinc-400 font-medium truncate w-[200px] text-center px-2">
                                    {message.media.name || "Visualizar Documento"}
                                </span>
                            </div>
                        ) : message.media.url ? (
                            <img
                                src={message.media.url}
                                alt={message.media.name || "media"}
                                className="max-h-64 w-full object-contain cursor-pointer"
                                onClick={() => window.open(message.media!.url, '_blank')}
                                onLoad={(e) => {
                                    const next = (e.target as HTMLImageElement).nextElementSibling;
                                    if (next) (next as HTMLElement).classList.add('hidden');
                                }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                    const next = (e.target as HTMLImageElement).nextElementSibling;
                                    if (next) (next as HTMLElement).classList.remove('hidden');
                                }}
                            />
                        ) : null}
                        <div className={cn(
                            "bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center",
                            message.media.url ? "hidden" : "h-32"
                        )}>
                            {MediaIcon ? <MediaIcon className="h-10 w-10 text-neutral-300 dark:text-zinc-600" /> : <FileText className="h-10 w-10 text-neutral-300 dark:text-zinc-600" />}
                        </div>
                    </div>
                )}
                {!!message.content && (
                    <p className="text-[13px] text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-[1.3] font-normal w-full overflow-hidden">
                        {message.content}
                    </p>
                )}
                {message.buttons && message.buttons.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1.5 w-full">
                        {message.buttons.map((btn) => (
                            <button 
                                key={btn.id}
                                onClick={() => onButtonClick?.(btn.text)}
                                className="w-full bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/20 text-primary dark:text-primary-foreground text-[13px] font-medium py-2 px-3 rounded-lg border border-primary/20 dark:border-primary/30 transition-colors shadow-sm"
                            >
                                {btn.text}
                            </button>
                        ))}
                    </div>
                )}
                <div className="absolute bottom-1 right-2 flex items-center justify-end">
                    <span className="text-[10px] text-neutral-400 dark:text-zinc-500 font-medium tracking-tight">
                        {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
            </div>
        </div>
    );
}
