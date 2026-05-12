import { useState, useRef, useEffect } from "react";
import { Node, Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    X, Play, RotateCcw, Send, Bot, User, Clock, GitBranch,
    Zap, ArrowRightLeft, Image, Mic, FileText, Video,
    Brain, ChevronRight, Gauge, Smartphone, UserSearch,
    Paperclip, Timer, BarChart3, Target, Sparkles, CheckCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlowSimulator, SimMessage, FlowCorrection, FlowSimulatorUIProps, MEDIA_ICONS } from "./hooks/useFlowSimulator";

export function FlowSimulatorUI({ nodes, edges, automationId, onClose, onHighlightNode, onCorrectionsGenerated }: FlowSimulatorUIProps) {
    const props = { nodes, edges, automationId, onClose, onHighlightNode, onCorrectionsGenerated };
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

    return (
        <div className="fixed right-8 top-16 bottom-8 w-[380px] z-50 flex flex-col animate-in slide-in-from-right-5 duration-300">
            {/* iPhone Frame */}
            <div className="flex flex-col h-full rounded-[2.5rem] border-[10px] border-[#d4d5d9] bg-[#efeae2] shadow-2xl relative overflow-hidden ring-1 ring-[#a1a1aa]">

                {/* iPhone Notch Container */}
                <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20 pointer-events-none">
                    <div className="w-[120px] h-[22px] bg-[#d4d5d9] rounded-b-xl" />
                </div>

                {/* Header (WhatsApp Header Style) */}
                <div className="shrink-0 bg-[#008069] pt-8 pb-3 px-4 flex items-center gap-3 shadow-sm z-10">
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/10">
                        <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-white leading-tight truncate">
                            {useVirtualLead ? "IA Vitta Virtual" : "Atendimento Real"}
                        </p>
                        <p className="text-[11px] text-emerald-50/90 truncate">
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 rounded-full" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Messages Area */}
                {/* We use a subtle background color native to WP light mode */}
                <ScrollArea className="flex-1 bg-[#efeae2]">
                    <div className="p-4 space-y-2.5 min-h-full pb-8">
                        {/* Empty state config */}
                        {showLeadSelector && !isRunning && !simFinished && (
                            <div className="flex flex-col items-center justify-center py-6 gap-4">
                                <div className="bg-[#ffeebd] text-[#7a6431] text-[11px] px-4 py-2 rounded-xl text-center shadow-sm w-full font-medium">
                                    Simulador Vittaia
                                </div>
                                <div className="w-full bg-white p-4 rounded-2xl shadow-sm border border-neutral-100 space-y-4">
                                    <p className="text-xs text-neutral-600 text-center">
                                        Para iniciar a automação, selecione o ambiente:
                                    </p>
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <UserSearch className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                                            <Input
                                                value={leadSearch}
                                                onChange={(e) => setLeadSearch(e.target.value)}
                                                placeholder="Buscar lead real..."
                                                className="h-9 text-xs pl-9 bg-neutral-50 border-neutral-200 text-neutral-800 rounded-xl"
                                            />
                                        </div>
                                        {searchingLeads && <p className="text-[10px] text-center text-neutral-500 animate-pulse">Buscando na base...</p>}
                                        {leadResults.length > 0 && (
                                            <div className="space-y-1 max-h-[140px] overflow-y-auto">
                                                {leadResults.map((l) => (
                                                    <button
                                                        key={l.id}
                                                        onClick={() => {
                                                            setSelectedLead(l);
                                                            selectedLeadRef.current = l;
                                                            setUseVirtualLead(false);
                                                            isVirtualRef.current = false;
                                                            setLeadSearch("");
                                                            setLeadResults([]);
                                                        }}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2",
                                                            selectedLead?.id === l.id
                                                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                                                : "bg-neutral-50 hover:bg-neutral-100 text-neutral-700"
                                                        )}
                                                    >
                                                        <User className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{l.name}</span>
                                                        <span className="text-neutral-400 text-[10px] ml-auto">{l.phone}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {selectedLead && !useVirtualLead && (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
                                                <User className="h-3.5 w-3.5 text-emerald-600" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-emerald-800 font-medium truncate">{selectedLead.name}</p>
                                                    <p className="text-[10px] text-emerald-600/70">{selectedLead.phone}</p>
                                                </div>
                                                <button onClick={() => { setSelectedLead(null); selectedLeadRef.current = null; }} className="text-emerald-600/60 hover:text-emerald-600">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        )}
                                        <Button
                                            onClick={() => {
                                                setShowLeadSelector(false);
                                                startSimulation();
                                            }}
                                            className="w-full bg-[#008069] hover:bg-[#006e5a] text-white rounded-xl h-10 shadow-sm disabled:opacity-50"
                                            disabled={!selectedLead}
                                        >
                                            <Play className="h-4 w-4 mr-2" /> Action Real
                                        </Button>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-neutral-200" />
                                        <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">ou</span>
                                        <div className="flex-1 h-px bg-neutral-200" />
                                    </div>

                                    <Button
                                        onClick={() => {
                                            isVirtualRef.current = true;
                                            selectedLeadRef.current = null;
                                            setSelectedLead(null);
                                            setUseVirtualLead(true);
                                            setShowLeadSelector(false);
                                            startSimulation();
                                        }}
                                        variant="outline"
                                        className="w-full border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-xl h-10"
                                    >
                                        <Smartphone className="h-4 w-4 mr-2 text-neutral-500" />
                                        Modo Sandbox (Virtual)
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Rendering Chat Messages */}
                        {messages.map((msg) => (
                            <MessageBubble key={msg.id} message={msg} nodes={nodes} />
                        ))}

                        {/* Route Choice System Message */}
                        {routeChoice && (
                            <div className="my-3 space-y-1.5 flex flex-col items-center">
                                <div className="bg-[#ffeebd] text-[#7a6431] text-[11px] px-4 py-2 rounded-xl text-center shadow-sm w-fit font-medium flex items-center gap-2">
                                    <GitBranch className="h-3 w-3" /> Desvio Condicional Ativo
                                </div>
                                <div className="w-full space-y-1.5 px-4 mt-2">
                                    {routeChoice.options.map((opt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleRouteSelect(opt.targetNodeId)}
                                            className="w-full text-left px-4 py-3 rounded-2xl bg-white shadow-sm border border-neutral-200 text-neutral-700 text-xs hover:border-[#008069] hover:shadow-md transition-all flex items-center gap-3"
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
                                <div className="bg-[#ffeebd] text-[#7a6431] text-[10px] px-3 py-1.5 rounded-lg shadow-sm text-center">
                                    Simulação de Automação Concluída
                                </div>
                                <div className="w-full bg-white rounded-2xl p-3 shadow-sm border border-neutral-100 space-y-2 mt-2">
                                    <p className="text-[11px] text-neutral-500 text-center font-medium mb-1">Ações Pós-Simulação</p>

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
                                        <div className="h-1.5 w-1.5 rounded-full bg-[#008069] animate-bounce [animation-delay:0ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-[#008069] animate-bounce [animation-delay:150ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-[#008069] animate-bounce [animation-delay:300ms]" />
                                    </div>
                                    <span className="text-[11px] text-[#008069] font-medium">
                                        {analysisRunning === 'service' ? 'IA analisando...' : 'IA mapeando...'}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </ScrollArea>

                {/* iPhone/WhatsApp Footer Input */}
                <div className="shrink-0 bg-[#f0f2f5] p-2 relative z-10 border-t border-neutral-200">
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
                            <div className="flex bg-white rounded-full h-10 items-center justify-center px-2 shrink-0 border border-neutral-200">
                                <button type="button" onClick={() => handleMediaAttach("image")} className="h-8 w-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-[#008069] transition-colors">
                                    <Image className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => handleMediaAttach("audio")} className="h-8 w-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-[#008069] transition-colors">
                                    <Mic className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => handleMediaAttach("document")} className="h-8 w-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-[#008069] transition-colors">
                                    <Paperclip className="h-4 w-4" />
                                </button>
                            </div>

                            <Input
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Mensagem"
                                className="flex-1 h-10 text-[13px] bg-white border-neutral-200 text-neutral-800 placeholder:text-neutral-400 rounded-full px-4 shadow-sm focus-visible:ring-0 focus-visible:border-[#008069]"
                                autoFocus
                            />

                            <Button type="submit" size="icon" className="h-10 w-10 rounded-full bg-[#00a884] hover:bg-[#008069] shadow-sm text-white shrink-0" disabled={!userInput.trim()}>
                                <Send className="h-4 w-4 -ml-0.5" />
                            </Button>
                        </form>
                    ) : (
                        <div className="flex items-center h-10 w-full px-1 gap-2">
                            {isRunning ? (
                                <div className="flex-1 flex items-center justify-center px-4 h-full bg-white rounded-full border border-neutral-200 text-[#008069] font-medium text-[11px] gap-2 shadow-sm">
                                    <div className="flex gap-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-[#008069] animate-bounce [animation-delay:0ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-[#008069] animate-bounce [animation-delay:150ms]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-[#008069] animate-bounce [animation-delay:300ms]" />
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
        </div>
    );
}

// -- Message Bubble (WhatsApp Light Mode Style) --
function MessageBubble({ message, nodes }: { message: SimMessage; nodes: Node[] }) {
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
                <div className="bg-[#ffeebd] rounded-xl px-3 py-1.5 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.05)] border border-[#f5e0a3]/30">
                    <p className="text-[10px] text-[#7a6431] text-center font-medium tracking-wide">
                        {message.content}
                    </p>
                </div>
            </div>
        );
    }

    // User Message (Lead) -> WhatsApp Light Green Right side
    if (message.type === "user") {
        return (
            <div className="flex justify-end my-1 px-2">
                <div className="bg-[#d9fdd3] rounded-[1.25rem] rounded-tr-[4px] px-3 py-2 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.08)] relative pb-6 border border-neutral-200/50">
                    <p className="text-[13px] text-[#111b21] whitespace-pre-wrap leading-[1.3] font-normal w-full overflow-hidden">
                        {message.content}
                    </p>
                    <div className="absolute bottom-1 right-2 flex items-center justify-end gap-1">
                        <span className="text-[10px] text-neutral-500 font-medium">
                            {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb] ml-0.5" />
                    </div>
                </div>
            </div>
        );
    }

    // Bot Message -> WhatsApp White Left Side
    const MediaIcon = message.nodeType ? MEDIA_ICONS[message.nodeType] : null;

    return (
        <div className="flex justify-start my-1 px-2">
            <div className="bg-white rounded-[1.25rem] rounded-tl-[4px] px-3 py-2 max-w-[85%] shadow-[0_1px_1px_rgba(0,0,0,0.08)] relative pb-6 border border-neutral-100">
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
                <p className="text-[13px] text-[#111b21] whitespace-pre-wrap leading-[1.3] font-normal w-full overflow-hidden">
                    {message.content}
                </p>
                <div className="absolute bottom-1 right-2 flex items-center justify-end">
                    <span className="text-[10px] text-neutral-400 font-medium tracking-tight">
                        {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
            </div>
        </div>
    );
}
