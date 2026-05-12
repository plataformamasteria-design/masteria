import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, ShoppingCart, Plus, Sparkles, History, ArrowUpRight, ArrowDownRight, Loader2, CheckCircle, Copy, QrCode, Brain, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TokenBalance {
  id: string;
  provider: string;
  total_tokens: number;
  used_tokens: number;
}

interface TokenPackage {
  id: string;
  provider: string;
  name: string;
  token_amount: number;
  price: number;
  price_per_1k_tokens: number;
  order_position: number;
}

interface TokenTransaction {
  id: string;
  provider: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function TokenBalanceSection({ organizationId, isLifetime = false }: { organizationId: string; isLifetime?: boolean }) {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"gemini" | "openai">("gemini");
  const [customAmount, setCustomAmount] = useState("");
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Payment state
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid" | "cancelled">("pending");
  const [purchaseInfo, setPurchaseInfo] = useState<{ amount: number; provider: string; price: number } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [bRes, pRes, tRes] = await Promise.all([
      (supabase as any).from("organization_token_balances").select("*").eq("organization_id", organizationId),
      (supabase as any).from("token_packages").select("*").eq("active", true).order("order_position"),
      (supabase as any).from("token_transactions").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    ]);
    setBalances(bRes.data || []);
    setPackages(pRes.data || []);
    setTransactions(tRes.data || []);
    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const getBalance = (provider: string) => balances.find(b => b.provider === provider);
  const geminiBalance = getBalance("gemini");
  const openaiBalance = getBalance("openai");

  const startPolling = (pId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    let pollCount = 0;
    pollingRef.current = setInterval(async () => {
      pollCount++;
      if (pollCount > 120) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        toast.error("Tempo de pagamento expirado. Tente novamente.");
        return;
      }
      try {
        const { data: result } = await supabase.functions.invoke("mercadopago-webhook?action=token_purchase_status", {
          body: { purchase_id: pId },
        });

        if (result?.status === "paid") {
          setPaymentStatus("paid");
          if (pollingRef.current) clearInterval(pollingRef.current);
          toast.success(`${formatTokens(result.token_amount || 0)} tokens adicionados com sucesso!`);
          await fetchData();
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);
  };

  const handlePurchasePackage = async (pkg: TokenPackage) => {
    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-webhook?action=token_purchase", {
        body: {
          organization_id: organizationId,
          provider: pkg.provider,
          token_amount: pkg.token_amount,
          price: pkg.price,
          package_name: pkg.name,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Show payment dialog
      setPurchaseId(data.purchase_id);
      setPixQrCode(data.pix_qr_code_base64);
      setPixCopyPaste(data.pix_qr_code);
      setPurchaseInfo({ amount: pkg.token_amount, provider: pkg.provider, price: pkg.price });
      setPaymentStatus("pending");
      setBuyDialogOpen(false);
      setPaymentDialog(true);

      // Start polling for payment confirmation
      startPolling(data.purchase_id);
    } catch (err: any) {
      console.error("Token purchase error:", err);
      toast.error(err.message || "Erro ao gerar pagamento");
    }
    setIsPurchasing(false);
  };

  const handleCustomPurchase = async () => {
    const amount = parseInt(customAmount);
    if (!amount || amount < 1000) {
      toast.error("Mínimo de 1.000 tokens");
      return;
    }

    // Use price_per_1k_tokens from the largest package for custom pricing
    const providerPackages = packages.filter(p => p.provider === selectedProvider);
    const largestPkg = providerPackages.sort((a, b) => b.token_amount - a.token_amount)[0];
    const pricePer1k = largestPkg?.price_per_1k_tokens || (largestPkg ? (largestPkg.price / largestPkg.token_amount) * 1000 : 0.01);
    const calculatedPrice = Math.max(0.01, parseFloat(((amount / 1000) * pricePer1k).toFixed(2)));

    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-webhook?action=token_purchase", {
        body: {
          organization_id: organizationId,
          provider: selectedProvider,
          token_amount: amount,
          price: calculatedPrice,
          package_name: `${formatTokens(amount)} tokens ${selectedProvider === "openai" ? "ChatGPT" : "Gemini"}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPurchaseId(data.purchase_id);
      setPixQrCode(data.pix_qr_code_base64);
      setPixCopyPaste(data.pix_qr_code);
      setPurchaseInfo({ amount, provider: selectedProvider, price: calculatedPrice });
      setPaymentStatus("pending");
      setBuyDialogOpen(false);
      setPaymentDialog(true);
      setCustomAmount("");

      startPolling(data.purchase_id);
    } catch (err: any) {
      console.error("Custom token purchase error:", err);
      toast.error(err.message || "Erro ao gerar pagamento");
    }
    setIsPurchasing(false);
  };

  const handleCopyPix = () => {
    if (pixCopyPaste) {
      navigator.clipboard.writeText(pixCopyPaste);
      toast.success("Código PIX copiado!");
    }
  };

  const handleClosePayment = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPaymentDialog(false);
    setPurchaseId(null);
    setPixQrCode(null);
    setPixCopyPaste(null);
    setPurchaseInfo(null);
    setPaymentStatus("pending");
  };

  const renderBalanceCard = (provider: string, label: string, balance: TokenBalance | undefined) => {
    if (isLifetime) {
      return (
        <div className="rounded-xl border border-amber-500/30 p-4 space-y-3 bg-gradient-to-br from-amber-500/5 to-yellow-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${provider === "openai" ? "text-emerald-500" : "text-blue-500"}`} />
              <span className="text-sm font-semibold">{label}</span>
            </div>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] gap-1">
              <Crown className="h-3 w-3" /> Vitalício
            </Badge>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-amber-500">∞</p>
              <span className="text-sm text-muted-foreground">Ilimitado</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Uso sem restrições de saldo</p>
          </div>
        </div>
      );
    }

    const total = balance?.total_tokens || 0;
    const used = balance?.used_tokens || 0;
    const remaining = Math.max(0, total - used);
    const pct = total > 0 ? (used / total) * 100 : 0;
    const isLow = pct > 80;

    return (
      <div className="rounded-xl border border-border/50 p-4 space-y-3 bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${provider === "openai" ? "text-emerald-500" : "text-blue-500"}`} />
            <span className="text-sm font-semibold">{label}</span>
          </div>
          {isLow && total > 0 && <Badge variant="destructive" className="text-[10px]">Baixo</Badge>}
          {total === 0 && <Badge variant="secondary" className="text-[10px]">Sem saldo</Badge>}
        </div>
        <div>
          <p className="text-2xl font-bold">{formatTokens(remaining)}</p>
          <p className="text-xs text-muted-foreground">de {formatTokens(total)} contratados</p>
        </div>
        <Progress value={Math.min(100, pct)} className="h-2" />
        <p className="text-xs text-muted-foreground">{formatTokens(used)} consumidos</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Tokens de I.A</CardTitle></CardHeader>
        <CardContent><div className="h-32 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Tokens de I.A
              {isLifetime && (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] gap-1">
                  <Crown className="h-3 w-3" /> Vitalício
                </Badge>
              )}
            </CardTitle>
            {!isLifetime && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setHistoryOpen(true)}>
                  <History className="h-3.5 w-3.5" /> Histórico
                </Button>
                <Button size="sm" className="gap-1.5 text-xs" onClick={() => setBuyDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Recarregar
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isLifetime ? 'Tokens ilimitados — uso sem restrições' : 'Gerencie seus tokens para automações com Inteligência Artificial'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderBalanceCard("gemini", "Gemini", geminiBalance)}
            {renderBalanceCard("openai", "ChatGPT (OpenAI)", openaiBalance)}
          </div>
        </CardContent>
      </Card>

      {/* Buy Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Recarregar Tokens
            </DialogTitle>
            <DialogDescription>Escolha um pacote ou defina uma quantidade personalizada</DialogDescription>
          </DialogHeader>

          <Tabs value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="gemini" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Gemini</TabsTrigger>
              <TabsTrigger value="openai" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> ChatGPT</TabsTrigger>
            </TabsList>

            {["gemini", "openai"].map(prov => (
              <TabsContent key={prov} value={prov} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  {packages.filter(p => p.provider === prov).map(pkg => (
                    <button
                      key={pkg.id}
                      disabled={isPurchasing}
                      onClick={() => handlePurchasePackage(pkg)}
                      className="rounded-xl border border-border/50 p-4 text-left hover:border-primary/50 hover:bg-primary/5 transition-all space-y-1 disabled:opacity-50"
                    >
                      <p className="font-semibold text-sm">{formatTokens(pkg.token_amount)}</p>
                      <p className="text-xs text-muted-foreground">{pkg.name}</p>
                      <p className="text-sm font-bold text-primary">R$ {Number(pkg.price).toFixed(2)}</p>
                    </button>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Quantidade personalizada</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Qtd. de tokens (min 1000)"
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      className="h-9"
                    />
                    <Button size="sm" disabled={isPurchasing || !customAmount} onClick={handleCustomPurchase} className="gap-1.5 shrink-0">
                      {isPurchasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Adicionar
                    </Button>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog (PIX) */}
      <Dialog open={paymentDialog} onOpenChange={(open) => { if (!open) handleClosePayment(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              {paymentStatus === "paid" ? "Pagamento Confirmado!" : "Pagamento via PIX"}
            </DialogTitle>
          </DialogHeader>

          {paymentStatus === "paid" ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-bold">Tokens adicionados!</p>
                <p className="text-sm text-muted-foreground">
                  {purchaseInfo && `${formatTokens(purchaseInfo.amount)} tokens ${purchaseInfo.provider === "openai" ? "ChatGPT" : "Gemini"}`}
                </p>
              </div>
              <Button onClick={handleClosePayment}>Fechar</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {purchaseInfo && (
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    {formatTokens(purchaseInfo.amount)} tokens {purchaseInfo.provider === "openai" ? "ChatGPT" : "Gemini"}
                  </p>
                  <p className="text-xl font-bold">R$ {purchaseInfo.price.toFixed(2)}</p>
                </div>
              )}

              {pixQrCode && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixQrCode}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-lg border"
                  />
                </div>
              )}

              {pixCopyPaste && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Código PIX (copia e cola)</p>
                  <div className="flex gap-2">
                    <Input value={pixCopyPaste} readOnly className="text-xs h-9 font-mono" />
                    <Button size="sm" variant="outline" onClick={handleCopyPix} className="shrink-0 gap-1.5">
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Aguardando confirmação do pagamento...</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de Tokens
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {transactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação encontrada</p>}
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card/30">
                {tx.transaction_type === "consumption" ? (
                  <ArrowDownRight className="h-4 w-4 text-red-500 shrink-0" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 text-green-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{tx.description || tx.transaction_type}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString("pt-BR")} · {tx.provider === "openai" ? "ChatGPT" : "Gemini"}
                  </p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${tx.transaction_type === "consumption" ? "text-red-500" : "text-green-500"}`}>
                  {tx.transaction_type === "consumption" ? "-" : "+"}{formatTokens(Math.abs(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
