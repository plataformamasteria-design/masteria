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
import { Search, Filter, Building2, Crown, Power, Eye, Users, MessageSquare, Link2, Loader2, Database, Rocket, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { OrganizationDetailsDrawer } from './components/organization-details-drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrganizationsTableView } from './components/organizations-table-view';
import { FinancialTab } from './components/financial-tab';
import { CredentialsTab } from './components/credentials-tab';
import { Wallet, KeyRound } from 'lucide-react';

export function OrganizationsClient({ initialData }: { initialData: MasterOrg[] }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isAssuming, setIsAssuming] = useState<string | null>(null);
    const [selectedOrg, setSelectedOrg] = useState<MasterOrg | null>(null);
    const router = useRouter();

    const filteredOrgs = useMemo(() => {
        return initialData.filter(org => {
            const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                org.slug.toLowerCase().includes(searchQuery.toLowerCase());

            if (statusFilter === 'all') return matchesSearch;
            if (statusFilter === 'active') return matchesSearch && org.active;
            if (statusFilter === 'inactive') return matchesSearch && !org.active;

            return matchesSearch;
        });
    }, [initialData, searchQuery, statusFilter]);

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

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden shrink-0">
            {/* Header Fixed Area */}
            <div className="shrink-0 p-6 pb-4 border-b border-border/40 bg-card/10 backdrop-blur-md">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between max-w-7xl mx-auto">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-primary">
                            <Crown className="h-4 w-4" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Superadmin Root</span>
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Gestão de Empresas</h1>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Supervisão profunda, multi-tenant e controle matriz de todos os clientes registrados na infraestrutura MasterIA.
                        </p>
                    </div>

                    <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50 items-center justify-center gap-3 px-4 py-2">
                        <div className="flex flex-col items-end">
                            <span className="text-xl font-black text-foreground leading-none">{initialData.length}</span>
                            <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Registros DB</span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-col md:flex-row gap-3 max-w-7xl mx-auto items-center justify-between">
                    <div className="flex flex-1 gap-3 w-full max-w-xl">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por Nome ou Slug..."
                                className="pl-9 h-10 bg-background shadow-sm border-border/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[160px] h-10 bg-background shadow-sm border-border/50">
                                <Filter className="h-3.5 w-3.5 mr-2 opacity-70" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Ver Todos</SelectItem>
                                <SelectItem value="active">Ativas (Livres)</SelectItem>
                                <SelectItem value="inactive">Bloqueadas</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex bg-background border border-border/50 rounded-xl overflow-hidden shadow-sm h-10 p-1 shrink-0">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={cn(
                                    "flex items-center justify-center p-2 rounded-lg transition-colors",
                                    viewMode === 'grid' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                                )}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    "flex items-center justify-center p-2 rounded-lg transition-colors",
                                    viewMode === 'list' ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                                )}
                            >
                                <List className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    </div>
                </div>

                <Tabs defaultValue="empresas" className="w-full mt-6">
                    <TabsList className="bg-muted/50 border border-border/50">
                        <TabsTrigger value="empresas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                            <Building2 className="h-4 w-4" />
                            Empresas
                        </TabsTrigger>
                        <TabsTrigger value="financeiro" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                            <Wallet className="h-4 w-4" />
                            Financeiro
                        </TabsTrigger>
                        <TabsTrigger value="credenciais" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                            <KeyRound className="h-4 w-4" />
                            Credenciais de I.A
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="empresas" className="mt-6 flex-1 outline-none h-full border-none p-0 m-0">

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
                                    onToggleStatus={handleToggleStatus}
                                />
                            ) : (
                                filteredOrgs.map(org => {
                                const isDeletingOrBlocked = !org.active;

                                return (
                                    <Card key={org.id} className={cn(
                                        "group relative overflow-hidden transition-all duration-300 border-border/40 bg-card hover:border-border",
                                        isDeletingOrBlocked && "opacity-80 grayscale-[0.4]",
                                        viewMode === 'grid' ? "hover:-translate-y-1 hover:shadow-xl flex flex-col" : "flex flex-col md:flex-row items-center w-full shadow-sm hover:shadow-md"
                                    )}>
                                        <div className={cn(
                                            "absolute top-0 left-0",
                                            viewMode === 'grid' ? "w-full h-1" : "w-1 h-full",
                                            org.active ? "bg-emerald-500" : "bg-destructive"
                                        )} />

                                        <CardHeader className={cn(
                                            "pb-3 pt-5 px-5 flex-1 w-full",
                                            viewMode === 'list' && "md:w-auto md:min-w[300px] md:pb-5"
                                        )}>
                                            <div className="flex justify-between items-start mb-2 gap-2">
                                                <h3 className="font-bold text-foreground text-base tracking-tight leading-tight line-clamp-1">{org.name}</h3>
                                                <Badge variant={org.active ? 'default' : 'secondary'} className={cn("shrink-0 h-5 text-[9px] uppercase tracking-wider px-1.5", org.active ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : "")}>
                                                    {org.active ? 'Ativa' : 'Bloqueado'}
                                                </Badge>
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
                                                "grid grid-cols-3 gap-3 p-3 bg-muted/20 border border-border/40 rounded-xl",
                                                viewMode === 'list' && "md:mb-5 md:mr-3 min-w-[200px]"
                                            )}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest"><Users className="h-2.5 w-2.5" /> Users</span>
                                                    <span className="font-black text-sm">{org.userCount}</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest"><MessageSquare className="h-2.5 w-2.5" /> Leads</span>
                                                    <span className="font-black text-sm">{org.contactCount}</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest"><Database className="h-2.5 w-2.5" /> Conex</span>
                                                    <span className="font-black text-sm">{org.connectionCount}</span>
                                                </div>
                                            </div>

                                            <div className={cn(
                                                "flex flex-col gap-3 mt-3",
                                                viewMode === 'list' && "md:mt-0 md:mb-5 min-w-[180px]"
                                            )}>
                                                {/* Action assume */}
                                                <Button
                                                    variant="default"
                                                    onClick={() => handleAssumeIdentity(org.id)}
                                                    disabled={isAssuming === org.id}
                                                    className="w-full h-9 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs gap-2 shadow-none transition-colors border border-primary/20"
                                                >
                                                    {isAssuming === org.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                                                    {isAssuming === org.id ? 'Injetando...' : 'Assumir'}
                                                </Button>

                                                <Button
                                                    variant="secondary"
                                                    onClick={() => setSelectedOrg(org)}
                                                    className="w-full h-9 font-bold text-xs gap-2"
                                                >
                                                    <LayoutGrid className="h-3.5 w-3.5" />
                                                    Gerenciar Perfil
                                                </Button>

                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleToggleStatus(org)}
                                                    className="w-full h-8 text-xs font-semibold gap-2 border-border/50 bg-background/50"
                                                >
                                                    <Power className="h-3 w-3" />
                                                    {org.active ? "Desativar Seco" : "Reativar Total"}
                                                </Button>

                                                {viewMode === 'grid' && (
                                                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                                                        <span>ID: {org.id.split('-')[0]}</span>
                                                        <span>Criada em: {new Date(org.createdAt).toLocaleDateString('pt-BR')}</span>
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
        </div>
    );
}
