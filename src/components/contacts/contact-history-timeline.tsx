import { useEffect, useState } from 'react';
import { Loader2, Tag, Kanban, Bot, User, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { RelativeTime } from '@/components/ui/relative-time';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContactEvent {
    id: string;
    type: 'ASSIGNMENT' | 'TAG' | 'KANBAN' | 'AUTOMATION' | 'SYSTEM';
    description: string;
    metadata: any;
    createdAt: string;
}

export function ContactHistoryTimeline({ contactId }: { contactId: string }) {
    const [events, setEvents] = useState<ContactEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const res = await fetch(`/api/v1/contacts/${contactId}/events`);
                if (!res.ok) throw new Error('Falha ao carregar histórico');
                const data = await res.json();
                setEvents(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, [contactId]);

    if (loading) {
        return (
            <div className="flex justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-xs text-red-500 p-4 text-center flex flex-col items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="text-xs text-muted-foreground p-4 text-center">
                Nenhum evento registrado no histórico.
            </div>
        );
    }

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'ASSIGNMENT': return <User className="h-3.5 w-3.5 text-blue-500" />;
            case 'TAG': return <Tag className="h-3.5 w-3.5 text-orange-500" />;
            case 'KANBAN': return <Kanban className="h-3.5 w-3.5 text-purple-500" />;
            case 'AUTOMATION': return <Bot className="h-3.5 w-3.5 text-green-500" />;
            default: return <CheckCircle2 className="h-3.5 w-3.5 text-gray-500" />;
        }
    };

    return (
        <div className="relative border-l border-border/40 ml-3 pl-4 space-y-6 pb-4 pt-2">
            {events.map((event, index) => (
                <div key={event.id} className="relative">
                    <div className="absolute -left-[26px] top-1 h-5 w-5 rounded-full bg-background border border-border/60 flex items-center justify-center">
                        {getEventIcon(event.type)}
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium leading-tight">{event.description}</p>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(event.createdAt).toLocaleString('pt-BR')}
                            <span className="opacity-50">·</span>
                            <RelativeTime date={event.createdAt} />
                        </span>
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                            <div className="mt-1 bg-muted/20 border border-border/40 rounded p-1.5 overflow-x-auto text-[10px] font-mono text-muted-foreground">
                                {JSON.stringify(event.metadata)}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
