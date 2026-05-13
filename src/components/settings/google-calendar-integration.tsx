'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar, CheckCircle2, XCircle, Loader2, ExternalLink, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CalendarInfo {
    id: string;
    name: string;
    primary: boolean;
    accessRole: string;
}

interface ActiveCalendar {
    id: string;
    name: string;
    priority: number;
    isActive: boolean;
}

interface ConnectionStatus {
    connected: boolean;
    calendars: CalendarInfo[];
    selectedCalendarId: string | null;
    activeCalendars: ActiveCalendar[];
}

export function GoogleCalendarIntegration() {
    const [status, setStatus] = useState<ConnectionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeCalendars, setActiveCalendars] = useState<ActiveCalendar[]>([]);
    const [schedulingMode, setSchedulingMode] = useState<'fill_first' | 'round_robin'>('fill_first');
    const { toast } = useToast();

    useEffect(() => {
        checkConnection();
    }, []);

    const checkConnection = async () => {
        try {
            const response = await fetch('/api/v1/integrations/google/calendars');
            if (response.ok) {
                const data = await response.json();
                const connected = data.calendars && data.calendars.length > 0;
                setStatus({
                    connected,
                    calendars: data.calendars || [],
                    selectedCalendarId: data.selectedCalendarId,
                    activeCalendars: data.activeCalendars || [],
                });
                // Load scheduling mode
                if (data.schedulingMode) {
                    setSchedulingMode(data.schedulingMode);
                }
                // Initialize active calendars from DB or fallback
                if (data.activeCalendars && data.activeCalendars.length > 0) {
                    setActiveCalendars(data.activeCalendars);
                } else if (data.selectedCalendarId && connected) {
                    // Backward compat: single calendar
                    const cal = (data.calendars || []).find((c: CalendarInfo) => c.id === data.selectedCalendarId);
                    setActiveCalendars([{
                        id: data.selectedCalendarId,
                        name: cal?.name || data.selectedCalendarId,
                        priority: 1,
                        isActive: true,
                    }]);
                }
            } else {
                setStatus({ connected: false, calendars: [], selectedCalendarId: null, activeCalendars: [] });
            }
        } catch (error) {
            console.error('Error checking Google Calendar connection:', error);
            setStatus({ connected: false, calendars: [], selectedCalendarId: null, activeCalendars: [] });
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        setConnecting(true);
        window.location.href = `/api/v1/integrations/google/connect?redirectUrl=${encodeURIComponent(window.location.pathname)}`;
    };

    const toggleCalendar = useCallback((calendarId: string, calendarName: string) => {
        setActiveCalendars(prev => {
            const existing = prev.find(c => c.id === calendarId);
            if (existing) {
                // Remove
                const filtered = prev.filter(c => c.id !== calendarId);
                // Recalculate priorities
                return filtered.map((c, i) => ({ ...c, priority: i + 1 }));
            } else {
                // Add with next priority
                return [...prev, {
                    id: calendarId,
                    name: calendarName,
                    priority: prev.length + 1,
                    isActive: true,
                }];
            }
        });
    }, []);

    const movePriority = useCallback((calendarId: string, direction: 'up' | 'down') => {
        setActiveCalendars(prev => {
            const sorted = [...prev].sort((a, b) => a.priority - b.priority);
            const index = sorted.findIndex(c => c.id === calendarId);
            if (index < 0) return prev;

            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= sorted.length) return prev;

            // Swap
            [sorted[index], sorted[newIndex]] = [sorted[newIndex], sorted[index]];
            return sorted.map((c, i) => ({ ...c, priority: i + 1 }));
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/v1/integrations/google/calendars', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activeCalendars, schedulingMode }),
            });

            if (response.ok) {
                toast({
                    title: 'Sucesso',
                    description: `${activeCalendars.length} calendário(s) configurado(s) para agendamento!`,
                });
            } else {
                toast({
                    title: 'Erro',
                    description: 'Erro ao salvar calendários',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            console.error('Error saving calendars:', error);
            toast({
                title: 'Erro',
                description: 'Erro ao salvar calendários',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const getPriorityLabel = (priority: number): string => {
        if (priority === 1) return 'Principal';
        return `Fallback ${priority - 1}`;
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    const sortedActive = [...activeCalendars].sort((a, b) => a.priority - b.priority);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Google Calendar</CardTitle>
                            <CardDescription>
                                Conecte sua agenda para que a IA possa agendar reuniões automaticamente
                            </CardDescription>
                        </div>
                    </div>
                    <Badge variant={status?.connected ? 'default' : 'secondary'} className="gap-1">
                        {status?.connected ? (
                            <>
                                <CheckCircle2 className="h-3 w-3" />
                                Conectado
                            </>
                        ) : (
                            <>
                                <XCircle className="h-3 w-3" />
                                Desconectado
                            </>
                        )}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {!status?.connected ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Ao conectar seu Google Calendar, o agente de IA poderá:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                            <li>Verificar sua disponibilidade de horários</li>
                            <li>Agendar reuniões diretamente na sua agenda</li>
                            <li>Enviar convites com link do Google Meet</li>
                            <li>Sugerir horários alternativos quando ocupado</li>
                        </ul>
                        <Button onClick={handleConnect} disabled={connecting} className="w-full sm:w-auto">
                            {connecting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Conectando...
                                </>
                            ) : (
                                <>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Conectar Google Calendar
                                </>
                            )}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Multi-calendar selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Calendários ativos para agendamento
                            </label>
                            <p className="text-xs text-muted-foreground">
                                Selecione os calendários que a IA pode usar. A ordem define a prioridade de agendamento.
                            </p>

                            <div className="space-y-1 border rounded-lg p-2">
                                {status.calendars.map((calendar) => {
                                    const isActive = activeCalendars.some(ac => ac.id === calendar.id);
                                    return (
                                        <div
                                            key={calendar.id}
                                            className={`flex items-center gap-3 p-2 rounded-md transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-muted/50'
                                                }`}
                                        >
                                            <Checkbox
                                                id={`cal-${calendar.id}`}
                                                checked={isActive}
                                                onCheckedChange={() => toggleCalendar(calendar.id, calendar.name)}
                                            />
                                            <label
                                                htmlFor={`cal-${calendar.id}`}
                                                className="flex-1 text-sm cursor-pointer"
                                            >
                                                {calendar.name}
                                                {calendar.primary && (
                                                    <span className="text-xs text-muted-foreground ml-1">(Google Principal)</span>
                                                )}
                                            </label>
                                            {isActive && (
                                                <Badge variant="outline" className="text-xs">
                                                    {getPriorityLabel(
                                                        activeCalendars.find(ac => ac.id === calendar.id)?.priority || 999
                                                    )}
                                                </Badge>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Priority ordering */}
                        {sortedActive.length > 1 && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Ordem de prioridade</label>
                                <p className="text-xs text-muted-foreground">
                                    Se o calendário principal estiver cheio, a IA tentará o próximo automaticamente.
                                </p>
                                <div className="space-y-1 border rounded-lg p-2">
                                    {sortedActive.map((cal, index) => (
                                        <div key={cal.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                                            <Badge variant={index === 0 ? 'default' : 'secondary'} className="text-xs min-w-[80px] justify-center">
                                                {getPriorityLabel(cal.priority)}
                                            </Badge>
                                            <span className="flex-1 text-sm">{cal.name}</span>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    disabled={index === 0}
                                                    onClick={() => movePriority(cal.id, 'up')}
                                                >
                                                    <ArrowUp className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    disabled={index === sortedActive.length - 1}
                                                    onClick={() => movePriority(cal.id, 'down')}
                                                >
                                                    <ArrowDown className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Scheduling mode selector */}
                        {sortedActive.length > 1 && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Modo de agendamento</label>
                                <RadioGroup
                                    value={schedulingMode}
                                    onValueChange={(v) => setSchedulingMode(v as 'fill_first' | 'round_robin')}
                                    className="space-y-2"
                                >
                                    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${schedulingMode === 'fill_first' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-muted/50'
                                        }`}>
                                        <RadioGroupItem value="fill_first" id="mode_fill" className="mt-0.5" />
                                        <label htmlFor="mode_fill" className="cursor-pointer">
                                            <div className="text-sm font-medium">Preenchimento Total</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                Preenche por completo a agenda do Calendário 1 antes de usar o próximo.
                                                Ideal para concentrar agendamentos em um calendário principal.
                                            </div>
                                        </label>
                                    </div>
                                    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${schedulingMode === 'round_robin' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-muted/50'
                                        }`}>
                                        <RadioGroupItem value="round_robin" id="mode_rr" className="mt-0.5" />
                                        <label htmlFor="mode_rr" className="cursor-pointer">
                                            <div className="text-sm font-medium">Preenchimento Sequencial</div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                Distribui os agendamentos entre os calendários em rodízio (1→2→3→1...).
                                                Ideal para balancear a carga entre múltiplos atendentes.
                                            </div>
                                        </label>
                                    </div>
                                </RadioGroup>
                            </div>
                        )}

                        {/* Save button */}
                        <Button onClick={handleSave} disabled={saving || activeCalendars.length === 0} className="w-full sm:w-auto">
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                `Salvar ${activeCalendars.length > 0 ? `(${activeCalendars.length} calendário${activeCalendars.length > 1 ? 's' : ''})` : ''}`
                            )}
                        </Button>

                        <div className="pt-4 border-t">
                            <Button variant="outline" onClick={handleConnect} size="sm">
                                Reconectar conta
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
