import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Users as UsersIcon, Link2, Copy, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  roles?: string[];
  page_permissions?: string[];
  approved?: boolean;
  pending_approval?: boolean;
  organization_id?: string;
  requested_org_slug?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

type AppPage = 'dashboard' | 'leads' | 'pipeline' | 'followup' | 'chat' | 'users' | 'developer' | 'promptia' | 'agenda' | 'teams' | 'financeiro' | 'commands' | 'automations' | 'disparos' | 'diagnostico' | 'marketing';

const PAGE_LABELS: Record<AppPage, string> = {
  dashboard: 'Dashboard',
  chat: 'Chat',
  agenda: 'Agenda',
  commands: 'Comandos',
  leads: 'Leads',
  pipeline: 'Pipeline',
  diagnostico: 'Diagnóstico de Leads',
  marketing: 'Marketing',
  financeiro: 'Financeiro',
  teams: 'Equipes',
  automations: 'Automações',
  disparos: 'Disparos',
  developer: 'Desenvolvedor',
  promptia: 'Prompt I.A',
  followup: 'Follow Up',
  users: 'Usuários',
};

interface PageGroup {
  label: string;
  pages: AppPage[];
}

const PAGE_GROUPS: PageGroup[] = [
  { label: 'Principal', pages: ['dashboard', 'chat', 'agenda', 'commands'] },
  { label: 'CRM & Vendas', pages: ['leads', 'pipeline', 'diagnostico', 'marketing', 'financeiro', 'teams'] },
  { label: 'Automação & I.A', pages: ['automations', 'disparos', 'developer', 'promptia'] },
];

