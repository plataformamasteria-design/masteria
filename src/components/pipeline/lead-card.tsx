'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Users, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface LeadCardProps {
    lead: {
        id: string;
        phone: string;
        contactName: string | null;
        profilePictureUrl: string | null;
        assignedToName?: string | null;
        teamId?: string | null;
    };
}

export function LeadCard({ lead }: LeadCardProps) {
    const router = useRouter();

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: lead.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab'
    };

    return (
        <div ref={setNodeRef} style={style}>
            <Card
                className="mb-3 glass border border-white/10 hover:border-primary/30 hover:shadow-xl transition-all relative z-10"
                {...attributes}
                {...listeners}
            >
                <CardContent className="p-4 flex flex-col gap-3">
                    {/* Header Info */}
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-sm">
                            <AvatarImage src={lead.profilePictureUrl || undefined} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold text-xs">
                                {lead.contactName?.[0]?.toUpperCase() || lead.phone?.[0] || '?'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">
                                {lead.contactName || "Contato Desconhecido"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                                {lead.phone}
                            </p>
                        </div>
                    </div>

                    {/* Responsibility indicators */}
                    <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
                        {lead.assignedToName && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <User strokeWidth={2.5} className="h-3.5 w-3.5 text-blue-500" />
                                <span className="truncate font-medium">{lead.assignedToName}</span>
                            </div>
                        )}
                        {lead.teamId && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Users strokeWidth={2.5} className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="truncate font-medium capitalize">Equipe alocada</span>
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="pt-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="w-full text-xs h-7 gap-2 bg-primary/10 hover:bg-primary/20 text-primary border-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/atendimentos?chatId=${lead.id}`);
                                }}
                            >
                                <MessageSquare className="h-3 w-3" /> Ver Chat
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
