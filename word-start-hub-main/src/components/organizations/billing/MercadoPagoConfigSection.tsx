import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Wifi, WifiOff, CreditCard, Send, QrCode, Landmark, Search, Copy, Check, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    MercadoPagoConfig,
    callMP,
    SUPABASE_URL
} from "./billing-utils";

export function MercadoPagoConfigSection() {
    const [config, setConfig] = useState<MercadoPagoConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showToken, setShowToken] = useState(false);
    const [drafts, setDrafts] = useState({ access_token: "", public_key: "", webhook_secret: "" });
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [connectionResult, setConnectionResult] = useState<any>(null);

    const fetchConfig = useCallback(async () => {
        setIsLoading(true);
        const { data } = await (supabase as any).from("mercadopago_config").select("*").limit(1).single();
        setConfig(data);
        if (data) {
            setDrafts({
                access_token: data.access_token_encrypted || "",
                public_key: data.public_key || "",
                webhook_secret: data.webhook_secret || "",
            });
        }
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        setIsSaving(true);
        const payload = {
            access_token_encrypted: drafts.access_token,
            public_key: drafts.public_key,
            webhook_secret: drafts.webhook_secret,
            active: true,
            updated_at: new Date().toISOString(),
        };

        let error;
        if (config?.id) {
            ({ error } = await (supabase as any).from("mercadopago_config").update(payload).eq("id", config.id));
        } else {
            ({ error } = await (supabase as any).from("mercadopago_config").insert(payload));
        }

        if (error) {
            toast.error("Erro ao salvar configuração");
        } else {
            toast.success("Configuração do Mercado Pago salva");
            await fetchConfig();
        }
        setIsSaving(false);
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setConnectionResult(null);
        try {
            const result = await callMP("test_connection");
            setConnectionResult(result);
            if (result.connected) {
                toast.success(`Conectado! Conta: ${result.account?.email || result.account?.first_name}`);
            } else {
                toast.error(`Falha na conexão: ${result.error}`);
            }
        } catch (err: any) {
            toast.error(err.message);
            setConnectionResult({ connected: false, error: err.message });
        }
        setIsTesting(false);
    };

    if (isLoading) return <Skeleton className="h-64" />;

    const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary" />
                        Configuração do Mercado Pago
                    </CardTitle>
                    <CardDescription>
                        Configure as credenciais para receber pagamentos via Mercado Pago
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Access Token</Label>
                        <div className="flex gap-2">
                            <Input
                                type={showToken ? "text" : "password"}
                                value={drafts.access_token}
                                onChange={(e) => setDrafts(d => ({ ...d, access_token: e.target.value }))}
                                placeholder="APP_USR-..."
                            />
                            <Button variant="ghost" size="icon" onClick={() => setShowToken(!showToken)}>
                                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Public Key</Label>
                        <Input
                            value={drafts.public_key}
                            onChange={(e) => setDrafts(d => ({ ...d, public_key: e.target.value }))}
                            placeholder="APP_USR-..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Webhook Secret (opcional)</Label>
                        <Input
                            type="password"
                            value={drafts.webhook_secret}
                            onChange={(e) => setDrafts(d => ({ ...d, webhook_secret: e.target.value }))}
                            placeholder="Secret para validar webhooks"
                        />
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">URL do Webhook (configure no Mercado Pago)</p>
                        <code className="text-xs break-all text-primary">{webhookUrl}</code>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <Badge variant={config?.active ? "default" : "secondary"}>
                                {config?.active ? "Ativo" : "Inativo"}
                            </Badge>
                            {connectionResult && (
                                <Badge variant={connectionResult.connected ? "default" : "destructive"} className="gap-1">
                                    {connectionResult.connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                    {connectionResult.connected ? "Conectado" : "Desconectado"}
                                </Badge>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleTestConnection} disabled={isTesting} className="gap-2">
                                <Wifi className="h-4 w-4" />
                                {isTesting ? "Testando..." : "Testar Conexão"}
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? "Salvando..." : "Salvar Configuração"}
                            </Button>
                        </div>
                    </div>

                    {/* Connection result details */}
                    {connectionResult?.connected && connectionResult.account && (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-1">
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">✅ Conexão estabelecida</p>
                            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                <span>ID: {connectionResult.account.id}</span>
                                <span>Email: {connectionResult.account.email}</span>
                                <span>Nome: {connectionResult.account.first_name} {connectionResult.account.last_name}</span>
                                <span>País: {connectionResult.account.site_id}</span>
                            </div>
                        </div>
                    )}

                    {connectionResult && !connectionResult.connected && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm font-medium text-destructive">❌ Falha na conexão</p>
                            <p className="text-xs text-muted-foreground mt-1">{connectionResult.error}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Payment Section */}
            <CreatePaymentSection />
        </div>
    );
}

