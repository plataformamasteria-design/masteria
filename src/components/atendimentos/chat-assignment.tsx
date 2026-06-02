'use client';

import * as React from 'react';
import { UserPlus, Users, User, Loader2, Check, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    getOrganizationUsers,
    getOrganizationTeams,
    assignChatToUser,
    assignChatToTeam,
    unassignChat,
} from '@/app/actions/chat-assignment';
import { cn } from '@/lib/utils';
import { Conversation } from '@/lib/types';

interface OrganizationUser {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
}

interface OrganizationTeam {
    id: string;
    name: string;
}

interface ChatAssignmentDropdownProps {
    conversation: Conversation;
    onAssignUpdate: () => void; // Trigger a reload or UI update in InboxController
}

export function ChatAssignmentDropdown({ conversation, onAssignUpdate }: ChatAssignmentDropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [users, setUsers] = React.useState<OrganizationUser[]>([]);
    const [teams, setTeams] = React.useState<OrganizationTeam[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [updating, setUpdating] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        if (isOpen && users.length === 0) {
            setLoading(true);
            Promise.all([getOrganizationUsers(), getOrganizationTeams()])
                .then(([usersRes, teamsRes]) => {
                    if (usersRes.success) setUsers(usersRes.data || []);
                    if (teamsRes.success) setTeams(teamsRes.data || []);
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen]);

    const handleAssignToUser = async (userId: string) => {
        setUpdating(true);
        try {
            const res = await assignChatToUser(conversation.id, userId);
            if (res.success) {
                toast({ title: 'Sucesso', description: 'Atribuído ao usuário.' });
                onAssignUpdate();
            } else {
                toast({ title: 'Erro', description: res.error, variant: 'destructive' });
            }
        } finally {
            setUpdating(false);
            setIsOpen(false);
        }
    };

    const handleAssignToTeam = async (teamId: string) => {
        setUpdating(true);
        try {
            const res = await assignChatToTeam(conversation.id, teamId);
            if (res.success) {
                toast({ title: 'Sucesso', description: 'Atribuído à equipe.' });
                onAssignUpdate();
            } else {
                toast({ title: 'Erro', description: res.error, variant: 'destructive' });
            }
        } finally {
            setUpdating(false);
            setIsOpen(false);
        }
    };

    const handleUnassign = async () => {
        setUpdating(true);
        try {
            const res = await unassignChat(conversation.id);
            if (res.success) {
                toast({ title: 'Sucesso', description: 'Atribuição removida.' });
                onAssignUpdate();
            } else {
                toast({ title: 'Erro', description: res.error, variant: 'destructive' });
            }
        } finally {
            setUpdating(false);
            setIsOpen(false);
        }
    };

    const isAssigned = !!conversation.assignedTo || !!conversation.teamId;

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-8 gap-2 rounded-lg text-[11px] font-semibold transition-all duration-200",
                        isAssigned
                            ? "bg-primary/10 text-primary hover:bg-primary/15 border border-primary/20"
                            : "bg-white/[0.02] border border-white/[0.06] text-muted-foreground/80 hover:bg-white/[0.04]"
                    )}
                    disabled={updating || conversation.status === 'ARCHIVED'}
                >
                    {updating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isAssigned ? (
                        conversation.assignedTo ? (
                            <User className="h-3.5 w-3.5" />
                        ) : (
                            <Users className="h-3.5 w-3.5" />
                        )
                    ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden lg:inline truncate max-w-[100px]">
                        {isAssigned
                            ? conversation.assignedUserName || conversation.teamName || 'Atribuído'
                            : 'Atribuir'}
                    </span>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 bg-card/95 backdrop-blur-xl border border-white/[0.08] rounded-xl">
                {loading ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                    </div>
                ) : (
                    <>
                        {isAssigned && (
                            <>
                                <DropdownMenuItem onClick={handleUnassign} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer px-3 py-2 text-[12px] font-medium">
                                    <XCircle className="h-3.5 w-3.5 mr-2" />
                                    Remover Atribuição
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/[0.06]" />
                            </>
                        )}

                        {(teams.length > 0) && (
                            <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-[10px] text-muted-foreground/60 uppercase tracking-widest py-1">
                                    Equipes
                                </DropdownMenuLabel>
                                {teams.map(team => (
                                    <DropdownMenuItem
                                        key={team.id}
                                        onClick={() => handleAssignToTeam(team.id)}
                                        className="cursor-pointer px-3 py-2 flex items-center justify-between text-[13px]"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span>{team.name}</span>
                                        </div>
                                        {conversation.teamId === team.id && <Check className="h-3.5 w-3.5 text-primary" />}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator className="bg-white/[0.06]" />
                            </DropdownMenuGroup>
                        )}

                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-[10px] text-muted-foreground/60 uppercase tracking-widest py-1">
                                Usuários
                            </DropdownMenuLabel>
                            {users.map(user => (
                                <DropdownMenuItem
                                    key={user.id}
                                    onClick={() => handleAssignToUser(user.id)}
                                    className="cursor-pointer px-3 py-2 flex items-center justify-between text-[13px]"
                                >
                                    <div className="flex items-center gap-2 max-w-[170px]">
                                        <Avatar className="h-5 w-5">
                                            <AvatarImage src={user.avatarUrl || ''} />
                                            <AvatarFallback className="text-[9px]">{user.name?.substring(0, 2) || 'US'}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{user.name || user.email}</span>
                                    </div>
                                    {conversation.assignedTo === user.id && <Check className="h-3.5 w-3.5 text-primary" />}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
