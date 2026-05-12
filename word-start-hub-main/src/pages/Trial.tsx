import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Check, Loader2, Clock, Zap, MessageSquare, BarChart3, Users, Calendar } from "lucide-react";
import SiteLayout, { useSiteThemeContext } from "@/components/site/SiteLayout";

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";

async function callSubscriptionAPI(action: string, body?: any) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/subscription-api?action=${action}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok || data?.error) return { ok: false, error: data?.error || `Erro (${res.status})`, status: res.status };
  return { ok: true, data, status: res.status };
}

function TrialContent() {
  const { isDark } = useSiteThemeContext();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  const handleOrgNameChange = (name: string) => {
    setOrgName(name);
    setOrgSlug(name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
  };

  const checkSlug = async (slug: string) => {
    if (slug.length < 3) { setSlugAvailable(null); return; }
    try {
      const result = await callSubscriptionAPI(`check_slug&slug=${slug}`);
      setSlugAvailable(result.ok ? Boolean(result.data?.available) : null);
    } catch { setSlugAvailable(null); }
  };

  const handleSlugChange = (slug: string) => {
    const clean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setOrgSlug(clean);
    clearTimeout((window as any).__slugTimer);
    (window as any).__slugTimer = setTimeout(() => checkSlug(clean), 500);
  };

  const handleSubmit = async () => {
    if (!fullName || !email || !password || !orgName || !orgSlug) { toast.error("Preencha todos os campos"); return; }
    if (password.length < 6) { toast.error("Senha: mínimo 6 caracteres"); return; }
    setSubmitting(true);
    try {
      const result = await callSubscriptionAPI("create_trial", { email, password, full_name: fullName, org_name: orgName, org_slug: orgSlug });
      if (!result.ok) { toast.error(result.error || "Erro no cadastro"); return; }
      setSuccess(true);
      // If existing user, show different message
      if (result.data?.existing_user) {
        toast.success("Nova organização criada! Faça login para acessar.");
      }
    } finally { setSubmitting(false); }
  };

  const mutedText = isDark ? "text-[#8892a8]" : "text-[#5a6478]";
  const accent = isDark ? "text-emerald-400" : "text-emerald-600";
  const accentBg = isDark ? "bg-emerald-500/10" : "bg-emerald-50";
  const cardBg = isDark ? "bg-[#111827]/60 border-[#1e2a3a]" : "bg-white border-[#e5e8ee]";
  const inputBg = isDark ? "bg-[#0a0f1a] border-[#1e2a3a] text-[#e8ecf4]" : "bg-[#f0f2f7] border-[#e5e8ee] text-[#1a1f2e]";

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className={`max-w-md w-full rounded-2xl border p-8 text-center space-y-4 ${cardBg}`}>
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${accentBg}`}>
            <Check className={`h-8 w-8 ${accent}`} />
          </div>
          <h2 className="text-2xl font-light tracking-tight">Conta Criada!</h2>
          <p className={`font-light ${mutedText}`}>Seu teste gratuito de 7 dias está ativo.</p>
          <Button className={`w-full rounded-full h-11 text-[13px] font-medium ${isDark ? "bg-emerald-500 text-[#0a0f1a]" : "bg-emerald-600 text-white"}`} onClick={() => window.location.href = "/auth"}>
            Acessar Plataforma
          </Button>
        </div>
      </div>
    );
  }

  const features = [
    { icon: <MessageSquare className="h-4 w-4" />, text: "Chat com WhatsApp integrado" },
    { icon: <BarChart3 className="h-4 w-4" />, text: "Dashboard e CRM completo" },
    { icon: <Zap className="h-4 w-4" />, text: "Automações e Disparos" },
    { icon: <Users className="h-4 w-4" />, text: "Gestão de Leads e Pipeline" },
    { icon: <Calendar className="h-4 w-4" />, text: "Agenda e Agendamentos" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 md:py-24">
      <div className="grid md:grid-cols-2 gap-14 items-start">
        {/* Left */}
        <div className="space-y-8">
          <div className="space-y-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium tracking-wider uppercase ${accentBg} ${accent}`}>
              <Clock className="h-3 w-3" /> 7 dias grátis
            </div>
            <h1 className="text-3xl md:text-4xl font-light tracking-tight">
              Teste o Vitta <span className={`font-semibold ${accent}`}>gratuitamente</span>
            </h1>
            <p className={`text-lg font-light ${mutedText}`}>
              Todas as funcionalidades por 7 dias, sem compromisso.
            </p>
          </div>

          <div className="space-y-4">
            <p className={`text-[11px] font-semibold tracking-[0.2em] uppercase ${mutedText}`}>O que está incluso</p>
            {features.map((f, i) => (
              <div key={i} className={`flex items-center gap-3 ${mutedText}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accentBg} ${accent}`}>
                  {f.icon}
                </div>
                <span className="text-[13px] font-light">{f.text}</span>
              </div>
            ))}
          </div>

          <div className={`p-4 rounded-xl border ${cardBg}`}>
            <p className={`text-[13px] font-light ${mutedText}`}>
              <span className="font-medium" style={{ color: isDark ? "#e8ecf4" : "#1a1f2e" }}>Sem cartão de crédito.</span>{" "}
              Ao final dos 7 dias, escolha um plano para continuar.
            </p>
          </div>
        </div>

        {/* Right — form */}
        <div className={`rounded-2xl border p-6 space-y-4 ${cardBg}`}>
          <h3 className="text-lg font-light text-center tracking-tight">Criar conta gratuita</h3>

          {[
            { label: "Nome completo", value: fullName, onChange: (v: string) => setFullName(v), placeholder: "Seu nome", type: "text" },
            { label: "Email", value: email, onChange: (v: string) => setEmail(v), placeholder: "seu@email.com", type: "email" },
            { label: "Senha", value: password, onChange: (v: string) => setPassword(v), placeholder: "Mínimo 6 caracteres", type: "password" },
          ].map((field) => (
            <div key={field.label} className="space-y-1.5">
              <Label className={`text-[12px] font-medium tracking-wide ${mutedText}`}>{field.label}</Label>
              <Input type={field.type} value={field.value} onChange={(e) => field.onChange(e.target.value)} placeholder={field.placeholder} className={`h-10 rounded-lg text-[13px] ${inputBg}`} />
            </div>
          ))}

          <Separator className={isDark ? "bg-[#1e2a3a]" : "bg-[#e5e8ee]"} />

          <div className="space-y-1.5">
            <Label className={`text-[12px] font-medium tracking-wide ${mutedText}`}>Nome da organização</Label>
            <Input value={orgName} onChange={(e) => handleOrgNameChange(e.target.value)} placeholder="Minha Empresa" className={`h-10 rounded-lg text-[13px] ${inputBg}`} />
          </div>

          <div className="space-y-1.5">
            <Label className={`text-[12px] font-medium tracking-wide ${mutedText}`}>Slug (URL)</Label>
            <Input value={orgSlug} onChange={(e) => handleSlugChange(e.target.value)} placeholder="minha-empresa" className={`h-10 rounded-lg text-[13px] ${inputBg}`} />
            {slugAvailable === true && <p className="text-[11px] text-emerald-500">✓ Disponível</p>}
            {slugAvailable === false && <p className="text-[11px] text-red-500">✗ Já em uso</p>}
          </div>

          <Button className={`w-full rounded-full h-11 text-[13px] font-medium tracking-wide ${isDark ? "bg-emerald-500 hover:bg-emerald-400 text-[#0a0f1a]" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`} disabled={submitting} onClick={handleSubmit}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando...</> : "Começar Teste Grátis"}
          </Button>

          <p className={`text-[11px] text-center ${mutedText}`}>
            Ao criar sua conta, concorda com{" "}
            <a href="/terms" className={accent}>Termos</a> e{" "}
            <a href="/privacy" className={accent}>Privacidade</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Trial() {
  return (
    <SiteLayout>
      <TrialContent />
    </SiteLayout>
  );
}
