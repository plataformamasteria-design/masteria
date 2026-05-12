import { useEffect, useState, useRef } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Play, Pause, XCircle, Loader2, Send, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface BroadcastPayload {
    campaignId: string;
    campaignName: string;
    recipients: string[];
    messageSteps: any[];
    campaignActionType: string;
    selectedAutomationId: string;
    autoAssignTag: boolean;
    autoAssignTagId: string;
    autoAssignFunnel: boolean;
    autoAssignFunnelId: string;
    autoAssignStageId: string;
    delaySeconds: number;
    delayBetweenMessages: number;
    sent: number;
    failed: number;
    status: 'running' | 'paused' | 'completed' | 'cancelled';
}

interface RemoteCampaign {
    id: string;
    name: string;
    status: string;
    sent_count: number;
    total_recipients: number;
}

export function BroadcastRunnerOverlay() {
    const { currentOrganization } = useOrganization();
    const orgId = currentOrganization?.id;
    const [payload, setPayload] = useState<BroadcastPayload | null>(null);
    const [remoteCampaigns, setRemoteCampaigns] = useState<RemoteCampaign[]>([]);
    const abortRef = useRef(false);
    const isExecutingRef = useRef(false);

    // ─── Local execution listener (same browser) ───
    useEffect(() => {
        if (!orgId) return;

        const loadFromStorage = () => {
            const stored = localStorage.getItem(`vitta_active_broadcast_${orgId}`);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    setPayload(parsed);
                    if (parsed.status === 'running' && !isExecutingRef.current) {
                        executeBroadcast(parsed);
                    }
                } catch (e) {
                    console.error("Failed to parse broadcast payload", e);
                }
            }
        };

        loadFromStorage();

        const handleStartEvent = (e: any) => {
            const newPayload = e.detail;
            localStorage.setItem(`vitta_active_broadcast_${orgId}`, JSON.stringify(newPayload));
            setPayload(newPayload);
            if (!isExecutingRef.current) {
                executeBroadcast(newPayload);
            }
        };

        const handleStorageEvent = (e: StorageEvent) => {
            if (e.key === `vitta_active_broadcast_${orgId}` && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    setPayload(parsed);
                    if (parsed.status === 'paused' || parsed.status === 'cancelled') {
                        abortRef.current = true;
                    } else if (parsed.status === 'running' && !isExecutingRef.current) {
                        executeBroadcast(parsed);
                    }
                } catch (err) { }
            } else if (e.key === `vitta_active_broadcast_${orgId}` && !e.newValue) {
                setPayload(null);
                abortRef.current = true;
            }
        };

        window.addEventListener("startBroadcast", handleStartEvent);
        window.addEventListener("storage", handleStorageEvent);

        return () => {
            abortRef.current = true;
            window.removeEventListener("startBroadcast", handleStartEvent);
            window.removeEventListener("storage", handleStorageEvent);
        };
    }, [orgId]);

    // ─── Supabase Realtime: org-wide running campaigns ───
    useEffect(() => {
        if (!orgId) return;

        // Initial fetch
        const fetchRunning = async () => {
            const { data } = await supabase
                .from("broadcast_campaigns")
                .select("id, name, status, sent_count, total_recipients")
                .eq("organization_id", orgId)
                .in("status", ["running", "paused"])
                .order("created_at", { ascending: false })
                .limit(5);
            setRemoteCampaigns(data || []);
        };
        fetchRunning();

        // Subscribe to realtime changes
        const channel = supabase
            .channel(`broadcast-status-${orgId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "broadcast_campaigns",
                    filter: `organization_id=eq.${orgId}`,
                },
                (change: any) => {
                    const record = change.new;
                    if (!record) return;
                    setRemoteCampaigns(prev => {
                        const filtered = prev.filter(c => c.id !== record.id);
                        if (record.status === "running" || record.status === "paused") {
                            return [{
                                id: record.id,
                                name: record.name,
                                status: record.status,
                                sent_count: record.sent_count || 0,
                                total_recipients: record.total_recipients || 0,
                            }, ...filtered];
                        }
                        return filtered; // completed/cancelled → remove from list
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orgId]);

    const resolvePhoneToChatId = async (phone: string, cache: Map<string, string>): Promise<string | null> => {
        if (cache.has(phone)) return cache.get(phone)!;
        if (!orgId) return null;
        const variations = [phone];
        if (phone.startsWith("55") && phone.length === 13) variations.push("55" + phone.substring(2, 4) + phone.substring(5));
        if (phone.startsWith("55") && phone.length === 12) variations.push("55" + phone.substring(2, 4) + "9" + phone.substring(4));

        const { data: existingChat } = await supabase
            .from("chats").select("id").eq("organization_id", orgId).in("phone", variations).limit(1).maybeSingle();

        if (existingChat) {
            cache.set(phone, existingChat.id);
            return existingChat.id;
        }
        return null;
    };

    const executeBroadcast = async (currentPayload: BroadcastPayload) => {
        if (typeof navigator !== 'undefined' && navigator.locks) {
            navigator.locks.request(`vitta_broadcast_${orgId}`, { ifAvailable: true }, async (lock) => {
                if (!lock) return;
                await startLoop(currentPayload);
            });
        } else {
            await startLoop(currentPayload);
        }
    };

    const startLoop = async (currentPayload: BroadcastPayload) => {
        isExecutingRef.current = true;
        abortRef.current = false;
        const chatIdCache = new Map<string, string>();

        let { sent, failed, recipients, messageSteps, campaignActionType, selectedAutomationId, autoAssignTag, autoAssignTagId, autoAssignFunnel, autoAssignFunnelId, autoAssignStageId, delaySeconds, delayBetweenMessages, campaignId } = currentPayload;

        for (let i = sent; i < recipients.length; i++) {
            if (abortRef.current) {
                isExecutingRef.current = false;
                return;
            }

            const phone = recipients[i];
            const chatId = await resolvePhoneToChatId(phone, chatIdCache);

            try {
                if (campaignActionType === "automation" && selectedAutomationId) {
                    const { error: invokeErr } = await supabase.functions.invoke("automation-executor", {
                        body: { trigger_type: "broadcast_campaign", automation_id: selectedAutomationId, chat_id: chatId, organization_id: orgId },
                    });
                    if (invokeErr) console.error("Executor Invoke Err", invokeErr);
                    sent++;
                } else {
                    for (let stepIdx = 0; stepIdx < messageSteps.length; stepIdx++) {
                        if (abortRef.current) break;
                        const step = messageSteps[stepIdx];
                        await supabase.functions.invoke("send-to-evolution", {
                            body: {
                                organization_id: orgId, phone: phone,
                                message: step.content || '', message_type: step.message_type,
                                file_url: step.file_url || null, file_name: step.file_name || null,
                            },
                        });
                        if (chatId) {
                            try {
                                await supabase.from("messages").insert({
                                    chat_id: chatId, organization_id: orgId!,
                                    content: step.content || null, message_type: step.message_type,
                                    file_url: step.file_url || null, file_name: step.file_name || null,
                                    is_from_user: true, sent_from_platform: true,
                                });
                            } catch (e) { console.error("Failed to save broadcast message:", e); }
                        }
                        if (stepIdx < messageSteps.length - 1 && !abortRef.current) {
                            await new Promise(r => setTimeout(r, delayBetweenMessages * 1000));
                        }
                    }
                    sent++;
                    if (chatId && (autoAssignTag || autoAssignFunnel)) {
                        try {
                            if (autoAssignTag && autoAssignTagId) {
                                const { data: existing } = await supabase.from("chat_tags").select("id").eq("chat_id", chatId).eq("tag_id", autoAssignTagId).maybeSingle();
                                if (!existing) await supabase.from("chat_tags").insert({ chat_id: chatId, tag_id: autoAssignTagId, organization_id: orgId! });
                            }
                            if (autoAssignFunnel && autoAssignFunnelId && autoAssignStageId) {
                                await supabase.from("chat_funnel_stage").upsert({
                                    chat_id: chatId, funnel_id: autoAssignFunnelId, stage_id: autoAssignStageId, organization_id: orgId!,
                                }, { onConflict: "chat_id,funnel_id" });
                            }
                        } catch { }
                    }
                }
            } catch { failed++; }

            const isLast = i === recipients.length - 1;
            const newStatus = abortRef.current ? "paused" : isLast ? "completed" : "running";

            const updatedPayload = { ...currentPayload, sent, failed, status: newStatus as any };
            setPayload(updatedPayload);
            localStorage.setItem(`vitta_active_broadcast_${orgId}`, JSON.stringify(updatedPayload));

            await supabase.from("broadcast_campaigns").update({
                sent_count: sent, failed_count: failed,
                status: newStatus,
                completed_at: isLast || (abortRef.current && currentPayload.status === 'cancelled') ? new Date().toISOString() : null,
            }).eq("id", campaignId);

            if (!isLast && !abortRef.current) {
                await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
            }
        }

        if (!abortRef.current) {
            toast({ title: "Disparo Concluído!", description: `Finalizado com ${sent} envios confirmados.` });
            setTimeout(() => {
                setPayload(null);
                localStorage.removeItem(`vitta_active_broadcast_${orgId}`);
            }, 5000);
        }
        isExecutingRef.current = false;
    };

    const handlePause = () => {
        abortRef.current = true;
        if (payload) {
            const up = { ...payload, status: 'paused' as any };
            setPayload(up);
            localStorage.setItem(`vitta_active_broadcast_${orgId}`, JSON.stringify(up));
            toast({ title: "Disparo Pausado", description: "O processamento foi interrompido com segurança." });
        }
    };

    const handleResume = () => {
        if (payload) {
            const up = { ...payload, status: 'running' as any };
            setPayload(up);
            localStorage.setItem(`vitta_active_broadcast_${orgId}`, JSON.stringify(up));
            executeBroadcast(up);
            toast({ title: "Disparo Retomado", description: "O envio continuará do número onde parou." });
        }
    };

    const handleCancel = async () => {
        abortRef.current = true;
        if (payload) {
            await supabase.from("broadcast_campaigns").update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq("id", payload.campaignId);
            setPayload(null);
            localStorage.removeItem(`vitta_active_broadcast_${orgId}`);
            toast({ title: "Disparo Cancelado Permanentemente" });
        }
    };

    // Filter remote campaigns that are NOT the local one (avoid duplicate cards)
    const localCampaignId = payload?.campaignId;
    const visibleRemote = remoteCampaigns.filter(c => c.id !== localCampaignId);

    const hasLocal = payload && payload.status !== 'completed';
    const hasRemote = visibleRemote.length > 0;

    if (!hasLocal && !hasRemote) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] space-y-3 animate-in slide-in-from-bottom-5">
            {/* ── Local execution card (full controls) ── */}
            {hasLocal && (
                <Card className="border-primary/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-2xl">
                    <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Send className={`h-4 w-4 shrink-0 ${payload!.status === 'running' ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                                <span className="font-semibold text-sm truncate" title={payload!.campaignName}>
                                    {payload!.campaignName}
                                </span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                {payload!.status === 'running' ? (
                                    <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-amber-500/10 hover:text-amber-500" onClick={handlePause} title="Pausar Envio">
                                        <Pause className="h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-500" onClick={handleResume} title="Retomar Envio">
                                        <Play className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={handleCancel} title="Cancelar Fatalmente">
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Progress value={payload!.recipients.length > 0 ? Math.round((payload!.sent / payload!.recipients.length) * 100) : 0} className="h-2" />
                            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground pt-1">
                                <span>
                                    {payload!.status === 'running' ? (
                                        <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin text-primary" /> Enviando em 2º plano</span>
                                    ) : (
                                        <span className="text-amber-500">Envio Pausado</span>
                                    )}
                                </span>
                                <span>{payload!.sent} / {payload!.recipients.length} ({payload!.recipients.length > 0 ? Math.round((payload!.sent / payload!.recipients.length) * 100) : 0}%)</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Remote campaigns (read-only, for other org members) ── */}
            {visibleRemote.map(rc => {
                const pct = rc.total_recipients > 0 ? Math.round((rc.sent_count / rc.total_recipients) * 100) : 0;
                return (
                    <Card key={rc.id} className="border-muted-foreground/20 bg-background/90 backdrop-blur-xl shadow-lg">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="font-medium text-sm truncate" title={rc.name}>
                                    {rc.name}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto shrink-0 ${rc.status === 'running' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500'}`}>
                                    {rc.status === 'running' ? 'Enviando' : 'Pausado'}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <Progress value={pct} className="h-1.5" />
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        {rc.status === 'running' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                                        Disparo de outro usuário
                                    </span>
                                    <span>{rc.sent_count}/{rc.total_recipients} ({pct}%)</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
