import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Webhook, Package, Brain, DollarSign, Users, AlertTriangle, Loader2, Plus, Minus, KeyRound, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OrgModulesConfig } from "./OrgModulesConfig";

interface OrgClientDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: any;
}

export function OrgClientDataDialog({ open, onOpenChange, organization }: OrgClientDataDialogProps) {
  if (!organization) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Dados do Cliente — {organization.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="webhooks" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="webhooks" className="text-xs gap-1">
              <Webhook className="h-3.5 w-3.5" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="modules" className="text-xs gap-1">
              <Package className="h-3.5 w-3.5" />
              Módulos
            </TabsTrigger>
            <TabsTrigger value="tokens" className="text-xs gap-1">
              <Brain className="h-3.5 w-3.5" />
              Tokens
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="users" className="text-xs gap-1">
              <Users className="h-3.5 w-3.5" />
              Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="webhooks" className="mt-4">
            <WebhooksTabContent organizationId={organization.id} organizationName={organization.name} />
          </TabsContent>

          <TabsContent value="modules" className="mt-4">
            <OrgModulesConfig organizationId={organization.id} organizationName={organization.name} />
          </TabsContent>

          <TabsContent value="tokens" className="mt-4">
            <TokensTabContent organizationId={organization.id} />
          </TabsContent>

          <TabsContent value="financeiro" className="mt-4">
            <FinanceiroTabContent organizationId={organization.id} />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <UsersTabContent organizationId={organization.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ===== Webhooks Tab (inline version) =====
function WebhooksTabContent({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("organization_webhooks")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("event_type", "message_received")
        .maybeSingle();
      setWebhookUrl(data?.webhook_url || "");
      setIsLoading(false);
    };
    load();
  }, [organizationId]);

  const handleSave = async () => {
    setIsSaving(true);
    const { data: existing } = await (supabase as any)
      .from("organization_webhooks")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("event_type", "message_received")
      .maybeSingle();

    if (existing) {
      await (supabase as any)
        .from("organization_webhooks")
        .update({ webhook_url: webhookUrl, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else if (webhookUrl) {
      await (supabase as any)
        .from("organization_webhooks")
        .insert({ organization_id: organizationId, event_type: "message_received", webhook_url: webhookUrl, active: true });
    }
    toast.success("Webhook salvo");
    setIsSaving(false);
  };

  if (isLoading) return <Skeleton className="h-24" />;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm">URL do Webhook — Mensagens Recebidas (I.A)</Label>
        <Input
          placeholder="https://..."
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
        />
      </div>
      <Button size="sm" onClick={handleSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Salvar
      </Button>
    </div>
  );
}

// ===== Tokens Tab =====
function TokensTabContent({ organizationId }: { organizationId: string }) {
  const [balances, setBalances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  const fetchBalances = useCallback(async () => {
    setIsLoading(true);
    const { data } = await (supabase as any)
      .from("organization_token_balances")
      .select("*")
      .eq("organization_id", organizationId);
    setBalances(data || []);
    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const handleAdjust = async (provider: string, action: "add" | "remove") => {
    const amount = parseInt(adjustments[provider] || "0");
    if (!amount || amount <= 0) { toast.error("Informe uma quantidade válida"); return; }

    setIsSaving(true);
    const balance = balances.find(b => b.provider === provider);

    if (balance) {
      const newTotal = action === "add"
        ? balance.total_tokens + amount
        : Math.max(0, balance.total_tokens - amount);

      const { error } = await (supabase as any)
        .from("organization_token_balances")
        .update({ total_tokens: newTotal })
        .eq("id", balance.id);

      if (error) { toast.error("Erro ao ajustar"); } else {
        // Log transaction
        await (supabase as any).from("token_transactions").insert({
          organization_id: organizationId,
          provider,
          transaction_type: action === "add" ? "manual_credit" : "manual_debit",
          amount: action === "add" ? amount : -amount,
          description: `Ajuste manual: ${action === "add" ? "+" : "-"}${amount} tokens`,
        });
        toast.success(`Tokens ${action === "add" ? "adicionados" : "removidos"}`);
        setAdjustments(prev => ({ ...prev, [provider]: "" }));
        await fetchBalances();
      }
    } else if (action === "add") {
      const { error } = await (supabase as any)
        .from("organization_token_balances")
        .insert({ organization_id: organizationId, provider, total_tokens: amount, used_tokens: 0 });

      if (error) { toast.error("Erro ao criar saldo"); } else {
        await (supabase as any).from("token_transactions").insert({
          organization_id: organizationId,
          provider,
          transaction_type: "manual_credit",
          amount,
          description: `Ajuste manual: +${amount} tokens`,
        });
        toast.success("Tokens adicionados");
        setAdjustments(prev => ({ ...prev, [provider]: "" }));
        await fetchBalances();
      }
    }
    setIsSaving(false);
  };

  if (isLoading) return <Skeleton className="h-32" />;

  const renderProvider = (provider: string, label: string) => {
    const balance = balances.find(b => b.provider === provider);
    const total = balance?.total_tokens || 0;
    const used = balance?.used_tokens || 0;
    const remaining = Math.max(0, total - used);

    return (
      <div className="p-4 rounded-lg border border-border/50 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{label}</span>
          <Badge variant="secondary" className="text-xs">
            {remaining.toLocaleString("pt-BR")} restantes
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Total: {total.toLocaleString("pt-BR")} | Usado: {used.toLocaleString("pt-BR")}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Quantidade"
            className="h-8 text-xs flex-1"
            value={adjustments[provider] || ""}
            onChange={(e) => setAdjustments(prev => ({ ...prev, [provider]: e.target.value }))}
          />
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" disabled={isSaving} onClick={() => handleAdjust(provider, "add")}>
            <Plus className="h-3 w-3" /> Add
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs text-destructive" disabled={isSaving} onClick={() => handleAdjust(provider, "remove")}>
            <Minus className="h-3 w-3" /> Rem
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderProvider("gemini", "Gemini (Flash)")}
      {renderProvider("openai", "ChatGPT (OpenAI)")}
    </div>
  );
}

// ===== Financeiro Tab =====
function FinanceiroTabContent({ organizationId }: { organizationId: string }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      let query = (supabase as any)
        .from("payment_history")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data } = await query;
      setPayments(data || []);
      setIsLoading(false);
    };
    load();
  }, [organizationId]);

  if (isLoading) return <Skeleton className="h-48" />;

  const unpaidCount = payments.filter(p => p.status === "pending" || p.status === "failed").length;

  const filtered = payments.filter(p => {
    if (filterType !== "all" && p.payment_type !== filterType) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    return true;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid": return <Badge className="bg-green-500/20 text-green-700 border-green-500/30 text-[10px]">Pago</Badge>;
      case "pending": return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-[10px]">Pendente</Badge>;
      case "failed": return <Badge variant="destructive" className="text-[10px]">Falhou</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "mensalidade": return "Mensalidade";
      case "token_chatgpt": return "Tokens ChatGPT";
      case "token_gemini": return "Tokens Gemini";
      default: return type || "—";
    }
  };

  return (
    <div className="space-y-4">
      {unpaidCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>{unpaidCount} fatura(s) em aberto</span>
        </div>
      )}

      <div className="flex gap-2">
        <select
          className="h-8 text-xs rounded-md border border-border/50 bg-background px-2"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">Todos os tipos</option>
          <option value="mensalidade">Mensalidade</option>
          <option value="token_chatgpt">Tokens ChatGPT</option>
          <option value="token_gemini">Tokens Gemini</option>
        </select>
        <select
          className="h-8 text-xs rounded-md border border-border/50 bg-background px-2"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="paid">Pago</option>
          <option value="pending">Pendente</option>
          <option value="failed">Falhou</option>
        </select>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro encontrado</p>
        )}
        {filtered.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card/30">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{typeLabel(p.payment_type)}</span>
                {statusBadge(p.status)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Ref: {p.reference_month || "—"} · Criado: {new Date(p.created_at).toLocaleDateString("pt-BR")}
                {p.paid_at && ` · Pago: ${new Date(p.paid_at).toLocaleDateString("pt-BR")}`}
              </div>
              {p.notes && <p className="text-[10px] text-muted-foreground mt-0.5 italic">{p.notes}</p>}
            </div>
            <span className="text-sm font-bold shrink-0">R$ {Number(p.amount || 0).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== Users Tab =====
function UsersTabContent({ organizationId }: { organizationId: string }) {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const { data: profilesData } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, avatar_url, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });

      // Fetch roles separately from user_roles table
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
      setIsLoading(false);
    };
    load();
  }, [organizationId]);

  const handleResetPassword = async (userId: string) => {
    const pwd = passwords[userId];
    if (!pwd || pwd.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { user_id: userId, new_password: pwd },
      });

      // Extract error details from response
      if (error) {
        // Try to get the actual error message from the response body
        let errorMsg = "Erro ao redefinir senha";
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            errorMsg = body?.error || errorMsg;
          } else if (error.message) {
            errorMsg = error.message;
          }
        } catch { /* fallback to generic */ }
        throw new Error(errorMsg);
      }
      if (data?.error) throw new Error(data.error);

      toast.success("Senha redefinida com sucesso!");
      setResettingId(null);
      setPasswords((prev) => ({ ...prev, [userId]: "" }));
    } catch (e: any) {
      toast.error(e.message || "Erro ao redefinir senha");
    }
    setIsSaving(false);
  };

  if (isLoading) return <Skeleton className="h-32" />;

  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum usuário encontrado nesta organização
      </p>
    );
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "manager": return "Gerente";
      case "user": return "Usuário";
      default: return role || "Usuário";
    }
  };

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {users.map((user) => (
        <div key={user.id} className="p-3 rounded-lg border border-border/30 bg-card/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.full_name || "Sem nome"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-[10px]">{roleLabel(user.role)}</Badge>
              <Button
                size="sm"
                variant={resettingId === user.id ? "secondary" : "outline"}
                className="h-7 gap-1 text-[11px]"
                onClick={() => setResettingId(resettingId === user.id ? null : user.id)}
              >
                <KeyRound className="h-3 w-3" />
                {resettingId === user.id ? "Cancelar" : "Redefinir Senha"}
              </Button>
            </div>
          </div>

          {resettingId === user.id && (
            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <Input
                  type={showPwd[user.id] ? "text" : "password"}
                  placeholder="Nova senha (mín. 6 caracteres)"
                  className="h-8 text-xs pr-8"
                  value={passwords[user.id] || ""}
                  onChange={(e) => setPasswords((prev) => ({ ...prev, [user.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPwd((prev) => ({ ...prev, [user.id]: !prev[user.id] }))}
                >
                  {showPwd[user.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs gap-1"
                disabled={isSaving || !passwords[user.id] || (passwords[user.id]?.length ?? 0) < 6}
                onClick={() => handleResetPassword(user.id)}
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Redefinir
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
