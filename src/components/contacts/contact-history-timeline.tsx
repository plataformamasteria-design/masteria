import { useEffect, useState } from 'react';
import { Loader2, Tag, Kanban, CheckCircle2, AlertCircle, Calendar, Zap, UserCheck } from 'lucide-react';
import { RelativeTime } from '@/components/ui/relative-time';

interface ContactEvent {
    id: string;
    type: 'ASSIGNMENT' | 'TAG' | 'KANBAN' | 'AUTOMATION' | 'SYSTEM';
    description: string;
    metadata: any;
    createdAt: string;
}

interface EventStyle {
    icon: React.ReactNode;
    border: string;
    bg: string;
}

const DEFAULT_STYLE: EventStyle = {
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/60" />,
    border: 'border-border/40',
    bg: 'bg-muted/20',
};

const EVENT_STYLES: Partial<Record<ContactEvent['type'], EventStyle>> = {
    ASSIGNMENT: {
        icon: <UserCheck className="h-3.5 w-3.5 text-blue-500" />,
        border: 'border-blue-500/25',
        bg: 'bg-blue-500/5',
    },
    TAG: {
        icon: <Tag className="h-3.5 w-3.5 text-orange-500" />,
        border: 'border-orange-500/25',
        bg: 'bg-orange-500/5',
    },
    KANBAN: {
        icon: <Kanban className="h-3.5 w-3.5 text-purple-500" />,
        border: 'border-purple-500/25',
        bg: 'bg-purple-500/5',
    },
    AUTOMATION: {
        icon: <Zap className="h-3.5 w-3.5 text-emerald-500" />,
        border: 'border-emerald-500/25',
        bg: 'bg-emerald-500/5',
    },
    SYSTEM: DEFAULT_STYLE,
};

/**
 * Parseia o metadata de um evento e retorna label humanizado.
 * Evita exibir JSON bruto ou UUIDs para o usuário final.
 */
function parseMetadata(type: ContactEvent['type'], raw: any): string | null {
    if (!raw) return null;

    // Se vier como string JSON, parsear
    let metadata = raw;
    if (typeof raw === 'string') {
        try { metadata = JSON.parse(raw); } catch { return null; }
    }

    if (typeof metadata !== 'object' || metadata === null) return null;

    try {
        if (type === 'ASSIGNMENT') {
            if (metadata.unassigned) return 'Atribuição removida';
            if (metadata.assignedUserName) return `Agente: ${metadata.assignedUserName}`;
            if (metadata.teamName) return `Equipe: ${metadata.teamName}`;
            // UUID sem nome — não exibir para o usuário
            return null;
        }

        if (type === 'KANBAN') {
            const from = metadata.fromStage as string | undefined;
            const to = (metadata.toStage ?? metadata.stageName) as string | undefined;
            const board = metadata.boardName as string | undefined;
            if (to && from) return `${board ? `[${board}] ` : ''}${from} → ${to}`;
            if (to) return `Etapa: ${to}${board ? ` (${board})` : ''}`;
            return null;
        }

        if (type === 'AUTOMATION') {
            if (metadata.flowName) return `Fluxo: ${metadata.flowName}`;
            if (metadata.action) return `Ação: ${metadata.action}`;
            return null;
        }

        if (type === 'TAG') {
            if (metadata.tagName) {
                return `${metadata.added === false ? 'Removida' : 'Adicionada'}: ${metadata.tagName}`;
            }
            return null;
        }

        // SYSTEM — exibir apenas campos legíveis
        const readableKeys = ['message', 'reason', 'status', 'action', 'note'];
        for (const key of readableKeys) {
            if (metadata[key] && typeof metadata[key] === 'string') {
                return metadata[key] as string;
            }
        }

        return null;
    } catch {
        return null;
    }
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

    return (
        <div className="relative border-l border-border/40 ml-3 pl-4 space-y-4 pb-4 pt-2">
            {events.map((event) => {
                const style: EventStyle = EVENT_STYLES[event.type] ?? DEFAULT_STYLE;
                const detail = parseMetadata(event.type, event.metadata);

                return (
                    <div key={event.id} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[26px] top-2 h-5 w-5 rounded-full bg-background border border-border/60 flex items-center justify-center">
                            {style.icon}
                        </div>

                        <div className={`flex flex-col gap-1 rounded-lg border p-2.5 ${style.border} ${style.bg}`}>
                            <p className="text-[13px] font-medium leading-tight">{event.description}</p>

                            {detail && (
                                <p className="text-[11px] text-muted-foreground/80 font-medium">
                                    {detail}
                                </p>
                            )}

                            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mt-0.5">
                                <Calendar className="h-3 w-3" />
                                {new Date(event.createdAt).toLocaleString('pt-BR')}
                                <span className="opacity-50">·</span>
                                <RelativeTime date={event.createdAt} />
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
