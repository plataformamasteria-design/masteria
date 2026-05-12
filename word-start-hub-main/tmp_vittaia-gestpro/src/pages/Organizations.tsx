import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AppShell from '@/components/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus, Building2, Users, MessageSquare, DollarSign, TrendingUp, Edit,
  ExternalLink, Power, Package, Settings2, CreditCard, Database, Link2,
  Clock, AlertTriangle, Brain, Eye, EyeOff, Save, Loader2, FileText, Search, Filter, Trash2, CheckCircle, Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrganizations, Organization, OrganizationStats } from '@/hooks/useOrganizations';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EvolutionGlobalConfig } from '@/components/organizations/EvolutionGlobalConfig';
import { BackupRestore } from '@/components/organizations/BackupRestore';
import { OrganizationBackupExport } from '@/components/organizations/OrganizationBackupExport';
import { GlobalIntegrationsConfig } from '@/components/organizations/GlobalIntegrationsConfig';
import { PlatformPaymentsTab } from '@/components/organizations/PlatformPaymentsTab';
import { OrgClientDataDialog } from '@/components/organizations/OrgClientDataDialog';
import { AIPromptsManager } from '@/components/organizations/AIPromptsManager';

export default function Organizations() {
  const { organizations, isLoading, orgStats, createOrganization, updateOrganization, deleteOrganization, refreshOrganizations } = useOrganizations();
  const { viewAsOrganization } = useOrganization();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isClientDataDialogOpen, setIsClientDataDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'plataforma',
    active: true,
  });

  const filteredOrgs = useMemo(() => {
    return organizations.filter(org => {
      const matchesSearch = org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.slug.toLowerCase().includes(searchQuery.toLowerCase());

      const trialEndsAt = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
      const isTrial = trialEndsAt && trialEndsAt > new Date();
      const isExpiredTrial = trialEndsAt && trialEndsAt <= new Date();

      if (statusFilter === 'all') return matchesSearch;
      if (statusFilter === 'active') return matchesSearch && org.active && !isTrial;
      if (statusFilter === 'trial') return matchesSearch && isTrial;
      if (statusFilter === 'inactive') return matchesSearch && !org.active;
      if (statusFilter === 'expired') return matchesSearch && isExpiredTrial;

      return matchesSearch;
    });
  }, [organizations, searchQuery, statusFilter]);

  const handleCreateOrganization = async () => {
    if (!formData.name || !formData.slug) return;
    const success = await createOrganization(formData);
    if (success) {
      setIsCreateDialogOpen(false);
      setFormData({ name: '', slug: '', plan: 'plataforma', active: true });
    }
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''),
    }));
  };

  const openEditDialog = (org: Organization) => {
    setSelectedOrg(org);
    setFormData({
      name: org.name,
      slug: org.slug,
      plan: org.plan || 'plataforma',
      active: org.active,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateOrganization = async () => {
    if (!selectedOrg || !formData.name || !formData.slug) return;
    const success = await updateOrganization(selectedOrg.id, formData);
    if (success) {
      setIsEditDialogOpen(false);
      setSelectedOrg(null);
    }
  };

  const handleTogglePlan = async (orgId: string, currentStatus: boolean) => {
    await updateOrganization(orgId, { active: !currentStatus });
  };

  const handleActivateFromTrial = async (orgId: string) => {
    const success = await updateOrganization(orgId, { active: true, trial_ends_at: null });
    if (success) {
      toast.success('Organização ativada com sucesso! Trial encerrado.');
    }
  };

  const handleDeleteOrganization = async () => {
    if (!selectedOrg || deleteConfirmSlug !== selectedOrg.slug) return;

    setIsDeleting(true);
    const success = await deleteOrganization(selectedOrg.id);
    setIsDeleting(false);

    if (success) {
      setIsDeleteDialogOpen(false);
      setDeleteConfirmSlug('');
      setSelectedOrg(null);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-10 w-48" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-[1600px] mx-auto animate-slide-up">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Settings2 className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Painel Admin</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão da Plataforma</h1>
            <p className="text-muted-foreground">
              Supervisão central de organizações, faturamento e infraestrutura
            </p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-glow-primary hover:scale-105 transition-transform duration-200">
                <Plus className="h-4 w-4" />
                Nova Organização
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-white/10">
              <DialogHeader>
                <DialogTitle>Criar Nova Organização</DialogTitle>
                <DialogDescription>Configure os dados básicos da nova sub-conta</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Organização</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Clínica Vitta"
                    className="bg-background/50"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL Identificadora)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">app.vitta.com/</span>
                    <Input
                      id="slug"
                      placeholder="clinica-vitta"
                      className="bg-background/50"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateOrganization}>Criar Organização</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs Main */}
        <Tabs defaultValue="organizations" className="w-full">
          <TabsList className="w-full justify-start bg-transparent border-b rounded-none h-12 p-0 gap-6">
            <TabsTrigger value="organizations" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2 gap-2 shadow-none">
              <Building2 className="h-4 w-4" />
              Organizações
            </TabsTrigger>
            <TabsTrigger value="integrations" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2 gap-2 shadow-none">
              <Link2 className="h-4 w-4" />
              Integrações Globais
            </TabsTrigger>
            <TabsTrigger value="payment" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2 gap-2 shadow-none">
              <CreditCard className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="data" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2 gap-2 shadow-none">
              <Database className="h-4 w-4" />
              Backup & Dados
            </TabsTrigger>
            <TabsTrigger value="ai-prompts" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-2 gap-2 shadow-none">
              <Brain className="h-4 w-4" />
              I.A do Sistema
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organizations" className="space-y-6 mt-6">
            {/* Filters bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/30 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou slug..."
                    className="pl-9 bg-background/50 border-white/10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-40 bg-background/50 border-white/10">
                    <Filter className="h-3.5 w-3.5 mr-2 opacity-70" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="active">Ativas (Pagantes)</SelectItem>
                    <SelectItem value="trial">Em Trial</SelectItem>
                    <SelectItem value="inactive">Inativas</SelectItem>
                    <SelectItem value="expired">Trial Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {organizations.length} Total
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  {organizations.filter(o => o.active).length} Ativas
                </div>
              </div>
            </div>

            <OrgGrid
              organizations={filteredOrgs}
              orgStats={orgStats}
              onEdit={openEditDialog}
              onTogglePlan={handleTogglePlan}
              onToggleLifetime={async (id, current) => {
                await updateOrganization(id, { lifetime: !current, active: true, trial_ends_at: null } as any);
              }}
              onActivateFromTrial={handleActivateFromTrial}
              onViewAs={viewAsOrganization}
              onClientData={(org) => { setSelectedOrg(org); setIsClientDataDialogOpen(true); }}
              onDelete={(org) => { setSelectedOrg(org); setDeleteConfirmSlug(''); setIsDeleteDialogOpen(true); }}
              refreshOrganizations={refreshOrganizations}
            />

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="glass border-white/10">
                <DialogHeader>
                  <DialogTitle>Editar Organização</DialogTitle>
                  <DialogDescription>Modificar as propriedades desta sub-conta</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Nome da Organização</Label>
                    <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-slug">Slug (URL Identificadora)</Label>
                    <Input id="edit-slug" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-white/5">
                    <div className="space-y-0.5">
                      <Label htmlFor="edit-active">Organização Ativa</Label>
                      <p className="text-[10px] text-muted-foreground">Habilitar/Desabilitar acesso total</p>
                    </div>
                    <Switch id="edit-active" checked={formData.active} onCheckedChange={(checked) => setFormData({ ...formData, active: checked })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleUpdateOrganization}>Salvar Alterações</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Deletion Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogContent className="glass border-destructive/20 max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Destruição Permanente
                  </DialogTitle>
                  <DialogDescription>
                    Esta ação é irreversível. Todos os chats, usuários, faturas e automações da organização <strong>{selectedOrg?.name}</strong> serão apagados permanentemente.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>Ao confirmar, o sistema removerá todos os registros vinculados e usuários associados que não pertencem a outras organizações.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delete-slug" className="text-xs">Para confirmar, digite o slug: <strong className="select-all">{selectedOrg?.slug}</strong></Label>
                    <Input
                      id="delete-slug"
                      value={deleteConfirmSlug}
                      onChange={(e) => setDeleteConfirmSlug(e.target.value)}
                      placeholder="Identificador da organização"
                      className="bg-background/50 border-destructive/20 focus-visible:ring-destructive"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Cancelar</Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteOrganization}
                    disabled={isDeleting || deleteConfirmSlug !== selectedOrg?.slug}
                    className="gap-2"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Confirmar Destruição
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <OrgClientDataDialog
              open={isClientDataDialogOpen}
              onOpenChange={setIsClientDataDialogOpen}
              organization={selectedOrg}
            />
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6 mt-6">
            <EvolutionGlobalConfig />
            <AIGlobalCredentials />
            <GlobalIntegrationsConfig />
          </TabsContent>

          <TabsContent value="payment" className="space-y-6 mt-6">
            <PlatformPaymentsTab />
          </TabsContent>

          <TabsContent value="data" className="space-y-6 mt-6">
            <OrganizationBackupExport />
            <BackupRestore />
          </TabsContent>

          <TabsContent value="ai-prompts" className="space-y-6 mt-6">
            <AIPromptsManager />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ===== Billing Day Picker =====
function BillingDayPicker({ orgId, currentDay, onUpdate }: { orgId: string; currentDay: number; onUpdate: () => Promise<void> }) {
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (newDay: string) => {
    setIsSaving(true);
    const { error } = await supabase
      .from('organizations')
      .update({ billing_day: Number(newDay) })
      .eq('id', orgId);

    if (error) {
      toast.error('Erro ao atualizar dia de renovação');
    } else {
      toast.success(`Dia de renovação alterado para dia ${newDay}`);
      await onUpdate();
    }
    setIsSaving(false);
  };

  return (
    <Select value={String(currentDay)} onValueChange={handleChange} disabled={isSaving}>
      <SelectTrigger className="h-8 w-24 text-[10px] bg-background/50 border-white/5">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
          <SelectItem key={day} value={String(day)}>Dia {day}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ===== OrgGrid component =====
function OrgGrid({
  organizations,
  orgStats,
  onEdit,
  onTogglePlan,
  onToggleLifetime,
  onActivateFromTrial,
  onViewAs,
  onClientData,
  onDelete,
  refreshOrganizations,
}: {
  organizations: Organization[];
  orgStats: Record<string, OrganizationStats>;
  onEdit: (org: Organization) => void;
  onTogglePlan: (id: string, active: boolean) => void;
  onToggleLifetime: (id: string, current: boolean) => void;
  onActivateFromTrial: (id: string) => void;
  onViewAs: (id: string) => void;
  onClientData: (org: Organization) => void;
  onDelete: (org: Organization) => void;
  refreshOrganizations: () => Promise<void>;
}) {
  const { currentOrganization } = useOrganization();

  if (organizations.length === 0) {
    return (
      <Card className="border-dashed border-2 bg-transparent">
        <CardContent className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
          <Building2 className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">Nenhuma organização encontrada</p>
          <p className="text-sm text-muted-foreground">Tente ajustar seus filtros de busca</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {organizations.map((org) => {
        const stats = orgStats[org.id] || { totalUsers: 0, totalLeads: 0, totalMessages: 0, totalRevenue: 0 };
        const trialEndsAt = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
        const isTrial = trialEndsAt && trialEndsAt > new Date();
        const isExpired = trialEndsAt && trialEndsAt <= new Date();
        const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
        const isViewing = currentOrganization?.id === org.id;

        return (
          <Card key={org.id} className={cn(
            "group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-white/5 glass",
            isTrial && "ring-1 ring-amber-500/20",
            !org.active && "opacity-80 grayscale-[0.5]"
          )}>
            {/* Status Indicator Bar */}
            <div className={cn(
              "absolute top-0 left-0 w-full h-1",
              org.active ? "bg-primary" : "bg-muted",
              isTrial && "bg-amber-500",
              isExpired && "bg-destructive"
            )} />

            <CardHeader className="pb-3 pt-6 px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold truncate tracking-tight group-hover:text-primary transition-colors">
                      {org.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                    <Link2 className="h-3 w-3" />
                    {org.slug}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); onDelete(org); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Badge variant={org.active ? 'default' : 'secondary'} className="font-bold text-[9px] uppercase tracking-wider h-5">
                      {org.active ? 'Premium' : 'Inativo'}
                    </Badge>
                  </div>
                  {org.lifetime && (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold text-[9px] uppercase tracking-wider h-5 gap-1">
                      <Crown className="h-2.5 w-2.5" /> Vitalício
                    </Badge>
                  )}
                  {isTrial && (
                    <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold text-[9px] uppercase tracking-wider h-5">
                      Trial
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant="destructive" className="font-bold text-[9px] uppercase tracking-wider h-5">
                      Expirado
                    </Badge>
                  )}
                </div>
              </div>

              {(isTrial || isExpired) && trialEndsAt && (
                <div className="space-y-2 mt-4">
                  <div className={cn(
                    "flex items-center gap-2 text-[10px] px-3 py-2 rounded-lg border",
                    isExpired ? "bg-destructive/10 text-destructive border-destructive/20" :
                      daysLeft <= 3 ? "bg-orange-500/10 text-orange-500 border-orange-500/20 animate-pulse" :
                        "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  )}>
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {isExpired ? 'Trial encerrado em ' : 'Expira em '}
                      {isExpired ? trialEndsAt.toLocaleDateString('pt-BR') : `${daysLeft} dias (${trialEndsAt.toLocaleDateString('pt-BR')})`}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-2 h-8 text-xs font-bold bg-primary hover:bg-primary/90"
                    onClick={() => onActivateFromTrial(org.id)}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Ativar Plano (Sair do Trial)
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent className="px-6 pb-6 pt-0 space-y-6">
              {/* Refined Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                    <Users className="h-3 w-3" /> Usuários
                  </div>
                  <p className="text-2xl font-black">{stats.totalUsers}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                    <TrendingUp className="h-3 w-3" /> Leads
                  </div>
                  <p className="text-2xl font-black">{stats.totalLeads}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                    <MessageSquare className="h-3 w-3" /> Mensagens
                  </div>
                  <p className="text-2xl font-black">{stats.totalMessages}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                    <DollarSign className="h-3 w-3" /> Receita
                  </div>
                  <p className="text-2xl font-black text-primary">
                    <span className="text-xs font-normal text-muted-foreground mr-1">R$</span>
                    {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Controls Section */}
              <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 group/switch">
                    <div className={cn(
                      "p-1.5 rounded-md transition-colors",
                      org.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Power className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase">Acesso</span>
                      <span className="text-xs text-muted-foreground">{org.active ? 'Ativo' : 'Bloqueado'}</span>
                    </div>
                  </div>
                  <Switch checked={org.active} onCheckedChange={() => onTogglePlan(org.id, org.active)} className="scale-90" />
                </div>

                {/* Lifetime Toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-1.5 rounded-md transition-colors",
                      org.lifetime ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"
                    )}>
                      <Crown className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase">Vitalício</span>
                      <span className="text-xs text-muted-foreground">{org.lifetime ? 'Ativo ∞' : 'Desativado'}</span>
                    </div>
                  </div>
                  <Switch
                    checked={org.lifetime || false}
                    onCheckedChange={() => onToggleLifetime(org.id, org.lifetime || false)}
                    className="scale-90"
                  />
                </div>

                {!isTrial && !isExpired && !org.lifetime && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
                        <CreditCard className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase">Renovação</span>
                        <span className="text-xs text-muted-foreground italic">Próxima cobrança</span>
                      </div>
                    </div>
                    <BillingDayPicker
                      orgId={org.id}
                      currentDay={org.billing_day || 10}
                      onUpdate={refreshOrganizations}
                    />
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant={isViewing ? "default" : "secondary"}
                  size="sm"
                  className={cn(
                    "w-full gap-2 h-9 text-xs font-bold transition-all duration-300",
                    isViewing ? "shadow-glow-primary" : "bg-white/5 hover:bg-white/10"
                  )}
                  onClick={() => onViewAs(org.id)}
                >
                  {isViewing ? <Eye className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                  {isViewing ? "Visualizando Agora" : "Assumir Identidade"}
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-[11px] h-9 border-white/10 hover:bg-primary/5 transition-colors"
                    onClick={() => onEdit(org)}
                  >
                    <Edit className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-[11px] h-9 border-white/10 hover:bg-primary/5 transition-colors"
                    onClick={() => onClientData(org)}
                  >
                    <FileText className="h-3.5 w-3.5" /> Dados
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-white/5 pt-3">
                <span>ID Sistema: {org.id.slice(0, 8)}...</span>
                <span>Desde {new Date(org.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ===== AI Global Credentials (Vitta I.A) =====
function AIGlobalCredentials() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('global_config')
        .select('key, value')
        .in('key', ['openai_api_key', 'gemini_api_key']);
      if (data) {
        for (const row of data) {
          if (row.key === 'openai_api_key') setOpenaiKey(row.value || '');
          if (row.key === 'gemini_api_key') setGeminiKey(row.value || '');
        }
      }
      setIsLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const { key, value } of [
        { key: 'openai_api_key', value: openaiKey },
        { key: 'gemini_api_key', value: geminiKey },
      ]) {
        const { data: existing } = await supabase
          .from('global_config')
          .select('id')
          .eq('key', key)
          .maybeSingle();
        if (existing) {
          await supabase.from('global_config').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
        } else {
          await supabase.from('global_config').insert({ key, value });
        }
      }
      toast.success('Credenciais de I.A salvas com sucesso');
    } catch {
      toast.error('Erro ao salvar credenciais');
    }
    setIsSaving(false);
  };

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card className="glass border-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-400" />
          Vitta I.A — Infraestrutura Global
        </CardTitle>
        <CardDescription>
          Credenciais padrão utilizadas pelo motor de inteligência central da plataforma
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* OpenAI */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider opacity-70">OpenAI API Key</Label>
              <Badge variant="outline" className="text-[10px] opacity-70">GPT-4o Ready</Badge>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showOpenai ? 'text' : 'password'}
                  placeholder="sk-..."
                  className="bg-background/40 border-white/10 pr-10"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent opacity-50 hover:opacity-100"
                  onClick={() => setShowOpenai(!showOpenai)}
                >
                  {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Gemini */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Google Gemini API Key</Label>
              <Badge variant="outline" className="text-[10px] opacity-70">Pro 1.5 Ready</Badge>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showGemini ? 'text' : 'password'}
                  placeholder="AIza..."
                  className="bg-background/40 border-white/10 pr-10"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent opacity-50 hover:opacity-100"
                  onClick={() => setShowGemini(!showGemini)}
                >
                  {showGemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="gap-2 shadow-glow-primary">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Sincronizar Infraestrutura
        </Button>
      </CardContent>
    </Card>
  );
}
