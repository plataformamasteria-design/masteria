"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, Monitor, Smartphone, Camera,
  Image as ImageIcon, Video, Layers, ExternalLink, Copy,
  ChevronLeft, ChevronRight, Play, Link2, Maximize2, RefreshCw,
  AlertTriangle, Globe2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type CreativeType = "IMAGE" | "VIDEO" | "CAROUSEL" | "UNKNOWN";

type AdPreviewFormat =
  | "MOBILE_FEED_STANDARD"
  | "DESKTOP_FEED_STANDARD"
  | "INSTAGRAM_STANDARD"
  | "INSTAGRAM_STORY"
  | "INSTAGRAM_REELS"
  | "FACEBOOK_STORY";

interface CarouselCard {
  index: number;
  headline: string;
  description?: string;
  link?: string;
  image_url?: string;
  video_id?: string;
  cta_type?: string;
}

interface CreativeDetails {
  copy?: string;
  headline?: string;
  description?: string;
  link?: string;
  image_url?: string;
  thumbnail_url?: string;
  video_id?: string;
  cta_type?: string;
  cta_link?: string;
  page_id?: string;
  instagram_actor_id?: string;
  cards?: CarouselCard[];
}

interface AdCreativeData {
  ad: { id: string; name: string; status: string; effective_status: string };
  creative_id: string;
  creative_type: CreativeType;
  creative_details: CreativeDetails;
  preview_html: string | null;
}

// ── Format Options ─────────────────────────────────────────────────────────────
const FORMATS: {
  value: AdPreviewFormat;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  platform: "facebook" | "instagram";
  color: string;
}[] = [
  { value: "MOBILE_FEED_STANDARD", label: "Feed Mobile", sublabel: "Facebook", icon: Globe2, platform: "facebook", color: "#1877F2" },
  { value: "DESKTOP_FEED_STANDARD", label: "Feed Desktop", sublabel: "Facebook", icon: Monitor, platform: "facebook", color: "#1877F2" },
  { value: "INSTAGRAM_STANDARD", label: "Feed", sublabel: "Instagram", icon: Camera, platform: "instagram", color: "#E1306C" },
  { value: "INSTAGRAM_STORY", label: "Stories", sublabel: "Instagram", icon: Smartphone, platform: "instagram", color: "#C13584" },
  { value: "INSTAGRAM_REELS", label: "Reels", sublabel: "Instagram", icon: Play, platform: "instagram", color: "#833AB4" },
  { value: "FACEBOOK_STORY", label: "Stories", sublabel: "Facebook", icon: Smartphone, platform: "facebook", color: "#1877F2" },
];

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Saiba Mais",
  SHOP_NOW: "Comprar Agora",
  SIGN_UP: "Cadastre-se",
  DOWNLOAD: "Baixar",
  GET_QUOTE: "Obter Cotação",
  SUBSCRIBE: "Assinar",
  CONTACT_US: "Entre em Contato",
  WATCH_MORE: "Assistir Mais",
  BOOK_NOW: "Reserve Agora",
  APPLY_NOW: "Candidatar-se",
  GET_OFFER: "Ver Oferta",
  SEND_MESSAGE: "Enviar Mensagem",
  WHATSAPP_MESSAGE: "WhatsApp",
  CALL_NOW: "Ligar Agora",
  SEE_MORE: "Ver Mais",
  MESSAGE_PAGE: "Enviar Mensagem",
};

