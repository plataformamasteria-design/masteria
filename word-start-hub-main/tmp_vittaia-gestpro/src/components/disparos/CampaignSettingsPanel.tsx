import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Clock } from "lucide-react";

export function CampaignSettingsPanel({
    autoAssignTag, setAutoAssignTag, autoAssignTagId, setAutoAssignTagId, tags,
    autoAssignFunnel, setAutoAssignFunnel, autoAssignFunnelId, setAutoAssignFunnelId, funnels,
    autoAssignStageId, setAutoAssignStageId, autoAssignStages,
    delaySeconds, setDelaySeconds, delayBetweenMessages, setDelayBetweenMessages,
    scheduleEnabled, setScheduleEnabled, scheduledDate, setScheduledDate,
    scheduledTime, setScheduledTime
}: any) {
    return (
        <>
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> Ações Pós-Envio
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">Atribuir automaticamente etiqueta ou etapa de funil a cada lead que receber a mensagem.</p>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <Switch checked={autoAssignTag} onCheckedChange={setAutoAssignTag} />
                            <Label>Atribuir etiqueta automaticamente</Label>
                        </div>
                        {autoAssignTag && (
                            <Select value={autoAssignTagId} onValueChange={setAutoAssignTagId}>
                                <SelectTrigger><SelectValue placeholder="Selecione a etiqueta" /></SelectTrigger>
                                <SelectContent>
                                    {tags?.map((tag: any) => (
                                        <SelectItem key={tag.id} value={tag.id}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                                {tag.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <Separator />
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <Switch checked={autoAssignFunnel} onCheckedChange={setAutoAssignFunnel} />
                            <Label>Mover para etapa de funil automaticamente</Label>
                        </div>
                        {autoAssignFunnel && (
                            <>
                                <Select value={autoAssignFunnelId} onValueChange={(v) => { setAutoAssignFunnelId(v); setAutoAssignStageId(""); }}>
                                    <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                                    <SelectContent>{funnels?.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                                </Select>
                                {autoAssignFunnelId && (
                                    <Select value={autoAssignStageId} onValueChange={setAutoAssignStageId}>
                                        <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                                        <SelectContent>{autoAssignStages?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Agendamento & Delay
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Delay entre destinatários (s)</Label>
                            <Input type="number" min={3} max={300} value={delaySeconds} onChange={e => setDelaySeconds(Math.max(3, Number(e.target.value)))} className="mt-1" />
                            <p className="text-xs text-muted-foreground mt-1">Mínimo 3s</p>
                        </div>
                        <div>
                            <Label>Delay entre mensagens (s)</Label>
                            <Input type="number" min={0.5} max={30} step={0.5} value={delayBetweenMessages} onChange={e => setDelayBetweenMessages(Math.max(0.5, Number(e.target.value)))} className="mt-1" />
                            <p className="text-xs text-muted-foreground mt-1">Entre etapas da sequência</p>
                        </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-3">
                        <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                        <Label>Agendar envio</Label>
                    </div>
                    {scheduleEnabled && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Data</Label>
                                <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <Label>Hora</Label>
                                <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="mt-1" />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
