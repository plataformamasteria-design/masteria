"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { TrafegoCriativo } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Brain, Plus, Eye, Loader2, Image, Video, FileText, Upload, Copy, X, Link2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

type TabDetalhe = "metricas" | "copy" | "analise" | "historico";

// ── Upload component ──
function MediaUpload({ onUpload, uploading, setUploading, currentUrl }: {
  onUpload: (url: string) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  currentUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 200 * 1024 * 1024) {
      toast.error("Arquivo excede 200 MB");
      return;
    }
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime", "video/webm", "video/mpeg"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, WebP, GIF, MP4, MOV ou WebM.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/marketing/criativos/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.error) { toast.error(data.error); }
      else { onUpload(data.url); toast.success("Upload concluído"); }
    } catch { toast.error("Erro no upload"); }
    setUploading(false);
  }, [onUpload, setUploading]);

  return (
    <div>
      <label className="text-xs font-medium">Arquivo (imagem ou vídeo)</label>
      <div
        className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : currentUrl ? "border-green-500/30 bg-green-500/5" : "border-border hover:border-muted-foreground"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 size={20} className="animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Enviando...</span>
          </div>
        ) : currentUrl ? (
          <div className="flex items-center justify-center gap-2 py-1">
            <Check size={14} className="text-green-400" />
            <span className="text-xs text-green-400">Arquivo enviado</span>
            <span className="text-[10px] text-muted-foreground">— clique para substituir</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-2">
            <Upload size={18} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Arraste ou clique para enviar</span>
            <span className="text-[10px] text-muted-foreground">JPG, PNG, MP4, MOV — até 200 MB</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Media preview component ──
function MediaPreview({ url, tipo, className }: { url: string | null; tipo: string; className?: string }) {
  if (!url) return null;
  const isVideo = tipo === "video" || /\.(mp4|mov|webm|mpeg)$/i.test(url);
  if (isVideo) {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className={`rounded-lg bg-black ${className || "w-full max-h-[300px] object-contain"}`}
      />
    );
  }
  return (
    <img
      src={url}
      alt="Criativo"
      className={`rounded-lg object-cover ${className || "w-full max-h-[300px]"}`}
    />
  );
}

// ── Thumbnail for cards ──
function MediaThumb({ url, tipo }: { url: string | null; tipo: string }) {
  if (!url) return null;
  const isVideo = tipo === "video" || /\.(mp4|mov|webm|mpeg)$/i.test(url);
  if (isVideo) {
    return (
      <div className="relative w-10 h-10 rounded-lg bg-black overflow-hidden flex items-center justify-center">
        <Video size={16} className="text-white/60" />
      </div>
    );
  }
  return (
    <img src={url} alt="" className="w-10 h-10 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
  );
}

interface CriativoComMetricas extends TrafegoCriativo {
  metricas_atuais: { cpl: number | null; ctr: number | null; spend: number | null; leads: number | null; fase_ciclo_vida: string | null; score_periodo: number | null } | null;
}