// ===== Create Payment (Pix, Boleto, Card) =====
function CreatePaymentSection() {
    const [orgs, setOrgs] = useState<any[]>([]);
    const [selectedOrg, setSelectedOrg] = useState("");
    const [amount, setAmount] = useState("");
    const [referenceMonth, setReferenceMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [paymentMethod, setPaymentMethod] = useState("pix");
    const [payerEmail, setPayerEmail] = useState("");
    const [payerDoc, setPayerDoc] = useState("");
    const [description, setDescription] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    // Validate payment
    const [validateId, setValidateId] = useState("");
    const [isValidating, setIsValidating] = useState(false);
    const [validateResult, setValidateResult] = useState<any>(null);

    useEffect(() => {
        (supabase as any).from("organizations").select("id, name, lifetime").order("name").then(({ data }: any) => setOrgs((data || []).filter((o: any) => !o.lifetime)));
    }, []);

    const handleCreatePayment = async () => {
        if (!selectedOrg || !amount) {
            toast.error("Selecione a organização e informe o valor");
            return;
        }
        setIsCreating(true);
        setResult(null);
        try {
            const res = await callMP("create_payment", {
                organization_id: selectedOrg,
                amount: Number(amount),
                reference_month: referenceMonth,
                description: description || `Assinatura Vitta - ${referenceMonth}`,
                payment_method: paymentMethod,
                payer_email: payerEmail || "cliente@email.com",
                payer_doc_type: "CPF",
                payer_doc_number: payerDoc || undefined,
            });

            if (res.error) {
                toast.error(res.error);
            } else {
                setResult(res);
                toast.success(`Pagamento criado! Status: ${res.status}`);
            }
        } catch (err: any) {
            toast.error(err.message);
        }
        setIsCreating(false);
    };

    const handleValidatePayment = async () => {
        if (!validateId) { toast.error("Informe o ID do pagamento"); return; }
        setIsValidating(true);
        setValidateResult(null);
        try {
            const res = await callMP("validate_payment", { payment_id: validateId });
            setValidateResult(res);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success(`Status: ${res.status} (${res.status_detail})`);
            }
        } catch (err: any) {
            toast.error(err.message);
        }
        setIsValidating(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copiado!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-4">
            {/* Create Payment */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <span className="h-5 w-5 text-primary flex items-center justify-center">R$</span>
                        Criar Pagamento
                    </CardTitle>
                    <CardDescription>Gere cobranças via Pix, Boleto ou Cartão</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Organização</Label>
                            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Mês de Referência</Label>
                            <Input type="month" value={referenceMonth} onChange={e => setReferenceMonth(e.target.value)} className="h-9" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Valor (R$)</Label>
                            <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="99.90" className="h-9" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Método de Pagamento</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pix">
                                        <span className="flex items-center gap-2"><QrCode className="h-3.5 w-3.5" /> Pix</span>
                                    </SelectItem>
                                    <SelectItem value="boleto">
                                        <span className="flex items-center gap-2"><Landmark className="h-3.5 w-3.5" /> Boleto</span>
                                    </SelectItem>
                                    <SelectItem value="credit_card">
                                        <span className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Cartão de Crédito</span>
                                    </SelectItem>
                                    <SelectItem value="debit_card">
                                        <span className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Cartão de Débito</span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">E-mail do Pagador</Label>
                            <Input value={payerEmail} onChange={e => setPayerEmail(e.target.value)} placeholder="cliente@email.com" className="h-9" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">CPF do Pagador</Label>
                            <Input value={payerDoc} onChange={e => setPayerDoc(e.target.value)} placeholder="12345678900" className="h-9" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Descrição (opcional)</Label>
                        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Assinatura Vitta - Março 2026" className="h-9" />
                    </div>

                    {(paymentMethod === "credit_card" || paymentMethod === "debit_card") && (
                        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <p className="text-xs text-yellow-700 dark:text-yellow-400">
                                ⚠️ Pagamento por cartão requer tokenização via SDK do Mercado Pago no frontend.
                                Use o <strong>Link de Pagamento</strong> (Faturas → Link) para pagamentos com cartão,
                                ou integre o MercadoPago.js no checkout.
                            </p>
                        </div>
                    )}

                    <Button onClick={handleCreatePayment} disabled={isCreating || !selectedOrg || !amount} className="gap-2">
                        <Send className="h-4 w-4" />
                        {isCreating ? "Criando..." : "Criar Pagamento"}
                    </Button>

                    {/* Result */}
                    {result && (
                        <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
                            <div className="flex items-center gap-2">
                                <Badge variant={result.status === "approved" ? "default" : "secondary"}>
                                    {result.status === "approved" ? "Aprovado" : result.status === "pending" ? "Pendente" : result.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">ID: #{result.payment_id}</span>
                            </div>

                            {/* Pix QR Code */}
                            {result.pix_qr_code && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium">Pix Copia e Cola:</Label>
                                    <div className="flex gap-2">
                                        <Input value={result.pix_qr_code} readOnly className="text-xs font-mono h-8" />
                                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(result.pix_qr_code)} className="h-8 gap-1 shrink-0">
                                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                            {copied ? "Copiado" : "Copiar"}
                                        </Button>
                                    </div>
                                    {result.pix_qr_code_base64 && (
                                        <div className="flex justify-center">
                                            <img src={`data:image/png;base64,${result.pix_qr_code_base64}`} alt="QR Code Pix" className="w-48 h-48 rounded-lg border" />
                                        </div>
                                    )}
                                    {result.pix_ticket_url && (
                                        <Button variant="outline" size="sm" asChild className="gap-1">
                                            <a href={result.pix_ticket_url} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-3 w-3" /> Ver Página do Pix
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Boleto */}
                            {result.boleto_url && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium">Boleto:</Label>
                                    {result.boleto_barcode && (
                                        <div className="flex gap-2">
                                            <Input value={result.boleto_barcode} readOnly className="text-xs font-mono h-8" />
                                            <Button variant="outline" size="sm" onClick={() => copyToClipboard(result.boleto_barcode)} className="h-8 shrink-0">
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                    <Button variant="outline" size="sm" asChild className="gap-1">
                                        <a href={result.boleto_url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-3 w-3" /> Abrir Boleto
                                        </a>
                                    </Button>
                                </div>
                            )}

                            {result.status_detail && (
                                <p className="text-xs text-muted-foreground">Detalhe: {result.status_detail}</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Validate Payment */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Search className="h-5 w-5 text-primary" />
                        Validar Pagamento
                    </CardTitle>
                    <CardDescription>Consulte o status de um pagamento pelo ID do Mercado Pago</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex gap-2">
                        <Input value={validateId} onChange={e => setValidateId(e.target.value)} placeholder="ID do pagamento (ex: 12345678)" className="h-9" />
                        <Button onClick={handleValidatePayment} disabled={isValidating || !validateId} className="gap-2 shrink-0">
                            <Search className="h-4 w-4" />
                            {isValidating ? "Validando..." : "Validar"}
                        </Button>
                    </div>

                    {validateResult && !validateResult.error && (
                        <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge variant={validateResult.status === "approved" ? "default" : validateResult.status === "rejected" ? "destructive" : "secondary"}>
                                    {validateResult.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">#{validateResult.payment_id}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                <span>Valor: R$ {Number(validateResult.amount || 0).toFixed(2)}</span>
                                <span>Método: {validateResult.payment_method || "—"}</span>
                                <span>Detalhe: {validateResult.status_detail || "—"}</span>
                                <span>Pagador: {validateResult.payer_email || "—"}</span>
                                <span>Criado: {validateResult.date_created ? new Date(validateResult.date_created).toLocaleString("pt-BR") : "—"}</span>
                                <span>Aprovado: {validateResult.date_approved ? new Date(validateResult.date_approved).toLocaleString("pt-BR") : "—"}</span>
                            </div>
                            <p className="text-xs">
                                Ref: <code className="text-primary">{validateResult.external_reference || "—"}</code>
                            </p>
                            <p className="text-xs">
                                Status no BD: <Badge variant="outline" className="text-xs">{validateResult.db_status}</Badge>
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
