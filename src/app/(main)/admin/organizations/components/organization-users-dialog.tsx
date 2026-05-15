'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Mail, UserCircle } from 'lucide-react';
import { getOrganizationUsers } from '@/app/actions/superadmin-actions';
import { MasterOrg } from '@/app/actions/superadmin-actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface OrganizationUsersDialogProps {
    org: MasterOrg | null;
    open: boolean;
    onClose: () => void;
}

export function OrganizationUsersDialog({ org, open, onClose }: OrganizationUsersDialogProps) {
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        if (open && org) {
            fetchUsers();
        }
    }, [open, org]);

    const fetchUsers = async () => {
        if (!org) return;
        setLoading(true);
        const res = await getOrganizationUsers(org.id);
        if (res.success && res.data) {
            setUsers(res.data);
        }
        setLoading(false);
    };

    if (!org) return null;

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-2xl bg-background border-border shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20">
                    <DialogTitle className="flex items-center gap-2 text-xl font-black">
                        <Users className="h-5 w-5 text-primary" />
                        Usuários do Tenant
                    </DialogTitle>
                    <DialogDescription>
                        Gerencie os usuários pertencentes à empresa <strong>{org.name}</strong>.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <ScrollArea className="h-[400px]">
                        <div className="p-6 space-y-4">
                            {users.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                                    <UserCircle className="h-10 w-10 mb-2 opacity-50" />
                                    <p>Nenhum usuário cadastrado nesta empresa.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {users.map(user => (
                                        <div key={user.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <Avatar className="h-10 w-10 ring-2 ring-primary/10">
                                                    <AvatarImage src={user.avatarUrl || ''} />
                                                    <AvatarFallback className="bg-primary/5 text-primary font-bold">
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-bold text-sm text-foreground">{user.name}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <Mail className="h-3 w-3" />
                                                        {user.email}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                                                    {user.role}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}
