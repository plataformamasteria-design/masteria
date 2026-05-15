'use client';

import { MasterOrg } from '@/app/actions/superadmin-actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Rocket, LayoutGrid, Power, Link2, Users, MessageSquare, Database, Trash2, TimerReset, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrganizationsTableViewProps {
    organizations: MasterOrg[];
    isAssuming: string | null;
    onAssumeIdentity: (id: string) => void;
    onManageProfile: (org: MasterOrg) => void;
    onManageUsers: (org: MasterOrg) => void;
    onDelete: (org: MasterOrg) => void;
    onToggleStatus: (org: MasterOrg) => void;
}

export function OrganizationsTableView({
    organizations,
    isAssuming,
    onAssumeIdentity,
    onManageProfile,
    onManageUsers,
    onDelete,
    onToggleStatus
}: OrganizationsTableViewProps) {
    if (organizations.length === 0) {
        return null;
    }

    return (
        <div className="border border-border/40 rounded-xl overflow-hidden bg-card/30">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow>
                        <TableHead className="w-[300px]">Empresa</TableHead>
                        <TableHead>Métricas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {organizations.map((org) => {
                        const isDeletingOrBlocked = !org.active;
                        
                        return (
                            <TableRow 
                                key={org.id}
                                className={cn(
                                    "group transition-colors hover:bg-muted/20",
                                    isDeletingOrBlocked && "opacity-80 grayscale-[0.3]"
                                )}
                            >
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full shrink-0",
                                                org.active ? "bg-emerald-500" : "bg-destructive"
                                            )} />
                                            <span className="font-bold text-foreground truncate">{org.name}</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono bg-muted/40 w-fit px-1.5 py-0.5 rounded">
                                            <Link2 className="h-2.5 w-2.5" />
                                            {org.slug}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground mt-1">
                                            ID: {org.id.split('-')[0]}
                                        </span>
                                    </div>
                                </TableCell>

                                <TableCell>
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col gap-0.5" title="Usuários">
                                            <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest"><Users className="h-2.5 w-2.5" /></span>
                                            <span className="font-semibold text-xs">{org.userCount}</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5" title="Leads">
                                            <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest"><MessageSquare className="h-2.5 w-2.5" /></span>
                                            <span className="font-semibold text-xs">{org.contactCount}</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5" title="Conexões">
                                            <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest"><Database className="h-2.5 w-2.5" /></span>
                                            <span className="font-semibold text-xs">{org.connectionCount}</span>
                                        </div>
                                    </div>
                                </TableCell>

                                <TableCell>
                                    <div className="flex flex-col gap-1.5 items-start">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {org.lifetime && (
                                                <Badge variant="outline" className="h-5 text-[9px] uppercase tracking-wider px-1.5 border-amber-500/30 text-amber-500 bg-amber-500/5 gap-1">
                                                    <ShieldCheck className="h-2.5 w-2.5" /> Vitalício
                                                </Badge>
                                            )}
                                            {org.trialEndsAt && new Date(org.trialEndsAt) > new Date() && (
                                                <Badge variant="outline" className="h-5 text-[9px] uppercase tracking-wider px-1.5 border-blue-500/30 text-blue-500 bg-blue-500/5 gap-1">
                                                    <TimerReset className="h-2.5 w-2.5" /> Trial
                                                </Badge>
                                            )}
                                            {org.trialEndsAt && new Date(org.trialEndsAt) <= new Date() && !org.lifetime && (
                                                <Badge variant="destructive" className="h-5 text-[9px] uppercase tracking-wider px-1.5 gap-1">
                                                    Expirado
                                                </Badge>
                                            )}
                                            <Badge variant={org.active ? 'default' : 'secondary'} className={cn(
                                                "h-5 text-[9px] uppercase tracking-wider px-1.5", 
                                                org.active ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20" : ""
                                            )}>
                                                {org.active ? 'Ativa' : 'Bloqueado'}
                                            </Badge>
                                        </div>
                                        <div className="text-[9px] text-muted-foreground whitespace-nowrap">
                                            Criada: {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                                        </div>
                                    </div>
                                </TableCell>

                                <TableCell>
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onManageProfile(org)}
                                            className="h-8 border-border/50 bg-background hover:bg-muted font-medium text-xs hidden md:flex"
                                            title="Perfil Financeiro e Credenciais"
                                        >
                                            <LayoutGrid className="h-3.5 w-3.5" />
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onManageUsers(org)}
                                            className="h-8 border-border/50 bg-background hover:bg-muted font-medium text-xs hidden md:flex"
                                            title="Gerenciar Usuários"
                                        >
                                            <Users className="h-3.5 w-3.5" />
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onDelete(org)}
                                            className="h-8 border-border/50 bg-background hover:text-destructive hover:bg-destructive/10 font-medium text-xs hidden md:flex"
                                            title="Deletar Permanentemente"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onToggleStatus(org)}
                                            className={cn(
                                                "h-8 text-xs font-semibold border-border/50 hidden md:flex",
                                                org.active ? "hover:text-destructive hover:bg-destructive/10" : "hover:text-emerald-500 hover:bg-emerald-500/10"
                                            )}
                                            title={org.active ? "Bloquear Tenant" : "Reativar Tenant"}
                                        >
                                            <Power className="h-3.5 w-3.5" />
                                        </Button>

                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => onAssumeIdentity(org.id)}
                                            disabled={isAssuming === org.id}
                                            className="h-8 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs gap-1.5 border border-primary/20 shadow-none transition-colors"
                                        >
                                            {isAssuming === org.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                                            {isAssuming === org.id ? 'Injetando...' : 'Assumir'}
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
