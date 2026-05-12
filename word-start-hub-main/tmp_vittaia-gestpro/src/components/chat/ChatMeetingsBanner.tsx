import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, CheckCircle, XCircle, Clock, X, CalendarClock, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EventDialog } from '@/components/agenda/EventDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ChatMeetingsBannerProps {
    chatId: string;
    organizationId: string;
}

interface Meeting {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    attendance_status: string;
    description: string | null;
    location: string | null;
    all_day: boolean;
    color: string | null;
    assigned_to: string | null;
    chat_id: string | null;
    calendar_id?: string | null;
}

export const ChatMeetingsBanner: React.FC<ChatMeetingsBannerProps> = ({ chatId, organizationId }) => {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [now, setNow] = useState(new Date());
    const [dismissedMeetings, setDismissedMeetings] = useState<string[]>([]);
    const [editingEvent, setEditingEvent] = useState<Meeting | null>(null);
    const [cancelMeeting, setCancelMeeting] = useState<Meeting | null>(null);
    const [cancelReason, setCancelReason] = useState("");

    useEffect(() => {
        setDismissedMeetings([]);
    }, [chatId]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchMeetings = async () => {
        if (!chatId || !organizationId) return;
        try {
            const { data, error } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('chat_id', chatId)
                .eq('organization_id', organizationId)
                .order('start_time', { ascending: true });

            if (error) throw error;

            const pendingMeetings = (data || []).filter(m =>
                !m.attendance_status || !['attended', 'no_show', 'cancelled'].includes(m.attendance_status.toLowerCase())
            );

            setMeetings(pendingMeetings);
        } catch (err) {
            console.error("Error fetching meetings for banner:", err);
        }
    };

    useEffect(() => {
        fetchMeetings();

        // Realtime channel for calendar events to auto-update banner (se criado por outro client ou abas)
        const channel = supabase
            .channel(`meetings-banner-${chatId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'calendar_events',
                filter: `chat_id=eq.${chatId}`
            }, () => {
                fetchMeetings();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatId]);

    const updateStatus = async (id: string, status: string, title: string, reason?: string) => {
        try {
            await supabase.from('calendar_events').update({ attendance_status: status }).eq('id', id);

            // Also log system message that attendance was marked!
            let statusText = '';
            if (status === 'attended') statusText = '✅ Compareceu';
            else if (status === 'no_show') statusText = '❌ Não compareceu';
            else if (status === 'cancelled') statusText = `🚫 Cancelado. Motivo: ${reason || 'Não informado'}`;

            if (statusText) {
                await supabase.from('messages').insert({
                    chat_id: chatId,
                    organization_id: organizationId,
                    content: `Status da Reunião (${title}) atualizado: ${statusText}`,
                    message_type: 'system',
                    is_from_user: true
                });
            }
        } catch (e) {
            console.error("Error updating status:", e);
        }
    };

    const visibleMeetings = meetings.filter(m => !dismissedMeetings.includes(m.id));

    if (visibleMeetings.length === 0) return null;

    return (
        <div className="w-full px-4">
            <div className="flex gap-3 overflow-x-auto pb-2 overflow-y-hidden snap-x scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {visibleMeetings.map(m => {
                    const date = new Date(m.start_time);
                    if (isNaN(date.getTime())) return null;

                    const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
                    const past = diffHours < 0;

                    let colorClass = 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/20 text-amber-900 dark:text-amber-400 dark:bg-amber-500/10 dark:hover:bg-amber-500/20';
                    if (past) {
                        colorClass = 'bg-red-500/15 hover:bg-red-500/25 border-red-500/20 text-red-900 dark:text-red-300 dark:bg-red-500/10 dark:hover:bg-red-500/20';
                    } else if (diffHours <= 24) {
                        colorClass = 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30 text-amber-900 dark:text-amber-400 dark:bg-amber-500/15 dark:hover:bg-amber-500/25';
                    }

                    const formatTimeLeft = (targetDate: Date) => {
                        const totalMs = targetDate.getTime() - now.getTime();
                        if (totalMs < 0) return '';

                        const totalSeconds = Math.floor(totalMs / 1000);
                        const h = Math.floor(totalSeconds / 3600);
                        const min = Math.floor((totalSeconds % 3600) / 60);
                        const s = totalSeconds % 60;

                        if (h >= 24) {
                            const d = Math.floor(h / 24);
                            return `Falta ${d}d e ${h % 24}h`;
                        }
                        return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    };

                    const isSingle = visibleMeetings.length === 1;
                    const sizingClass = isSingle ? 'w-full' : 'shrink-0 min-w-[320px] max-w-[90vw]';

                    return (
                        <div key={m.id} className={`${sizingClass} flex items-center justify-between gap-6 px-4 py-2.5 text-xs rounded-2xl border shadow-sm backdrop-blur-md transition-colors ${colorClass} snap-start`}>
                            <div className="flex items-center gap-2 font-bold tracking-tight">
                                {past ? <Clock className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                                <span className="truncate max-w-[130px] sm:max-w-[400px]">
                                    {past ? 'Reunião Pendente: ' : 'Próxima Reunião: '} {format(date, "dd/MM 'às' HH:mm", { locale: ptBR })}
                                    {!past && <span className="ml-1 opacity-80 whitespace-nowrap hidden sm:inline-block font-mono">({formatTimeLeft(date)})</span>}
                                </span>
                            </div>

                            <div className="flex gap-1.5 sm:gap-2 shrink-0 items-center">
                                {past && (
                                    <>
                                        <Button size="sm" variant="ghost" className="h-7 px-2.5 sm:px-3 text-[10px] sm:text-xs font-bold rounded-full bg-white/90 dark:bg-black/60 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-400 shadow-md border border-white/40 dark:border-white/10 transition-transform active:scale-95" onClick={() => updateStatus(m.id, 'attended', m.title)}>
                                            <CheckCircle className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Compareceu</span>
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 px-2.5 sm:px-3 text-[10px] sm:text-xs font-bold rounded-full bg-white/90 dark:bg-black/60 hover:bg-red-500/30 text-red-800 dark:text-red-400 shadow-md border border-white/40 dark:border-white/10 transition-transform active:scale-95" onClick={() => updateStatus(m.id, 'no_show', m.title)}>
                                            <XCircle className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">No-Show</span>
                                        </Button>
                                    </>
                                )}
                                <Button size="icon" variant="ghost" className={`h-7 w-7 rounded-full bg-white/90 dark:bg-black/60 hover:bg-amber-500/30 ${past ? 'text-slate-800 dark:text-slate-300' : 'text-amber-800 dark:text-amber-400'} shadow-md border border-white/40 dark:border-white/10 transition-transform active:scale-95`} title="Remarcar" onClick={() => setEditingEvent(m)}>
                                    <CalendarClock className="w-4 h-4" />
                                </Button>
                                {!past && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-white/90 dark:bg-black/60 hover:bg-red-500/30 text-red-800 dark:text-red-400 shadow-md border border-white/40 dark:border-white/10 transition-transform active:scale-95" title="Cancelar" onClick={() => setCancelMeeting(m)}>
                                        <Ban className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-white/90 dark:bg-black/60 hover:bg-slate-500/30 text-slate-800 dark:text-slate-300 shadow-md border border-white/40 dark:border-white/10 transition-transform active:scale-95 hover:opacity-100" title="Ocultar deste chat" onClick={() => setDismissedMeetings(prev => [...prev, m.id])}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {editingEvent && (
                <EventDialog
                    open={!!editingEvent}
                    onOpenChange={(open) => !open && setEditingEvent(null)}
                    selectedDate={new Date(editingEvent.start_time)}
                    event={editingEvent as any}
                    isRescheduling={true}
                    onEventSaved={() => {
                        setEditingEvent(null);
                        fetchMeetings();
                    }}
                />
            )}

            {cancelMeeting && (
                <Dialog open={!!cancelMeeting} onOpenChange={(open) => !open && setCancelMeeting(null)}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Cancelar Reunião</DialogTitle>
                            <DialogDescription>
                                Você está prestes a cancelar a reunião <b>{cancelMeeting.title}</b>. Por favor, detalhe o motivo do cancelamento.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-2">
                            <Label htmlFor="cancelReason">Motivo do Cancelamento *</Label>
                            <Textarea
                                id="cancelReason"
                                placeholder="Descreva o motivo para manter no histórico do lead..."
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                rows={3}
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCancelMeeting(null)}>Voltar</Button>
                            <Button variant="destructive" onClick={() => {
                                if (!cancelReason.trim()) return;
                                updateStatus(cancelMeeting.id, 'cancelled', cancelMeeting.title, cancelReason);
                                setCancelMeeting(null);
                                setCancelReason("");
                            }}>Confirmar Cancelamento</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};
