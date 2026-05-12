import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Package, Wifi, Check, X, TrendingDown, Clock, CheckCircle, XCircle, History, ChevronLeft, ChevronRight, Receipt, ExternalLink, QrCode, Copy, Landmark, Users, UserPlus, ShoppingCart, Loader2, Plus, Rocket, Minus, Crown, Infinity } from "lucide-react";
import { useOrganizationModules, MODULE_DEFINITIONS, CONNECTION_DEFINITIONS } from "@/hooks/useOrganizationModules";
import { Progress } from "@/components/ui/progress";
import { useGlobalModulePrices } from "@/hooks/useGlobalModulePrices";
import { usePaymentHistory } from "@/hooks/usePaymentHistory";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

import { InvoiceCarousel } from "./billing/InvoiceCarousel";
import { PaymentDialog } from "./billing/PaymentDialog";
import { ContractItemDialog } from "./billing/ContractItemDialog";
import { ActivatePlanDialog } from "./billing/ActivatePlanDialog";

export default function ModulesAndBillingTab({ tokenSection }: { tokenSection?: ReactNode } = {}) {
  const { currentOrganization, currentUserCount, refreshOrganizations } = useOrganization();
  const { modules, connections, isLoading, refresh: refreshModules } = useOrganizationModules();
  const { getModuleBasePrice, getConnectionBasePrice, globalUserConfig, isLoading: loadingGlobal } = useGlobalModulePrices();
  const { payments, isLoading: loadingPayments, refresh: refreshPayments } = usePaymentHistory();
  const [payingInvoice, setPayingInvoice] = useState<any>(null);
  const [contractItem, setContractItem] = useState<{ type: "module" | "connection" | "user_seat"; key: string; label: string; price: number } | null>(null);
  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);

  const isLifetime = !!(currentOrganization as any)?.lifetime;

  // Detect trial mode
  const isTrial = !isLifetime && !!currentOrganization?.trial_ends_at && new Date(currentOrganization.trial_ends_at) > new Date();

  // Refresh org data on mount to ensure fresh max_users / price_per_extra_user
  useEffect(() => {
    refreshOrganizations();
  }, []);

  useEffect(() => {
    if (!isLoading && !loadingGlobal) setHasInitialLoaded(true);
  }, [isLoading, loadingGlobal]);

  const globalBaseUsers = globalUserConfig?.default_max_users || 10;
  const maxUsers = Math.max(currentOrganization?.max_users || globalBaseUsers, globalBaseUsers);
  const pricePerExtraUser = Number(currentOrganization?.price_per_extra_user || globalUserConfig?.default_price_per_extra_user || 0);
  const contractedExtraSeats = Math.max(0, maxUsers - globalBaseUsers);
  const extraUsersCost = contractedExtraSeats * pricePerExtraUser;
  const extraUsers = contractedExtraSeats;
  const orgId = currentOrganization?.id || "";

  const handleTrialBlock = () => {
    toast.info("Você está no período de teste. Ative seu plano para contratar recursos adicionais.", { duration: 5000 });
  };

  const calculatedTotal = [
    ...modules.filter(m => m.active).map(m => ({ price: m.price, key: m.module_key, type: 'module' as const })),
    ...connections.filter(c => c.active && !CONNECTION_DEFINITIONS[c.connection_key]?.alwaysFree && c.connection_key !== 'whatsapp').map(c => ({ price: c.price, key: c.connection_key, type: 'connection' as const })),
  ].reduce((sum, item) => {
    if (item.price === -1) {
      return sum + (item.type === 'module' ? getModuleBasePrice(item.key) : getConnectionBasePrice(item.key));
    }
    return sum + Math.max(0, item.price);
  }, 0);

  if (!hasInitialLoaded && (isLoading || loadingGlobal)) {
    return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  }

  const getDiscount = (orgPrice: number, basePrice: number) => {
    if (orgPrice === -1 || basePrice <= 0 || orgPrice <= 0) return null;
    if (orgPrice < basePrice) return basePrice - orgPrice;
    return null;
  };

  const getDisplayPrice = (orgPrice: number, basePrice: number) => {
    if (orgPrice === -1) return basePrice;
    return orgPrice;
  };

  const getEffectivePrice = (orgPrice: number, basePrice: number) => {
    if (orgPrice === -1) return basePrice;
    return Math.max(0, orgPrice);
  };

  const handleContractSuccess = async () => {
    refreshModules();
    refreshPayments();
    await refreshOrganizations();
  };

  return (
    <div className="space-y-6">
      {/* Invoice Carousel - hidden for lifetime */}
      {!isLifetime && !loadingPayments && payments.length > 0 && (
        <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Faturas</CardTitle>
            </div>
            <CardDescription>Histórico de faturas mensais</CardDescription>
          </CardHeader>
          <CardContent>
            <InvoiceCarousel payments={payments} onPayInvoice={setPayingInvoice} />
          </CardContent>
        </Card>
      )}

      {/* Pay Invoice Dialog */}
      <PaymentDialog payment={payingInvoice} open={!!payingInvoice} onClose={() => { setPayingInvoice(null); refreshPayments(); }} onPaid={() => { refreshPayments(); }} />

      {/* Contract Item Dialog */}
      {contractItem && (
        <ContractItemDialog
          open={!!contractItem}
          onClose={() => setContractItem(null)}
          itemType={contractItem.type}
          itemKey={contractItem.key}
          itemLabel={contractItem.label}
          price={contractItem.price}
          orgId={orgId}
          onSuccess={handleContractSuccess}
        />
      )}

      {/* Activate Plan Dialog */}
      <ActivatePlanDialog
        open={showActivateDialog}
        onClose={() => setShowActivateDialog(false)}
        orgId={orgId}
        onSuccess={async () => {
          await refreshOrganizations();
          refreshPayments();
          refreshModules();
        }}
        getModuleBasePrice={getModuleBasePrice}
        getConnectionBasePrice={getConnectionBasePrice}
        globalUserConfig={globalUserConfig as any}
        pricePerExtraUser={pricePerExtraUser}
      />

      {/* Summary */}
      <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
              {isLifetime ? <Crown className="h-5 w-5 text-amber-500" /> : <CreditCard className="h-5 w-5 text-primary" />}
            </div>
            <CardTitle>{isLifetime ? 'Plano Vitalício' : 'Planos e Cobranças'}</CardTitle>
          </div>
          <CardDescription>{isLifetime ? 'Acesso completo e permanente a todos os recursos' : 'Módulos, conexões e histórico de pagamento'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`p-6 rounded-xl border ${isLifetime ? 'bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/20' : 'bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10'}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                {isLifetime ? (
                  <>
                    <p className="text-sm text-muted-foreground">Plano</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-amber-500">Vitalício</p>
                      <Crown className="h-6 w-6 text-amber-500" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Todos os módulos, conexões e tokens desbloqueados permanentemente</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Valor Mensal Total</p>
                    {isTrial ? (
                      <p className="text-3xl font-bold text-amber-500">Trial</p>
                    ) : (
                      <p className="text-3xl font-bold text-primary">
                        R$ {(calculatedTotal + extraUsersCost).toFixed(2)}
                      </p>
                    )}
                    {!isTrial && extraUsersCost > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Módulos: R$ {calculatedTotal.toFixed(2)} + Usuários extras: R$ {extraUsersCost.toFixed(2)}
                      </p>
                    )}
                    {isTrial && currentOrganization?.trial_ends_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Teste gratuito até {new Date(currentOrganization.trial_ends_at).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className={`p-3 rounded-lg ${isLifetime ? 'bg-gradient-to-br from-amber-500/10 to-yellow-500/10' : 'bg-gradient-to-br from-primary/10 to-accent/10'}`}>
                {isLifetime ? <Crown className="h-6 w-6 text-amber-500" /> : <CreditCard className="h-6 w-6 text-primary" />}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Status: <span className="font-medium text-foreground">
                {isLifetime ? 'Vitalício ∞' : isTrial ? 'Período de Teste' : currentOrganization?.active ? 'Ativo' : 'Inativo'}
              </span>
            </p>
            {isTrial && !isLifetime && (
              <Button
                className="w-full mt-4 gap-2"
                onClick={() => setShowActivateDialog(true)}
              >
                <Rocket className="h-4 w-4" />
                Ativar Plano
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Token Section (injected) */}
      {tokenSection}

      {/* User Seats */}
      <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Usuários</CardTitle>
            {isLifetime && (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] gap-1">
                <Crown className="h-3 w-3" /> Ilimitado
              </Badge>
            )}
          </div>
          <CardDescription>{isLifetime ? 'Sem limite de usuários' : 'Gerenciamento de licenças de usuários'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLifetime ? (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-yellow-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Usuários Ativos</p>
                  <p className="text-2xl font-bold text-amber-500">{currentUserCount}</p>
                </div>
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1">
                  <Crown className="h-3 w-3" /> Sem limite
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Plano vitalício — adicione quantos usuários precisar</p>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">Licenças de Usuários</p>
                    <p className="text-2xl font-bold text-primary">
                      {currentUserCount} <span className="text-base font-normal text-muted-foreground">/ {maxUsers}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    {extraUsers > 0 ? (
                      <Badge variant="destructive" className="gap-1">
                        <UserPlus className="h-3 w-3" />
                        {extraUsers} extra{extraUsers > 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Check className="h-3 w-3" />
                        Dentro do limite
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress value={Math.min(100, (currentUserCount / maxUsers) * 100)} className="h-2 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {currentUserCount >= maxUsers
                    ? `Limite atingido. Novos registros serão bloqueados automaticamente.`
                    : `${maxUsers - currentUserCount} vaga${maxUsers - currentUserCount > 1 ? 's' : ''} disponível${maxUsers - currentUserCount > 1 ? 'is' : ''}.`}
                </p>
              </div>
              {pricePerExtraUser > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Custo por usuário adicional</p>
                      <p className="text-xs text-muted-foreground">Cobrado mensalmente na renovação (base inclusa: {globalBaseUsers} usuários)</p>
                    </div>
                    <span className="text-sm font-bold text-primary">R$ {pricePerExtraUser.toFixed(2)}/mês</span>
                  </div>
                  {extraUsers > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{contractedExtraSeats} assento{contractedExtraSeats > 1 ? 's' : ''} contratado{contractedExtraSeats > 1 ? 's' : ''} × R$ {pricePerExtraUser.toFixed(2)}</span>
                        <span className="font-bold text-destructive">R$ {extraUsersCost.toFixed(2)}/mês</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Add user seat button */}
              {pricePerExtraUser > 0 && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    if (isTrial) return handleTrialBlock();
                    setContractItem({
                      type: "user_seat",
                      key: "extra_user",
                      label: "+1 Usuário",
                      price: pricePerExtraUser,
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Usuário — R$ {pricePerExtraUser.toFixed(2)}/mês
                </Button>
              )}
              {/* Remove extra seats button */}
              {extraUsers > 0 && pricePerExtraUser > 0 && (
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={async () => {
                    const contractedAt = (currentOrganization as any)?.extra_users_contracted_at;
                    if (!contractedAt) {
                      toast.error("Data de contratação não encontrada.");
                      return;
                    }
                    const daysSinceContracted = Math.floor((Date.now() - new Date(contractedAt).getTime()) / (1000 * 60 * 60 * 24));
                    if (daysSinceContracted < 30) {
                      toast.error(`Remoção de usuários extras só é permitida após 30 dias da contratação. Faltam ${30 - daysSinceContracted} dia(s).`);
                      return;
                    }
                    if (currentUserCount > maxUsers - 1) {
                      toast.error(`Não é possível reduzir. Existem ${currentUserCount} usuários ativos. Remova um usuário antes de reduzir a licença.`);
                      return;
                    }
                    if (!confirm(`Remover 1 licença extra? O limite cairá de ${maxUsers} para ${maxUsers - 1} usuários.`)) return;
                    try {
                      const updateData: any = { max_users: maxUsers - 1 };
                      if (maxUsers - 1 <= globalBaseUsers) {
                        updateData.extra_users_contracted_at = null;
                      }
                      const { error } = await (supabase as any)
                        .from("organizations")
                        .update(updateData)
                        .eq("id", orgId);
                      if (error) throw error;
                      toast.success("Licença extra removida com sucesso!");
                      await refreshOrganizations();
                      refreshPayments();
                    } catch (err: any) {
                      toast.error("Erro ao remover licença: " + (err.message || "tente novamente"));
                    }
                  }}
                >
                  <Minus className="h-4 w-4" />
                  Remover 1 Licença Extra
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modules */}
      <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Módulos</CardTitle>
            {isLifetime && (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] gap-1">
                <Crown className="h-3 w-3" /> Todos inclusos
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(MODULE_DEFINITIONS).map(([key, def]) => {
            const mod = modules.find(m => m.module_key === key);
            const isActive = mod?.active || false;
            const orgPrice = mod?.price ?? -1;
            const basePrice = getModuleBasePrice(key);
            const displayPrice = getDisplayPrice(orgPrice, basePrice);
            const effectivePrice = getEffectivePrice(orgPrice, basePrice);
            const discount = getDiscount(orgPrice, basePrice);
            const isInheriting = orgPrice === -1;
            const isFree = orgPrice === 0;

            return (
              <div key={key} className={`p-4 rounded-xl border ${isLifetime || isActive ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{def.label}</h3>
                    {isLifetime ? (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs gap-1">
                        <Crown className="h-3 w-3" /> Vitalício
                      </Badge>
                    ) : (
                      <Badge variant={isActive ? 'default' : 'secondary'}>
                        {isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    )}
                  </div>
                  {!isLifetime && (
                    <div className="flex items-center gap-2">
                      {discount !== null && discount > 0 && (
                        <div className="flex items-center gap-1">
                          <TrendingDown className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-xs text-green-600 font-medium line-through">R$ {basePrice.toFixed(2)}</span>
                        </div>
                      )}
                      {isFree ? (
                        <Badge variant="secondary" className="text-xs">Gratuito</Badge>
                      ) : isInheriting ? (
                        <span className="text-sm font-medium text-primary">R$ {basePrice.toFixed(2)}/mês <span className="text-xs text-muted-foreground">(global)</span></span>
                      ) : displayPrice > 0 ? (
                        <span className="text-sm font-medium text-primary">R$ {displayPrice.toFixed(2)}/mês</span>
                      ) : null}
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">{def.description}</p>
                <div className="grid grid-cols-2 gap-1">
                  {def.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm">
                      {isLifetime || isActive ? <Check className="h-3.5 w-3.5 text-primary shrink-0" /> : <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <span className={isLifetime || isActive ? '' : 'text-muted-foreground'}>{f}</span>
                    </div>
                  ))}
                </div>
                {/* Contract button for inactive modules - hidden for lifetime */}
                {!isLifetime && !isActive && (
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-3 gap-2"
                    onClick={() => {
                      if (isTrial) return handleTrialBlock();
                      setContractItem({
                        type: "module",
                        key,
                        label: def.label,
                        price: effectivePrice,
                      });
                    }}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Contratar {effectivePrice > 0 ? `— R$ ${effectivePrice.toFixed(2)}/mês` : '— Gratuito'}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Connections */}
      <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
             <Wifi className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Conexões de Chat</CardTitle>
            {isLifetime && (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] gap-1">
                <Crown className="h-3 w-3" /> Todas inclusas
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(CONNECTION_DEFINITIONS).map(([key, def]) => {
              const conn = connections.find(c => c.connection_key === key);
              const isActive = conn?.active || def.alwaysFree || false;
              const isFree = def.alwaysFree;
              const orgPrice = conn?.price ?? -1;
              const basePrice = getConnectionBasePrice(key);
              const displayPrice = isFree ? 0 : getDisplayPrice(orgPrice, basePrice);
              const effectivePrice = isFree ? 0 : getEffectivePrice(orgPrice, basePrice);
              const discount = isFree ? null : getDiscount(orgPrice, basePrice);

              return (
                <div key={key} className={`p-4 rounded-xl border ${isLifetime || isActive ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{def.label}</span>
                      {isLifetime ? (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs gap-1">
                          <Crown className="h-3 w-3" /> Vitalício
                        </Badge>
                      ) : (
                        <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                          {isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {!isLifetime && (
                    <div className="flex items-center gap-2 mt-1">
                      {isFree ? (
                        <span className="text-xs font-medium text-green-600">Incluso no plano</span>
                      ) : (
                        <>
                          {discount !== null && discount > 0 && (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" />
                              <span className="line-through">R$ {basePrice.toFixed(2)}</span>
                            </span>
                          )}
                          {displayPrice > 0 && (
                            <span className="text-xs font-medium text-primary">R$ {displayPrice.toFixed(2)}/mês</span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {/* Contract button - hidden for lifetime */}
                  {!isLifetime && !isActive && !isFree && (
                    <Button
                      variant="default"
                      size="sm"
                      className="mt-2 gap-2 w-full"
                      onClick={() => {
                        if (isTrial) return handleTrialBlock();
                        setContractItem({
                          type: "connection",
                          key,
                          label: def.label,
                          price: effectivePrice,
                        });
                      }}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Contratar {effectivePrice > 0 ? `— R$ ${effectivePrice.toFixed(2)}/mês` : ''}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