export default function TrafegoBibliotecaPage() {
  const [criativos, setCriativos] = useState<CriativoComMetricas[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<{ notion_id: string; cliente: string }[]>([]);

  // Filtros
  const [filtroCliente, setFiltroCliente] = useState("all");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroFase, setFiltroFase] = useState("all");

  // Modal novo criativo
  const [modalNovo, setModalNovo] = useState(false);
  const [novoForm, setNovoForm] = useState({ nome: "", cliente_id: "", tipo: "imagem" as string, nicho: "", ad_id: "", copy_texto: "", roteiro_texto: "", arquivo_url: "" });
  const [criando, setCriando] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload para criativo existente
  const [uploadingExisting, setUploadingExisting] = useState(false);

  // Modal detalhe
  const [selecionado, setSelecionado] = useState<CriativoComMetricas | null>(null);
  const [tabDetalhe, setTabDetalhe] = useState<TabDetalhe>("metricas");
  const [metricasHistorico, setMetricasHistorico] = useState<Record<string, unknown>[]>([]);
  const [analisando, setAnalisando] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [criativosRes, clientesRes] = await Promise.all([
      fetch("/api/marketing/criativos"),
      supabase.from("clientes_receita").select("notion_id, nome").in("status_financeiro", ["ativo", "pausado", "pagou_integral", "parceria"]),
    ]);
    const data = await criativosRes.json();
    setCriativos(Array.isArray(data) ? data : []);
    setClientes((clientesRes.data || []).map((c: { notion_id: string; nome: string }) => ({ notion_id: c.notion_id, cliente: c.nome })) as { notion_id: string; cliente: string }[]);
    setLoading(false);
  }

  const filtrados = criativos.filter((c) => {
    if (filtroCliente !== "all" && c.cliente_id !== filtroCliente) return false;
    if (filtroTipo !== "all" && c.tipo !== filtroTipo) return false;
    if (filtroStatus !== "all" && c.status_veiculacao !== filtroStatus) return false;
    if (filtroFase !== "all" && c.metricas_atuais?.fase_ciclo_vida !== filtroFase) return false;
    return true;
  });

  // KPIs
  const totalAtivos = criativos.filter((c) => c.status_veiculacao === "ativo").length;
  const scoreMedio = criativos.filter((c) => c.score_final).reduce((s, c) => s + (c.score_final || 0), 0) / Math.max(1, criativos.filter((c) => c.score_final).length);
  const emFadiga = criativos.filter((c) => c.status_veiculacao === "fadigado").length;
  const melhorCPL = criativos.reduce((best, c) => {
    const cpl = c.metricas_atuais?.cpl;
    if (cpl && cpl > 0 && (!best || cpl < best)) return cpl;
    return best;
  }, null as number | null);

  async function criarCriativo() {
    if (!novoForm.nome || !novoForm.cliente_id || !novoForm.tipo) { toast.error("Preencha campos obrigatorios"); return; }
    setCriando(true);
    const res = await fetch("/api/marketing/criativos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(novoForm),
    });
    if (res.ok) {
      toast.success("Criativo criado");
      setModalNovo(false);
      setNovoForm({ nome: "", cliente_id: "", tipo: "imagem", nicho: "", ad_id: "", copy_texto: "", roteiro_texto: "", arquivo_url: "" });
      loadData();
    } else toast.error("Erro ao criar");
    setCriando(false);
  }

  async function uploadParaCriativo(file: File, criativoId: string) {
    setUploadingExisting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("criativo_id", criativoId);
      const res = await fetch("/api/marketing/criativos/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else {
        toast.success("Upload concluído");
        if (selecionado && selecionado.id === criativoId) {
          setSelecionado({ ...selecionado, arquivo_url: data.url });
        }
        loadData();
      }
    } catch { toast.error("Erro no upload"); }
    setUploadingExisting(false);
  }

  async function abrirDetalhe(c: CriativoComMetricas) {
    setSelecionado(c);
    setTabDetalhe("metricas");
    const { data } = await supabase
      .from("trafego_criativo_metricas")
      .select("*")
      .eq("criativo_id", c.id)
      .order("mes_referencia", { ascending: true });
    setMetricasHistorico(data || []);
  }

  async function analisarCriativo() {
    if (!selecionado) return;
    setAnalisando(true);
    try {
      const res = await fetch("/api/ia/analisar-criativo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criativo_id: selecionado.id }),
      });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else {
        toast.success("Analise concluida!");
        setSelecionado({ ...selecionado, analise_resultado: data.analise, score_final: data.analise.score, analise_status: "concluido" });
        loadData();
      }
    } catch { toast.error("Erro ao analisar"); }
    setAnalisando(false);
  }

  const tipoIcon = { video: Video, imagem: Image, roteiro: FileText };
  const faseColor: Record<string, string> = {
    aquecimento: "bg-blue-500/20 text-blue-400",
    pico: "bg-green-500/20 text-green-400",
    estavel: "bg-gray-500/20 text-gray-400",
    fadiga: "bg-red-500/20 text-red-400",
    encerrado: "bg-muted text-muted-foreground",
  };
  const statusColor: Record<string, string> = {
    ativo: "bg-green-500/20 text-green-400",
    pausado: "bg-yellow-500/20 text-yellow-400",
    fadigado: "bg-red-500/20 text-red-400",
    arquivado: "bg-muted text-muted-foreground",
  };

  const clienteNome = (id: string) => clientes.find((c) => c.notion_id === id)?.cliente || "—";

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Carregando...</p></div>;

  const analise = selecionado?.analise_resultado;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Biblioteca de Criativos</h1>
        <Button size="sm" onClick={() => setModalNovo(true)}><Plus size={14} className="mr-1" />Novo criativo</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-[10px] text-muted-foreground">Criativos ativos</p><p className="text-2xl font-bold">{totalAtivos}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] text-muted-foreground">Score medio</p><p className="text-2xl font-bold">{scoreMedio.toFixed(1)}<span className="text-xs text-muted-foreground">/10</span></p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] text-muted-foreground">Em fadiga</p><p className={`text-2xl font-bold ${emFadiga > 0 ? "text-red-400" : ""}`}>{emFadiga}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[10px] text-muted-foreground">Melhor CPL</p><p className="text-2xl font-bold text-green-400">{melhorCPL ? formatCurrency(melhorCPL) : "—"}</p></CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
          <option value="all">Todos clientes</option>
          {clientes.map((c) => <option key={c.notion_id} value={c.notion_id}>{c.cliente}</option>)}
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
          <option value="all">Todos tipos</option><option value="video">Video</option><option value="imagem">Imagem</option><option value="roteiro">Roteiro</option>
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
          <option value="all">Todos status</option><option value="ativo">Ativo</option><option value="pausado">Pausado</option><option value="fadigado">Fadigado</option><option value="arquivado">Arquivado</option>
        </select>
        <select value={filtroFase} onChange={(e) => setFiltroFase(e.target.value)} className="text-xs bg-transparent border rounded-lg px-3 py-1.5">
          <option value="all">Todas fases</option><option value="aquecimento">Aquecimento</option><option value="pico">Pico</option><option value="estavel">Estavel</option><option value="fadiga">Fadiga</option><option value="encerrado">Encerrado</option>
        </select>
      </div>

      {/* Grid de criativos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.map((c) => {
          const Icon = tipoIcon[c.tipo] || FileText;
          return (
            <Card key={c.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => abrirDetalhe(c)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {c.arquivo_url ? (
                      <MediaThumb url={c.arquivo_url} tipo={c.tipo} />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Icon size={18} className="text-muted-foreground" /></div>
                    )}
                    <div>
                      <p className="text-sm font-medium truncate max-w-[180px]">{c.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{clienteNome(c.cliente_id)} {c.nicho ? `· ${c.nicho}` : ""}</p>
                    </div>
                  </div>
                  <Badge className={`text-[9px] ${statusColor[c.status_veiculacao] || "bg-muted"}`}>{c.status_veiculacao}</Badge>
                </div>

                {typeof c.score_final === "number" && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${c.score_final >= 7 ? "bg-green-500" : c.score_final >= 4 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${(c.score_final / 10) * 100}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${c.score_final >= 7 ? "text-green-400" : c.score_final >= 4 ? "text-yellow-400" : "text-red-400"}`}>{c.score_final.toFixed(1)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  {c.metricas_atuais?.fase_ciclo_vida && (
                    <Badge className={`text-[9px] ${faseColor[c.metricas_atuais.fase_ciclo_vida] || "bg-muted"}`}>{c.metricas_atuais.fase_ciclo_vida}</Badge>
                  )}
                  <div className="flex gap-3">
                    {c.metricas_atuais?.cpl && <span>CPL {formatCurrency(c.metricas_atuais.cpl)}</span>}
                    {c.metricas_atuais?.leads && <span>{c.metricas_atuais.leads} leads</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Badge className={`text-[9px] ${c.analise_status === "concluido" ? "bg-green-500/20 text-green-400" : c.analise_status === "processando" ? "bg-blue-500/20 text-blue-400" : "bg-muted text-muted-foreground"}`}>
                    IA: {c.analise_status}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={(e) => { e.stopPropagation(); abrirDetalhe(c); }}><Eye size={10} className="mr-1" />Ver</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtrados.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum criativo encontrado</div>}
      </div>

      {/* Modal: Novo criativo */}
      <Dialog open={modalNovo} onOpenChange={setModalNovo}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Criativo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Nome *</label>
              <input className="w-full mt-1 text-sm bg-transparent border rounded px-3 py-2" value={novoForm.nome} onChange={(e) => setNovoForm({ ...novoForm, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Cliente *</label>
                <select className="w-full mt-1 text-xs bg-transparent border rounded px-2 py-2" value={novoForm.cliente_id} onChange={(e) => setNovoForm({ ...novoForm, cliente_id: e.target.value })}>
                  <option value="">Selecione</option>
                  {clientes.map((c) => <option key={c.notion_id} value={c.notion_id}>{c.cliente}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Tipo *</label>
                <select className="w-full mt-1 text-xs bg-transparent border rounded px-2 py-2" value={novoForm.tipo} onChange={(e) => setNovoForm({ ...novoForm, tipo: e.target.value })}>
                  <option value="imagem">Imagem</option><option value="video">Video</option><option value="roteiro">Roteiro</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Nicho</label>
                <input className="w-full mt-1 text-xs bg-transparent border rounded px-2 py-2" value={novoForm.nicho} onChange={(e) => setNovoForm({ ...novoForm, nicho: e.target.value })} placeholder="Ex: trabalhista" />
              </div>
              <div>
                <label className="text-xs font-medium">Ad ID (Meta)</label>
                <input className="w-full mt-1 text-xs bg-transparent border rounded px-2 py-2" value={novoForm.ad_id} onChange={(e) => setNovoForm({ ...novoForm, ad_id: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
            {(novoForm.tipo === "imagem" || novoForm.tipo === "video") && (
              <MediaUpload
                onUpload={(url) => setNovoForm({ ...novoForm, arquivo_url: url })}
                uploading={uploading}
                setUploading={setUploading}
                currentUrl={novoForm.arquivo_url || null}
              />
            )}
            {(novoForm.tipo === "imagem" || novoForm.tipo === "roteiro") && (
              <div>
                <label className="text-xs font-medium">{novoForm.tipo === "imagem" ? "Copy" : "Roteiro"}</label>
                <textarea className="w-full mt-1 text-xs bg-transparent border rounded px-3 py-2 h-24"
                  value={novoForm.tipo === "imagem" ? novoForm.copy_texto : novoForm.roteiro_texto}
                  onChange={(e) => setNovoForm({ ...novoForm, [novoForm.tipo === "imagem" ? "copy_texto" : "roteiro_texto"]: e.target.value })}
                  placeholder={novoForm.tipo === "imagem" ? "Texto do copy..." : "Texto do roteiro..."} />
              </div>
            )}
            {novoForm.tipo === "video" && (
              <div>
                <label className="text-xs font-medium">Roteiro (opcional)</label>
                <textarea className="w-full mt-1 text-xs bg-transparent border rounded px-3 py-2 h-24"
                  value={novoForm.roteiro_texto}
                  onChange={(e) => setNovoForm({ ...novoForm, roteiro_texto: e.target.value })}
                  placeholder="Cole o roteiro do vídeo aqui..." />
              </div>
            )}
            <Button className="w-full" onClick={criarCriativo} disabled={criando || uploading}>
              {criando ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Plus size={14} className="mr-1" />}
              Criar Criativo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhe do criativo */}
      <Dialog open={!!selecionado} onOpenChange={() => setSelecionado(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selecionado && (() => { const Icon = tipoIcon[selecionado.tipo] || FileText; return <Icon size={16} />; })()}
              {selecionado?.nome}
            </DialogTitle>
          </DialogHeader>

          {selecionado && (
            <>
              <div className="flex gap-1 border-b">
                {(["metricas", "copy", "analise", "historico"] as TabDetalhe[]).map((t) => (
                  <button key={t} onClick={() => setTabDetalhe(t)}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${tabDetalhe === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    {t === "metricas" ? "Métricas" : t === "copy" ? "Copy/Roteiro" : t === "analise" ? "Análise IA" : "Histórico"}
                  </button>
                ))}
              </div>

              {tabDetalhe === "metricas" && (
                <div className="space-y-4">
                  {selecionado.arquivo_url ? (
                    <MediaPreview url={selecionado.arquivo_url} tipo={selecionado.tipo} />
                  ) : (selecionado.tipo === "imagem" || selecionado.tipo === "video") && (
                    <div
                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground transition-colors"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";
                        input.onchange = (e) => {
                          const f = (e.target as HTMLInputElement).files?.[0];
                          if (f) uploadParaCriativo(f, selecionado.id);
                        };
                        input.click();
                      }}
                    >
                      {uploadingExisting ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={20} className="animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Enviando...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Upload size={20} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Clique para enviar {selecionado.tipo === "video" ? "o vídeo" : "a imagem"}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {selecionado.ad_id && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Link2 size={12} />
                      <span>Ad ID: <span className="font-mono text-foreground">{selecionado.ad_id}</span></span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground">Score</p>
                      <p className="text-lg font-bold">{selecionado.score_final?.toFixed(1) || "—"}/10</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground">Fase</p>
                      <Badge className={`mt-1 text-[10px] ${faseColor[selecionado.metricas_atuais?.fase_ciclo_vida || ""] || "bg-muted"}`}>
                        {selecionado.metricas_atuais?.fase_ciclo_vida || "N/A"}
                      </Badge>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground">CPL atual</p>
                      <p className="text-lg font-bold">{selecionado.metricas_atuais?.cpl ? formatCurrency(selecionado.metricas_atuais.cpl) : "—"}</p>
                    </div>
                  </div>
                  {metricasHistorico.length > 1 && (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metricasHistorico.map((m) => ({ mes: (m.mes_referencia as string)?.slice(0, 7), cpl: m.cpl }))}>
                          <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v) => formatCurrency(Number(v))} labelStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="cpl" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {metricasHistorico.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Historico de fases</p>
                      <div className="flex gap-1 flex-wrap">
                        {metricasHistorico.map((m, i) => (
                          <Badge key={i} className={`text-[9px] ${faseColor[(m.fase_ciclo_vida as string)] || "bg-muted"}`}>
                            {(m.mes_referencia as string)?.slice(0, 7)}: {m.fase_ciclo_vida as string}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tabDetalhe === "copy" && (
                <div className="space-y-4">
                  {selecionado.copy_texto && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Copy</p>
                      <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap">{selecionado.copy_texto}</div>
                    </div>
                  )}
                  {selecionado.roteiro_texto && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Roteiro</p>
                      <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap">{selecionado.roteiro_texto}</div>
                    </div>
                  )}
                  {selecionado.tipo === "video" && selecionado.transcricao_status === "pendente" && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-400">
                      Transcricao pendente. Faca upload do video para processar.
                    </div>
                  )}
                  {selecionado.transcricao_texto && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Transcricao</p>
                      <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap">{selecionado.transcricao_texto}</div>
                    </div>
                  )}
                  <Button onClick={analisarCriativo} disabled={analisando}>
                    {analisando ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Brain size={14} className="mr-1" />}
                    Analisar com IA
                  </Button>
                </div>
              )}

              {tabDetalhe === "analise" && (
                <div className="space-y-4">
                  {analise ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Pontos fortes</p>
                          {analise.pontos_fortes.map((p: string, i: number) => <p key={i} className="text-green-400">+ {p}</p>)}
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Pontos fracos</p>
                          {analise.pontos_fracos.map((p: string, i: number) => <p key={i} className="text-red-400">- {p}</p>)}
                        </div>
                      </div>
                      {analise.gatilhos_identificados?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Gatilhos identificados</p>
                          <div className="flex gap-1 flex-wrap">{analise.gatilhos_identificados.map((g: string, i: number) => <Badge key={i} className="text-[9px]">{g}</Badge>)}</div>
                        </div>
                      )}
                      <div className="text-xs space-y-1">
                        <p><strong>Publico provavel:</strong> {analise.publico_provavel}</p>
                        <p><strong>Nicho juridico:</strong> {analise.nicho_juridico}</p>
                      </div>
                      {analise.sugestoes_copy?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Sugestoes de copy</p>
                          {analise.sugestoes_copy.map((s: any, i: number) => (
                            <Card key={i}>
                              <CardContent className="p-3 space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-bold">Versao {s.versao}: {s.headline}</p>
                                  <Button variant="ghost" size="sm" className="h-5 text-[9px]" onClick={() => { navigator.clipboard.writeText(s.copy_completo); toast.success("Copiado!"); }}>
                                    <Copy size={8} className="mr-1" />Copiar
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">{s.copy_completo}</p>
                                <p className="text-[10px] text-muted-foreground italic">{s.justificativa}</p>
                                <p className="text-[10px] text-muted-foreground">Baseado em: {s.baseado_em}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                      {analise.alerta_compliance && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 text-xs text-yellow-400">
                          OAB: {analise.alerta_compliance}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 space-y-3">
                      <p className="text-sm text-muted-foreground">Nenhuma analise disponivel</p>
                      <Button onClick={analisarCriativo} disabled={analisando}>
                        {analisando ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Brain size={14} className="mr-1" />}
                        Analisar com IA
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {tabDetalhe === "historico" && (
                <div className="space-y-2 text-xs">
                  <div className="border-l-2 border-muted pl-4 space-y-3">
                    <div>
                      <p className="font-medium">Criado</p>
                      <p className="text-muted-foreground">{new Date(selecionado.criado_em).toLocaleString("pt-BR")}</p>
                    </div>
                    {selecionado.data_inicio_veiculacao && (
                      <div>
                        <p className="font-medium">Inicio veiculacao</p>
                        <p className="text-muted-foreground">{new Date(selecionado.data_inicio_veiculacao).toLocaleDateString("pt-BR")}</p>
                      </div>
                    )}
                    {selecionado.analise_status === "concluido" && (
                      <div>
                        <p className="font-medium">Analise IA concluida</p>
                        <p className="text-muted-foreground">Score: {selecionado.score_final?.toFixed(1)}/10</p>
                      </div>
                    )}
                    {selecionado.status_veiculacao === "fadigado" && (
                      <div>
                        <p className="font-medium text-red-400">Entrou em fadiga</p>
                        <p className="text-muted-foreground">CPL subindo acima do pico</p>
                      </div>
                    )}
                    {selecionado.data_fim_veiculacao && (
                      <div>
                        <p className="font-medium">Fim veiculacao</p>
                        <p className="text-muted-foreground">{new Date(selecionado.data_fim_veiculacao).toLocaleDateString("pt-BR")}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

