import { useState, useRef, useEffect } from "react";
import { Node, Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    X, Play, RotateCcw, Send, Bot, User, Clock, GitBranch,
    Zap, ArrowRightLeft, Image, Mic, FileText, Video,
    Brain, ChevronRight, Gauge, Smartphone, UserSearch,
    Paperclip, Timer, BarChart3, Target, Sparkles, CheckCheck, StickyNote
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useFlowSimulator, SimMessage, FlowCorrection, FlowSimulatorUIProps, MEDIA_ICONS } from "./useFlowSimulator";

export function FlowSimulatorUI({ nodes, edges, automationId, onClose, onHighlightNode, onCorrectionsGenerated, onMemoryUpdated, standalone }: FlowSimulatorUIProps) {
    const props = { nodes, edges, automationId, onClose, onHighlightNode, onCorrectionsGenerated, onMemoryUpdated, standalone };
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
    } = useFlowSimulator(props);

    const containerContent = (
        <>
            {/* iPhone Frame */}
            <div className={cn(
                "flex flex-col bg-zinc-50 relative overflow-hidden w-full h-full",
                standalone 
                    ? "sm:max-w-[400px] sm:h-[85vh] sm:border-[10px] sm:border-zinc-800 sm:rounded-[2.5rem] sm:shadow-2xl sm:ring-1 sm:ring-zinc-950" 
                    : "shadow-2xl ring-1 ring-zinc-950 border-[10px] border-zinc-800 rounded-[2.5rem]"
            )}>

                <div className={cn(
                    "absolute top-0 inset-x-0 h-6 justify-center z-20 pointer-events-none",
                    standalone ? "hidden sm:flex" : "flex"
                )}>
                    <div className="w-[120px] h-[22px] bg-zinc-800 rounded-b-xl" />
                </div>

                {/* Header */}
                <div className={cn(
                    "shrink-0 bg-violet-600 pb-3 px-4 flex items-center gap-3 shadow-sm z-10 drag-handle",
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
                        <p className="text-[11px] text-violet-100 truncate">
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
                <ScrollArea className="flex-1 bg-zinc-50">
                    <div className="p-4 space-y-2.5 min-h-full pb-8">
                        {/* Empty state config */}
                        {showLeadSelector && !isRunning && !simFinished && (
                            <div className="flex flex-col items-center justify-center py-6 gap-4">
                                <div className="bg-violet-100 text-violet-700 text-[11px] px-4 py-2 rounded-xl text-center shadow-sm w-full font-medium border border-violet-200">
                                    Simulador Master I.A
                                </div>
                                <div className="w-full bg-white p-4 rounded-2xl shadow-sm border border-neutral-100 space-y-4">
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
                                        className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 shadow-sm"
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Validador de Fluxo
                                    </Button>
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
                                <div className="bg-violet-50 text-violet-600 border border-violet-100 text-[11px] px-4 py-2 rounded-xl text-center shadow-sm w-fit font-medium flex items-center gap-2">
                                    <GitBranch className="h-3 w-3" /> Desvio Condicional Ativo
                                </div>
                                <div className="w-full space-y-1.5 px-4 mt-2">
                                    {routeChoice.options.map((opt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleRouteSelect(opt.targetNodeId)}
                                            className="w-full text-left px-4 py-3 rounded-2xl bg-white shadow-sm border border-neutral-200 text-neutral-700 text-xs hover:border-violet-600 hover:shadow-md transition-all flex items-center gap-3"
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

                        {/* Post-Simulation Actions */}
                        {simFinished && !analysisRunning && (
                            <div className="mt-4 flex flex-col items-center gap-2">
                                <div className="bg-violet-100 border border-violet-200 text-violet-700 text-[10px] px-3 py-1.5 rounded-lg shadow-sm text-center font-medium">
                                    Simulação de Automação Concluída
                                </div>
                                <div className="w-full bg-white rounded-2xl p-3 shadow-sm border border-neutral-100 space-y-2 mt-2">
                                    <p className="text-[11px] text-neutral-500 text-center font-medium mb-1">Ações Pós-Simulação</p>

                                    {!standalone && (
                                        <>
                                            <button
                                                onClick={runServiceAnalysis}
                                                className="w-full flex items-center gap-3 bg-violet-50 text-violet-700 px-3 py-2.5 rounded-xl hover:bg-violet-100 transition-colors"
                                            >
                                                <div className="h-7 w-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                                    <BarChart3 className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <p className="text-xs font-semibold">Analisar Atendimento</p>
                                                    <p className="text-[9px] text-violet-600/70">Qualidade e IA</p>
                                                </div>
                                                <Sparkles className="h-4 w-4 text-violet-300" />
                                            </button>

                                            <button
                                                onClick={runAutomationAnalysis}
                                                className="w-full flex items-center gap-3 bg-amber-50 text-amber-700 px-3 py-2.5 rounded-xl hover:bg-amber-100 transition-colors"
                                            >
                                                <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
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
                                        className="w-full flex items-center gap-3 bg-blue-50 text-blue-700 px-3 py-2.5 rounded-xl hover:bg-blue-100 transition-colors"
                                    >
                                        <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                            <FileText className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="text-xs font-semibold">Exportar Log (Txt)</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {analysisRunning && (
                            <div className="flex justify-center my-3">
                                <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 px-4 py-2 flex items-center gap-3">
                                    <div className="flex gap-1.5">
                                        <div className="h-1.5 w-1.5 rounded-full bg-violet-600 animate-bounce [animation-delay:0ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-violet-600 animate-bounce [animation-delay:150ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-violet-600 animate-bounce [animation-delay:300ms]" />
                                    </div>
                                    <span className="text-[11px] text-violet-600 font-medium">
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
                    "shrink-0 bg-white relative z-10 border-t border-neutral-200",
                    standalone ? "px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:pb-2" : "p-2"
                )}>
                    {/* Floating Timeout Indicator */}
                    {waitingInput && timeoutCountdown !== null && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white px-3 py-1.5 rounded-full shadow-md border border-red-100 flex items-center gap-2">
                            <Timer className="h-3 w-3 text-red-500 animate-pulse" />
                            <span className="text-[10px] font-medium text-red-600">Aguarda {timeoutCountdown}s</span>
                        </div>
                    )}

                    {waitingInput ? (
                        <form onSubmit={(e) => { e.preventDefault(); handleSendInput(); }} className="flex items-center gap-2">
                            {/* Paperclip alternative for media */}
                            <div className="flex bg-neutral-50 rounded-full h-10 items-center justify-center px-2 shrink-0 border border-neutral-200">
                                <button type="button" onClick={() => handleMediaAttach("image")} className="h-8 w-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-violet-600 transition-colors">
                                    <Image className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => handleMediaAttach("audio")} className="h-8 w-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-violet-600 transition-colors">
                                    <Mic className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => handleMediaAttach("document")} className="h-8 w-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-violet-600 transition-colors">
                                    <Paperclip className="h-4 w-4" />
                                </button>
                            </div>

                            <Input
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Mensagem"
                                className="flex-1 h-10 text-[13px] bg-neutral-50 border-neutral-200 text-neutral-800 placeholder:text-neutral-400 rounded-full px-4 shadow-sm focus-visible:ring-0 focus-visible:border-violet-600"
                                autoFocus
                            />

                            <Button type="submit" size="icon" className="h-10 w-10 rounded-full bg-violet-600 hover:bg-violet-700 shadow-sm text-white shrink-0" disabled={!userInput.trim()}>
                                <Send className="h-4 w-4 -ml-0.5" />
                            </Button>
                        </form>
                    ) : (
                        <div className="flex items-center h-10 w-full px-1 gap-2">
                            {isRunning ? (
                                <div className="flex-1 flex items-center justify-center px-4 h-full bg-violet-50 rounded-full border border-violet-100 text-violet-700 font-medium text-[11px] gap-2 shadow-sm">
                                    <div className="flex gap-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-violet-600 animate-bounce [animation-delay:0ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-violet-600 animate-bounce [animation-delay:150ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-violet-600 animate-bounce [animation-delay:300ms]" />
                                    </div>
                                    Processando fluxo...
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center px-4 h-full bg-neutral-100 rounded-full border border-neutral-200 text-neutral-400 font-medium text-[11px] shadow-inner">
                                    {simFinished ? "Automação finalizada" : "Aguardando início"}
                                </div>
                            )}

                            {!isRunning && !simFinished && !showLeadSelector && (
                                <Button size="icon" variant="outline" className="h-10 w-10 rounded-full shrink-0 border-neutral-200 text-neutral-500 hover:text-black bg-white" onClick={fullReset} title="Resetar Tudo">
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
        </>
    );

    if (standalone) {
        return (
            <div className="flex w-full h-[100dvh] sm:items-center sm:justify-center bg-zinc-950 sm:p-4 overflow-hidden">
                {containerContent}
            </div>
        );
    }

    return (
        <motion.div
            drag
            dragHandle=".drag-handle"
            dragMomentum={false}
            className="fixed right-8 top-16 bottom-8 w-[380px] z-50 flex flex-col"
        >
            {containerContent}
        </motion.div>
    );
}


// -- Message Bubble --
function MessageBubble({ message, nodes, onButtonClick }: { message: SimMessage; nodes: Node[]; onButtonClick?: (text: string) => void }) {
    if (message.type === "typing") {
        return (
            <div className="flex justify-start my-1 px-2">
                <div className="bg-white rounded-[1.25rem] rounded-tl-sm px-4 py-2.5 shadow-sm border border-neutral-100 w-fit">
                    <div className="flex gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-neutral-300 animate-bounce [animation-delay:0ms]" />
                        <div className="h-2 w-2 rounded-full bg-neutral-300 animate-bounce [animation-delay:150ms]" />
                        <div className="h-2 w-2 rounded-full bg-neutral-300 animate-bounce [animation-delay:300ms]" />
                    </div>
                </div>
            </div>
        );
    }

    if (message.type === "system") {
        return (
            <div className="flex justify-center my-3">
                <div className="bg-violet-50 rounded-xl px-3 py-1.5 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.05)] border border-violet-100">
                    <p className="text-[10px] text-violet-600 text-center font-medium tracking-wide">
                        {message.content}
                    </p>
                </div>
            </div>
        );
    }

    // Internal Message (Nota) -> Left Side with yellow background
    if (message.type === "internal") {
        return (
            <div className="flex justify-start my-1 px-2">
                <div className="bg-amber-50 rounded-[1.25rem] rounded-tl-[4px] px-4 py-2.5 max-w-[85%] shadow-sm relative pb-6 border border-amber-200">
                    <div className="flex items-center gap-1.5 mb-1 text-amber-600">
                        <StickyNote className="h-3 w-3" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Nota Interna</span>
                    </div>
                    <p className="text-[13px] text-amber-900 whitespace-pre-wrap leading-[1.3] font-medium w-full overflow-hidden">
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
                <div className="bg-violet-600 rounded-[1.25rem] rounded-tr-[4px] px-4 py-2.5 max-w-[85%] shadow-sm relative pb-6">
                    <p className="text-[13px] text-white whitespace-pre-wrap leading-[1.3] font-normal w-full overflow-hidden">
                        {message.content}
                    </p>
                    <div className="absolute bottom-1 right-2 flex items-center justify-end gap-1">
                        <span className="text-[10px] text-violet-200 font-medium">
                            {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <CheckCheck className="h-3.5 w-3.5 text-violet-300 ml-0.5" />
                    </div>
                </div>
            </div>
        );
    }

    // Bot Message -> Left Side
    const MediaIcon = message.nodeType ? MEDIA_ICONS[message.nodeType] : null;

    return (
        <div className="flex justify-start my-1 px-2">
            <div className="bg-white rounded-[1.25rem] rounded-tl-[4px] px-4 py-2.5 max-w-[85%] shadow-sm relative pb-6 border border-neutral-100">
                {message.media && (
                    <div className="rounded-xl overflow-hidden mb-1.5 border border-neutral-100 bg-neutral-100">
                        {message.media.url && !message.media.url.startsWith("data:") ? (
                            <img
                                src={message.media.url}
                                alt={message.media.name || "media"}
                                className="max-h-48 w-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                }}
                            />
                        ) : null}
                        <div className={cn(
                            "h-32 bg-neutral-100 flex items-center justify-center",
                            message.media.url && !message.media.url.startsWith("data:") ? "hidden" : ""
                        )}>
                            {MediaIcon ? <MediaIcon className="h-10 w-10 text-neutral-300" /> : <FileText className="h-10 w-10 text-neutral-300" />}
                        </div>
                    </div>
                )}
                <p className="text-[13px] text-zinc-800 whitespace-pre-wrap leading-[1.3] font-normal w-full overflow-hidden">
                    {message.content}
                </p>
                {message.buttons && message.buttons.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1.5 w-full">
                        {message.buttons.map((btn) => (
                            <button 
                                key={btn.id}
                                onClick={() => onButtonClick?.(btn.text)}
                                className="w-full bg-violet-50 hover:bg-violet-100 text-violet-700 text-[13px] font-medium py-2 px-3 rounded-lg border border-violet-200 transition-colors shadow-sm"
                            >
                                {btn.text}
                            </button>
                        ))}
                    </div>
                )}
                <div className="absolute bottom-1 right-2 flex items-center justify-end">
                    <span className="text-[10px] text-neutral-400 font-medium tracking-tight">
                        {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
            </div>
        </div>
    );
}
