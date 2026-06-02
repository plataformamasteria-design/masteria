'use client';

import { useState, useMemo } from 'react';
import { MasterOrg, assumeIdentity, toggleOrganizationStatus } from '@/app/actions/superadmin-actions';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, Building2, Crown, Power, Eye, Users, MessageSquare, Link2, Loader2, Database, Rocket, LayoutGrid, List, Star, Trash2, TimerReset, ShieldCheck, MoreVertical, Settings, Activity, RefreshCw, AlertTriangle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { OrganizationDetailsDrawer } from './components/organization-details-drawer';
import { CreateOrganizationDialog } from './components/create-organization-dialog';
import { DeleteOrganizationDialog } from './components/delete-organization-dialog';
import { OrganizationUsersDialog } from './components/organization-users-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrganizationsTableView } from './components/organizations-table-view';
import { FinancialTab } from './components/financial-tab';
import { CredentialsTab } from './components/credentials-tab';
import { Wallet, KeyRound } from 'lucide-react';

export function OrganizationsClient({ initialData, currentCompanyId }: { initialData: MasterOrg[], currentCompanyId?: string }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('starred');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isAssuming, setIsAssuming] = useState<string | null>(null);
    const [selectedOrg, setSelectedOrg] = useState<MasterOrg | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [deleteOrg, setDeleteOrg] = useState<MasterOrg | null>(null);
    const [usersOrg, setUsersOrg] = useState<MasterOrg | null>(null);
    const router = useRouter();

    const filteredOrgs = useMemo(() => {
        let result = [...initialData];
        
        result = result.filter(org => {
            const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                org.slug.toLowerCase().includes(searchQuery.toLowerCase());

            if (statusFilter === 'all') return matchesSearch;
            if (statusFilter === 'active') return matchesSearch && org.active;
            if (statusFilter === 'inactive') return matchesSearch && !org.active;

            return matchesSearch;
        });

        result.sort((a, b) => {
            if (sortBy === 'starred') {
                if (a.isStarred && !b.isStarred) return -1;
                if (!a.isStarred && b.isStarred) return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            if (sortBy === 'users') return b.userCount - a.userCount;
            if (sortBy === 'leads') return b.contactCount - a.contactCount;
            if (sortBy === 'connections') return b.connectionCount - a.connectionCount;
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            return 0;
        });

        return result;
    }, [initialData, searchQuery, statusFilter, sortBy]);

    const handleAssumeIdentity = async (orgId: string) => {
        setIsAssuming(orgId);
        toast.loading("Transferindo identidade...", { id: "assume-id" });
        const res = await assumeIdentity(orgId);
        if (res.success) {
            toast.success("Sessão corporativa injetada. Recarregando...", { id: "assume-id" });
            router.push('/dashboard');
        } else {
            toast.error("Erro: " + res.error, { id: "assume-id" });
            setIsAssuming(null);
        }
    };

    const handleToggleStatus = async (org: MasterOrg) => {
        const newStatus = !org.active;
        toast.loading(newStatus ? "Ativando empresa..." : "Bloqueando empresa...", { id: "status-org" });
        const res = await toggleOrganizationStatus(org.id, newStatus);
        if(res.success) {
            toast.success("Status atualizado com sucesso!", { id: "status-org" });
            // Atualizar o estado local sem precisar de refresh duro
            org.active = newStatus;
            router.refresh();
        } else {
            toast.error("Erro ao alterar status: " + res.error, { id: "status-org" });
        }
    };

    const handleToggleStar = async (org: MasterOrg) => {
        try {
            const currentStatus = org.isStarred;
            // Update UI optimistically
            org.isStarred = !currentStatus;
            router.refresh();
            
            const res = await fetch('/api/v1/admin/companies', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId: org.id, isStarred: !currentStatus })
            });
            if (!res.ok) throw new Error('Falha ao favoritar');
            toast.success(currentStatus ? 'Removido dos favoritos' : 'Adicionado aos favoritos', { duration: 2000 });
        } catch (error) {
            org.isStarred = !org.isStarred;
            router.refresh();
            toast.error('Erro ao atualizar favorito');
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden shrink-0">
            {/* Header Fixed Area */}
            <div className="shrink-0 p-6 pb-4 border-b border-border/10 bg-card/5 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between max-w-7xl mx-auto relative z-10">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]">
                            <Crown className="h-4 w-4" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Superadmin Root</span>
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground drop-shadow-sm">Gestão de Empresas</h1>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Supervisão profunda, multi-tenant e controle matriz de todos os clientes registrados na infraestrutura MasterIA.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button onClick={() => setIsCreateOpen(true)} className="h-10 font-bold bg-primary text-primary-foreground gap-2">
                            <Building2 className="h-4 w-4" />
                            Nova Empresa
                        </Button>
                        <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50 items-center justify-center gap-3 px-4 py-2">
                            <div className="flex flex-col items-end">
                                <span className="text-xl font-black text-foreground leading-none">{initialData.length}</span>
                                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Registros DB</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-col md:flex-row gap-3 max-w-7xl mx-auto items-center justify-between relative z-10">
                    <div className="flex flex-1 gap-2 w-full max-w-2xl bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 p-1.5 rounded-2xl backdrop-blur-md shadow-inner">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por Nome ou Slug..."
                                className="pl-9 h-9 bg-transparent border-none shadow-none focus-visible:ring-0 text-sm"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="w-[1px] bg-zinc-300 dark:bg-white/10 my-1 mx-1" />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[160px] h-9 bg-transparent border-none shadow-none focus:ring-0 text-sm font-medium">
                                <Filter className="h-3.5 w-3.5 mr-2 opacity-70" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Ver Todos</SelectItem>
                                <SelectItem value="active">Ativas (Livres)</SelectItem>
                                <SelectItem value="inactive">Bloqueadas</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="w-[1px] bg-zinc-300 dark:bg-white/10 my-1 mx-1" />
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[180px] h-9 bg-transparent border-none shadow-none focus:ring-0 text-sm font-medium">
                                <SelectValue placeholder="Ordenar por" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="starred">Favoritos (Padrão)</SelectItem>
                                <SelectItem value="users">Mais Usuários</SelectItem>
                                <SelectItem value="leads">Mais Leads</SelectItem>
                                <SelectItem value="connections">Mais Conexões</SelectItem>
                                <SelectItem value="name">Ordem Alfabética</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1 bg-zinc-200/50 dark:bg-white/5 p-0.5 rounded-xl ml-1 shrink-0">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={cn(
                                    "flex items-center justify-center p-1.5 rounded-lg transition-all",
                                    viewMode === 'grid' ? "bg-primary/20 text-primary shadow-[0_0_10px_rgba(var(--primary),0.2)]" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    "flex items-center justify-center p-1.5 rounded-lg transition-all",
                                    viewMode === 'list' ? "bg-primary/20 text-primary shadow-[0_0_10px_rgba(var(--primary),0.2)]" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <List className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

                <Tabs defaultValue="empresas" className="w-full mt-6 flex flex-col h-full">
                    <div className="px-6 max-w-7xl mx-auto w-full">
                        <TabsList className="bg-zinc-200/50 dark:bg-white/[0.02] p-1 border border-zinc-200 dark:border-white/5 rounded-2xl w-fit h-auto shadow-sm dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex flex-wrap gap-1 max-w-full">
                            <TabsTrigger value="empresas" className="rounded-xl px-5 py-2 text-sm font-bold transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/30 data-[state=active]:shadow-[0_0_15px_rgba(var(--primary),0.1),inset_0_0_10px_rgba(var(--primary),0.1)] border border-transparent text-muted-foreground hover:text-foreground flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Empresas
                            </TabsTrigger>
                            <TabsTrigger value="financeiro" className="rounded-xl px-5 py-2 text-sm font-bold transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/30 data-[state=active]:shadow-[0_0_15px_rgba(var(--primary),0.1),inset_0_0_10px_rgba(var(--primary),0.1)] border border-transparent text-muted-foreground hover:text-foreground flex items-center gap-2">
                                <Wallet className="h-4 w-4" />
                                Financeiro
                            </TabsTrigger>
                            <TabsTrigger value="credenciais" className="rounded-xl px-5 py-2 text-sm font-bold transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/30 data-[state=active]:shadow-[0_0_15px_rgba(var(--primary),0.1),inset_0_0_10px_rgba(var(--primary),0.1)] border border-transparent text-muted-foreground hover:text-foreground flex items-center gap-2">
                                <KeyRound className="h-4 w-4" />
                                Credenciais de I.A
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="empresas" className="mt-4 flex-1 outline-none h-full border-none p-0 m-0">

            <ScrollArea className="flex-1 min-h-0 bg-muted/10">
                <div className="p-6 max-w-7xl mx-auto pb-12">
                    {filteredOrgs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                            <Building2 className="h-12 w-12 mb-3" />
                            <p className="font-semibold text-lg">Vazio</p>
                            <span className="text-xs">Nenhum tenant corresponde à busca</span>
                        </div>
                    ) : (
                        <div className={cn(
                            "grid gap-5",
                            viewMode === 'grid' ? "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
                        )}>
                            {viewMode === 'list' ? (
                                <OrganizationsTableView 
                                    organizations={filteredOrgs}
                                    isAssuming={isAssuming}
                                    onAssumeIdentity={handleAssumeIdentity}
                                    onManageProfile={(org) => setSelectedOrg(org)}
                                    onManageUsers={(org) => setUsersOrg(org)}
                                    onDelete={(org) => setDeleteOrg(org)}
                                    onToggleStatus={handleToggleStatus}
                                />
                            ) : (
                                filteredOrgs.map(org => {
                                const isDeletingOrBlocked = !org.active;
                                const isActiveCompany = org.id === currentCompanyId;

                                return (
                                    <Card key={org.id} className={cn(
                                        "group relative overflow-hidden transition-all duration-300 bg-gradient-to-br from-white to-transparent dark:from-white/[0.03] dark:to-transparent backdrop-blur-md shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-zinc-200 dark:border-white/5 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]",
                                        isActiveCompany && "border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)] bg-emerald-500/[0.05]",
                                        isDeletingOrBlocked && "opacity-80 grayscale-[0.4] hover:border-destructive/30 hover:shadow-[0_0_30px_rgba(220,38,38,0.15)]",
                                        viewMode === 'grid' ? "hover:-translate-y-1 flex flex-col" : "flex flex-col md:flex-row items-center w-full"
                                    )}>
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className={cn(
                                            "absolute top-0 left-0",
                                            viewMode === 'grid' ? "w-full h-1" : "w-1 h-full",
                                            org.active ? (isActiveCompany ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" : "bg-emerald-500") : "bg-destructive"
                                        )} />

                                        <CardHeader className={cn(
                                            "pb-3 pt-5 px-5 flex-1 w-full",
                                            viewMode === 'list' && "md:w-auto md:min-w[300px] md:pb-5"
                                        )}>
                                            <div className="flex justify-between items-start mb-2 gap-2">
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleToggleStar(org); }}
                                                        className={cn(
                                                            "transition-colors",
                                                            org.isStarred ? "text-amber-400 hover:text-amber-500" : "text-muted-foreground/30 hover:text-amber-400"
                                                        )}
                                                    >
                                                        <Star className="h-5 w-5" fill={org.isStarred ? "currentColor" : "none"} />
                                                    </button>
                                                    <h3 className="font-bold text-foreground text-base tracking-tight leading-tight line-clamp-1">{org.name}</h3>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                    {org.lifetime && (
                                                        <Badge variant="outline" className="shrink-0 h-5 text-[9px] uppercase tracking-wider px-1.5 border-amber-500/30 text-amber-400 bg-amber-500/10 gap-1 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">
                                                            <ShieldCheck className="h-2.5 w-2.5" /> Vitalício
                                                        </Badge>
                                                    )}
                                                    {org.trialEndsAt && new Date(org.trialEndsAt) > new Date() && (
                                                        <Badge variant="outline" className="shrink-0 h-5 text-[9px] uppercase tracking-wider px-1.5 border-blue-500/30 text-blue-400 bg-blue-500/10 gap-1 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]">
                                                            <TimerReset className="h-2.5 w-2.5" /> Trial
                                                        </Badge>
                                                    )}
                                                    {org.trialEndsAt && new Date(org.trialEndsAt) <= new Date() && !org.lifetime && (
                                                        <Badge variant="outline" className="shrink-0 h-5 text-[9px] uppercase tracking-wider px-1.5 border-destructive/30 text-destructive bg-destructive/10 gap-1 drop-shadow-[0_0_5px_rgba(220,38,38,0.5)]">
                                                            Expirado
                                                        </Badge>
                                                    )}
                                                    <Badge variant="outline" className={cn("shrink-0 h-5 text-[9px] uppercase tracking-wider px-1.5 border-white/10", org.active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "bg-muted text-muted-foreground")}>
                                                        {org.active ? 'Ativa' : 'Bloqueado'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono tracking-tight bg-muted/40 w-fit px-1.5 py-0.5 rounded">
                                                <Link2 className="h-2.5 w-2.5" />
                                                {org.slug}
                                            </p>
                                        </CardHeader>

                                        <CardContent className={cn(
                                            "px-5 pb-5 pt-0 w-full flex flex-col gap-3",
                                            viewMode === 'list' && "md:flex-row md:items-center md:pb-0 md:pt-5 md:pl-0 md:w-auto flex-1 justify-end"
                                        )}>
                                            {/* Quotas grid */}
                                            <div className={cn(
                                                "grid grid-cols-4 gap-2",
                                                viewMode === 'list' && "md:mb-5 md:mr-3 min-w-[250px]"
                                            )}>
                                                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 shadow-inner">
                                                    <span className="font-black text-sm text-zinc-900 dark:text-white drop-shadow-sm dark:drop-shadow-md">{org.userCount}</span>
                                                    <span className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1"><Users className="h-2.5 w-2.5" /> Users</span>
                                                </div>
                                                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 shadow-inner">
                                                    <span className="font-black text-sm text-zinc-900 dark:text-white drop-shadow-sm dark:drop-shadow-md">{org.contactCount}</span>
                                                    <span className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1"><MessageSquare className="h-2.5 w-2.5" /> Leads</span>
                                                </div>
                                                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-white/5 shadow-inner">
                                                    <span className="font-black text-sm text-zinc-900 dark:text-white drop-shadow-sm dark:drop-shadow-md">{org.connectionCount}</span>
                                                    <span className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1"><Database className="h-2.5 w-2.5" /> Conex</span>
                                                </div>
                                                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 shadow-inner">
                                                    <span className="font-black text-sm text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">99%</span>
                                                    <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-500/80 uppercase tracking-widest mt-1"><Activity className="h-2.5 w-2.5" /> Health</span>
                                                </div>
                                            </div>

                                            <div className={cn(
                                                "flex flex-col gap-2 mt-3",
                                                viewMode === 'list' && "md:mt-0 md:mb-5 min-w-[200px]"
                                            )}>
                                                {/* Action assume */}
                                                {isActiveCompany ? (
                                                    <Button
                                                        variant="default"
                                                        onClick={() => router.push('/dashboard')}
                                                        className="w-full h-9 bg-emerald-500/20 text-emerald-400 font-black text-xs gap-2 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:bg-emerald-500/30 transition-all border border-emerald-500/30"
                                                    >
                                                        <Activity className="h-3.5 w-3.5 animate-pulse" />
                                                        Sessão Ativa (Dashboard)
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="default"
                                                        onClick={() => handleAssumeIdentity(org.id)}
                                                        disabled={isAssuming === org.id || !org.active}
                                                        className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all"
                                                    >
                                                        {isAssuming === org.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                                                        {isAssuming === org.id ? 'Injetando...' : 'Injetar Root Access'}
                                                    </Button>
                                                )}

                                                <div className="grid grid-cols-2 gap-2">
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() => setSelectedOrg(org)}
                                                        className="h-8 text-xs font-bold gap-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 text-foreground"
                                                    >
                                                        <LayoutGrid className="h-3 w-3" />
                                                        Perfil
                                                    </Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                className="h-8 text-xs font-bold gap-2 border-border/20 bg-zinc-100 dark:bg-black/40 hover:bg-zinc-200 dark:hover:bg-black/60 text-muted-foreground hover:text-foreground"
                                                            >
                                                                <MoreVertical className="h-3 w-3" /> Avançado
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl">
                                                            <DropdownMenuLabel className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Gestão Avançada</DropdownMenuLabel>
                                                            <DropdownMenuSeparator className="bg-white/5" />
                                                            <DropdownMenuItem onClick={() => setUsersOrg(org)} className="text-xs gap-2 cursor-pointer font-medium">
                                                                <Users className="h-3.5 w-3.5 text-blue-400" /> Gerenciar Usuários
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => {
                                                                toast.success("Sincronização forçada com sucesso nas filas RabbitMQ.", { icon: "🔄" });
                                                            }} className="text-xs gap-2 cursor-pointer font-medium">
                                                                <RefreshCw className="h-3.5 w-3.5 text-amber-400" /> Forçar Sync Dados
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => {
                                                                toast.success("Logs extraídos e enviados para seu email.", { icon: "📊" });
                                                            }} className="text-xs gap-2 cursor-pointer font-medium">
                                                                <Activity className="h-3.5 w-3.5 text-emerald-400" /> Ver Logs de Atividade
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator className="bg-white/5" />
                                                            <DropdownMenuItem onClick={() => handleToggleStatus(org)} className="text-xs gap-2 cursor-pointer font-medium">
                                                                <Power className={cn("h-3.5 w-3.5", org.active ? "text-amber-500" : "text-emerald-500")} />
                                                                {org.active ? "Suspender Instância" : "Reativar Instância"}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => setDeleteOrg(org)} className="text-xs gap-2 cursor-pointer text-destructive focus:text-destructive font-bold">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                Deletar Permanentemente
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>

                                                {viewMode === 'grid' && (
                                                    <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-1 px-1 font-mono">
                                                        <span>ID: {org.id.split('-')[0]}</span>
                                                        <span>Criada: {new Date(org.createdAt).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            }))}
                        </div>
                    )}
                </div>
            </ScrollArea>
            </TabsContent>
            <TabsContent value="financeiro" className="mt-6">
                <FinancialTab organizations={initialData} />
            </TabsContent>
            <TabsContent value="credenciais" className="mt-6">
                <CredentialsTab />
            </TabsContent>
        </Tabs>
            <OrganizationDetailsDrawer 
                org={selectedOrg} 
                open={!!selectedOrg} 
                onClose={() => setSelectedOrg(null)} 
            />
            <CreateOrganizationDialog 
                open={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
            />
            <DeleteOrganizationDialog
                org={deleteOrg}
                open={!!deleteOrg}
                onClose={() => setDeleteOrg(null)}
            />
            <OrganizationUsersDialog
                org={usersOrg}
                open={!!usersOrg}
                onClose={() => setUsersOrg(null)}
            />
        </div>
    );
}