const TYPE_CONFIG: Record<CreativeType, { label: string; icon: React.ElementType; color: string }> = {
  IMAGE: { label: "Imagem", icon: ImageIcon, color: "text-primary" },
  VIDEO: { label: "Vídeo", icon: Video, color: "text-primary" },
  CAROUSEL: { label: "Carrossel", icon: Layers, color: "text-primary" },
  UNKNOWN: { label: "Desconhecido", icon: AlertTriangle, color: "text-foreground/90" },
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Preview iframe ─────────────────────────────────────────────────────────────
function PreviewIframe({ adId, format }: { adId: string; format: AdPreviewFormat }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeHeight, setIframeHeight] = useState(600);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    setIframeHeight(600); // altura default enquanto carrega
    setIframeKey(k => k + 1);
  }, [adId, format]);

  // Escutar postMessage do iframe filho (altura real do preview do Meta)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "metaPreviewHeight" && typeof e.data.height === "number") {
        const h = Math.max(200, Math.min(e.data.height + 16, 1200)); // clamp 200-1200
        setIframeHeight(h);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const isStory = format.includes("STORY") || format.includes("REELS");
  const isDesktop = format === "DESKTOP_FEED_STANDARD";
  // Aumentar as larguras para dar margem e evitar scroll horizontal no ifame filho
  const frameWidth = isDesktop ? 600 : isStory ? 360 : 450;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Container do iframe — sem overflow, altura se ajusta ao conteúdo */}
      <div
        className="relative w-full flex justify-center"
        style={{ maxWidth: frameWidth }}
      >
        {loading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 rounded-2xl z-10 gap-3"
            style={{ minHeight: 300 }}
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-foreground/90 font-mono">Carregando preview via Meta...</p>
          </div>
        )}
        {error && !loading && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 rounded-2xl z-10 gap-3 p-6 text-center"
            style={{ minHeight: 300 }}
          >
            <AlertTriangle  className="h-8 w-8 text-primary" />
            <p className="text-sm text-foreground/90">{error}</p>
            <button
              onClick={() => { setIframeKey(k => k + 1); setLoading(true); setError(""); }}
              className="text-xs text-primary hover:text-accent/70 underline"
            >
              Tentar novamente
            </button>
          </div>
        )}
        {/* iframe sem scroll próprio — altura dinâmica por postMessage */}
        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={`/api/meta/ad-preview?ad_id=${adId}&format=${format}`}
          className="w-full border-0 rounded-2xl"
          style={{
            height: loading ? 0 : iframeHeight,
            opacity: loading ? 0 : 1,
            transition: "opacity 0.4s ease, height 0.3s ease",
            overflow: "hidden",
            display: "block",
          }}
          scrolling="no"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError("Não foi possível carregar o preview. Verifique se o anúncio está ativo e o token tem permissão de ads_read.");
          }}
          sandbox="allow-scripts allow-same-origin allow-popups"
          title="Ad Preview"
        />
      </div>
      <a
        href={`https://www.facebook.com/ads/library/`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-foreground/90 hover:text-foreground/90 flex items-center gap-1 transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Preview oficial via Meta Graph API
      </a>
    </div>
  );
}

