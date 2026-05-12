import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Package, Wifi, Settings2, Users, Brain, Plus, Trash2, Loader2, Check } from "lucide-react";
import { useGlobalModulePrices } from "@/hooks/useGlobalModulePrices";
import { MODULE_DEFINITIONS, CONNECTION_DEFINITIONS } from "@/hooks/useOrganizationModules";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function GlobalModulesConfig() {
  const { modulePrices, connectionPrices, globalUserConfig, isLoading, updateModulePrice, updateConnectionPrice, updateGlobalUserConfig } = useGlobalModulePrices();
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, string>>({});
  const [connectionDrafts, setConnectionDrafts] = useState<Record<string, string>>({});
  const [defaultMaxUsers, setDefaultMaxUsers] = useState("3");
  const [defaultPricePerExtraUser, setDefaultPricePerExtraUser] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const nextModuleDrafts: Record<string, string> = {};
    for (const key of Object.keys(MODULE_DEFINITIONS)) {
      const current = modulePrices.find((m) => m.module_key === key);
      nextModuleDrafts[key] = String(current?.base_price ?? 0);
    }

    const nextConnectionDrafts: Record<string, string> = {};
    for (const key of Object.keys(CONNECTION_DEFINITIONS)) {
      const current = connectionPrices.find((c) => c.connection_key === key);
      nextConnectionDrafts[key] = String(current?.base_price ?? 0);
    }

    setModuleDrafts(nextModuleDrafts);
    setConnectionDrafts(nextConnectionDrafts);
    if (globalUserConfig) {
      setDefaultMaxUsers(String(globalUserConfig.default_max_users));
      setDefaultPricePerExtraUser(String(globalUserConfig.default_price_per_extra_user));
    }
    setIsDirty(false);
  }, [modulePrices, connectionPrices, globalUserConfig]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  }

  const normalizePrice = (value: string) => parseFloat(value.replace(",", ".")) || 0;

  const handleSaveAll = async () => {
    setIsSaving(true);

    const moduleResults = await Promise.all(
      Object.keys(MODULE_DEFINITIONS).map((key) =>
        updateModulePrice(key, normalizePrice(moduleDrafts[key] ?? "0"))
      )
    );

    const connectionResults = await Promise.all(
      Object.keys(CONNECTION_DEFINITIONS).map((key) =>
        updateConnectionPrice(key, normalizePrice(connectionDrafts[key] ?? "0"))
      )
    );

    const userConfigOk = await updateGlobalUserConfig({
      default_max_users: parseInt(defaultMaxUsers) || 3,
      default_price_per_extra_user: normalizePrice(defaultPricePerExtraUser),
    });

    const ok = [...moduleResults, ...connectionResults].every(Boolean) && userConfigOk;
    if (ok) {
      toast.success("Preços salvos com sucesso");
      setIsDirty(false);
    } else {
      toast.error("Erro ao salvar alguns preços");
    }

    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configuração Global de Módulos
          </CardTitle>
          <CardDescription>
            Defina os preços base dos módulos e conexões. Organizações sem preço personalizado herdarão estes valores.
          </CardDescription>
          <div>
            <Button onClick={handleSaveAll} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar tudo"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Global User Defaults */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Usuários — Padrão Global
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex-1">
              <p className="text-sm font-medium">Limite padrão de usuários</p>
              <p className="text-xs text-muted-foreground">Aplicado a novas organizações criadas</p>
            </div>
            <div className="flex items-center gap-1 w-28">
              <Label className="text-xs shrink-0">Máx</Label>
              <Input
                type="number"
                min="1"
                className="h-8 text-sm"
                value={defaultMaxUsers}
                onChange={(e) => { setDefaultMaxUsers(e.target.value); setIsDirty(true); }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex-1">
              <p className="text-sm font-medium">Valor padrão por usuário extra</p>
              <p className="text-xs text-muted-foreground">Cobrado mensalmente por cada assento acima do limite base</p>
            </div>
            <div className="flex items-center gap-1 w-28">
              <Label className="text-xs shrink-0">R$</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                className="h-8 text-sm"
                value={defaultPricePerExtraUser}
                onChange={(e) => { setDefaultPricePerExtraUser(e.target.value); setIsDirty(true); }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Módulos — Preço Base
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(MODULE_DEFINITIONS).map(([key, def]) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <p className="text-sm font-medium">{def.label}</p>
                <p className="text-xs text-muted-foreground">{def.description}</p>
              </div>
              <div className="flex items-center gap-1 w-36">
                <Label className="text-xs shrink-0">R$</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-8 text-sm"
                  value={moduleDrafts[key] ?? "0"}
                  onChange={(e) => {
                    setModuleDrafts((prev) => ({ ...prev, [key]: e.target.value }));
                    setIsDirty(true);
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-4 w-4 text-primary" />
            Conexões de Chat — Preço Base
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(CONNECTION_DEFINITIONS).map(([key, def]) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium flex-1">{def.label}</p>
              <div className="flex items-center gap-1 w-36">
                <Label className="text-xs shrink-0">R$</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-8 text-sm"
                  value={connectionDrafts[key] ?? "0"}
                  onChange={(e) => {
                    setConnectionDrafts((prev) => ({ ...prev, [key]: e.target.value }));
                    setIsDirty(true);
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Token Pricing */}
      <TokenPricingConfig />
    </div>
  );
}

// ===== Token Package Pricing Config =====
function TokenPricingConfig() {
  const [packages, setPackages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { name: string; token_amount: string; price: string; price_per_1k_tokens: string }>>({});

  const fetchPackages = useCallback(async () => {
    setIsLoading(true);
    const { data } = await (supabase as any).from("token_packages").select("*").order("provider").order("order_position");
    setPackages(data || []);
    const d: Record<string, any> = {};
    for (const p of data || []) {
      d[p.id] = { name: p.name, token_amount: String(p.token_amount), price: String(p.price), price_per_1k_tokens: String(p.price_per_1k_tokens ?? 0) };
    }
    setDrafts(d);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const handleSave = async (pkg: any) => {
    const draft = drafts[pkg.id];
    if (!draft) return;
    setIsSaving(true);
    const { error } = await (supabase as any)
      .from("token_packages")
      .update({
        name: draft.name,
        token_amount: parseInt(draft.token_amount) || 0,
        price: parseFloat(draft.price) || 0,
        price_per_1k_tokens: parseFloat(draft.price_per_1k_tokens) || 0,
      })
      .eq("id", pkg.id);

    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Pacote atualizado");
      await fetchPackages();
    }
    setIsSaving(false);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);

    const updates = packages.map((pkg) => {
      const draft = drafts[pkg.id] || {
        name: pkg.name,
        token_amount: String(pkg.token_amount),
        price: String(pkg.price),
        price_per_1k_tokens: String(pkg.price_per_1k_tokens ?? 0),
      };

      return (supabase as any)
        .from("token_packages")
        .update({
          name: draft.name,
          token_amount: parseInt(draft.token_amount) || 0,
          price: parseFloat(draft.price) || 0,
          price_per_1k_tokens: parseFloat(draft.price_per_1k_tokens) || 0,
        })
        .eq("id", pkg.id);
    });

    const results = await Promise.all(updates);
    const hasError = results.some((r: any) => r.error);

    if (hasError) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Pacotes atualizados");
      await fetchPackages();
    }

    setIsSaving(false);
  };

  const handleAdd = async (provider: string) => {
    const { error } = await (supabase as any).from("token_packages").insert({
      provider,
      name: `Novo pacote ${provider === "openai" ? "ChatGPT" : "Gemini"}`,
      token_amount: 100000,
      price: 10,
      order_position: packages.filter(p => p.provider === provider).length + 1,
      active: true,
    });
    if (error) toast.error("Erro ao adicionar"); else { toast.success("Pacote adicionado"); await fetchPackages(); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("token_packages").delete().eq("id", id);
    if (error) toast.error("Erro ao remover"); else { toast.success("Pacote removido"); await fetchPackages(); }
  };

  if (isLoading) return <Skeleton className="h-48" />;

  const geminiPkgs = packages.filter(p => p.provider === "gemini");
  const openaiPkgs = packages.filter(p => p.provider === "openai");

  const renderProviderSection = (label: string, provider: string, pkgs: any[]) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => handleAdd(provider)}>
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
      </div>
      {pkgs.map(pkg => {
        const draft = drafts[pkg.id] || { name: pkg.name, token_amount: String(pkg.token_amount), price: String(pkg.price), price_per_1k_tokens: String(pkg.price_per_1k_tokens ?? 0) };
        return (
          <div key={pkg.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <div className="flex-1 grid grid-cols-4 gap-2">
              <Input
                className="h-8 text-xs"
                value={draft.name}
                onChange={e => setDrafts(d => ({ ...d, [pkg.id]: { ...draft, name: e.target.value } }))}
                placeholder="Nome"
              />
              <div className="flex items-center gap-1">
                <Label className="text-[10px] shrink-0">Tokens</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={draft.token_amount}
                  onChange={e => setDrafts(d => ({ ...d, [pkg.id]: { ...draft, token_amount: e.target.value } }))}
                />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-[10px] shrink-0">R$</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-8 text-xs"
                  value={draft.price}
                  onChange={e => setDrafts(d => ({ ...d, [pkg.id]: { ...draft, price: e.target.value } }))}
                />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-[10px] shrink-0">R$/1K</Label>
                <Input
                  type="number"
                  step="0.0001"
                  className="h-8 text-xs"
                  value={draft.price_per_1k_tokens}
                  onChange={e => setDrafts(d => ({ ...d, [pkg.id]: { ...draft, price_per_1k_tokens: e.target.value } }))}
                />
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 px-2" disabled={isSaving} onClick={() => handleSave(pkg)}>
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => handleDelete(pkg.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
      {pkgs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum pacote configurado</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Tokens de I.A — Preços dos Pacotes
            </CardTitle>
            <CardDescription className="text-xs">Configure os pacotes de tokens disponíveis para compra por organização</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleSaveAll} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar tudo"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderProviderSection("Gemini (Flash)", "gemini", geminiPkgs)}
        {renderProviderSection("ChatGPT (OpenAI)", "openai", openaiPkgs)}
      </CardContent>
    </Card>
  );
}
