"use client";
/**
 * Audience Hub — Central de Públicos Personalizados
 * Abas: Hub (todos) | Video View | Instagram/Facebook | Site (Pixel) | Lista de Clientes
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import {
  Film, Globe2, Camera, BookOpen, Megaphone, Search, RefreshCw,
  Plus, CheckCircle2, AlertCircle, Loader2, Target, X, Info,
  Users, Link2, LayoutGrid, ChevronDown, TrendingUp, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAdAccount } from "@/contexts/ad-account-context";

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ─── Types ────────────────────────────────────────────────────────────────────
interface MetaVideo { id: string; title?: string; picture?: string; length?: number | null; ad_name?: string; source: string; source_label: string; }
interface MetaPage { id: string; name: string; access_token?: string; instagram_business_account?: { id: string; username: string }; }
interface MetaPixel { id: string; name: string; }
interface CustomAudience { id: string; name: string; subtype: string; description?: string; delivery_status?: { code: number; description: string }; approximate_count_upper_bound?: number; }

type Tab = "hub" | "video" | "engagement" | "pixel" | "customerlist";
type VideoEvent = "video_view" | "TWO_SECOND_CONTINUOUS_VIDEO_VIEWS" | "VIDEO_WATCHED_25" | "VIDEO_WATCHED_50" | "VIDEO_WATCHED_75" | "THRUPLAY";

const TABS: { id: Tab; label: string; icon: React.ElementType; color: string }[] = [
  { id: "hub",          label: "Todos os Públicos", icon: LayoutGrid, color: "text-primary" },
  { id: "video",        label: "Video View",        icon: Film,       color: "text-primary"   },
  { id: "engagement",   label: "Instagram / Facebook", icon: Camera,  color: "text-primary"  },
  { id: "pixel",        label: "Site (Pixel)",      icon: Globe2,     color: "text-primary"},
  { id: "customerlist", label: "Lista de Clientes", icon: Users,      color: "text-primary" },
];

const SUBTYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  VIDEO:       { label: "Video View",       color: "text-primary",    bg: "bg-primary/10 border-primary/20"    },
  ENGAGEMENT:  { label: "Engajamento",      color: "text-primary",    bg: "bg-primary/10 border-primary/20"   },
  WEBSITE:     { label: "Site (Pixel)",     color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  CUSTOM:      { label: "Lista Clientes",   color: "text-primary",   bg: "bg-primary/10 border-primary/20"  },
  LOOKALIKE:   { label: "Lookalike",        color: "text-primary",  bg: "bg-primary/10 border-primary/20"},
  IG_BUSINESS: { label: "Instagram",        color: "text-primary",    bg: "bg-primary/10 border-primary/20"   },
};

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  facebook_page: { label: "Página Facebook", icon: Globe2,    color: "text-primary",   bg: "bg-primary/10",   border: "border-primary/20" },
  instagram:     { label: "Instagram",       icon: Camera,    color: "text-primary",   bg: "bg-primary/10",   border: "border-primary/20" },
  ad_library:    { label: "Biblioteca",      icon: BookOpen,  color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
  campaign:      { label: "Campanhas",       icon: Megaphone, color: "text-primary",  bg: "bg-primary/10",  border: "border-primary/20" },
};

const VIDEO_EVENTS: { value: VideoEvent; label: string; desc: string }[] = [
  { value: "video_view",                        label: "Qualquer visualização",    desc: "Qualquer reprodução do vídeo" },
  { value: "TWO_SECOND_CONTINUOUS_VIDEO_VIEWS", label: "2 segundos contínuos",     desc: "Assistiu pelo menos 2s sem parar" },
  { value: "VIDEO_WATCHED_25",                  label: "25% do vídeo",             desc: "Assistiu ao menos 25% da duração" },
  { value: "VIDEO_WATCHED_50",                  label: "50% do vídeo",             desc: "Assistiu ao menos 50% da duração" },
  { value: "VIDEO_WATCHED_75",                  label: "75% do vídeo",             desc: "Assistiu ao menos 75% da duração" },
  { value: "THRUPLAY",                          label: "ThruPlay (95% ou 15s)",    desc: "Assistiu 95% ou mínimo 15 segundos" },
];

const RETENTION_OPTS = ["7", "14", "30", "60", "90", "180", "365"];

function fmtCount(n?: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `~${(n / 1000).toFixed(0)}K`;
  return String(n);
}

// ─── Shared: Audience Name Input ──────────────────────────────────────────────
function NameInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label  className="text-xs font-semibold text-foreground/70">Nome do Público *</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Ex: Público VV 30d"} className="bg-black/30 border-white/10 text-sm h-9" />
    </div>
  );
}

// ─── Shared: Retention Picker ─────────────────────────────────────────────────
function RetentionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label  className="text-xs font-semibold text-foreground/70">Janela de Retenção (dias)</Label>
      <div className="flex gap-1.5 flex-wrap">
        {RETENTION_OPTS.map(d => (
          <button key={d} onClick={() => onChange(d)} className={cn("px-2.5 py-1 rounded-md text-xs font-bold border transition-all",
            value === d ? "bg-accent border-accent text-white" : "bg-white/[0.03] border-white/10 text-foreground/60 hover:border-white/20 hover:text-foreground")}>
            {d}d
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Shared: Result Banner ────────────────────────────────────────────────────
function ResultBanner({ result }: { result: { success?: boolean; id?: string; error?: string } | null }) {
  if (!result) return null;
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
      className={cn("rounded-lg border p-3 flex gap-2", result.success ? "border-primary/20 bg-primary/10" : "border-primary/20 bg-primary/10")}>
      {result.success ? <CheckCircle2  className="h-4 w-4 text-primary shrink-0 mt-0.5" /> : <AlertCircle  className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
      <div>
        <p className="text-xs font-semibold">{result.success ? "Público criado com sucesso!" : "Erro ao criar público"}</p>
        {result.id    && <p className="text-[10px] font-mono text-foreground/40 mt-0.5">ID: {result.id}</p>}
        {result.error && <p className="text-[10px] text-primary mt-0.5">{result.error}</p>}
      </div>
    </motion.div>
  );
}

async function postAudience(body: object) {
  const res = await fetch("/api/meta/custom-audiences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Erro ao criar público");
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — HUB: Todos os Públicos
// ═══════════════════════════════════════════════════════════════════════════════
function TabHub({ audiences, isLoading, onRefresh }: { audiences: CustomAudience[]; isLoading: boolean; onRefresh: () => void }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const types = useMemo(() => {
    const seen = new Set<string>();
    audiences.forEach(a => seen.add(a.subtype));
    return Array.from(seen);
  }, [audiences]);

  const filtered = useMemo(() => {
    return audiences.filter(a => {
      const matchType = typeFilter === "ALL" || a.subtype === typeFilter;
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.id.includes(search);
      return matchType && matchSearch;
    });
  }, [audiences, search, typeFilter]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {["ALL", ...types].map(t => {
            const meta = SUBTYPE_META[t];
            const count = t === "ALL" ? audiences.length : audiences.filter(a => a.subtype === t).length;
            return (
              <button key={t} onClick={() => setTypeFilter(t)} className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                typeFilter === t ? "bg-primary/15 border-accent/40 text-accent/70" : "bg-white/[0.03] border-white/10 text-foreground/60 hover:text-foreground")}>
                {t === "ALL" ? `Todos (${count})` : `${meta?.label || t} (${count})`}
              </button>
            );
          })}
        </div>
        <Button  variant="outline" size="sm" onClick={onRefresh} className="gap-1.5 border-white/15 text-foreground/70 hover:text-foreground bg-transparent text-xs h-8">
          <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} /> Atualizar
        </Button>
      </div>
      <div className="relative max-w-sm">
        <Search  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou ID..." className="pl-9 bg-white/[0.03] border-white/10 text-sm h-9" />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2  className="h-6 w-6 animate-spin text-foreground/30" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {filtered.map((a, i) => {
              const meta = SUBTYPE_META[a.subtype] ?? { label: a.subtype, color: "text-foreground/60", bg: "bg-white/5 border-white/10" };
              const ready = a.delivery_status?.code === 200;
              return (
                <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 30) * 0.02 }}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3 hover:border-white/15 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{a.name}</p>
                      {a.description && <p className="text-xs text-foreground/40 truncate mt-0.5">{a.description}</p>}
                    </div>
                    <span className={cn("shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border", meta.bg, meta.color)}>{meta.label}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[9px] text-foreground/40 uppercase tracking-wider">Tamanho</p>
                      <p className="text-sm font-bold">{fmtCount(a.approximate_count_upper_bound)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-foreground/40 uppercase tracking-wider">Status</p>
                      <p className={cn("text-xs font-bold", ready ? "text-primary" : "text-primary")}>{ready ? "Pronto" : "Processando"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-foreground/40 uppercase tracking-wider">ID</p>
                      <p className="text-[10px] font-mono text-foreground/40 truncate">{a.id}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {!isLoading && filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-foreground/40 text-sm">Nenhum público encontrado.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — VIDEO VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function VideoCard({ video, selected, onToggle }: { video: MetaVideo; selected: boolean; onToggle: () => void }) {
  const src = SOURCE_CONFIG[video.source] ?? { label: video.source_label || "Vídeo", icon: Film, color: "text-foreground/50", bg: "bg-white/5", border: "border-white/10" };
  const SrcIcon = src.icon;
  return (
    <motion.button onClick={onToggle} whileTap={{ scale: 0.97 }} className={cn("relative w-full text-left rounded-xl border transition-all overflow-hidden",
      selected ? "border-accent/60 bg-accent/8 shadow-[0_0_12px_rgba(0,153,255,0.15)]" : "border-white/8 bg-white/[0.02] hover:border-white/15")}>
      <div className="relative aspect-video bg-black/40">
        {video.picture ? <img src={video.picture} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film  className="h-8 w-8 text-foreground/20" /></div>}
        <span className={cn("absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border", src.bg, src.color, src.border)}>
          <SrcIcon className="h-2.5 w-2.5" />{src.label}
        </span>
        {selected && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-white" /></div></div>}
        {video.length && <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/70 text-white px-1.5 py-0.5 rounded">{Math.floor(video.length / 60)}:{String(Math.floor(video.length % 60)).padStart(2, "0")}</span>}
      </div>
      <div className="p-2">
        <p className="text-[11px] font-medium truncate">{video.title || `Vídeo ${video.id}`}</p>
        {video.ad_name && <p className="text-[9px] text-foreground/40 truncate">{video.ad_name}</p>}
      </div>
    </motion.button>
  );
}

function TabVideoView({ audiences }: { audiences: CustomAudience[] }) {
  const { account } = useAdAccount();
  const { data: pagesData } = useSWR<{ data: MetaPage[] }>("/api/meta/pages", fetcher, { revalidateOnFocus: false });
  const pages = pagesData?.data || [];
  const firstPage = pages[0];
  const igActorId = firstPage?.instagram_business_account?.id;

  const videoParams = new URLSearchParams();
  if (account?.id) videoParams.set("account_id", account.id);
  if (firstPage?.id) videoParams.set("pageId", firstPage.id);
  if (igActorId) videoParams.set("igActorId", igActorId);

  const { data: videosData, isLoading } = useSWR(`/api/meta/videos?${videoParams.toString()}`, fetcher, { revalidateOnFocus: false });
  const allVideos: MetaVideo[] = videosData?.data || [];

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [videoEvent, setVideoEvent] = useState<VideoEvent>("video_view");
  const [retentionDays, setRetentionDays] = useState("30");
  const [audienceName, setAudienceName] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; id?: string; error?: string } | null>(null);

  const filtered = useMemo(() => allVideos.filter(v => {
    const ms = sourceFilter === "all" || v.source === sourceFilter;
    const ms2 = !search || (v.title || "").toLowerCase().includes(search.toLowerCase()) || v.id.includes(search);
    return ms && ms2;
  }), [allVideos, sourceFilter, search]);

  const sourceCounts = useMemo(() => ({
    all: allVideos.length,
    facebook_page: (videosData?.pageVideos || []).length,
    instagram:     (videosData?.igVideos || []).length,
    campaign:      (videosData?.campaignVideos || []).length,
    ad_library:    (videosData?.libraryVideos || []).length,
  }), [videosData, allVideos]);

  const toggleVideo = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelectedIds(new Set(filtered.map(v => v.id)));
  const clearAll  = () => setSelectedIds(new Set());

  const handleCreate = async () => {
    if (!audienceName.trim() || selectedIds.size === 0) return;
    setCreating(true); setResult(null);
    try {
      const data = await postAudience({ name: audienceName, subtype: "VIDEO", videoIds: Array.from(selectedIds), videoEvent, retentionDays: Number(retentionDays) });
      setResult({ success: true, id: data.data?.id });
      setAudienceName(""); setSelectedIds(new Set());
      mutate("/api/meta/custom-audiences");
    } catch (e: any) { setResult({ error: e.message }); } finally { setCreating(false); }
  };

  const sources = ["all", "facebook_page", "instagram", "campaign", "ad_library"] as const;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
      {/* Left: Video picker */}
      <div className="space-y-3">
        {/* Source tabs */}
        <div className="flex flex-wrap gap-1.5">
          {sources.map(s => {
            const cfg = s !== "all" ? SOURCE_CONFIG[s] : null;
            const Icon = cfg?.icon;
            const count = sourceCounts[s] || 0;
            return (
              <button key={s} onClick={() => setSourceFilter(s)} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                sourceFilter === s ? "bg-primary/15 border-accent/40 text-accent/70" : "bg-white/[0.03] border-white/10 text-foreground/60 hover:text-foreground")}>
                {Icon && <Icon className="h-3 w-3" />}
                {s === "all" ? "Todos" : cfg!.label}
                <span className={cn("text-[9px] font-mono px-1 rounded", sourceFilter === s ? "bg-primary/20 text-accent/70" : "bg-white/5 text-foreground/40")}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search + Select All */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar vídeos..." className="pl-9 bg-white/[0.03] border-white/10 text-sm h-9" />
          </div>
          <Button  variant="outline" size="sm" onClick={selectAll} className="text-xs h-9 border-white/15 text-foreground/70 hover:text-foreground bg-transparent px-3">Selecionar Todos</Button>
          {selectedIds.size > 0 && <Button  variant="outline" size="sm" onClick={clearAll} className="text-xs h-9 border-white/15 text-foreground/70 px-3 bg-transparent">Limpar</Button>}
        </div>

        {selectedIds.size > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
            <span className="text-xs font-semibold text-accent/70">{selectedIds.size} vídeo{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}</span>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-foreground/40"><Loader2 className="h-6 w-6 animate-spin" /><p className="text-xs">Buscando vídeos em 4 fontes...</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <AnimatePresence>
              {filtered.map((v, i) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 16) * 0.025 }}>
                  <VideoCard video={v} selected={selectedIds.has(v.id)} onToggle={() => toggleVideo(v.id)} />
                </motion.div>
              ))}
            </AnimatePresence>
            {filtered.length === 0 && <div className="col-span-full py-12 text-center text-foreground/40 text-sm">Nenhum vídeo encontrado.</div>}
          </div>
        )}
      </div>

      {/* Right: Form */}
      <div className="xl:sticky xl:top-6 space-y-3">
        <SpotlightCard className="p-5 space-y-4">
          <div className="flex items-center gap-2"><Film  className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Criar Público Video View</h2></div>
          <NameInput value={audienceName} onChange={setAudienceName} placeholder="Ex: VV 50% Reels 30d" />
          <div className="space-y-1.5">
            <Label  className="text-xs font-semibold text-foreground/70">Tipo de Engajamento</Label>
            <div className="space-y-1">
              {VIDEO_EVENTS.map(ev => (
                <button key={ev.value} onClick={() => setVideoEvent(ev.value)} className={cn("w-full flex items-start gap-2.5 px-3 py-2 rounded-lg border text-left transition-all",
                  videoEvent === ev.value ? "border-accent/40 bg-accent/8" : "border-white/[0.06] bg-black/20 text-foreground/60 hover:text-foreground hover:border-white/15")}>
                  <div className={cn("w-3 h-3 rounded-full border-2 shrink-0 mt-0.5 transition-colors", videoEvent === ev.value ? "border-accent bg-accent" : "border-foreground/30")} />
                  <div><p className="text-xs font-semibold">{ev.label}</p><p className="text-[10px] text-foreground/50">{ev.desc}</p></div>
                </button>
              ))}
            </div>
          </div>
          <RetentionPicker value={retentionDays} onChange={setRetentionDays} />
          <AnimatePresence><ResultBanner result={result} /></AnimatePresence>
          <Button onClick={handleCreate} disabled={creating || !audienceName.trim() || selectedIds.size === 0} className="w-full bg-primary/10 hover:bg-primary/10 border-0 font-bold gap-2">
            {creating ? <><Loader2 className="h-4 w-4 animate-spin" />Criando...</> : <><Plus className="h-4 w-4" />Criar ({selectedIds.size} vídeo{selectedIds.size !== 1 ? "s" : ""})</>}
          </Button>
          <div className="flex gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5"><Info  className="h-3.5 w-3.5 text-foreground/30 shrink-0 mt-0.5" /><p className="text-[10px] text-foreground/40 leading-relaxed">Selecione vídeos ao lado. O Meta levará minutos a horas para estimar o tamanho.</p></div>
        </SpotlightCard>

        {/* Existing VIDEO audiences */}
        {audiences.filter(a => a.subtype === "VIDEO").length > 0 && (
          <SpotlightCard className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary mb-3">Públicos Video View Existentes</p>
            <div className="space-y-2">
              {audiences.filter(a => a.subtype === "VIDEO").map(a => (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium truncate">{a.name}</p>
                  <span className={cn("text-[9px] font-bold shrink-0", a.delivery_status?.code === 200 ? "text-primary" : "text-primary")}>{a.delivery_status?.code === 200 ? "Pronto" : "Processando"}</span>
                </div>
              ))}
            </div>
          </SpotlightCard>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — ENGAGEMENT (Instagram / Facebook Page)
// ═══════════════════════════════════════════════════════════════════════════════
function TabEngagement({ audiences }: { audiences: CustomAudience[] }) {
  const { data: pagesData } = useSWR<{ data: MetaPage[] }>("/api/meta/pages", fetcher, { revalidateOnFocus: false });
  const pages = pagesData?.data || [];

  const [audienceName, setAudienceName] = useState("");
  const [engSource, setEngSource] = useState<"ig" | "fb">("ig");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [igActorId, setIgActorId] = useState("");
  const [engEvent, setEngEvent] = useState(""); // Default set by effect
  const [retentionDays, setRetentionDays] = useState("30");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; id?: string; error?: string } | null>(null);

  const igOptions = useMemo(() => {
    const items: { id: string; label: string; pageId: string }[] = [];
    pages.forEach(p => {
      if (p.instagram_business_account?.id) items.push({ 
        id: p.instagram_business_account.id, 
        label: `@${p.instagram_business_account.username || p.instagram_business_account.id} (${p.name})`,
        pageId: p.id 
      });
    });
    return items;
  }, [pages]);

  const IG_EVENTS = [
    { value: "ig_business_profile_engaged", label: "Qualquer pessoa que tenha engajado com esta conta" },
    { value: "ig_business_profile_visited", label: "Qualquer pessoa que visitou o perfil" },
    { value: "ig_user_messaged_business", label: "Pessoas que enviaram uma mensagem" },
    { value: "ig_user_saved_post_or_ad", label: "Pessoas que salvaram publicação ou anúncio" },
  ];
  
  const FB_EVENTS = [
    { value: "page_engaged",     label: "Quem engajou com sua Página" },
    { value: "page_visited",     label: "Quem visitou sua Página" },
    { value: "page_liked",       label: "Pessoas que curtiram sua Página" },
    { value: "page_messaged",    label: "Pessoas que enviaram uma mensagem" },
    { value: "page_cta_clicked", label: "Pessoas que clicaram em botão de ação" },
  ];

  // Auto-select defaults
  useEffect(() => {
    if (!igActorId && igOptions.length > 0) setIgActorId(igOptions[0].id);
    if (!selectedPageId && pages.length > 0) setSelectedPageId(pages[0].id);
  }, [pages, igOptions, igActorId, selectedPageId]);

  useEffect(() => {
    // Atualizar o evento selecionado caso mude a fonte
    if (engSource === "ig") setEngEvent(IG_EVENTS[0].value);
    if (engSource === "fb") setEngEvent(FB_EVENTS[0].value);
  }, [engSource]);

  const handleCreate = async () => {
    if (!audienceName.trim()) return;
    setCreating(true); setResult(null);
    try {
      const body: any = { name: audienceName, subtype: "ENGAGEMENT", retentionDays: Number(retentionDays), engEvent };
      
      if (engSource === "ig") {
        const selectedIg = igOptions.find(o => o.id === igActorId);
        body.igActorId = igActorId;
        body.igLinkedPageId = selectedIg?.pageId; // Enviar o pageId real em vez do IG actor ID para o evento de source
      } else {
        body.pageId = selectedPageId;
      }
      
      const data = await postAudience(body);
      setResult({ success: true, id: data.data?.id });
      setAudienceName("");
      mutate("/api/meta/custom-audiences");
    } catch (e: any) { setResult({ error: e.message }); } finally { setCreating(false); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
      {/* Info */}
      <SpotlightCard className="p-6 space-y-4">
        <div className="flex items-center gap-2"><Camera  className="h-5 w-5 text-primary" /><h2 className="font-bold">Engajamento Instagram / Página Facebook</h2></div>
        <p className="text-sm text-foreground/60">Crie públicos com pessoas que interagiram com seu perfil do Instagram ou Página do Facebook — sem precisar de Pixel.</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { title: "Instagram Business", desc: "Quem engajou com posts, Reels, Stories ou perfil do IG", icon: Camera, color: "text-primary" },
            { title: "Página do Facebook", desc: "Quem curtiu, comentou ou clicou em botões da Página FB", icon: Globe2, color: "text-primary" },
          ].map(c => (
            <div key={c.title} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-2">
              <c.icon className={cn("h-5 w-5", c.color)} />
              <p className="font-semibold text-sm">{c.title}</p>
              <p className="text-xs text-foreground/50">{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Existing engagement audiences */}
        {audiences.filter(a => a.subtype === "ENGAGEMENT" || a.subtype === "IG_BUSINESS").length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Públicos Existentes</p>
            {audiences.filter(a => a.subtype === "ENGAGEMENT" || a.subtype === "IG_BUSINESS").map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 gap-2">
                <p className="text-xs font-medium truncate">{a.name}</p>
                <span className={cn("text-[9px] font-bold shrink-0", a.delivery_status?.code === 200 ? "text-primary" : "text-primary")}>{a.delivery_status?.code === 200 ? "Pronto" : "Processando"}</span>
              </div>
            ))}
          </div>
        )}
      </SpotlightCard>

      {/* Form */}
      <div className="xl:sticky xl:top-6">
        <SpotlightCard className="p-5 space-y-4">
          <div className="flex items-center gap-2"><Target  className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Criar Público de Engajamento</h2></div>
          <NameInput value={audienceName} onChange={setAudienceName} placeholder="Ex: IG Engajou 90d" />

          {/* Source toggle */}
          <div className="space-y-1.5">
            <Label  className="text-xs font-semibold text-foreground/70">Fonte</Label>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: "ig", label: "Instagram", icon: Camera },{ id: "fb", label: "Facebook", icon: Globe2 }].map(s => (
                <button key={s.id} onClick={() => setEngSource(s.id as "ig" | "fb")} className={cn("flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-semibold transition-all",
                  engSource === s.id ? "border-primary/20 bg-primary/10 text-primary" : "border-white/10 bg-white/[0.02] text-foreground/60 hover:text-foreground")}>
                  <s.icon className="h-3.5 w-3.5" />{s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actor selector */}
          {engSource === "ig" ? (
            <div className="space-y-1.5">
              <Label  className="text-xs font-semibold text-foreground/70">Conta do Instagram</Label>
              {igOptions.length === 0 ? <p className="text-xs text-foreground/40 p-2">Nenhuma conta IG encontrada</p> : (
                <div className="space-y-1">
                  {igOptions.map(opt => (
                    <button key={opt.id} onClick={() => setIgActorId(opt.id)} className={cn("w-full text-left px-3 py-2 rounded-lg border text-xs transition-all",
                      igActorId === opt.id ? "border-primary/20 bg-primary/10 text-primary" : "border-white/8 bg-white/[0.02] text-foreground/70 hover:text-foreground")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label  className="text-xs font-semibold text-foreground/70">Página do Facebook</Label>
              <div className="space-y-1">
                {pages.map(p => (
                  <button key={p.id} onClick={() => setSelectedPageId(p.id)} className={cn("w-full text-left px-3 py-2 rounded-lg border text-xs transition-all",
                    selectedPageId === p.id ? "border-primary/20 bg-primary/10 text-primary" : "border-white/8 bg-white/[0.02] text-foreground/70 hover:text-foreground")}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Event */}
          <div className="space-y-1.5">
            <Label  className="text-xs font-semibold text-foreground/70">Tipo de Engajamento</Label>
            <div className="space-y-1">
              {(engSource === "ig" ? IG_EVENTS : FB_EVENTS).map(ev => (
                <button key={ev.value} onClick={() => setEngEvent(ev.value)} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all",
                  engEvent === ev.value ? "border-primary/20 bg-primary/10 text-foreground" : "border-white/[0.06] bg-black/20 text-foreground/60 hover:text-foreground hover:border-white/15")}>
                  <div className={cn("w-2.5 h-2.5 rounded-full border-2 shrink-0", engEvent === ev.value ? "border-primary/20 bg-primary/10" : "border-foreground/30")} />
                  {ev.label}
                </button>
              ))}
            </div>
          </div>

          <RetentionPicker value={retentionDays} onChange={setRetentionDays} />
          <AnimatePresence><ResultBanner result={result} /></AnimatePresence>
          <Button onClick={handleCreate} disabled={creating || !audienceName.trim() || (engSource === "ig" ? !igActorId : !selectedPageId)} className="w-full bg-primary/10 hover:bg-primary/10 border-0 font-bold gap-2">
            {creating ? <><Loader2 className="h-4 w-4 animate-spin" />Criando...</> : <><Plus className="h-4 w-4" />Criar Público</>}
          </Button>
        </SpotlightCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — PIXEL (Website)
// ═══════════════════════════════════════════════════════════════════════════════
function TabPixel({ audiences }: { audiences: CustomAudience[] }) {
  const { account } = useAdAccount();
  const pixelUrl = account?.id ? `/api/meta/pixels?account_id=${account.id}` : "/api/meta/pixels";
  const { data: pixelsData } = useSWR<{ data: MetaPixel[] }>(pixelUrl, fetcher, { revalidateOnFocus: false });
  const pixels = pixelsData?.data || [];

  const [audienceName, setAudienceName] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [eventFilter, setEventFilter] = useState<"ALL_VISITORS" | "SPECIFIC_PAGE">("ALL_VISITORS");
  const [urlMatch, setUrlMatch] = useState("");
  const [retentionDays, setRetentionDays] = useState("30");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; id?: string; error?: string } | null>(null);

  const handleCreate = async () => {
    if (!audienceName.trim() || !pixelId) return;
    setCreating(true); setResult(null);
    try {
      const body: any = { name: audienceName, subtype: "WEBSITE", pixelId, eventFilter, retentionDays: Number(retentionDays) };
      if (eventFilter === "SPECIFIC_PAGE") body.urlMatch = urlMatch;
      const data = await postAudience(body);
      setResult({ success: true, id: data.data?.id });
      setAudienceName("");
      mutate("/api/meta/custom-audiences");
    } catch (e: any) { setResult({ error: e.message }); } finally { setCreating(false); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
      <SpotlightCard className="p-6 space-y-4">
        <div className="flex items-center gap-2"><Globe2  className="h-5 w-5 text-primary" /><h2 className="font-bold">Público de Site (Pixel)</h2></div>
        <p className="text-sm text-foreground/60">Crie públicos de pessoas que visitaram seu site, páginas específicas ou realizaram ações rastreadas pelo seu Pixel do Meta.</p>
        {pixels.length > 0 && (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <p className="text-xs font-bold text-primary mb-2">Pixels disponíveis nesta conta</p>
            {pixels.map(p => <div key={p.id} className="flex justify-between text-xs py-1"><span className="font-medium">{p.name}</span><span className="font-mono text-foreground/40">{p.id}</span></div>)}
          </div>
        )}
        {audiences.filter(a => a.subtype === "WEBSITE").length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Públicos de Site Existentes</p>
            {audiences.filter(a => a.subtype === "WEBSITE").map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                <p className="text-xs font-medium truncate">{a.name}</p>
                <span className={cn("text-[9px] font-bold shrink-0", a.delivery_status?.code === 200 ? "text-primary" : "text-primary")}>{a.delivery_status?.code === 200 ? "Pronto" : "Processando"}</span>
              </div>
            ))}
          </div>
        )}
      </SpotlightCard>

      <div className="xl:sticky xl:top-6">
        <SpotlightCard className="p-5 space-y-4">
          <div className="flex items-center gap-2"><Globe2  className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold">Criar Público de Site</h2></div>
          <NameInput value={audienceName} onChange={setAudienceName} placeholder="Ex: Visitantes Site 30d" />

          <div className="space-y-1.5">
            <Label  className="text-xs font-semibold text-foreground/70">Pixel *</Label>
            {pixels.length === 0 ? <p className="text-xs text-foreground/40">Nenhum pixel encontrado nesta conta</p> : (
              <div className="space-y-1">
                {pixels.map(p => (
                  <button key={p.id} onClick={() => setPixelId(p.id)} className={cn("w-full text-left px-3 py-2 rounded-lg border text-xs transition-all",
                    pixelId === p.id ? "border-primary/20 bg-primary/10 text-primary" : "border-white/8 bg-white/[0.02] text-foreground/70 hover:text-foreground")}>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-foreground/40 ml-2 font-mono text-[10px]">{p.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label  className="text-xs font-semibold text-foreground/70">Tipo de Visitante</Label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: "ALL_VISITORS", l: "Todos os visitantes" }, { v: "SPECIFIC_PAGE", l: "Página específica" }].map(o => (
                <button key={o.v} onClick={() => setEventFilter(o.v as any)} className={cn("py-2 px-3 rounded-lg border text-xs font-semibold transition-all",
                  eventFilter === o.v ? "border-primary/20 bg-primary/10 text-primary" : "border-white/10 bg-white/[0.02] text-foreground/60 hover:text-foreground")}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {eventFilter === "SPECIFIC_PAGE" && (
            <div className="space-y-1.5">
              <Label  className="text-xs font-semibold text-foreground/70">URL contém (texto)</Label>
              <Input value={urlMatch} onChange={e => setUrlMatch(e.target.value)} placeholder="Ex: /obrigado, /checkout" className="bg-black/30 border-white/10 text-sm h-9" />
            </div>
          )}

          <RetentionPicker value={retentionDays} onChange={setRetentionDays} />
          <AnimatePresence><ResultBanner result={result} /></AnimatePresence>
          <Button onClick={handleCreate} disabled={creating || !audienceName.trim() || !pixelId} className="w-full bg-primary/10 hover:bg-primary/10 border-0 font-bold gap-2">
            {creating ? <><Loader2 className="h-4 w-4 animate-spin" />Criando...</> : <><Plus className="h-4 w-4" />Criar Público</>}
          </Button>
        </SpotlightCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5 — LISTA DE CLIENTES
// ═══════════════════════════════════════════════════════════════════════════════
function TabCustomerList({ audiences }: { audiences: CustomAudience[] }) {
  const [audienceName, setAudienceName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; id?: string; error?: string } | null>(null);

  const [syncId, setSyncId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success?: boolean; message?: string; total_emails?: number; received?: number; error?: string } | null>(null);

  const customAudiences = audiences.filter(a => a.subtype === "CUSTOM");

  const handleCreate = async () => {
    if (!audienceName.trim()) return;
    setCreating(true); setResult(null);
    try {
      const data = await postAudience({ name: audienceName, description, subtype: "CUSTOM", customer_file_source: "USER_PROVIDED_ONLY" });
      setResult({ success: true, id: data.data?.id });
      setAudienceName(""); setDescription("");
      mutate("/api/meta/custom-audiences");
    } catch (e: any) { setResult({ error: e.message }); } finally { setCreating(false); }
  };

  const handleSync = async () => {
    if (!syncId) return;
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch("/api/meta/sync-audience-clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience_id: syncId }) });
      const data = await res.json();
      setSyncResult(data);
    } catch (e: any) { setSyncResult({ error: String(e) }); } finally { setSyncing(false); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Create list */}
      <SpotlightCard className="p-6 space-y-4">
        <div className="flex items-center gap-2"><Users  className="h-5 w-5 text-primary" /><h2 className="font-bold">Nova Lista de Clientes</h2></div>
        <p className="text-sm text-foreground/60">Crie uma lista vazia e depois use "Sincronizar CRM" para populá-la com emails dos contratos ativos.</p>
        <NameInput value={audienceName} onChange={setAudienceName} placeholder="Ex: Clientes Ativos Comarka" />
        <div className="space-y-1.5">
          <Label  className="text-xs font-semibold text-foreground/70">Descrição (opcional)</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Lista de emails dos clientes ativos" className="bg-black/30 border-white/10 text-sm h-9" />
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-foreground/60">
          Após criar, use <strong className="text-foreground">Sincronizar CRM</strong> ao lado para enviar os emails automaticamente.
        </div>
        <AnimatePresence><ResultBanner result={result} /></AnimatePresence>
        <Button onClick={handleCreate} disabled={creating || !audienceName.trim()} className="w-full bg-primary/10 hover:bg-primary/10 border-0 font-bold gap-2">
          {creating ? <><Loader2 className="h-4 w-4 animate-spin" />Criando...</> : <><Plus className="h-4 w-4" />Criar Lista</>}
        </Button>
      </SpotlightCard>

      {/* Sync CRM */}
      <SpotlightCard className="p-6 space-y-4">
        <div className="flex items-center gap-2"><Link2  className="h-5 w-5 text-primary" /><h2 className="font-bold">Sincronizar CRM → Meta</h2></div>
        <p className="text-sm text-foreground/60">Busca todos os emails de contratos ativos e leads convertidos e envia para um público do Meta para exclusão de campanhas de aquisição.</p>
        <div className="space-y-1.5">
          <Label  className="text-xs font-semibold text-foreground/70">Público de Destino</Label>
          {customAudiences.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-foreground/40">Crie uma lista primeiro →</div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {customAudiences.map(a => (
                <button key={a.id} onClick={() => setSyncId(a.id)} className={cn("w-full text-left px-3 py-2 rounded-lg border text-xs transition-all",
                  syncId === a.id ? "border-primary/20 bg-primary/10 text-primary" : "border-white/8 bg-white/[0.02] text-foreground/70 hover:text-foreground")}>
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {syncResult && (
          <div className={cn("rounded-lg border p-3 flex gap-2 animate-in fade-in zoom-in-95 duration-200",
            syncResult.success ? "border-primary/20 bg-primary/10" : "border-primary/20 bg-primary/10")}>
            {syncResult.success ? <CheckCircle2  className="h-4 w-4 text-primary shrink-0 mt-0.5" /> : <AlertCircle  className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
            <div>
              <p className="text-xs font-semibold">{syncResult.success ? "Sincronizado!" : "Erro"}</p>
              <p className="text-[10px] text-foreground/50 mt-0.5">{syncResult.message || syncResult.error}</p>
              {syncResult.total_emails && <p className="text-[10px] text-foreground/40">{syncResult.received}/{syncResult.total_emails} emails aceitos</p>}
            </div>
          </div>
        )}
        <Button onClick={handleSync} disabled={syncing || !syncId} className="w-full bg-primary/10 hover:bg-primary/10 border-0 font-bold gap-2">
          {syncing ? <><Loader2 className="h-4 w-4 animate-spin" />Sincronizando...</> : <><RefreshCw className="h-4 w-4" />Sincronizar Agora</>}
        </Button>
      </SpotlightCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AudienceManagerPage() {
  const [activeTab, setActiveTab] = useState<Tab>("hub");

  const { data: audiencesData, isLoading: audiencesLoading } = useSWR<{ data: CustomAudience[] }>(
    "/api/meta/custom-audiences", fetcher, { revalidateOnFocus: false }
  );
  const audiences = audiencesData?.data || [];

  const stats = useMemo(() => ({
    total:      audiences.length,
    video:      audiences.filter(a => a.subtype === "VIDEO").length,
    engagement: audiences.filter(a => a.subtype === "ENGAGEMENT" || a.subtype === "IG_BUSINESS").length,
    website:    audiences.filter(a => a.subtype === "WEBSITE").length,
    custom:     audiences.filter(a => a.subtype === "CUSTOM").length,
    lookalike:  audiences.filter(a => a.subtype === "LOOKALIKE").length,
  }), [audiences]);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" /> Audience Hub
          </h1>
          <p className="text-sm text-foreground/60 mt-1">Central de públicos personalizados — crie, gerencie e sincronize todos os tipos.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate("/api/meta/custom-audiences")} className="gap-1.5 border-white/15 text-foreground/70 hover:text-foreground bg-transparent shrink-0">
          <RefreshCw className={cn("h-3.5 w-3.5", audiencesLoading && "animate-spin")} />
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: "Total",       value: stats.total,      color: "text-primary"  },
          { label: "Video View",  value: stats.video,      color: "text-primary"    },
          { label: "Engajamento", value: stats.engagement, color: "text-primary"    },
          { label: "Site",        value: stats.website,    color: "text-primary" },
          { label: "Listas",      value: stats.custom,     color: "text-primary"   },
          { label: "Lookalike",   value: stats.lookalike,  color: "text-primary"  },
        ].map(k => (
          <SpotlightCard key={k.label} className="p-3 text-center space-y-0.5">
            <p className={cn("text-xl font-black", k.color)}>{k.value}</p>
            <p className="text-[9px] uppercase tracking-[0.12em] text-foreground/50">{k.label}</p>
          </SpotlightCard>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-black/30 border border-white/[0.06] overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={cn("flex-1 min-w-max flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
              activeTab === t.id ? "bg-white/[0.08] text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground hover:bg-white/[0.04]")}>
              <Icon className={cn("h-3.5 w-3.5 shrink-0", activeTab === t.id ? t.color : "")} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "hub"          && <TabHub audiences={audiences} isLoading={audiencesLoading} onRefresh={() => mutate("/api/meta/custom-audiences")} />}
        {activeTab === "video"        && <TabVideoView audiences={audiences} />}
        {activeTab === "engagement"   && <TabEngagement audiences={audiences} />}
        {activeTab === "pixel"        && <TabPixel audiences={audiences} />}
        {activeTab === "customerlist" && <TabCustomerList audiences={audiences} />}
      </div>
    </div>
  );
}
