import { useState, useEffect } from "react";
import { UserCog, ShieldCheck, Search, Loader2, ArrowLeftRight, UserPlus, Trash2, Key, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SavedAccount {
  user_id: string;
  email: string;
  full_name: string;
  access_token: string;
  refresh_token: string;
}

export function ImpersonationWidget() {
  const { isSuperAdmin, isImpersonating, stopImpersonating } = useUserRole();
  const { currentOrganization } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [multiAccountEnabled, setMultiAccountEnabled] = useState(() => localStorage.getItem('vitta_multi_account_enabled') === 'true');
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("org");

  useEffect(() => {
    const handleMultiAccountChange = () => {
      setMultiAccountEnabled(localStorage.getItem('vitta_multi_account_enabled') === 'true');
    };
    window.addEventListener('multi_account_changed', handleMultiAccountChange);
    return () => window.removeEventListener('multi_account_changed', handleMultiAccountChange);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (currentOrganization?.id && isSuperAdmin) {
        loadUsers();
        setActiveTab("org");
      } else {
        loadSavedAccounts();
        setActiveTab("saved");
      }
    }
  }, [isOpen, currentOrganization?.id, isSuperAdmin]);

  const loadSavedAccounts = () => {
    try {
      const stored = localStorage.getItem('vitta_saved_accounts');
      if (stored) {
        setSavedAccounts(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Erro ao carregar contas salvas", e);
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profilesData } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email")
        .eq("organization_id", currentOrganization?.id)
        .order("full_name", { ascending: true });

      const profiles = profilesData || [];

      if (profiles.length > 0) {
        const userIds = profiles.map((p: any) => p.id);
        const { data: rolesData } = await (supabase as any)
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const rolesMap: Record<string, string> = {};
        (rolesData || []).forEach((r: any) => { rolesMap[r.user_id] = r.role; });
        profiles.forEach((p: any) => { p.role = rolesMap[p.id] || "user"; });
      }

      setUsers(profiles);
    } catch (err) {
      console.error("Erro ao carregar usuários para impersonation:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImpersonate = (userId: string) => {
    localStorage.setItem("impersonated_user_id", userId);
    window.location.reload();
  };

  const saveCurrentSession = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    
    const { user } = sessionData.session;
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    
    const currentAccount: SavedAccount = {
      user_id: user.id,
      email: user.email || "",
      full_name: profile?.full_name || "Sem Nome",
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token
    };

    const stored = localStorage.getItem('vitta_saved_accounts');
    let accounts: SavedAccount[] = stored ? JSON.parse(stored) : [];
    
    accounts = accounts.filter(a => a.user_id !== user.id);
    accounts.push(currentAccount);
    
    localStorage.setItem('vitta_saved_accounts', JSON.stringify(accounts));
    setSavedAccounts(accounts);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    setIsLoggingIn(true);
    try {
      await saveCurrentSession();
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;
      
      toast.success("Login efetuado com sucesso!");
      window.location.reload();
    } catch (err: any) {
      console.error("Erro no login:", err);
      toast.error(err.message || "Erro ao adicionar conta.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSwitchAccount = async (account: SavedAccount) => {
    toast.info(`Trocando para ${account.full_name}...`);
    try {
      await saveCurrentSession();
      const { error } = await supabase.auth.setSession({
        access_token: account.access_token,
        refresh_token: account.refresh_token
      });

      if (error) {
        // Se o token expirou
        removeAccount(account.user_id);
        throw new Error("Sessão expirada. Por favor, adicione a conta novamente.");
      }

      window.location.reload();
    } catch (err: any) {
      console.error("Erro ao trocar conta:", err);
      toast.error(err.message || "Erro ao trocar conta.");
    }
  };

  const removeAccount = (userId: string) => {
    const newAccounts = savedAccounts.filter(a => a.user_id !== userId);
    setSavedAccounts(newAccounts);
    localStorage.setItem('vitta_saved_accounts', JSON.stringify(newAccounts));
    toast.success("Conta removida da lista.");
  };

  const filteredUsers = users.filter((u) => 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "manager": return "Gerente";
      case "super_admin": return "Super Admin";
      case "user": return "Usuário";
      default: return role || "Usuário";
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "super_admin": return "bg-violet-500/15 text-violet-600 border-violet-500/30";
      case "admin": return "bg-blue-500/15 text-blue-600 border-blue-500/30";
      case "manager": return "bg-amber-500/15 text-amber-600 border-amber-500/30";
      default: return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
    }
  };

  if (!isSuperAdmin && !isImpersonating && !multiAccountEnabled) return null;

  return (
    <>
      <div className="fixed bottom-6 left-6 z-[9999]">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button 
              size="icon" 
              className={`h-12 w-12 rounded-full shadow-2xl transition-all ${
                isImpersonating 
                  ? "bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-amber-500/30 animate-pulse" 
                  : "bg-zinc-900 hover:bg-zinc-800 text-white border border-white/10"
              }`}
              title={isImpersonating ? "Identidade Assumida Ativa" : "Trocar Identidade"}
            >
              <UserCog className="h-6 w-6" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[340px] p-0 mb-2 ml-6 rounded-xl border border-border/50 shadow-2xl overflow-hidden" align="start" side="top">
            <div className="bg-muted/50 p-4 border-b border-border/50">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Múltiplas Contas
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Troque rapidamente entre usuários ou contas salvas.
              </p>
            </div>
            
            {isImpersonating && (
              <div className="p-3 bg-amber-500/10 border-b border-amber-500/20">
                <Button 
                  variant="default" 
                  className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold text-xs h-8"
                  onClick={stopImpersonating}
                >
                  Voltar para meu Admin Original
                </Button>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {isSuperAdmin && (
                <TabsContent value="org" className="m-0 border-none outline-none">
                  <div className="p-3 border-b border-border/50">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar usuário da org..." 
                        className="h-8 pl-8 text-xs bg-background/50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="max-h-[250px] overflow-y-auto p-2 space-y-1">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                        <span className="text-xs">Carregando usuários...</span>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-xs text-center py-6 text-muted-foreground">Nenhum usuário encontrado.</p>
                    ) : (
                      filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleImpersonate(user.id)}
                          className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors text-left group"
                        >
                          <div className="min-w-0 flex-1 mr-2">
                            <p className="text-xs font-semibold truncate text-foreground">
                              {user.full_name || "Sem nome"}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-[9px] uppercase font-bold h-4 px-1.5 ${roleColor(user.role)}`}>
                              {roleLabel(user.role)}
                            </Badge>
                            <div className="h-6 w-6 rounded bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowLeftRight className="h-3 w-3" />
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </TabsContent>
              )}

              {!isSuperAdmin && multiAccountEnabled && (
                <TabsContent value="saved" className="m-0 border-none outline-none">
                  <div className="max-h-[250px] overflow-y-auto p-2 space-y-1 mt-2">
                    {savedAccounts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                        <Key className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <p className="text-xs text-muted-foreground">Nenhuma conta adicional salva.</p>
                      </div>
                    ) : (
                      savedAccounts.map((account) => (
                        <div key={account.user_id} className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors text-left group">
                          <button
                            onClick={() => handleSwitchAccount(account)}
                            className="min-w-0 flex-1 mr-2 text-left"
                          >
                            <p className="text-xs font-semibold truncate text-foreground">
                              {account.full_name || "Sem nome"}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {account.email}
                            </p>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                              onClick={(e) => { e.stopPropagation(); removeAccount(account.user_id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <button 
                              onClick={() => handleSwitchAccount(account)}
                              className="h-6 w-6 rounded bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20"
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 border-t border-border/50 bg-muted/20">
                    <Button 
                      variant="outline" 
                      className="w-full text-xs h-8 border-dashed flex items-center justify-center gap-2"
                      onClick={() => {
                        setIsOpen(false);
                        setIsLoginModalOpen(true);
                      }}
                    >
                      <UserPlus className="h-3 w-3" />
                      Adicionar Conta Existente
                    </Button>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Adicionar Conta
            </DialogTitle>
            <DialogDescription>
              Faça login com a segunda conta. Sua sessão atual será salva para você retornar depois.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddAccount} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="agente@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsLoginModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoggingIn} className="gap-2">
                {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                Autenticar e Trocar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