// ── Creative Details Panel ─────────────────────────────────────────────────────
function CreativePanel({ data }: { data: AdCreativeData }) {
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { creative_type, creative_details: d } = data;
  const typeConf = TYPE_CONFIG[creative_type];

  const handleCopy = (text: string, key: string) => {
    copyToClipboard(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const cards = d.cards || [];
  const currentCard = cards[carouselIdx];

  return (
    <div className="space-y-4 text-sm">
      {/* Type badge */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/5">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.04]`}>
          <typeConf.icon className={`h-4 w-4 ${typeConf.color}`} />
          <span className="text-xs font-bold text-foreground/90">{typeConf.label}</span>
        </div>
        {d.cta_type && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/20 bg-accent/5">
            <span className="text-xs font-bold text-accent/70">{CTA_LABELS[d.cta_type] || d.cta_type}</span>
          </div>
        )}
      </div>

      {/* Copy / Texto */}
      {d.copy && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/90">Texto Principal (Copy)</label>
            <button
              onClick={() => handleCopy(d.copy!, "copy")}
              className="flex items-center gap-1 text-[10px] text-foreground/90 hover:text-foreground/90 transition-colors"
            >
              <Copy className="h-3 w-3" />
              {copiedKey === "copy" ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-foreground/90 text-xs leading-relaxed whitespace-pre-wrap">
            {d.copy}
          </div>
        </div>
      )}

      {/* Headline */}
      {d.headline && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/90">Título (Headline)</label>
            <button onClick={() => handleCopy(d.headline!, "headline")} className="flex items-center gap-1 text-[10px] text-foreground/90 hover:text-foreground/90 transition-colors">
              <Copy className="h-3 w-3" /> {copiedKey === "headline" ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-foreground text-sm font-semibold">
            {d.headline}
          </div>
        </div>
      )}

      {/* Description */}
      {d.description && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/90">Descrição</label>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-foreground/90 text-xs">
            {d.description}
          </div>
        </div>
      )}

      {/* Link de destino */}
      {(d.cta_link || d.link) && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/90">URL de Destino</label>
          <a
            href={d.cta_link || d.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 text-primary text-xs hover:text-accent/70 hover:border-primary/20 transition-colors truncate"
          >
            <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{d.cta_link || d.link}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0 ml-auto" />
          </a>
        </div>
      )}

      {/* Video thumbnail */}
      {creative_type === "VIDEO" && (d.thumbnail_url || d.image_url) && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/90">Thumbnail do Vídeo</label>
          <div className="relative rounded-xl overflow-hidden border border-white/8 bg-zinc-900">
            <img
              src={d.thumbnail_url || d.image_url}
              alt="Thumbnail"
              className="w-full object-cover"
              style={{ maxHeight: 140 }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Play  className="h-5 w-5 text-foreground fill-white" />
              </div>
            </div>
          </div>
          {d.video_id && (
            <p className="text-[10px] text-foreground/90 font-mono">Video ID: {d.video_id}</p>
          )}
        </div>
      )}

      {/* Imagem (IMAGE type) */}
      {creative_type === "IMAGE" && d.image_url && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/90">Imagem do Anúncio</label>
          <div className="rounded-xl overflow-hidden border border-white/8 bg-zinc-900">
            <img
              src={d.image_url}
              alt="Creative"
              className="w-full object-cover"
              style={{ maxHeight: 160 }}
            />
          </div>
        </div>
      )}

      {/* Carousel Cards */}
      {creative_type === "CAROUSEL" && cards.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/90">
              Cards do Carrossel ({cards.length})
            </label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCarouselIdx(i => Math.max(0, i - 1))}
                disabled={carouselIdx === 0}
                className="h-6 w-6 flex items-center justify-center rounded-md bg-white/5 text-foreground/90 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs text-foreground/90 w-10 text-center">{carouselIdx + 1}/{cards.length}</span>
              <button
                onClick={() => setCarouselIdx(i => Math.min(cards.length - 1, i + 1))}
                disabled={carouselIdx === cards.length - 1}
                className="h-6 w-6 flex items-center justify-center rounded-md bg-white/5 text-foreground/90 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Dots navigation */}
          <div className="flex gap-1.5 justify-center py-1">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => setCarouselIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === carouselIdx ? "w-5 bg-white" : "w-1.5 bg-white/20"}`}
              />
            ))}
          </div>

          {currentCard && (
            <motion.div
              key={carouselIdx}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden"
            >
              {(currentCard.image_url || currentCard.video_id) && (
                <div className="relative bg-zinc-900">
                  {currentCard.image_url && (
                    <img src={currentCard.image_url} alt={`Card ${carouselIdx + 1}`} className="w-full object-cover" style={{ maxHeight: 120 }} />
                  )}
                  {currentCard.video_id && !currentCard.image_url && (
                    <div className="h-24 flex items-center justify-center bg-zinc-800">
                      <Video  className="h-8 w-8 text-foreground/90" />
                      <p className="text-xs text-foreground/90 ml-2">Vídeo #{currentCard.video_id}</p>
                    </div>
                  )}
                </div>
              )}
              <div className="p-3 space-y-1">
                {currentCard.headline && <p className="text-xs font-bold text-foreground">{currentCard.headline}</p>}
                {currentCard.description && <p className="text-[11px] text-foreground/90">{currentCard.description}</p>}
                {currentCard.cta_type && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-foreground/90">{currentCard.link || ""}</span>
                    <span className="text-[10px] font-bold text-primary border border-primary/20 px-2 py-0.5 rounded">
                      {CTA_LABELS[currentCard.cta_type] || currentCard.cta_type}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* IDs técnicos */}
      <div className="pt-2 border-t border-white/5 space-y-1">
        <p className="text-[10px] text-foreground/90">Creative ID: <span className="font-mono text-foreground/90">{data.creative_id}</span></p>
        {d.page_id && <p className="text-[10px] text-foreground/90">Page ID: <span className="font-mono text-foreground/90">{d.page_id}</span></p>}
        {d.instagram_actor_id && <p className="text-[10px] text-foreground/90">Instagram Account: <span className="font-mono text-foreground/90">{d.instagram_actor_id}</span></p>}
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export interface AdPreviewModalProps {
  adId: string;
  adName: string;
  onClose: () => void;
}

export function AdPreviewModal({ adId, adName, onClose }: AdPreviewModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<AdPreviewFormat>("MOBILE_FEED_STANDARD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<AdCreativeData | null>(null);
  const [activePlatform, setActivePlatform] = useState<"all" | "facebook" | "instagram">("all");

  // Fetch creative data
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    
    fetch(`/api/meta/ad-creative-full?ad_id=${adId}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch(e => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    
    return () => { cancelled = true; };
  }, [adId]);

  const filteredFormats = FORMATS.filter(f =>
    activePlatform === "all" || f.platform === activePlatform
  );

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal - fixo no centro, scroll interno */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[2001] flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxWidth: 1100, maxHeight: "95vh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-950">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-transparent flex items-center justify-center flex-shrink-0">
                <Maximize2  className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground truncate">Preview do Anúncio</h2>
                <p className="text-[11px] text-foreground/90 truncate">{adName}</p>
              </div>
              {data && (
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  TYPE_CONFIG[data.creative_type].color === "text-primary" ? "bg-primary/10 border-primary/20 text-accent/70" :
                  TYPE_CONFIG[data.creative_type].color === "text-primary" ? "bg-primary/10 border-primary/20 text-primary" :
                  "bg-primary/10 border-primary/20 text-primary"
                }`}>
                  {React.createElement(TYPE_CONFIG[data.creative_type].icon, { className: "h-3 w-3" })}
                  {TYPE_CONFIG[data.creative_type].label}
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-foreground/90 hover:text-foreground transition-colors flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body - ÚNICA barra de rolagem em todo o modal */}
          <div className="flex-1 overflow-y-auto flex bg-zinc-950/50">
            {/* Left: Format selector + Preview */}
            <div className="flex-1 flex flex-col">
              {/* Platform filter tabs */}
              <div className="flex-shrink-0 flex items-center gap-2 px-5 pt-4 pb-2">
                {([
                  { key: "all" as const, label: "Todos" },
                  { key: "facebook" as const, label: "Facebook" },
                  { key: "instagram" as const, label: "Instagram" },
                ] as { key: "all" | "facebook" | "instagram"; label: string }[]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActivePlatform(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      activePlatform === tab.key
                        ? "border-white/20 bg-white/10 text-foreground"
                        : "border-transparent text-foreground/90 hover:text-foreground/90"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <span className="ml-auto text-[10px] text-foreground/90">Clique para trocar o formato</span>
              </div>

              {/* Format grid */}
              <div className="flex-shrink-0 grid grid-cols-3 gap-2 px-5 pb-3">
                {filteredFormats.map(fmt => {
                  const isActive = selectedFormat === fmt.value;
                  return (
                    <button
                      key={fmt.value}
                      onClick={() => setSelectedFormat(fmt.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                        isActive
                          ? "border-white/25 bg-white/10 text-foreground"
                          : "border-white/5 bg-white/[0.02] text-foreground/90 hover:border-white/10 hover:text-foreground/90"
                      }`}
                    >
                      <div
                        className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: isActive ? fmt.color + "25" : "transparent" }}
                      >
                        <fmt.icon className="h-4 w-4" style={{ color: isActive ? fmt.color : undefined }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold truncate">{fmt.label}</p>
                        <p className="text-[10px] text-foreground/90 truncate">{fmt.sublabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Área de preview — sem scroll próprio, cresce para caber o iframe */}
              <div className="flex items-start justify-center px-5 pb-6">
                {loading ? (
                  <div className="flex flex-col items-center gap-4 py-16">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-xs text-foreground/90 font-mono">Carregando criativo via Graph API...</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center max-w-xs">
                    <AlertTriangle  className="h-8 w-8 text-primary" />
                    <p className="text-sm text-foreground/90">{error}</p>
                  </div>
                ) : (
                  <PreviewIframe adId={adId} format={selectedFormat} />
                )}
              </div>
            </div>

            {/* Right: Creative Details */}
            <div className="w-80 flex-shrink-0 border-l border-white/5 flex flex-col bg-[#09090b]">
              <div className="flex-shrink-0 px-5 py-4 border-b border-white/5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/90">Detalhes do Criativo</h3>
              </div>
              <div className="flex-1 px-5 py-4">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
                    ))}
                  </div>
                ) : error ? (
                  <p className="text-xs text-foreground/90 text-center mt-8">Não foi possível carregar os detalhes.</p>
                ) : data ? (
                  <CreativePanel data={data} />
                ) : null}
              </div>

              {/* Footer actions */}
              <div className="flex-shrink-0 p-4 border-t border-white/5 space-y-2">
                <a
                  href={`https://business.facebook.com/adsmanager/manage/ads?selected_ad_ids=${adId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl border border-white/10 text-xs font-medium text-foreground/90 hover:text-foreground hover:border-white/20 hover:bg-white/5 transition-all"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir no Meta Ads Manager
                </a>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
