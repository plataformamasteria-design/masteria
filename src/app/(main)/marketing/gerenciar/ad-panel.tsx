"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Image as ImageIcon, Film, LayoutGrid, Upload, Cloud, Loader2,
  Link, Tag, AlignLeft, Type, FileText, Layers, Radio, Eye, ImagePlay, Sparkles, ExternalLink,
  MessageCircle, CheckCircle2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdPreview } from "./ad-preview";
import type { AdNode, CarouselCard } from "./tree-builder";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

import { Section, MediaPicker, CarouselEditor, ChatPreview, MessageTemplateEditor } from "./ad-components";

// ── Main AdPanel ──
export function AdPanel({
  ad, pages, loadingPages, onChange,
}: {
  ad: AdNode; pages: any[]; loadingPages: boolean; onChange: (par: Partial<AdNode>) => void;
}) {
  const [imagePicker, setImagePicker] = useState(false);
  const [videoPicker, setVideoPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [manualIds, setManualIds] = useState(false);

  // Fetch Instagram accounts dedicated endpoint when page changes
  const { data: igData, isLoading: loadingIg } = useSWR(
    ad.page_id ? `/api/meta/instagram-accounts?page_id=${ad.page_id}` : null,
    fetcher,
  );
  const igAccounts: { id: string; username: string; name?: string }[] = igData?.data ? [...igData.data] : [];

  if (ad.instagram_actor_id && ad.instagram_actor_id !== "NONE" && !igAccounts.find(x => x.id === ad.instagram_actor_id)) {
    igAccounts.push({ id: ad.instagram_actor_id, username: `Conta Vinculada (${ad.instagram_actor_id})` });
  }

  const selectedPage = pages.find((p: any) => p.id === ad.page_id);
  const igHandle = igAccounts.find((ig) => ig.id === ad.instagram_actor_id)?.username
    || selectedPage?.instagram_business_account?.username;

  return (
    <div className="space-y-5">
      {/* ── Brand Identity ── */}
      <Section icon={<Layers className="h-4 w-4" />} title="Autoridade da Marca Mestre" accent="blue">
        <div className="flex justify-end mb-2">
          <label className="flex items-center gap-2 text-xs text-foreground/90 hover:text-foreground cursor-pointer transition-colors">
            <input 
              type="checkbox" 
              checked={manualIds} 
              onChange={(e) => setManualIds(e.target.checked)} 
              className="h-3 w-3 bg-black border-white/10 rounded accent-accent" 
            />
            Inserir IDs Manualmente (Override)
          </label>
        </div>
        
        {manualIds ? (
           <div className="flex flex-col gap-4">
              <div className="space-y-2">
                 <Label  className="text-foreground/90 font-semibold text-xs text-foreground">ID da Página do Facebook *</Label>
                 <Input 
                   value={ad.page_id} 
                   onChange={(e) => onChange({ page_id: e.target.value })} 
                   placeholder="Ex: 1029384756" 
                   className="bg-black/50 border-white/10 text-foreground rounded-xl h-11 font-mono focus-visible:ring-primary/50" 
                 />
              </div>
              <div className="space-y-2">
                 <Label  className="text-foreground/90 font-semibold text-xs text-foreground">ID da Conta do Instagram</Label>
                 <Input 
                   value={ad.instagram_actor_id} 
                   onChange={(e) => onChange({ instagram_actor_id: e.target.value })} 
                   placeholder="Ex: 129384756123 (Em branco para vazio)" 
                   className="bg-black/50 border-white/10 text-foreground rounded-xl h-11 font-mono focus-visible:ring-primary/50" 
                 />
              </div>
           </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label  className="text-foreground/90 font-semibold text-xs text-foreground">Página do Facebook *</Label>
              {loadingPages ? (
                <div className="text-primary text-xs font-bold animate-pulse flex items-center h-11">Fazendo Handshake com Meta...</div>
              ) : (
                  <Select value={ad.page_id || undefined} onValueChange={(v) => {
                    // Clear the IG when page changes — will be re-populated via endpoint
                    onChange({ page_id: v, instagram_actor_id: "" });
                  }}>
                  <SelectTrigger  className="bg-black/50 border-white/10 text-foreground rounded-xl h-11 focus-visible:ring-primary/50"><SelectValue placeholder="Selecionar Página..." /></SelectTrigger>
                  <SelectContent>{pages.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            {ad.page_id && (
              <div className="space-y-2">
                <Label  className="text-foreground/90 font-semibold text-xs text-foreground">Conta do Instagram</Label>
                {loadingIg ? (
                  <div className="text-primary text-xs font-bold animate-pulse flex items-center h-11 gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Buscando perfis vinculados...
                  </div>
                ) : (
                  <Select value={ad.instagram_actor_id || "NONE"} onValueChange={(v) => onChange({ instagram_actor_id: v === "NONE" ? "" : v })}>
                    <SelectTrigger  className="bg-black/50 border-white/10 text-foreground rounded-xl h-11 focus-visible:ring-primary/50">
                      <SelectValue placeholder="Selecionar perfil do Instagram..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Nenhum (somente Facebook)</SelectItem>
                      {igAccounts.map((ig) => (
                        <SelectItem key={ig.id} value={ig.id}>
                          @{ig.username || ig.id}{ig.name ? ` — ${ig.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── Creative Source + Format ── */}
      <Section icon={<Upload className="h-4 w-4" />} title="Renderização e Layout Origem" accent="blue">
        {/* Source */}
        <div className="space-y-2">
          <Label  className="text-foreground/90 font-semibold text-xs">Fonte dos Ativos Visuais</Label>
          <div className="flex flex-col gap-4">
            {(["MANUAL", "CATALOG"] as const).map((src) => (
              <button key={src} onClick={() => onChange({ creative_source: src })}
                className={`px-4 py-3 rounded-2xl border text-left transition-all ${ad.creative_source === src ? "border-accent/60 bg-primary/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "border-white/10 bg-black/40 hover:bg-black/60 hover:border-white/20"}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${ad.creative_source === src ? "bg-primary/20 text-primary" : "bg-white/5 text-foreground/90"}`}>
                     {src === "MANUAL" ? <Upload className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${ad.creative_source === src ? "text-accent/70" : "text-foreground"}`}>
                      {src === "MANUAL" ? "Upload Manual" : "Catálogo Advantage+"}
                    </div>
                    <div className="text-foreground/90 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                      {src === "MANUAL" ? "Banco Exclusivo Pessoal" : "Array de Produtos Meta"}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        {ad.creative_source === "MANUAL" && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <Label  className="text-foreground/90 font-semibold text-xs">Arquitetura Estrutural</Label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { v: "SINGLE_IMAGE", icon: <ImageIcon className="h-5 w-5" />, label: "Imagem Flat" },
                { v: "SINGLE_VIDEO", icon: <Film className="h-5 w-5" />, label: "Filme Dinâmico" },
                { v: "CAROUSEL", icon: <LayoutGrid className="h-5 w-5" />, label: "Carrossel Extendido" },
              ] as const).map(({ v, icon, label }) => (
                <button key={v} onClick={() => onChange({ format: v })}
                  className={`py-6 px-3 rounded-2xl border flex flex-col items-center gap-3 transition-all ${ad.format === v ? "border-accent/60 bg-primary/10 text-primary shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-primary/20" : "border-white/10 bg-black/40 text-foreground/90 hover:border-white/20 hover:text-foreground/90"}`}>
                  {icon}
                  <span className="text-xs font-bold text-center uppercase tracking-widest">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-xs text-foreground font-medium">Anúncios com Vários Anunciantes</p>
            <p className="text-[10px] text-foreground/90 mt-0.5">Seu anúncio pode aparecer junto de outros para promover descoberta.</p>
          </div>
          <button onClick={() => onChange({ multi_advertiser: !ad.multi_advertiser })}
            className={`w-10 h-5 rounded-full transition-colors flex items-center p-0.5 flex-shrink-0 ml-4 ${ad.multi_advertiser ? "bg-accent" : "bg-zinc-700"}`}>
            <div className={`bg-white w-4 h-4 rounded-full transition-transform ${ad.multi_advertiser ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </Section>

      {/* ── Creative Content ── */}
      <Section icon={<AlignLeft className="h-4 w-4" />} title="Diretor de Arte — Elementos do Display" accent="blue">
        {/* Media */}
        {ad.creative_source === "MANUAL" && ad.format !== "CAROUSEL" && (
          <div className="space-y-2">
            <Label  className="text-foreground/90 font-semibold text-xs">
              Mídia Core Transparente ({ad.format === "SINGLE_VIDEO" ? "Video ID" : "Image Hash"})
            </Label>
            {ad.format === "SINGLE_IMAGE" ? (
              <div className="space-y-2">
                <div className="flex gap-4">
                  <Input value={ad.image_hash} onChange={(e) => onChange({ image_hash: e.target.value })}
                    placeholder="Hash de criptografia local gerado" className="bg-black/50 border-white/10 text-foreground font-mono text-sm h-12 rounded-xl flex-1 focus-visible:ring-primary/50" />
                  <Button onClick={() => setImagePicker(true)} variant="outline" className="border-white/10 bg-zinc-800 text-foreground/90 hover:text-foreground hover:bg-zinc-700 h-12 rounded-xl shrink-0 px-6 gap-2 font-bold shadow-md">
                    <ImageIcon className="h-4 w-4" /> Importar Nuvem
                  </Button>
                </div>
                {ad.image_hash && (
                  <p className="text-[10px] tracking-wider uppercase font-bold text-primary flex items-center gap-1"><Eye className="h-3 w-3" /> Hash Acoplado no Pacote</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <Input value={ad.video_id} onChange={(e) => onChange({ video_id: e.target.value })}
                    placeholder="ID Numérico do Meta File" className="bg-black/50 border-white/10 text-foreground font-mono text-sm h-12 rounded-xl flex-1 focus-visible:ring-primary/50" />
                  <Button onClick={() => setVideoPicker(true)} variant="outline" className="border-white/10 bg-zinc-800 text-foreground/90 hover:text-foreground hover:bg-zinc-700 h-12 rounded-xl shrink-0 px-6 gap-2 font-bold shadow-md">
                    <Film className="h-4 w-4" /> Importar Nuvem
                  </Button>
                </div>
                {ad.video_id && <p className="text-[10px] tracking-wider uppercase font-bold text-primary flex items-center gap-1"><Eye className="h-3 w-3" /> Vídeo ID Acoplado</p>}

                {/* Thumbnail URL for static placements */}
                <div className="space-y-1 pt-1">
                  <Label  className="text-foreground/90 font-semibold text-[10px] flex items-center gap-1.5 uppercase tracking-wider">
                    <ImagePlay className="h-3 w-3" /> Thumbnail (URL — opcional, para placements estáticos)
                  </Label>
                  <Input
                    value={(ad as any).video_thumbnail_url || ""}
                    onChange={(e) => onChange({ video_thumbnail_url: e.target.value } as any)}
                    placeholder="https://... (imagem de capa do vídeo)"
                    className="bg-black/50 border-white/10 text-foreground font-mono text-xs h-9 rounded-xl focus-visible:ring-primary/50"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Carousel copy (message above cards) ── */}
        {ad.format === "CAROUSEL" && ad.creative_source === "MANUAL" && (
          <div className="pt-2 border-t border-white/5 mt-4 space-y-2">
            <Label  className="text-foreground/90 font-semibold text-xs flex items-center gap-1">
              <AlignLeft  className="h-3.5 w-3.5 text-primary" /> Texto Principal (exibido acima dos cards)
            </Label>
            <Textarea value={ad.copy} onChange={(e) => onChange({ copy: e.target.value })}
              className="bg-black/40 border-white/10 text-foreground min-h-[80px] text-sm rounded-2xl resize-none focus-visible:ring-primary/50 p-4 leading-relaxed"
              placeholder="Mensagem exibida acima dos cards do carrossel..." />
          </div>
        )}

        {/* Carousel Editor */}
        {ad.format === "CAROUSEL" && ad.creative_source === "MANUAL" && (
          <div className="space-y-2 pt-2 border-t border-white/5 mt-4">
            <Label  className="text-foreground/90 font-semibold text-xs">Cartões Interativos Associados</Label>
            <CarouselEditor cards={ad.carousel_cards} onChange={(c) => onChange({ carousel_cards: c })} />
          </div>
        )}

        {/* Text fields — non-carousel formats only */}
        {ad.format !== "CAROUSEL" && (
          <div className="space-y-5 pt-4 border-t border-white/5 mt-4">
            {/* Copy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label  className="text-foreground/90 font-semibold text-xs flex items-center gap-1">Estratégia de Texto (Copywriting)</Label>
                <span className={`text-[10px] font-mono font-bold tabular-nums ${
                  (ad.copy?.length || 0) > 125 ? "text-primary" :
                  (ad.copy?.length || 0) > 100 ? "text-primary" : "text-foreground/90"
                }`}>{ad.copy?.length || 0}/125</span>
              </div>
              <Textarea value={ad.copy} onChange={(e) => onChange({ copy: e.target.value })}
                className="bg-black/40 border-white/10 text-foreground min-h-[120px] text-sm rounded-2xl resize-none focus-visible:ring-primary/50 p-4 leading-relaxed" placeholder="A mensagem hipnótica destinada a provocar as ações predefinidas..." />
              {(ad.copy?.length || 0) > 125 && (
                <p className="text-[10px] text-primary font-semibold">Texto acima do limite recomendado pela Meta (125 car.). Pode ser truncado nos posicionamentos.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Headline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label  className="text-foreground/90 font-semibold text-xs flex items-center gap-1">Manchete Superior (Headline)</Label>
                  <span className={`text-[10px] font-mono font-bold tabular-nums ${
                    (ad.headline?.length || 0) > 40 ? "text-primary" :
                    (ad.headline?.length || 0) > 32 ? "text-primary" : "text-foreground/90"
                  }`}>{ad.headline?.length || 0}/40</span>
                </div>
                <Input value={ad.headline} onChange={(e) => onChange({ headline: e.target.value })}
                  placeholder="Chamada de ação forte e aguda." className={`bg-black/50 text-foreground text-sm h-11 rounded-xl focus-visible:ring-primary/50 ${
                    (ad.headline?.length || 0) > 40 ? "border-primary/20" : "border-white/10"
                  }`} />
              </div>
              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label  className="text-foreground/90 font-semibold text-xs flex items-center gap-1">Texto de Apoio (Descrição)</Label>
                  <span className={`text-[10px] font-mono font-bold tabular-nums ${
                    (ad.description?.length || 0) > 30 ? "text-primary" :
                    (ad.description?.length || 0) > 24 ? "text-primary" : "text-foreground/90"
                  }`}>{ad.description?.length || 0}/30</span>
                </div>
                <Input value={ad.description} onChange={(e) => onChange({ description: e.target.value })}
                  placeholder="Explicação auxiliar sutil (Opcional)." className={`bg-black/50 text-foreground text-sm h-11 rounded-xl focus-visible:ring-primary/50 ${
                    (ad.description?.length || 0) > 30 ? "border-primary/20" : "border-white/10"
                  }`} />
              </div>
            </div>
            {/* Caption (Legenda) */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <Label  className="text-foreground/90 font-semibold text-xs flex items-center gap-1.5">
                <FileText  className="h-3.5 w-3.5 text-foreground/90" /> Legenda da Publicação (Caption — opcional, Facebook)
              </Label>
              <Input value={ad.caption || ""} onChange={(e) => onChange({ caption: e.target.value })}
                placeholder="Texto de legenda exibido no post do Facebook (ex: acesse o link)" className="bg-black/50 border-white/10 text-foreground text-sm h-11 rounded-xl focus-visible:ring-primary/50" />
            </div>
          </div>
        )}

        {/* URL + CTA (always visible) */}
        <div className="flex flex-col gap-4 pt-4 border-t border-white/5 mt-4">
          <div className="space-y-2">
              <Label  className="text-foreground/90 font-semibold text-xs flex items-center gap-1"><Link  className="h-4 w-4 text-primary" /> URL de Destino</Label>
            <Input value={ad.url} onChange={(e) => onChange({ url: e.target.value })}
              placeholder="https://comarka.com.br/lp-secreta" className="bg-black/50 border-white/10 text-foreground text-sm h-11 rounded-xl font-mono focus-visible:ring-primary/50" />
          </div>
          <div className="space-y-2">
              <Label  className="text-foreground/90 font-semibold text-xs flex items-center gap-1"><Tag  className="h-4 w-4 text-primary" /> Botão de Ação (CTA)</Label>
            <Select value={ad.cta_type} onValueChange={(v) => onChange({ cta_type: v })}>
              <SelectTrigger  className="bg-black/50 border-white/10 text-foreground h-11 rounded-xl focus-visible:ring-primary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{CTA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="focus:bg-primary/20">{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* ── URL Parameters + Tracking ── */}
      <Section icon={<ExternalLink className="h-4 w-4" />} title="Rastreamento & URL Parameters" accent="purple">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label  className="text-foreground/90 font-semibold text-xs flex items-center gap-2">
              URL Parameters <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">UTM</span>
            </Label>
            <Input
              value={ad.url_tags || ""}
              onChange={(e) => onChange({ url_tags: e.target.value })}
              placeholder="utm_source=meta&utm_medium=cpc&utm_campaign={{campaign.name}}"
              className="bg-black/50 border-white/10 text-foreground text-xs h-11 rounded-xl font-mono focus-visible:ring-primary/50"
            />
            <p className="text-[10px] text-foreground/90 leading-relaxed">
              Parâmetros adicionados ao final da URL de destino. Use variáveis da Meta: <code className="text-primary bg-primary/10 px-1 rounded">{'{{campaign.name}}'}</code>, <code className="text-primary bg-primary/10 px-1 rounded">{'{{adset.name}}'}</code>, <code className="text-primary bg-primary/10 px-1 rounded">{'{{ad.name}}'}</code>
            </p>
          </div>
          {/* URL Preview */}
          {ad.url && ad.url_tags && (
            <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
              <p className="text-[10px] text-foreground/90 font-bold uppercase tracking-widest mb-1">URL Final (Preview)</p>
              <p className="text-xs text-accent/70 font-mono break-all leading-relaxed">{ad.url}?{ad.url_tags}</p>
            </div>
          )}
          {/* Preset Buttons */}
          <div className="flex flex-col gap-2 w-full mt-2">
            <p className="text-[10px] text-foreground/90 font-semibold uppercase tracking-wider">Atalhos:</p>
            {[
              { label: "Padrão Meta", val: "utm_source=meta&utm_medium={{placement}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}" },
              { label: "Google Analytics", val: "utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_term={{adset.name}}" },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => onChange({ url_tags: preset.val })}
                className="px-2.5 py-1 rounded-lg border border-primary/20 bg-accent/5 text-primary text-[10px] font-semibold hover:bg-primary/15 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Advantage+ Creative ── */}
      <Section icon={<Sparkles className="h-4 w-4" />} title="Criativo Advantage+" accent="amber">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-foreground font-medium mb-1">Melhorias Automáticas de Criativo</p>
            <p className="text-[11px] text-foreground/90 leading-relaxed max-w-md">
              A Meta pode melhorar automaticamente seu criativo: ajuste de brilho/contraste, criação de variantes de texto, aplicação de música em vídeos e expansão da imagem para diferentes formatos.
            </p>
          </div>
          <button
            onClick={() => onChange({ advantage_creative: !ad.advantage_creative })}
            className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 flex-shrink-0 mt-1 ${
              ad.advantage_creative ? "bg-primary/10" : "bg-zinc-700"
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full transition-transform ${ad.advantage_creative ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
        {ad.advantage_creative && (
          <div className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary leading-relaxed">
            <strong className="text-primary">Ativo:</strong> A Meta poderá criar até 150 combinações de criativo e distribuí-las automaticamente. Adequado para testes de alto volume.
          </div>
        )}
      </Section>

      {/* ── Message Destination Experience (Conditional) ── */}
      {(ad.cta_type === "SEND_MESSAGE" || ad.cta_type === "SEND_WHATSAPP_MESSAGE") && (
        <MessageTemplateEditor
          value={ad.message_template_id || ""}
          pageId={ad.page_id || ""}
          pageAccessToken={pages.find((p: any) => p.id === ad.page_id)?.access_token || ""}
          onChange={(id, greeting, iceBreakers) => onChange({
            message_template_id: id,
            greeting_text: greeting,
            ice_breakers: iceBreakers,
            url: "",
          })}
        />
      )}

      {/* ── Ad Preview ── */}
      <div className="space-y-3">
        <button onClick={() => setShowPreview((v) => !v)}
          className="flex items-center gap-2 text-sm text-foreground/90 hover:text-foreground transition-colors w-full">
          <Eye  className="h-4 w-4 text-foreground/90" />
          <span className="font-medium">Prévia do Anúncio</span>
          <div className={`ml-auto transition-transform ${showPreview ? "rotate-180" : ""}`}>▾</div>
        </button>
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <AdPreview
                pageName={selectedPage?.name || ""}
                instagramHandle={igHandle}
                copy={ad.copy}
                headline={ad.headline}
                description={ad.description}
                ctaType={ad.cta_type}
                format={ad.format}
                imageHash={ad.image_hash}
                imageUrl={ad.image_url}
                videoId={ad.video_id}
                carouselCards={ad.carousel_cards}
                url={ad.url}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      {imagePicker && (
        <MediaPicker type="image" onSelect={(hash, name, url) => { onChange({ image_hash: hash, image_url: url }); setImagePicker(false); }} onClose={() => setImagePicker(false)} />
      )}
      {videoPicker && (
        <MediaPicker type="video" onSelect={(id) => { onChange({ video_id: id }); setVideoPicker(false); }} onClose={() => setVideoPicker(false)} />
      )}
    </div>
  );
}
