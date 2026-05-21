"use client";

import React, { useState } from "react";
import { Heart, MessageCircle, Send, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Saiba Mais",
  SHOP_NOW: "Comprar Agora",
  SIGN_UP: "Cadastre-se",
  GET_QUOTE: "Solicitar Orçamento",
  CONTACT_US: "Fale Conosco",
  DOWNLOAD: "Baixar",
  BOOK_TRAVEL: "Reservar",
  WATCH_MORE: "Assistir Mais",
  APPLY_NOW: "Candidatar-se",
  SUBSCRIBE: "Assinar",
};

type PreviewMode = "feed" | "stories";

interface CarouselCard { id: string; headline: string; url: string; image_hash?: string; image_url?: string; }

interface AdPreviewProps {
  pageName: string;
  instagramHandle?: string;
  copy: string;
  headline: string;
  description: string;
  ctaType: string;
  format: "SINGLE_IMAGE" | "SINGLE_VIDEO" | "CAROUSEL";
  imageHash?: string;
  imageUrl?: string;
  videoId?: string;
  carouselCards?: CarouselCard[];
  url?: string;
}

function MediaBlock({ format, imageHash, imageUrl, videoId, carouselCards, mode }: {
  format: string; imageHash?: string; imageUrl?: string; videoId?: string;
  carouselCards?: CarouselCard[]; mode: PreviewMode;
}) {
  const [cardIdx, setCardIdx] = useState(0);
  const aspectClass = mode === "stories" ? "aspect-[9/16]" : "aspect-square";

  if (format === "CAROUSEL" && carouselCards && carouselCards.length > 0) {
    const card = carouselCards[cardIdx];
    return (
      <div className={`relative w-full ${aspectClass} bg-card flex items-center justify-center`}>
        <div className="absolute inset-0 flex items-center justify-center opacity-70">
          {card?.image_url ? (
            <img src={card.image_url} alt="Carousel Media" className="w-full h-full object-cover" />
          ) : (
            <div className="w-12 h-12 border-2 border-zinc-400 rounded" />
          )}
        </div>
        <div className="relative z-10 w-full px-3 pb-2 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-foreground text-xs font-semibold truncate">{card?.headline || `Card ${cardIdx + 1}`}</p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setCardIdx((i) => Math.max(0, i - 1))} disabled={cardIdx === 0}
              className="w-6 h-6 bg-black/5 dark:bg-black/50 rounded-full flex items-center justify-center disabled:opacity-30">
              <ChevronLeft  className="h-3 w-3 text-foreground" />
            </button>
            <span className="text-[10px] text-foreground/90">{cardIdx + 1}/{carouselCards.length}</span>
            <button onClick={() => setCardIdx((i) => Math.min(carouselCards.length - 1, i + 1))} disabled={cardIdx === carouselCards.length - 1}
              className="w-6 h-6 bg-black/5 dark:bg-black/50 rounded-full flex items-center justify-center disabled:opacity-30">
              <ChevronRight  className="h-3 w-3 text-foreground" />
            </button>
          </div>
        </div>
        {/* Dots indicator */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 pb-1">
          {carouselCards.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === cardIdx ? "bg-accent" : "bg-zinc-600"}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${aspectClass} bg-gradient-to-br from-zinc-800 via-zinc-750 to-zinc-900 flex items-center justify-center overflow-hidden`}>
      {format === "SINGLE_VIDEO" ? (
        <div className="flex flex-col items-center gap-2 z-20">
          <div className="w-16 h-16 border-[3px] border-border bg-black/5 dark:bg-black/40 rounded-full flex items-center justify-center backdrop-blur-md cursor-pointer hover:scale-105 transition-transform shadow-2xl">
            <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[16px] border-l-white border-b-[10px] border-b-transparent ml-1" />
          </div>
          <span className="text-foreground/80 text-[10px] font-bold tracking-widest uppercase drop-shadow-md">Trailer</span>
          {imageUrl && <img src={imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 z-0" />}
        </div>
      ) : imageUrl ? (
        <img src={imageUrl} alt="Ad Cover" className="absolute inset-0 w-full h-full object-cover opacity-90" />
      ) : (
        <div className="flex flex-col items-center gap-2 opacity-30">
          <div className="w-12 h-12 border-2 border-zinc-400 rounded-lg flex items-center justify-center">
            <div className="w-6 h-4 border border-zinc-400 rounded-sm" />
          </div>
          <span className="text-foreground/90 text-[10px]">{imageHash ? `Hash: ${imageHash.slice(0, 8)}...` : "Imagem"}</span>
        </div>
      )}
    </div>
  );
}

export function AdPreview({ pageName, instagramHandle, copy, headline, description, ctaType, format, imageHash, imageUrl, videoId, carouselCards, url }: AdPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>("feed");
  const displayName = instagramHandle || pageName || "Sua Página";

  return (
    <div className="space-y-3">
      {/* Mode Switcher */}
      <div className="flex gap-1 bg-black/5 dark:bg-black/20 p-1 rounded-lg">
        {(["feed", "stories"] as PreviewMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 text-xs py-1 rounded-md capitalize transition-all ${mode === m ? "bg-black/10 dark:bg-white/10 text-foreground" : "text-foreground/90 hover:text-foreground/90"}`}>
            {m === "feed" ? "Feed" : "Stories"}
          </button>
        ))}
      </div>

      {/* Preview Card */}
      <div className={`rounded-xl overflow-hidden border border-zinc-700 bg-[#1c1e21] shadow-2xl ${mode === "stories" ? "max-w-[280px]" : "max-w-[360px]"} mx-auto transition-all duration-500 will-change-auto`}>
        {mode === "stories" ? (
          <div className="relative">
            <MediaBlock format={format} imageHash={imageHash} imageUrl={imageUrl} videoId={videoId} carouselCards={carouselCards} mode={mode} />
            <div className="absolute top-2 left-2 right-2 flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-primary flex-shrink-0 border border-border" />
              <span className="text-foreground text-[10px] font-semibold drop-shadow">{displayName}</span>
              <span className="text-foreground/90 text-[9px] ml-1">· Pub.</span>
            </div>
            <div className="absolute bottom-3 left-2 right-2">
              <button className="w-full text-center text-[11px] font-semibold bg-white/90 text-black rounded-full py-1">
                {CTA_LABELS[ctaType] || "Saiba Mais"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-primary flex-shrink-0" />
                <div>
                  <div className="text-foreground text-xs font-semibold leading-tight">{displayName}</div>
                  <div className="text-foreground/90 text-[10px]">Publicidade</div>
                </div>
              </div>
              <MoreHorizontal  className="h-4 w-4 text-foreground/90" />
            </div>
            {copy && <div className="px-3 pb-2 text-foreground text-xs leading-relaxed line-clamp-3">{copy}</div>}
            <MediaBlock format={format} imageHash={imageHash} imageUrl={imageUrl} videoId={videoId} carouselCards={carouselCards} mode={mode} />
            <div className="px-3 py-2 border-t border-border flex items-center justify-between bg-muted/50">
              <div className="min-w-0 flex-1 mr-3">
                {url && <div className="text-foreground/90 text-[9px] uppercase truncate">{url.replace(/https?:\/\//, "")}</div>}
                {headline && <div className="text-foreground text-xs font-semibold leading-tight truncate">{headline}</div>}
                {description && <div className="text-foreground/90 text-[10px] truncate">{description}</div>}
              </div>
              <button className="flex-shrink-0 text-[11px] font-semibold bg-primary/20 text-primary hover:bg-primary/30 text-foreground px-2.5 py-1 rounded transition-colors whitespace-nowrap">
                {CTA_LABELS[ctaType] || "Saiba Mais"}
              </button>
            </div>
            <div className="px-3 py-2 flex items-center gap-4 border-t border-border">
              {[{ icon: Heart, label: "Curtir" }, { icon: MessageCircle, label: "Comentar" }, { icon: Send, label: "Enviar" }].map(({ icon: Icon, label }) => (
                <button key={label} className="flex items-center gap-1 text-foreground/90 hover:text-foreground transition-colors">
                  <Icon className="h-3.5 w-3.5" /> <span className="text-[10px]">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <p className="text-[9px] text-foreground/90 text-center">A exibição pode variar por dispositivo e formato.</p>
    </div>
  );
}
