"use client";

import { useState, useMemo, useRef } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, RefreshCw, CheckCircle2, AlertCircle,
  ImageIcon, CheckSquare, Square, Zap, Film,
  Upload, Library, ChevronRight, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "Saiba Mais" },
  { value: "SHOP_NOW", label: "Comprar Agora" },
  { value: "SIGN_UP", label: "Cadastre-se" },
  { value: "DOWNLOAD", label: "Baixar" },
  { value: "CONTACT_US", label: "Fale Conosco" },
  { value: "GET_QUOTE", label: "Solicitar Orçamento" },
  { value: "BOOK_TRAVEL", label: "Reservar" },
  { value: "SUBSCRIBE", label: "Assinar" },
  { value: "SEND_MESSAGE", label: "Enviar Mensagem" },
];

interface BulkCreativeSwapProps {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}

interface AdEntry {
  id: string;
  name: string;
  adsetName: string;
  thumbnailUrl?: string;
}

type SwapResult = { ad_id: string; success: boolean; error?: string };
type MediaTab = "biblioteca" | "upload";

// ── Media Library Picker ────────────────────────────────────────────────────────
function MediaLibraryPicker({
  onSelect,
}: {
  onSelect: (imageHash: string, imageUrl: string) => void;
}) {
  const { data, isLoading } = useSWR("/api/meta/biblioteca-midias?type=IMAGE&limit=24", fetcher, {
    revalidateOnFocus: false,
  });
  const images: any[] = data?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-foreground/60">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-xs">Carregando biblioteca...</span>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-foreground/60">
        <Library className="h-8 w-8 opacity-30" />
        <p className="text-xs">Nenhuma imagem na biblioteca da conta.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
      {images.map((img: any) => (
        <button
          key={img.hash}
          onClick={() => onSelect(img.hash, img.url)}
          className="group relative aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-accent/60 transition-all bg-zinc-900"
          title={img.name}
        >
          <img
            src={img.url}
            alt={img.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-accent/0 group-hover:bg-primary/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <CheckCircle2 className="h-5 w-5 text-white drop-shadow" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Upload Panel ────────────────────────────────────────────────────────────────
function UploadPanel({
  onUploaded,
}: {
  onUploaded: (imageHash: string, imageUrl: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setErrorMsg("");
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/meta/upload-midia", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erro no upload");
      onUploaded(data.hash || data.image?.hash || "", data.url || data.image?.url || "");
    } catch (e: any) {
      setErrorMsg(e.message);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 h-36 rounded-xl border-2 border-dashed border-white/15 hover:border-accent/50 cursor-pointer transition-all bg-white/[0.02] hover:bg-white/[0.04]"
      >
        {preview ? (
          <img src={preview} alt="preview" className="h-28 w-auto rounded object-contain" />
        ) : (
          <>
            <Upload className="h-8 w-8 text-foreground/40" />
            <p className="text-xs text-foreground/50">
              Clique para enviar imagem (JPG, PNG, GIF)
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {uploading && (
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Enviando para a Meta Media Library...
        </div>
      )}
      {errorMsg && (
        <p className="text-xs text-primary flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5" /> {errorMsg}
        </p>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────
export function BulkCreativeSwap({ campaignId, campaignName, onClose }: BulkCreativeSwapProps) {
  const { data: treeData, isLoading } = useSWR(
    `/api/meta/campaign-tree?campaign_id=${campaignId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Flatten all ads across adsets
  const allAds: AdEntry[] = useMemo(() => {
    const adsets: any[] = treeData?.data || [];
    return adsets.flatMap((as: any) =>
      (as.ads?.data || []).map((ad: any) => ({
        id: ad.id,
        name: ad.name,
        adsetName: as.name,
        thumbnailUrl: ad.creative?.thumbnail_url || ad.creative?.image_url,
      }))
    );
  }, [treeData]);

  // Pages dropdown
  const { data: pagesData } = useSWR("/api/meta/pages", fetcher, { revalidateOnFocus: false });
  const pages: any[] = pagesData?.data || [];

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleAd = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(selected.size === allAds.length ? new Set() : new Set(allAds.map((a) => a.id)));

  // Creative fields
  const [pageId, setPageId] = useState("");
  const [imageHash, setImageHash] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [videoId, setVideoId] = useState("");
  const [copy, setCopy] = useState("");
  const [headline, setHeadline] = useState("");
  const [url, setUrl] = useState("");
  const [ctaType, setCtaType] = useState("LEARN_MORE");

  // Media tab
  const [mediaTab, setMediaTab] = useState<MediaTab>("biblioteca");

  // Step: confirm before swap
  const [confirmStep, setConfirmStep] = useState(false);

  // Execution state
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SwapResult[] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const canSwap = selected.size > 0 && pageId && (imageHash || videoId || copy || headline);

  const handleSwap = async () => {
    if (!canSwap) return;
    setRunning(true);
    setErrorMsg("");
    setResults(null);
    try {
      const res = await fetch("/api/meta/trocar-criativos-massa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_ids: Array.from(selected),
          creative: {
            page_id: pageId,
            image_hash: imageHash || undefined,
            video_id: videoId || undefined,
            copy: copy || undefined,
            headline: headline || undefined,
            url: url || undefined,
            cta_type: ctaType,
          },
          shared_creative: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao trocar criativos");
      setResults(data.results || []);
      setConfirmStep(false);
    } catch (e: any) {
      setErrorMsg(e.message);
      setConfirmStep(false);
    } finally {
      setRunning(false);
    }
  };

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount = results?.filter((r) => !r.success).length ?? 0;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="w-full max-w-3xl max-h-[90vh] bg-zinc-950 border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-black/20 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              {confirmStep && (
                <button
                  onClick={() => setConfirmStep(false)}
                  className="text-foreground/60 hover:text-foreground transition-colors mr-1"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <Zap className="h-5 w-5 text-primary" />
              {confirmStep ? "Confirmar Troca de Criativos" : "Troca de Criativos em Massa"}
            </h2>
            <p className="text-xs text-foreground/60 mt-0.5 truncate max-w-md">{campaignName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Results View ── */}
          {results && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 p-4 rounded-xl bg-primary/10 border border-primary/20 text-center">
                  <p className="text-2xl font-bold text-primary">{successCount}</p>
                  <p className="text-xs text-foreground/60 mt-1">Sucesso</p>
                </div>
                {failCount > 0 && (
                  <div className="flex-1 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                    <p className="text-2xl font-bold text-red-400">{failCount}</p>
                    <p className="text-xs text-foreground/60 mt-1">Com erros</p>
                  </div>
                )}
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {results.map((r) => {
                  const adName = allAds.find((a) => a.id === r.ad_id)?.name || r.ad_id;
                  return (
                    <div
                      key={r.ad_id}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${
                        r.success
                          ? "border-primary/20 bg-accent/8"
                          : "border-red-500/20 bg-red-500/5"
                      }`}
                    >
                      {r.success
                        ? <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        : <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
                      <div>
                        <p className="font-semibold text-foreground">{adName}</p>
                        {r.error && <p className="text-xs text-red-400 mt-1">{r.error}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button onClick={onClose} className="w-full bg-accent hover:bg-accent text-foreground font-bold h-11 rounded-xl">
                Concluir
              </Button>
            </div>
          )}

          {/* ── Confirmation Step ── */}
          {!results && confirmStep && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/8 space-y-4">
                <h3 className="text-sm font-bold text-foreground">Resumo da Troca</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-foreground/50 uppercase tracking-widest mb-1">Anúncios</p>
                    <p className="font-bold text-foreground">{selected.size} selecionados</p>
                  </div>
                  <div>
                    <p className="text-foreground/50 uppercase tracking-widest mb-1">Página</p>
                    <p className="font-bold text-foreground">
                      {pages.find((p) => p.id === pageId)?.name || pageId}
                    </p>
                  </div>
                  {imageHash && (
                    <div className="col-span-2">
                      <p className="text-foreground/50 uppercase tracking-widest mb-1">Mídia Selecionada</p>
                      {imagePreviewUrl ? (
                        <img src={imagePreviewUrl} alt="" className="h-20 rounded-lg object-cover border border-white/10" />
                      ) : (
                        <p className="font-mono text-xs text-primary">{imageHash}</p>
                      )}
                    </div>
                  )}
                  {copy && (
                    <div className="col-span-2">
                      <p className="text-foreground/50 uppercase tracking-widest mb-1">Copy</p>
                      <p className="text-foreground/80 line-clamp-2">{copy}</p>
                    </div>
                  )}
                  {headline && (
                    <div>
                      <p className="text-foreground/50 uppercase tracking-widest mb-1">Headline</p>
                      <p className="font-bold text-foreground">{headline}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-foreground/50 uppercase tracking-widest mb-1">CTA</p>
                    <p className="font-bold text-foreground">
                      {CTA_OPTIONS.find((c) => c.value === ctaType)?.label || ctaType}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-accent/8 border border-primary/20">
                <p className="text-xs text-accent/70">
                  <strong>Atenção:</strong> Esta ação substituirá os criativos dos {selected.size} anúncios selecionados. Essa alteração é <strong>imediata e irreversível</strong> via este dashboard.
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {errorMsg}
                </div>
              )}
            </div>
          )}

          {/* ── Main Form ── */}
          {!results && !confirmStep && (
            <>
              {/* Ad Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground/60 font-bold text-xs uppercase tracking-wider">
                    Selecionar Anúncios ({selected.size}/{allAds.length})
                  </Label>
                  <button
                    onClick={toggleAll}
                    className="text-[11px] text-primary hover:text-accent/70 font-semibold transition-colors"
                  >
                    {selected.size === allAds.length ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center h-24">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {allAds.map((ad) => {
                      const isSelected = selected.has(ad.id);
                      return (
                        <motion.button
                          key={ad.id}
                          onClick={() => toggleAd(ad.id)}
                          whileTap={{ scale: 0.99 }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? "border-accent/50 bg-primary/10"
                              : "border-white/8 bg-white/4 hover:border-white/20"
                          }`}
                        >
                          <span className="shrink-0 text-primary">
                            {isSelected
                              ? <CheckSquare className="h-4 w-4" />
                              : <Square className="h-4 w-4 text-foreground/40" />}
                          </span>
                          {ad.thumbnailUrl
                            ? <img src={ad.thumbnailUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                            : <div className="h-8 w-8 rounded bg-white/5 flex items-center justify-center shrink-0">
                                <ImageIcon className="h-4 w-4 text-foreground/40" />
                              </div>}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{ad.name}</p>
                            <p className="text-[11px] text-foreground/50 truncate">{ad.adsetName}</p>
                          </div>
                        </motion.button>
                      );
                    })}
                    {allAds.length === 0 && !isLoading && (
                      <p className="text-center text-sm text-foreground/50 py-6">
                        Nenhum anúncio encontrado nesta campanha.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Creative Fields */}
              <div className="border border-white/8 rounded-2xl overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-white/5">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Novo Criativo</h3>
                  <p className="text-[11px] text-foreground/50 mt-1">Os campos preenchidos substituirão o criativo nos anúncios selecionados.</p>
                </div>
                <div className="p-5 space-y-4">

                  {/* Página */}
                  <div className="space-y-2">
                    <Label className="text-foreground/60 font-semibold text-xs">
                      Página do Facebook <span className="text-primary">*</span>
                    </Label>
                    {pages.length > 0 ? (
                      <Select value={pageId || "__NONE__"} onValueChange={(v) => setPageId(v === "__NONE__" ? "" : v)}>
                        <SelectTrigger className="bg-black/50 border-white/10 text-foreground rounded-xl h-11 text-xs">
                          <SelectValue placeholder="Selecionar página..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__NONE__">Selecionar página...</SelectItem>
                          {pages.map((pg: any) => (
                            <SelectItem key={pg.id} value={pg.id}>
                              {pg.name} — <span className="font-mono text-foreground/60">{pg.id}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={pageId}
                        onChange={(e) => setPageId(e.target.value)}
                        placeholder="ID da Página do Facebook"
                        className="bg-black/50 border-white/10 text-foreground rounded-xl h-11 font-mono"
                      />
                    )}
                  </div>

                  {/* Media: Biblioteca ou Upload */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground/60 font-semibold text-xs flex items-center gap-2">
                        <ImageIcon className="h-3.5 w-3.5" /> Mídia
                      </Label>
                      {/* Tab toggle */}
                      <div className="flex gap-0.5 bg-white/5 rounded-lg p-0.5 border border-white/8">
                        <button
                          onClick={() => setMediaTab("biblioteca")}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                            mediaTab === "biblioteca"
                              ? "bg-accent text-white"
                              : "text-foreground/60 hover:text-foreground"
                          }`}
                        >
                          <Library className="h-3 w-3" /> Biblioteca
                        </button>
                        <button
                          onClick={() => setMediaTab("upload")}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                            mediaTab === "upload"
                              ? "bg-accent text-white"
                              : "text-foreground/60 hover:text-foreground"
                          }`}
                        >
                          <Upload className="h-3 w-3" /> Upload
                        </button>
                      </div>
                    </div>

                    {/* Seleção atual */}
                    {imageHash && (
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/10 border border-primary/20">
                        {imagePreviewUrl && (
                          <img src={imagePreviewUrl} alt="" className="h-10 w-10 rounded object-cover border border-white/10" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-foreground/60">Imagem selecionada</p>
                          <p className="text-xs font-mono text-primary truncate">{imageHash}</p>
                        </div>
                        <button
                          onClick={() => { setImageHash(""); setImagePreviewUrl(""); }}
                          className="text-foreground/40 hover:text-foreground transition-colors text-xs"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {mediaTab === "biblioteca" ? (
                      <MediaLibraryPicker
                        onSelect={(hash, imgUrl) => {
                          setImageHash(hash);
                          setImagePreviewUrl(imgUrl);
                          setVideoId("");
                        }}
                      />
                    ) : (
                      <UploadPanel
                        onUploaded={(hash, imgUrl) => {
                          setImageHash(hash);
                          setImagePreviewUrl(imgUrl);
                          setVideoId("");
                        }}
                      />
                    )}

                    {/* Video ID manual */}
                    <div className="space-y-1.5">
                      <Label className="text-foreground/60 font-semibold text-xs flex items-center gap-2">
                        <Film className="h-3 w-3" /> Ou ID de Vídeo (alternativo)
                      </Label>
                      <Input
                        value={videoId}
                        onChange={(e) => {
                          setVideoId(e.target.value);
                          if (e.target.value) { setImageHash(""); setImagePreviewUrl(""); }
                        }}
                        placeholder="ID numérico do vídeo no Meta"
                        className="bg-black/50 border-white/10 text-foreground rounded-xl h-10 font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* Copy */}
                  <div className="space-y-2">
                    <Label className="text-foreground/60 font-semibold text-xs">Texto Principal (Copy)</Label>
                    <Textarea
                      value={copy}
                      onChange={(e) => setCopy(e.target.value)}
                      placeholder="Copy do anúncio..."
                      className="bg-black/40 border-white/10 text-foreground min-h-[80px] text-sm rounded-xl resize-none"
                    />
                  </div>

                  {/* Headline + URL */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-foreground/60 font-semibold text-xs">Título / Headline</Label>
                      <Input
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        placeholder="Título do anúncio"
                        className="bg-black/50 border-white/10 text-foreground rounded-xl h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-foreground/60 font-semibold text-xs">URL de Destino</Label>
                      <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://..."
                        className="bg-black/50 border-white/10 text-foreground rounded-xl h-10 font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="space-y-2">
                    <Label className="text-foreground/60 font-semibold text-xs">Botão de Ação (CTA)</Label>
                    <Select value={ctaType} onValueChange={setCtaType}>
                      <SelectTrigger className="bg-black/50 border-white/10 text-foreground rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CTA_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex items-start gap-3"
                      >
                        <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400">{errorMsg}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!results && (
          <div className="flex items-center justify-between p-5 border-t border-white/5 bg-black/20 flex-shrink-0">
            <p className="text-xs text-foreground/50">
              {selected.size} anúncio(s) selecionado(s)
            </p>

            {confirmStep ? (
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setConfirmStep(false)}
                  className="text-foreground/60 hover:text-foreground"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleSwap}
                  disabled={running}
                  className="bg-accent hover:bg-accent text-foreground font-bold h-11 px-8 rounded-xl"
                >
                  {running
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Aplicando...</>
                    : <><Zap className="h-4 w-4 mr-2" />Confirmar e Aplicar</>}
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setConfirmStep(true)}
                disabled={!canSwap}
                className="bg-accent hover:bg-accent text-foreground font-bold h-11 px-8 rounded-xl gap-2"
              >
                <ChevronRight className="h-4 w-4" />
                Revisar e Aplicar em {selected.size} Anúncio(s)
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