export default function UsersContent() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedOrgForApproval, setSelectedOrgForApproval] = useState<Record<string, string>>({});
  const [autoGrantAllPermissions, setAutoGrantAllPermissions] = useState(false);
  const { toast } = useToast();
  const { currentOrganization, isSuperAdmin } = useOrganization();
  const { isSubAdmin, isAdmin, getPlanPages } = usePagePermissions();

  const planPages = getPlanPages();
  const [linkCopied, setLinkCopied] = useState(false);

  const generateMagicLink = () => {
    if (!currentOrganization?.slug) return;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_APP_URL || "http://localhost:5173");
    const link = `${baseUrl}/auth?invite=${currentOrganization.slug}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    toast({ title: "Link copiado!", description: "Link mágico de convite copiado para a área de transferência" });
    setTimeout(() => setLinkCopied(false), 3000);
  };

  useEffect(() => {
    if (currentOrganization?.id) {
      const settings = currentOrganization.settings as Record<string, any> | null;
      if (settings?.auto_grant_permissions) {
        setAutoGrantAllPermissions(true);
      } else {
        setAutoGrantAllPermissions(false);
      }
    }
  }, [currentOrganization?.id, currentOrganization?.settings]);

  const handleAutoGrantChange = async (checked: boolean) => {
    setAutoGrantAllPermissions(checked);
    if (!currentOrganization?.id) return;
    const currentSettings = (currentOrganization.settings as Record<string, any>) || {};
    const newSettings = { ...currentSettings, auto_grant_permissions: checked };
    const { error } = await (supabase as any).from('organizations').update({ settings: newSettings }).eq('id', currentOrganization.id);
    if (error) {
      console.error('Erro ao salvar configuração:', error);
      setAutoGrantAllPermissions(!checked);
      toast({ title: "Erro ao salvar configuração", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchUsers();
    if (isSuperAdmin) fetchAllOrganizations();

    const profilesSubscription = supabase.channel('profiles-changes-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchUsers())
      .subscribe();
    const rolesSubscription = supabase.channel('roles-changes-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => fetchUsers())
      .subscribe();

    return () => {
      profilesSubscription.unsubscribe();
      rolesSubscription.unsubscribe();
    };
  }, [currentOrganization?.id, isSuperAdmin]);

  const fetchAllOrganizations = async () => {
    try {
      const { data } = await (supabase as any).from('organizations').select('id, name, slug').order('name');
      setAllOrganizations(data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      let profilesQuery;

      if (isSuperAdmin) {
        if (currentOrganization?.id) {
          profilesQuery = (supabase as any).from('profiles').select('*').or(`organization_id.eq.${currentOrganization.id},organization_id.is.null`).order('created_at', { ascending: false });
        } else {
          profilesQuery = (supabase as any).from('profiles').select('*').is('organization_id', null).order('created_at', { ascending: false });
        }
      } else if (currentOrganization?.id) {
        const orgSlug = currentOrganization.slug || '';
        profilesQuery = (supabase as any).from('profiles').select('*').or(`organization_id.eq.${currentOrganization.id},and(organization_id.is.null,pending_approval.eq.true,requested_org_slug.eq.${orgSlug})`).order('created_at', { ascending: false });
      } else {
        setUsers([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await profilesQuery;
      const profileIds = profiles ? profiles.map((p: any) => p.id) : [];

      const [{ data: roles }, { data: permissions }] = await Promise.all([
        profileIds.length > 0 ? (supabase as any).from('user_roles').select('user_id, role').in('user_id', profileIds) : Promise.resolve({ data: [] }),
        profileIds.length > 0 ? (supabase as any).from('user_page_permissions').select('user_id, page').in('user_id', profileIds) : Promise.resolve({ data: [] })
      ]);

      if (!profiles) { setUsers([]); return; }

      const rolesByUser = new Map<string, string[]>();
      roles?.forEach((role: any) => {
        if (!rolesByUser.has(role.user_id)) rolesByUser.set(role.user_id, []);
        rolesByUser.get(role.user_id)!.push(role.role);
      });

      const permissionsByUser = new Map<string, string[]>();
      permissions?.forEach((perm: any) => {
        if (!permissionsByUser.has(perm.user_id)) permissionsByUser.set(perm.user_id, []);
        permissionsByUser.get(perm.user_id)!.push(perm.page);
      });

      const usersWithRoles = profiles.map((profile: any) => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        roles: rolesByUser.get(profile.id) || [],
        page_permissions: permissionsByUser.get(profile.id) || [],
        approved: profile.approved ?? true,
        pending_approval: profile.pending_approval ?? false,
        organization_id: profile.organization_id,
        requested_org_slug: profile.requested_org_slug
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({ title: "Erro ao carregar usuários", description: "Não foi possível carregar a lista de usuários", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentRoles: string[]) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.id === userId) {
        toast({ title: "Operação não permitida", description: "Você não pode modificar suas próprias permissões", variant: "destructive" });
        return;
      }
      if (isSubAdmin && !isSuperAdmin && !isAdmin) {
        toast({ title: "Operação não permitida", description: "Sub-admins não podem alterar a role de admin", variant: "destructive" });
        return;
      }
      const isUserAdmin = currentRoles.includes('admin');
      if (isUserAdmin) {
        const { error } = await (supabase as any).from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('user_roles').insert({ user_id: userId, role: 'admin' });
        if (error && error.code !== '23505') throw error;
      }
      await fetchUsers();
    } catch (error: any) {
      console.error('Error toggling admin role:', error);
      toast({ title: "Erro ao alterar permissões", description: error.message, variant: "destructive" });
    }
  };

  const toggleSubAdminRole = async (userId: string, currentRoles: string[]) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.id === userId) {
        toast({ title: "Operação não permitida", description: "Você não pode modificar suas próprias permissões", variant: "destructive" });
        return;
      }
      const isUserSubAdmin = currentRoles.includes('sub_admin');
      if (isUserSubAdmin) {
        const { error } = await (supabase as any).from('user_roles').delete().eq('user_id', userId).eq('role', 'sub_admin');
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('user_roles').insert({ user_id: userId, role: 'sub_admin' });
        if (error && error.code !== '23505') throw error;
      }
      await fetchUsers();
    } catch (error: any) {
      console.error('Error toggling sub_admin role:', error);
      toast({ title: "Erro ao alterar permissões", description: error.message, variant: "destructive" });
    }
  };

  const toggleHidenRole = async (userId: string, currentRoles: string[]) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.id === userId) {
        toast({ title: "Operação não permitida", description: "Você não pode modificar suas próprias permissões", variant: "destructive" });
        return;
      }
      const isUserHiden = currentRoles.includes('hiden');
      if (isUserHiden) {
        const { error } = await (supabase as any).from('user_roles').delete().eq('user_id', userId).eq('role', 'hiden');
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('user_roles').insert({ user_id: userId, role: 'hiden' });
        if (error && error.code !== '23505') throw error;
      }
      await fetchUsers();
    } catch (error: any) {
      console.error('Error toggling hiden role:', error);
      toast({ title: "Erro ao alterar permissões", description: error.message, variant: "destructive" });
    }
  };

  const togglePagePermission = async (userId: string, page: AppPage, currentPermissions: string[]) => {
    const hasPermission = currentPermissions.includes(page);
    setUsers(prev => prev.map(user => {
      if (user.id !== userId) return user;
      return {
        ...user,
        page_permissions: hasPermission
          ? (user.page_permissions || []).filter(p => p !== page)
          : [...(user.page_permissions || []), page]
      };
    }));

    try {
      if (hasPermission) {
        const { error } = await (supabase as any).from('user_page_permissions').delete().eq('user_id', userId).eq('page', page);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('user_page_permissions').insert({ user_id: userId, page: page });
        if (error && error.code !== '23505') throw error;
      }
    } catch (error: any) {
      console.error('Error toggling page permission:', error);
      setUsers(prev => prev.map(user => {
        if (user.id !== userId) return user;
        return { ...user, page_permissions: currentPermissions };
      }));
      toast({ title: "Erro ao alterar permissões", description: error.message, variant: "destructive" });
    }
  };

  const grantAllPermissions = async (userId: string) => {
    const pagesToGrant = planPages.filter(p => p !== 'users') as AppPage[];
    setUsers(prev => prev.map(user => {
      if (user.id !== userId) return user;
      return { ...user, page_permissions: [...pagesToGrant] };
    }));
    try {
      // Remove existing ones first
      await (supabase as any).from('user_page_permissions').delete().eq('user_id', userId);
      // Insert all
      const inserts = pagesToGrant.map(page => ({ user_id: userId, page }));
      const { error } = await (supabase as any).from('user_page_permissions').insert(inserts);
      if (error) throw error;
      toast({ title: "Todas as abas liberadas" });
    } catch (error: any) {
      console.error('Error granting all permissions:', error);
      await fetchUsers();
      toast({ title: "Erro ao alterar permissões", description: error.message, variant: "destructive" });
    }
  };

  const revokeAllPermissions = async (userId: string) => {
    const prev = users.find(u => u.id === userId)?.page_permissions || [];
    setUsers(prevUsers => prevUsers.map(user => {
      if (user.id !== userId) return user;
      return { ...user, page_permissions: [] };
    }));
    try {
      const { error } = await (supabase as any).from('user_page_permissions').delete().eq('user_id', userId);
      if (error) throw error;
      toast({ title: "Todas as abas removidas" });
    } catch (error: any) {
      console.error('Error revoking all permissions:', error);
      setUsers(prevUsers => prevUsers.map(user => {
        if (user.id !== userId) return user;
        return { ...user, page_permissions: prev };
      }));
      toast({ title: "Erro ao alterar permissões", description: error.message, variant: "destructive" });
    }
  };

  const updateUserName = async (userId: string, newName: string) => {
    try {
      const { error } = await (supabase as any).from('profiles').update({ full_name: newName.trim() }).eq('id', userId);
      if (error) throw error;
      setEditingUserId(null);
      setEditingName("");
      await fetchUsers();
    } catch (error: any) {
      console.error('Error updating user name:', error);
      toast({ title: "Erro ao atualizar nome", description: error.message, variant: "destructive" });
    }
  };

  const approveUser = async (userId: string, organizationId?: string) => {
    try {
      let orgId = organizationId || currentOrganization?.id;
      const user = users.find(u => u.id === userId);
      if (!orgId && user?.requested_org_slug) {
        const { data: org } = await (supabase as any).from('organizations').select('id').eq('slug', user.requested_org_slug).single();
        if (org) orgId = org.id;
      }
      if (!orgId) {
        toast({ title: "Erro", description: "Selecione uma organização para aprovar o usuário", variant: "destructive" });
        return;
      }
      const { error: profileError } = await (supabase as any).from('profiles').update({ approved: true, pending_approval: false, organization_id: orgId }).eq('id', userId);
      if (profileError) throw profileError;

      if (autoGrantAllPermissions) {
        const pagesToGrant = planPages.filter(p => p !== 'users');
        const inserts = pagesToGrant.map(page => ({ user_id: userId, page }));
        const { error: permError } = await (supabase as any).from('user_page_permissions').insert(inserts);
        if (permError && permError.code !== '23505') console.error('Error adding bulk permissions:', permError);
      } else {
        const { error: permError } = await (supabase as any).from('user_page_permissions').insert({ user_id: userId, page: 'dashboard' });
        if (permError && permError.code !== '23505') console.error('Error adding default permission:', permError);
      }

      setSelectedOrgForApproval(prev => { const newState = { ...prev }; delete newState[userId]; return newState; });
      await fetchUsers();
    } catch (error: any) {
      console.error('Error approving user:', error);
      toast({ title: "Erro ao aprovar usuário", description: error.message, variant: "destructive" });
    }
  };

  const rejectUser = async (userId: string) => {
    try {
      const { error } = await (supabase as any).from('profiles').delete().eq('id', userId);
      if (error) throw error;
      await fetchUsers();
    } catch (error: any) {
      console.error('Error rejecting user:', error);
      toast({ title: "Erro ao rejeitar usuário", description: error.message, variant: "destructive" });
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.id === userId) {
        toast({ title: "Operação não permitida", description: "Você não pode remover a si mesmo", variant: "destructive" });
        return;
      }
      if (!confirm(`Tem certeza que deseja remover o usuário ${userEmail}? Esta ação não pode ser desfeita.`)) return;
      const { error } = await supabase.functions.invoke('delete-user', { body: { userId } });
      if (error) throw error;
      await fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({ title: "Erro ao remover usuário", description: error.message || "Não foi possível remover o usuário", variant: "destructive" });
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'sub_admin': return 'Sub-Admin';
      case 'hiden': return 'Hiden';
      default: return 'Usuário';
    }
  };

  const canManageAdminRole = isSuperAdmin || (isAdmin && !isSubAdmin);
  const canManageSubAdminRole = isSuperAdmin || isAdmin || isSubAdmin;

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <UsersIcon className="h-4 w-4 md:h-5 md:w-5" />
            Gerenciamento de Usuários
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Permissões de acesso
            {currentOrganization?.plan && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                {currentOrganization.plan === 'plataforma' ? 'Plataforma' :
                  currentOrganization.plan === 'agente_ia' ? 'Agente I.A' :
                    currentOrganization.plan === 'full_stack' ? 'Full Stack' : currentOrganization.plan}
              </span>
            )}
            {currentOrganization?.slug && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground hidden sm:inline">
                Chave: {currentOrganization.slug}
              </span>
            )}
          </CardDescription>
          <div className="flex items-center gap-3 pt-2 border-t mt-2">
            <Switch checked={autoGrantAllPermissions} onCheckedChange={handleAutoGrantChange} id="auto-permissions-settings" />
            <label htmlFor="auto-permissions-settings" className="text-xs text-muted-foreground cursor-pointer">
              Ao aprovar, conceder acesso a todas as abas automaticamente
            </label>
          </div>
          {currentOrganization?.slug && (
            <div className="flex items-center gap-2 pt-2 border-t mt-2">
              <Button variant="outline" size="sm" onClick={generateMagicLink} className="gap-2 text-xs">
                {linkCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Link2 className="h-3.5 w-3.5" />}
                {linkCopied ? "Link copiado!" : "Copiar link mágico de convite"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Usuários que se cadastrarem por este link serão aprovados automaticamente com acesso ao Dashboard
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          {loading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          )}

          {!loading && users.length === 0 && (
            <div className="text-center py-8 px-4">
              <p className="text-muted-foreground text-sm">Nenhum usuário encontrado.</p>
            </div>
          )}

          {!loading && users.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Chave</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permissões</TableHead>
                    <TableHead>Acesso às Abas</TableHead>
                    <TableHead>Ações</TableHead>
                    <TableHead>Remover</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isUserAdmin = user.roles?.includes('admin');
                    const isUserSubAdmin = user.roles?.includes('sub_admin');
                    const isUserSuperAdmin = user.roles?.includes('super_admin');
                    const isUserHiden = user.roles?.includes('hiden');
                    const isEditing = editingUserId === user.id;
                    const isPending = user.pending_approval;
                    const isApproved = user.approved;
                    const hasFullAccess = isUserAdmin || isUserSubAdmin || isUserSuperAdmin;

                    return (
                      <TableRow key={user.id} className={isPending ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-8" placeholder="Nome do usuário" />
                              <Button size="sm" onClick={() => updateUserName(user.id, editingName)}>Salvar</Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditingUserId(null); setEditingName(""); }}>Cancelar</Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{user.full_name || "Sem nome"}</span>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingUserId(user.id); setEditingName(user.full_name || ""); }}>Editar</Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.requested_org_slug ? (
                            <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground font-mono">{user.requested_org_slug}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <div className="flex flex-col gap-2">
                              <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 inline-block w-fit">Pendente</span>
                              {isSuperAdmin && allOrganizations.length > 0 && (
                                <Select value={selectedOrgForApproval[user.id] || currentOrganization?.id || ''} onValueChange={(value) => setSelectedOrgForApproval(prev => ({ ...prev, [user.id]: value }))}>
                                  <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Selecionar organização" /></SelectTrigger>
                                  <SelectContent>
                                    {allOrganizations.map(org => (<SelectItem key={org.id} value={org.id}>{org.name} ({org.slug})</SelectItem>))}
                                  </SelectContent>
                                </Select>
                              )}
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" onClick={() => approveUser(user.id, selectedOrgForApproval[user.id])} className="h-7 text-xs" disabled={isSuperAdmin && !selectedOrgForApproval[user.id] && !currentOrganization?.id}>Aprovar</Button>
                                <Button size="sm" variant="destructive" onClick={() => rejectUser(user.id)} className="h-7 text-xs">Rejeitar</Button>
                              </div>
                            </div>
                          ) : isApproved ? (
                            <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-700 dark:text-green-300">Aprovado</span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles?.map((role) => (
                              <span key={role} className="px-2 py-1 text-xs rounded bg-primary/10 text-primary">{getRoleLabel(role)}</span>
                            ))}
                            {(!user.roles || user.roles.length === 0) && (
                              <span className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground">Agente</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasFullAccess ? (
                            <span className="text-xs text-muted-foreground">
                              {isUserSuperAdmin ? 'Acesso total (Super Admin)' : isUserAdmin ? 'Acesso total (Admin)' : 'Acesso ao plano (Sub-Admin)'}
                            </span>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                                  <span className="font-medium">{(user.page_permissions || []).length}</span>
                                  <span className="text-muted-foreground">/ {planPages.filter(p => p !== 'users').length} abas</span>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-0" align="start">
                                <div className="p-3 border-b border-border">
                                  <p className="text-sm font-semibold">Acesso às Abas</p>
                                  <p className="text-xs text-muted-foreground">{user.full_name || user.email}</p>
                                  <div className="flex gap-2 mt-2">
                                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => grantAllPermissions(user.id)}>Selecionar Todas</Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => revokeAllPermissions(user.id)}>Remover Todas</Button>
                                  </div>
                                </div>
                                <div className="p-3 max-h-64 overflow-y-auto space-y-3">
                                  {PAGE_GROUPS.map((group) => {
                                    const groupPages = group.pages.filter(p => planPages.includes(p) && p !== 'users');
                                    if (groupPages.length === 0) return null;
                                    return (
                                      <div key={group.label}>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{group.label}</p>
                                        <div className="space-y-1">
                                          {groupPages.map((page) => {
                                            const hasPerm = user.page_permissions?.includes(page);
                                            return (
                                              <label
                                                key={page}
                                                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                                onClick={() => togglePagePermission(user.id, page, user.page_permissions || [])}
                                              >
                                                <Checkbox checked={!!hasPerm} className="h-4 w-4" />
                                                <span className="text-sm">{PAGE_LABELS[page]}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {canManageAdminRole && !isUserSuperAdmin && (
                              <Button onClick={() => toggleAdminRole(user.id, user.roles || [])} size="sm" variant="outline" className="text-xs">
                                {isUserAdmin ? 'Remover Admin' : 'Tornar Admin'}
                              </Button>
                            )}
                            {canManageSubAdminRole && !isUserSuperAdmin && !isUserAdmin && (
                              <Button onClick={() => toggleSubAdminRole(user.id, user.roles || [])} size="sm" variant="outline" className="text-xs">
                                {isUserSubAdmin ? 'Remover Sub-Admin' : 'Tornar Sub-Admin'}
                              </Button>
                            )}
                            {canManageSubAdminRole && !isUserSuperAdmin && (
                              <Button onClick={() => toggleHidenRole(user.id, user.roles || [])} size="sm" variant="outline" className="text-xs">
                                {isUserHiden ? 'Remover Hiden' : 'Tornar Hiden'}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {!isUserSuperAdmin && (
                            <Button onClick={() => deleteUser(user.id, user.email)} size="sm" variant="destructive">Remover</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
