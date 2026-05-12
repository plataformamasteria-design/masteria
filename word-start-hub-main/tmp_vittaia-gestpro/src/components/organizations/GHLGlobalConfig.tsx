import { useState, useEffect } from "react";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, EyeOff, Save, Loader2, Copy, Check, ExternalLink, Link2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function GHLGlobalConfig() {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [baseDomain, setBaseDomain] = useState("marketplace.gohighlevel.com");
  const [ssoSharedSecret, setSsoSharedSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const defaultRedirectUri = `${SUPABASE_URL}/functions/v1/ghl-oauth-callback`;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("ghl_global_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (data) {
        setConfigId(data.id);
        setClientId(data.client_id || "");
        setClientSecret(data.client_secret || "");
        setRedirectUri(data.redirect_uri || defaultRedirectUri);
        setBaseDomain(data.base_domain || "marketplace.gohighlevel.com");
        setSsoSharedSecret(data.sso_shared_secret || "");
      } else {
        setRedirectUri(defaultRedirectUri);
      }
    } catch (err) {
      console.error("Error loading GHL config:", err);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri || defaultRedirectUri,
        base_domain: baseDomain || "marketplace.gohighlevel.com",
        sso_shared_secret: ssoSharedSecret,
      };

      if (configId) {
        const { error } = await (supabase as any)
          .from("ghl_global_config")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", configId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("ghl_global_config")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }
      toast.success("Credenciais GHL salvas com sucesso");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar credenciais GHL");
    }
    setIsSaving(false);
  };

  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri || defaultRedirectUri);
    setCopied(true);
    toast.success("Redirect URI copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyWebhookUrl = () => {
    const url = `${SUPABASE_URL}/functions/v1/ghl-webhook-receiver`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    toast.success("Webhook URL copiado!");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  if (isLoading) return <Skeleton className="h-64" />;

  const webhookUrl = `${SUPABASE_URL}/functions/v1/ghl-webhook-receiver`;

  return (
    <div className="space-y-4">
      {/* Credentials Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img
              src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/46gdLUn8MdGppBpFnozy/media/65f9dd59f3c6d1cbb69ac7a1.png"
              alt="GHL"
              className="h-5 w-5 rounded"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            Configuração Global GHL (Mercado App)
          </CardTitle>
          <CardDescription>
            Configure as credenciais mestras do aplicativo GoHighLevel que será usado por todas as organizações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Client ID</Label>
              <Input
                placeholder="Seu Client ID do GHL Marketplace App"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Domínio GHL (White Label)</Label>
              <Input
                placeholder="marketplace.gohighlevel.com"
                value={baseDomain}
                onChange={(e) => setBaseDomain(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Client Secret</Label>
            <div className="flex gap-2">
              <Input
                type={showSecret ? "text" : "password"}
                placeholder="Seu Client Secret do GHL Marketplace App"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="flex-1"
              />
              <Button variant="ghost" size="icon" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Redirect URI</Label>
            <div className="flex gap-2">
              <Input
                value={redirectUri || defaultRedirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={handleCopyRedirectUri}>
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Webhook URL</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="flex-1 font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopyWebhookUrl}>
                {copiedWebhook ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">SSO Shared Secret (Autenticação iFrame)</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Seu SSO Shared Secret do GHL (Opções Avançadas)"
                value={ssoSharedSecret}
                onChange={(e) => setSsoSharedSecret(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Coloque isso APENAS se desejar embutir a Vitta IA invisivelmente dentro de um iFrame Custom Menu Link no GHL.
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Credenciais Globais GHL
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
