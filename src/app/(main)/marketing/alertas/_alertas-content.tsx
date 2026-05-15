"use client";
import { ComarkaLoading } from "@/components/comarka-loading";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { AdsMetadata, AdsPerformance, LeadAdsAttribution, TrafegoRegraOtimizacao, TrafegoAnomalia } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { AlertTriangle, CheckCircle, Clock, Brain, Shield, Plus, ToggleLeft, ToggleRight, Loader2, X, Pause, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { AlertaDiagnosticoModal, type AlertaDiagnosticoData } from "@/components/alerta-diagnostico-modal";
import { truncateAdName } from "@/lib/trafego-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Tab = "alertas" | "regras" | "anomalias";

interface RegraComStats extends TrafegoRegraOtimizacao {
  stats: { aplicada: number; ignorada: number; disparada: number; falsa_positiva: number };
}

interface Snooze { ad_id: string; tipo: string; snooze_ate: string }

export default function TrafegoAlertasPage() {
  const [tab, setTab] = useState<Tab>("alertas");
  const fetcher = (url: string) => fetch(url).then(r => r.json());

  const fetchAlertas = async () => {
    const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const [{ data: m }, { data: p }, { data: sn }] = await Promise.all([
      supabase.from("ads_metadata").select("*").in("status", ["ACTIVE", "PAUSED", "ADSET_PAUSED", "CAMPAIGN_PAUSED"]),
      supabase.from("ads_performance").select("*").gte("data_ref", d30).order("data_ref", { ascending: false }).limit(10000),
      supabase.from("alertas_snooze").select("*").gte("snooze_ate", new Date().toISOString()),
    ]);
    return { metadata: (m || []) as AdsMetadata[], performance: (p || []) as AdsPerformance[], snoozes: (sn || []) as Snooze[] };
  };

  const { data: alertasData, isLoading: loading, mutate: mutateAlertas } = useSWR("alertasData", fetchAlertas, { revalidateOnFocus: false });
  const metadata = alertasData?.metadata || [];
  const performance = alertasData?.performance || [];
  const snoozes = alertasData?.snoozes || [];

  // Config
  const [cplLimite, setCplLimite] = useState(100);
  const [ctrMinimo, setCtrMinimo] = useState(0.8);
  const [freqMaxima, setFreqMaxima] = useState(3);
  const [zeroLeadsHoras, setZeroLeadsHoras] = useState(48);
  const [zeroLeadsGasto, setZeroLeadsGasto] = useState(50);
  const [ctrImpMin, setCtrImpMin] = useState(500);
  const [cplAtivo, setCplAtivo] = useState(true);
  const [ctrAtivo, setCtrAtivo] = useState(true);
  const [freqAtivo, setFreqAtivo] = useState(true);
  const [zeroAtivo, setZeroAtivo] = useState(true);

  // Modal diagnostico IA
  const [modalAberto, setModalAberto] = useState(false);
  const [alertaSelecionado, setAlertaSelecionado] = useState<AlertaDiagnosticoData | null>(null);

  // Modal analise IA expandida
  const [modalAnaliseIA, setModalAnaliseIA] = useState(false);
  const [analiseIA, setAnaliseIA] = useState<Record<string, unknown> | null>(null);
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [alertaParaAnalise, setAlertaParaAnalise] = useState<{ ad_id: string; adset_id: string | null; campaign_id: string | null; metrica: string; valor: number; ad_name: string } | null>(null);

  // Regras
  const { data: regrasData, isLoading: loadingRegras, mutate: mutateRegras } = useSWR("/api/marketing/regras", fetcher, { revalidateOnFocus: false });
  const regras: RegraComStats[] = Array.isArray(regrasData) ? regrasData : [];
  
  const [modalNovaRegra, setModalNovaRegra] = useState(false);
  const [novaRegra, setNovaRegra] = useState({ nome: "", metrica: "cpl", operador: ">=", threshold: "", acao_sugerida: "pausar_anuncio", acao_automatica: false, prioridade: 2 });

  // Anomalias
  const { data: anomaliasData, isLoading: loadingAnomalias, mutate: mutateAnomalias } = useSWR("/api/marketing/anomalias?resolvida=false", fetcher, { revalidateOnFocus: false });
  const anomalias: TrafegoAnomalia[] = Array.isArray(anomaliasData) ? anomaliasData : [];

  // Pausar
  const [pausando, setPausando] = useState<string | null>(null);

  useEffect(() => {
    const s1 = localStorage.getItem("trafego_cpl_limite"); if (s1) setCplLimite(Number(s1));
    const s2 = localStorage.getItem("trafego_ctr_minimo"); if (s2) setCtrMinimo(Number(s2));
    const s3 = localStorage.getItem("trafego_freq_maxima"); if (s3) setFreqMaxima(Number(s3));
    const s4 = localStorage.getItem("trafego_zero_horas"); if (s4) setZeroLeadsHoras(Number(s4));
    const s5 = localStorage.getItem("trafego_zero_gasto"); if (s5) setZeroLeadsGasto(Number(s5));
    const s6 = localStorage.getItem("trafego_ctr_imp_min"); if (s6) setCtrImpMin(Number(s6));
    const s7 = localStorage.getItem("trafego_cpl_ativo"); if (s7) setCplAtivo(s7 === "true");
    const s8 = localStorage.getItem("trafego_ctr_ativo"); if (s8) setCtrAtivo(s8 === "true");
    const s9 = localStorage.getItem("trafego_freq_ativo"); if (s9) setFreqAtivo(s9 === "true");
    const s10 = localStorage.getItem("trafego_zero_ativo"); if (s10) setZeroAtivo(s10 === "true");
  }, []);

  const isSnoozed = (adId: string, tipo: string) => snoozes.some((s) => s.ad_id === adId && s.tipo === tipo);

  const snoozeAlerta = async (adId: string, tipo: string) => {
    const snoozeAte = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("alertas_snooze").insert({ ad_id: adId, tipo, snooze_ate: snoozeAte });
    toast.success("Alerta silenciado por 24h");
    mutateAlertas();
  };

  async function abrirAnaliseIA(ad: { ad_id: string; ad_name: string | null; adset_id: string | null; campaign_id: string | null }, prob: { tipo: string; valor: string }) {
    const metrica = prob.tipo === "cpl_max" ? "cpl" : prob.tipo === "ctr_min" ? "ctr" : prob.tipo === "frequencia_max" ? "frequencia" : "leads_dia";
    setAlertaParaAnalise({
      ad_id: ad.ad_id,
      adset_id: ad.adset_id || null,
      campaign_id: ad.campaign_id || null,
      metrica,
      valor: parseFloat(prob.valor.replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
      ad_name: ad.ad_name || ad.ad_id,
    });
    setModalAnaliseIA(true);
    setAnalisandoIA(true);
    setAnaliseIA(null);

    try {
      const res = await fetch("/api/ia/avaliar-alerta-trafego", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_id: ad.ad_id,
          adset_id: ad.adset_id,
          campaign_id: ad.campaign_id,
          metrica,
          valor_atual: parseFloat(prob.valor.replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
        }),
      });
      const data = await res.json();
      if (data.analise) setAnaliseIA(data.analise);
      else toast.error(data.error || "Erro na analise");
    } catch { toast.error("Erro ao analisar"); }
    setAnalisandoIA(false);
  }

  async function pausarViaAPI(tipo: "ad" | "adset", objetoId: string) {
    if (!confirm(`Confirma pausar ${tipo === "ad" ? "anuncio" : "conjunto"} ${objetoId}?`)) return;
    setPausando(objetoId);
    try {
      const res = await fetch("/api/meta/pausar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, objeto_id: objetoId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        mutateAlertas();
      } else toast.error(data.error);
    } catch { toast.error("Erro ao pausar"); }
    setPausando(null);
  }

  async function registrarAcao(ad_id: string, acao: "ignorada" | "falsa_positiva") {
    await supabase.from("trafego_regras_historico").insert({
      ad_id, acao, valor_metrica_no_momento: 0,
      observacao: acao === "falsa_positiva" ? "Marcado como falso positivo pelo usuario" : "Alerta ignorado",
    });
    toast.success(acao === "falsa_positiva" ? "Falso positivo registrado" : "Alerta ignorado");
    setModalAnaliseIA(false);
  }

  async function toggleRegra(id: string, ativo: boolean) {
    await fetch("/api/marketing/regras", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ativo }),
    });
    mutateRegras();
  }

  async function criarRegra() {
    if (!novaRegra.nome || !novaRegra.threshold) { toast.error("Preencha nome e threshold"); return; }
    const res = await fetch("/api/marketing/regras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...novaRegra, threshold: Number(novaRegra.threshold) }),
    });
    if (res.ok) {
      toast.success("Regra criada");
      setModalNovaRegra(false);
      setNovaRegra({ nome: "", metrica: "cpl", operador: ">=", threshold: "", acao_sugerida: "pausar_anuncio", acao_automatica: false, prioridade: 2 });
      mutateRegras();
    } else toast.error("Erro ao criar regra");
  }

  async function resolverAnomalia(id: string) {
    await fetch("/api/marketing/anomalias", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    toast.success("Anomalia resolvida");
    mutateAnomalias();
  }

  function abrirDiagnostico(ad: typeof alertas[0], prob: (typeof alertas[0])["problemas"][0]) {
    const perfs = performance.filter((p) => p.ad_id === ad.ad_id).sort((a, b) => b.data_ref.localeCompare(a.data_ref));
    const d2str = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
    const d7str = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const perfs7d = perfs.filter((p) => p.data_ref >= d7str && p.frequencia > 0);
    const perfs2d = perfs.filter((p) => p.data_ref >= d2str);
    const d3str = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
    const perfs3d = perfs.filter((p) => p.data_ref >= d3str);
    const imp3d = perfs3d.reduce((s, p) => s + p.impressoes, 0);
    const clk3d = perfs3d.reduce((s, p) => s + p.cliques, 0);
    setAlertaSelecionado({
      tipo: prob.tipo, severidade: prob.severidade, adNome: ad.ad_name || ad.ad_id, campanhaNome: ad.campaign_name || "—",
      valorAtual: prob.valor, threshold: prob.threshold, spend30d: ad.spend, leads30d: ad.totalLeads, cpl30d: ad.cpl,
      ctr3d: imp3d > 0 ? (clk3d / imp3d) * 100 : 0, freqMedia7d: perfs7d.length > 0 ? perfs7d.reduce((s, p) => s + p.frequencia, 0) / perfs7d.length : 0,
      spend2d: perfs2d.reduce((s, p) => s + Number(p.spend), 0), leads2d: perfs2d.reduce((s, p) => s + p.leads, 0),
      perfDiario: perfs.slice(0, 14).map((p) => ({ data_ref: p.data_ref, spend: Number(p.spend), leads: p.leads, impressoes: p.impressoes, cliques: p.cliques, ctr: p.ctr, cpl: p.cpl, frequencia: p.frequencia })),
    });
    setModalAberto(true);
  }

  if (loading) return <ComarkaLoading />;

  const d3 = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
  const d2 = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  type AlertaItem = { tipo: "cpl_max" | "ctr_min" | "frequencia_max" | "zero_leads"; severidade: "danger" | "warning"; msg: string; sugestao?: string; valor: string; threshold: string };

  const alertas = metadata.map((ad) => {
    const perfs = performance.filter((p) => p.ad_id === ad.ad_id);
    const totalLeads = perfs.reduce((s, p) => s + p.leads, 0);
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const cpl = totalLeads > 0 ? spend / totalLeads : 0;
    const perfs3d = perfs.filter((p) => p.data_ref >= d3);
    const imp3d = perfs3d.reduce((s, p) => s + p.impressoes, 0);
    const clk3d = perfs3d.reduce((s, p) => s + p.cliques, 0);
    const ctr3d = imp3d > 0 ? (clk3d / imp3d) * 100 : 0;
    const perfs7d = perfs.filter((p) => p.data_ref >= d7 && p.frequencia > 0);
    const freqMedia = perfs7d.length > 0 ? perfs7d.reduce((s, p) => s + p.frequencia, 0) / perfs7d.length : 0;
    const perfs2d = perfs.filter((p) => p.data_ref >= d2);
    const spend2d = perfs2d.reduce((s, p) => s + Number(p.spend), 0);
    const leads2d = perfs2d.reduce((s, p) => s + p.leads, 0);
    const problemas: AlertaItem[] = [];
    if (cplAtivo && cpl > cplLimite && totalLeads > 0 && !isSnoozed(ad.ad_id, "cpl_max")) problemas.push({ tipo: "cpl_max", severidade: "danger", msg: `CPL de ${formatCurrency(cpl)} — acima do limite de ${formatCurrency(cplLimite)}`, sugestao: "Revisar segmentacao, criativo ou landing page. Considere pausar se persistir.", valor: formatCurrency(cpl), threshold: formatCurrency(cplLimite) });
    if (ctrAtivo && ctr3d < ctrMinimo && imp3d > ctrImpMin && !isSnoozed(ad.ad_id, "ctr_min")) problemas.push({ tipo: "ctr_min", severidade: "warning", msg: `CTR de ${ctr3d.toFixed(2)}% nos ultimos 3 dias — abaixo do minimo de ${ctrMinimo}%`, sugestao: "Revisar criativo, headline ou CTA. Testar novo angulo de copy.", valor: ctr3d.toFixed(2) + "%", threshold: ctrMinimo + "%" });
    if (freqAtivo && freqMedia > freqMaxima && !isSnoozed(ad.ad_id, "frequencia_max")) problemas.push({ tipo: "frequencia_max", severidade: "warning", msg: `Frequencia de ${freqMedia.toFixed(1)}x — audiencia saturada (limite: ${freqMaxima}x)`, sugestao: "Rotacionar criativo ou expandir audiencia para reduzir fadiga.", valor: freqMedia.toFixed(1) + "x", threshold: freqMaxima + "x" });
    if (zeroAtivo && spend2d > zeroLeadsGasto && leads2d === 0 && !isSnoozed(ad.ad_id, "zero_leads")) problemas.push({ tipo: "zero_leads", severidade: "danger", msg: `Zero leads com R$ ${spend2d.toFixed(2)} gastos em 48h`, sugestao: "Verificar formulario de lead, segmentacao ou se a campanha esta ativa.", valor: `R$ ${spend2d.toFixed(2)}`, threshold: `0 leads / ${zeroLeadsHoras}h` });
    return { ...ad, spend, totalLeads, cpl, ctr3d, freqMedia, problemas };
  }).filter((a) => a.problemas.length > 0);

  const totalAlertas = alertas.reduce((s, a) => s + a.problemas.length, 0);
  const criticos = alertas.reduce((s, a) => s + a.problemas.filter((p) => p.severidade === "danger").length, 0);

  const corAnomalia: Record<string, string> = {
    gasto_zerado: "bg-primary/10 text-primary",
    cpl_dobrou: "bg-primary/20 text-primary",
    leads_zerados: "bg-primary/10 text-primary",
    spend_esgotando: "bg-primary/10 text-primary",
    spend_sobrando: "bg-primary/20 text-primary",
    performance_queda_brusca: "bg-primary/20 text-primary",
  };

  const sevColor: Record<string, string> = { baixa: "bg-primary/20 text-primary", media: "bg-primary/10 text-primary", alta: "bg-primary/20 text-primary", critica: "bg-primary/10 text-primary" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alertas de Tráfego</h1>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {(["alertas", "regras", "anomalias"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t ? "bg-background text-foreground shadow-sm" : "text-foreground/90 hover:text-foreground"}`}>
              {t === "alertas" ? `Alertas${totalAlertas > 0 ? ` (${totalAlertas})` : ""}` : t === "regras" ? "Regras" : `Anomalias${anomalias.length > 0 ? ` (${anomalias.length})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Alertas */}
      {tab === "alertas" && (
        <>
          <div className="flex items-center gap-2 text-xs text-foreground/90 bg-muted/30 rounded-lg p-3">
            <span>Thresholds em</span>
            <a href="/config" className="text-primary hover:underline">Configurações</a>
            <span>· CPL: {formatCurrency(cplLimite)} · CTR: {ctrMinimo}% · Freq: {freqMaxima}x</span>
          </div>

          <div className="flex gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${criticos > 0 ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary"}`}>
              {criticos > 0 ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
              {criticos > 0 ? `${criticos} critico${criticos > 1 ? "s" : ""}` : "Nenhum alerta critico"}
            </div>
            {totalAlertas - criticos > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary">
                <AlertTriangle size={16} /> {totalAlertas - criticos} aviso{totalAlertas - criticos > 1 ? "s" : ""}
              </div>
            )}
          </div>

          {alertas.length === 0 ? (
            <Card><CardContent className="py-8 flex flex-col items-center gap-2"><CheckCircle  size={32} className="text-primary" /><p className="text-sm font-medium">Tudo certo!</p></CardContent></Card>
          ) : (() => {
            const linhas = alertas.flatMap((ad) => ad.problemas.map((p) => ({ ad, p })));
            const criticasRows = linhas.filter((r) => r.p.severidade === "danger");
            const avisosRows = linhas.filter((r) => r.p.severidade === "warning");
            const renderRow = ({ ad, p }: typeof linhas[0], i: number) => {
              const fullName = ad.ad_name || ad.ad_id;
              return (
                <tr key={`${ad.ad_id}-${p.tipo}-${i}`} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-2"><Badge className={`text-[10px] ${p.severidade === "danger" ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400"}`}>{p.tipo === "cpl_max" ? "CPL Alto" : p.tipo === "ctr_min" ? "CTR Baixo" : p.tipo === "frequencia_max" ? "Freq. Alta" : "Zero Leads"}</Badge></td>
                  <td className="px-4 py-2 text-xs font-medium max-w-[180px]">
                    <div className="truncate" title={fullName}>{truncateAdName(fullName)}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{ad.campaign_name || "—"}</div>
                  </td>
                  <td className="px-4 py-2 max-w-[280px]">
                    <div className="text-xs text-foreground">{p.msg}</div>
                    {p.sugestao && <div className="text-[10px] text-muted-foreground mt-0.5">{p.sugestao}</div>}
                  </td>
                  <td className="px-4 py-2 text-xs text-right font-bold">{p.valor}</td>
                  <td className="px-4 py-2 text-xs text-right text-foreground/90">{p.threshold}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button  variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => abrirAnaliseIA(ad, p)} title="Analise IA expandida"><Brain size={10} className="mr-1" />IA</Button>
                      <Button  variant="ghost" size="sm" className="h-6 text-[10px] text-foreground/90" onClick={() => abrirDiagnostico(ad, p)} title="Diagnostico"><Brain size={10} className="mr-1" />Diag</Button>
                      <Button  variant="ghost" size="sm" className="h-6 text-[10px] text-foreground/90" onClick={() => snoozeAlerta(ad.ad_id, p.tipo)} title="Silenciar 24h"><Clock size={10} className="mr-1" />24h</Button>
                    </div>
                  </td>
                </tr>
              );
            };
            const header = (
              <tr className="border-b text-foreground/90">
                <th className="px-4 py-2 text-left font-medium text-xs">Tipo</th>
                <th className="px-4 py-2 text-left font-medium text-xs">Anúncio</th>
                <th className="px-4 py-2 text-left font-medium text-xs">Motivo</th>
                <th className="px-4 py-2 text-right font-medium text-xs">Valor</th>
                <th className="px-4 py-2 text-right font-medium text-xs">Threshold</th>
                <th className="px-4 py-2 text-right font-medium text-xs">Ações</th>
              </tr>
            );
            return (
              <div className="space-y-4">
                {criticasRows.length > 0 && (
                  <Card>
                    <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 text-sm font-semibold text-primary">Alertas Criticos ({criticasRows.length})</div>
                    <CardContent className="p-0"><div className="overflow-auto"><table className="w-full text-sm"><thead>{header}</thead><tbody>{criticasRows.map((r, i) => renderRow(r, i))}</tbody></table></div></CardContent>
                  </Card>
                )}
                {avisosRows.length > 0 && (
                  <Card>
                    <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 text-sm font-semibold text-primary">Avisos ({avisosRows.length})</div>
                    <CardContent className="p-0"><div className="overflow-auto"><table className="w-full text-sm"><thead>{header}</thead><tbody>{avisosRows.map((r, i) => renderRow(r, i))}</tbody></table></div></CardContent>
                  </Card>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Tab: Regras de otimizacao */}
      {tab === "regras" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground/90">Regras de otimizacao automatica</p>
            <Button size="sm" onClick={() => setModalNovaRegra(true)}><Plus size={14} className="mr-1" />Nova regra</Button>
          </div>

          {loadingRegras ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {regras.map((r) => {
                const total = r.stats.aplicada + r.stats.ignorada;
                const taxaAplicacao = total > 0 ? (r.stats.aplicada / total) * 100 : 0;
                const taxaIgnorada = total > 0 ? (r.stats.ignorada / total) * 100 : 0;
                return (
                  <Card key={r.id} className={!r.ativo ? "opacity-50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{r.nome}</p>
                            <Badge className={`text-[9px] ${r.prioridade === 3 ? "bg-primary/10 text-primary" : r.prioridade === 2 ? "bg-primary/10 text-primary" : "bg-primary/20 text-primary"}`}>
                              P{r.prioridade}
                            </Badge>
                            {r.acao_automatica && <Badge  className="text-[9px] bg-primary/20 text-primary">Auto</Badge>}
                            {taxaAplicacao > 70 && total >= 3 && <Badge  className="text-[9px] bg-primary/10 text-primary">Alta efetividade</Badge>}
                            {taxaIgnorada > 70 && total >= 3 && <Badge  className="text-[9px] bg-primary/20 text-primary">Revisar</Badge>}
                          </div>
                          <p className="text-xs text-foreground/90">{r.metrica} {r.operador} {r.threshold} â†' {r.acao_sugerida.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-foreground/90">
                            {r.stats.disparada} disparos · {r.stats.aplicada} aplicadas · {r.stats.ignorada} ignoradas · {r.stats.falsa_positiva} falsos positivos
                          </p>
                        </div>
                        <button onClick={() => toggleRegra(r.id, !r.ativo)} className="text-foreground/90 hover:text-foreground">
                          {r.ativo ? <ToggleRight  size={24} className="text-primary" /> : <ToggleLeft size={24} />}
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {regras.length === 0 && <p className="text-center text-sm text-foreground/90 py-8">Nenhuma regra configurada</p>}
            </div>
          )}
        </div>
      )}

      {/* Tab: Anomalias */}
      {tab === "anomalias" && (
        <div className="space-y-2">
          {loadingAnomalias ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin" /></div>
          ) : anomalias.length === 0 ? (
            <Card><CardContent className="py-8 flex flex-col items-center gap-2"><CheckCircle  size={32} className="text-primary" /><p className="text-sm font-medium">Nenhuma anomalia ativa</p></CardContent></Card>
          ) : (
            anomalias.map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] ${corAnomalia[a.tipo] || "bg-muted"}`}>{a.tipo.replace(/_/g, " ")}</Badge>
                      <span className="text-[10px] text-foreground/90">{new Date(a.criado_em).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-xs">{a.causa_provavel || "Sem causa identificada"}</p>
                    <p className="text-[10px] text-foreground/90">
                      {a.ad_id && `AD: ${a.ad_id.slice(0, 12)}...`}
                      {a.valor_anterior !== null && ` · Anterior: ${a.valor_anterior}`}
                      {a.valor_atual !== null && ` · Atual: ${a.valor_atual}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => resolverAnomalia(a.id)}>
                    <CheckCircle size={10} className="mr-1" />Resolver
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Modal: Nova regra */}
      <Dialog open={modalNovaRegra} onOpenChange={setModalNovaRegra}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Regra de Otimizacao</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Nome</label>
              <input className="w-full mt-1 text-sm bg-transparent border rounded px-3 py-2" value={novaRegra.nome} onChange={(e) => setNovaRegra({ ...novaRegra, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium">Metrica</label>
                <select className="w-full mt-1 text-xs bg-transparent border rounded px-2 py-2" value={novaRegra.metrica} onChange={(e) => setNovaRegra({ ...novaRegra, metrica: e.target.value })}>
                  <option value="cpl">CPL</option><option value="ctr">CTR</option><option value="frequencia">Frequencia</option><option value="cpc">CPC</option><option value="roas">ROAS</option><option value="leads_dia">Leads/dia</option><option value="spend_dia">Spend/dia</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Operador</label>
                <select className="w-full mt-1 text-xs bg-transparent border rounded px-2 py-2" value={novaRegra.operador} onChange={(e) => setNovaRegra({ ...novaRegra, operador: e.target.value })}>
                  <option value=">=">{"â‰¥"}</option><option value="<=">{"â‰¤"}</option><option value=">">{">"}</option><option value="<">{"<"}</option><option value="=">{"="}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Threshold</label>
                <input type="number" className="w-full mt-1 text-xs bg-transparent border rounded px-2 py-2" value={novaRegra.threshold} onChange={(e) => setNovaRegra({ ...novaRegra, threshold: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Acao sugerida</label>
                <select className="w-full mt-1 text-xs bg-transparent border rounded px-2 py-2" value={novaRegra.acao_sugerida} onChange={(e) => setNovaRegra({ ...novaRegra, acao_sugerida: e.target.value })}>
                  <option value="pausar_anuncio">Pausar anuncio</option><option value="pausar_conjunto">Pausar conjunto</option><option value="pausar_campanha">Pausar campanha</option>
                  <option value="reduzir_orcamento">Reduzir orcamento</option><option value="trocar_criativo">Trocar criativo</option><option value="revisar_copy">Revisar copy</option><option value="revisar_publico">Revisar publico</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Prioridade</label>
                <select className="w-full mt-1 text-xs bg-transparent border rounded px-2 py-2" value={novaRegra.prioridade} onChange={(e) => setNovaRegra({ ...novaRegra, prioridade: Number(e.target.value) })}>
                  <option value={1}>1 - Baixa</option><option value={2}>2 - Media</option><option value={3}>3 - Alta</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={novaRegra.acao_automatica} onChange={(e) => setNovaRegra({ ...novaRegra, acao_automatica: e.target.checked })} />
              Acao automatica (executa se severidade critica)
            </label>
            <Button className="w-full" onClick={criarRegra}>Criar Regra</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Analise IA expandida */}
      <Dialog open={modalAnaliseIA} onOpenChange={setModalAnaliseIA}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Brain  size={18} className="text-primary" />Analise IA do Alerta</DialogTitle></DialogHeader>
          {alertaParaAnalise && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 text-xs">
                <p><strong>Anuncio:</strong> {alertaParaAnalise.ad_name}</p>
                <p><strong>Metrica:</strong> {alertaParaAnalise.metrica} = {alertaParaAnalise.valor}</p>
              </div>

              {analisandoIA ? (
                <div className="flex items-center justify-center py-8 gap-3"><Loader2  size={20} className="animate-spin text-primary" /><span className="text-sm text-foreground/90">Analisando com Gemini Flash...</span></div>
              ) : analiseIA ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-[10px] text-foreground/90">Severidade</p>
                      <Badge className={`mt-1 text-xs ${sevColor[(analiseIA.severidade as string)] || "bg-muted"}`}>{(analiseIA.severidade as string) || "N/A"}</Badge>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-[10px] text-foreground/90">Urgencia</p>
                      <p className="text-sm font-bold mt-1">{analiseIA.urgencia_horas as number}h</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div><strong>Causa provavel:</strong> {analiseIA.causa_provavel as string}</div>
                    <div><strong>Toleravel:</strong> {(analiseIA.e_comportamento_toleravel as boolean) ? "Sim" : "Nao"} — {analiseIA.justificativa as string}</div>
                    <div><strong>Acao recomendada:</strong> {analiseIA.acao_recomendada as string}</div>
                    {Array.isArray(analiseIA.regras_aplicadas) && analiseIA.regras_aplicadas.length > 0 && (
                      <div><strong>Regras:</strong> {(analiseIA.regras_aplicadas as string[]).join(", ")}</div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 border-t">
                    {typeof analiseIA.acao_meta_api === "string" && analiseIA.acao_meta_api && (
                      <Button variant="destructive" size="sm" disabled={!!pausando}
                        onClick={() => pausarViaAPI(String(analiseIA.acao_meta_api) === "pausar_conjunto" ? "adset" : "ad", String(analiseIA.acao_meta_api) === "pausar_conjunto" ? alertaParaAnalise.adset_id! : alertaParaAnalise.ad_id)}>
                        {pausando ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Pause size={12} className="mr-1" />}
                        Pausar via Meta API
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => registrarAcao(alertaParaAnalise.ad_id, "ignorada")}>Ignorar</Button>
                    <Button variant="ghost" size="sm" onClick={() => registrarAcao(alertaParaAnalise.ad_id, "falsa_positiva")}>
                      <ThumbsDown size={12} className="mr-1" />Falso positivo
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-foreground/90 py-8">Nenhuma analise disponivel</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertaDiagnosticoModal open={modalAberto} onClose={() => setModalAberto(false)} alerta={alertaSelecionado} />
    </div>
  );
}



