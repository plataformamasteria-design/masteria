"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import {
  Plus, Trash2, FolderTree, Crosshair, Target,
  Copy, Loader2, Play, Brain, Users, Heart, Briefcase,
  Image as ImageIcon, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { AdPanel } from "./ad-panel";
import { validateCampaignTree, ValidationError } from "./campaign-validator";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// ─────────────────── TYPES ───────────────────

export type CarouselCard = {
  id: string;
  headline: string;
  description: string;
  url: string;
  image_hash: string;
  image_url?: string;
  video_id: string;
  cta_type: string;
};

export type AdNode = {
  id: string;
  name: string;
  // Brand
  page_id: string;
  instagram_actor_id: string;
  // Creative setup
  creative_source: "MANUAL" | "CATALOG";
  format: "SINGLE_IMAGE" | "SINGLE_VIDEO" | "CAROUSEL";
  // Text content
  copy: string;
  headline: string;
  description: string;
  caption?: string;         // Legenda da publicação (Facebook)
  // Media
  image_hash: string;
  image_url?: string;
  video_id: string;
  video_thumbnail_url?: string;
  carousel_cards: CarouselCard[];
  // Settings
  url: string;
  url_tags?: string;
  cta_type: string;
  multi_advertiser: boolean;
  advantage_creative?: boolean;
  message_template_id?: string;
  // Mensagem de boas-vindas (page_welcome_message — Meta API v21.0)
  greeting_text?: string;           // Saudação inicial da conversa (max 160 chars)
  ice_breakers?: { title: string }[]; // Atalhos de resposta rápida (max 4, 80 chars cada)
  // For editMode: real Meta Ad ID for PATCH calls
  metaId?: string;
};

export type TargetingItem = { id: string; name: string };

export type AdSetNode = {
  id: string;
  name: string;
  daily_budget: string;
  lifetime_budget: string;
  budget_type: "DAILY" | "LIFETIME";
  bid_amount: string;
  bid_strategy: string;     // Por conjunto (quando não CBO)
  roas_average_floor?: string; // Para MINIMUM_ROAS bid strategy
  dynamic_creative: boolean;
  start_time: string;
  end_time: string;
  optimization_goal: string;
  geo_locations: string[];
  geo_locations_advanced: Array<{
    key: string;
    name: string;
    type: string;
    country_code?: string;
    region?: string;
    radius?: number;
    distance_unit?: string;
  }>;
  age_min: string;
  age_max: string;
  genders: string;
  custom_audiences: TargetingItem[];
  excluded_custom_audiences: TargetingItem[];
  interests: TargetingItem[];
  behaviors: TargetingItem[];
  life_events: TargetingItem[];
  work_positions: TargetingItem[];
  education_statuses: number[];
  relationship_statuses: number[];
  placements_type: "ADVANTAGE" | "MANUAL";
  device_platforms: string[];
  publisher_platforms: string[];
  facebook_positions: string[];
  instagram_positions: string[];
  messenger_positions: string[]; // Posicionamentos no Messenger
  audience_network_positions: string[]; // Posicionamentos na Audience Network
  conversion_location: string;
  messaging_destinations: string[];
  pixel_id: string;
  custom_event_type: string;
  advantage_audience?: number; // 0 or 1
  exclusions?: {
    interests?: TargetingItem[];
    behaviors?: TargetingItem[];
  };
  excluded_interests: TargetingItem[]; // flat list for UI convenience
  excluded_behaviors: TargetingItem[];
  ads: AdNode[];
  // For editMode: real Meta ID for PATCH calls
  metaId?: string;
};

export type CampaignNodeTree = {
  name: string;
  objective: string;
  special_ad_categories: string;
  buying_type: "AUCTION" | "RESERVED";
  is_cbo: boolean;
  daily_budget: string;
  bid_strategy: string;
  spend_cap: string;
  start_active?: boolean;
  adsets: AdSetNode[];
  // For editMode: real Meta IDs
  metaCampaignId?: string;
};

// ─────────────────── HELPERS ───────────────────

export function makeAd(suffix = "01"): AdNode {
  return {
    id: `ad_${Math.random().toString(36).substr(2, 9)}`,
    name: `Anúncio Padrão ${suffix}`,
    page_id: "", instagram_actor_id: "",
    creative_source: "MANUAL", format: "SINGLE_IMAGE",
    copy: "Confira a novidade hoje!",
    headline: "", description: "", caption: "",
    image_hash: "", image_url: "", video_id: "",
    carousel_cards: [],
    url: "https://comarka.com.br",
    url_tags: "",
    cta_type: "LEARN_MORE",
    multi_advertiser: false,
    advantage_creative: false,
    message_template_id: "",
    greeting_text: "",
    ice_breakers: [{ title: "" }, { title: "" }],
  };
}

export function makeAdSet(id: string, name: string): AdSetNode {
  return {
    id, name,
    daily_budget: "20", lifetime_budget: "350", budget_type: "DAILY",
    bid_amount: "", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    roas_average_floor: "",
    dynamic_creative: false,
    start_time: "", end_time: "", optimization_goal: "",
    geo_locations: ["BR"], geo_locations_advanced: [],
    age_min: "18", age_max: "65", genders: "ALL",
    custom_audiences: [], excluded_custom_audiences: [],
    interests: [], behaviors: [], life_events: [], work_positions: [],
    excluded_interests: [], excluded_behaviors: [],
    education_statuses: [], relationship_statuses: [],
    placements_type: "ADVANTAGE",
    device_platforms: ["mobile", "desktop"],
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed", "story", "video_feeds", "reels"],
    instagram_positions: ["stream", "story", "reels"],
    messenger_positions: [],
    audience_network_positions: [],
    conversion_location: "WEBSITE",
    messaging_destinations: ["whatsapp", "instagram"],
    pixel_id: "", custom_event_type: "PURCHASE", advantage_audience: 1,
    ads: [makeAd("01")],
  };
}

// ─────────────────── COMPONENTS ───────────────────

import { PixelSelector, AsyncCombobox, LocationPicker, TargetingPanel } from "./tree-components";

// ─────────────────── TREE BUILDER ───────────────────

export interface TreeBuilderProps {
  editMode?: boolean;
  editCampaignId?: string;
  initialTree?: CampaignNodeTree;
  onSave?: () => void;
  onFinish?: () => void;
}

export default function TreeBuilder({ editMode = false, editCampaignId, initialTree, onSave, onFinish }: TreeBuilderProps = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [validationErrs, setValidationErrs] = useState<ValidationError[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Focus utility
  const jumpToError = (nodeId: string) => {
     setShowValidationModal(false);
     setActNode({ id: nodeId, type: nodeId === "root" ? "campaign" : tree.adsets.some(s => s.id === nodeId) ? "adset" : "ad" });
  };

  const { data: pagesRes, isLoading: loadingPages } = useSWR("/api/meta/pages", fetcher);
  const pages = pagesRes?.data || [];

  const [tree, setTree] = useState<CampaignNodeTree>(() => {
    if (initialTree) return initialTree;
    return {
      name: "Nova Campanha Tree Builder",
      objective: "OUTCOME_TRAFFIC", special_ad_categories: "NONE",
      buying_type: "AUCTION", is_cbo: false,
      daily_budget: "50", bid_strategy: "LOWEST_COST_WITHOUT_CAP", spend_cap: "",
      start_active: false,
      adsets: [makeAdSet("adset_init", "Público Aberto")],
    };
  });

  const [actNode, setActNode] = useState<{ type: "campaign" | "adset" | "ad"; id?: string }>();

  // ── Tree mutations ──
  const addAdSet = () => {
    const id = `adset_${Math.random().toString(36).substr(2, 9)}`;
    setTree((t) => ({ ...t, adsets: [...t.adsets, makeAdSet(id, "Novo Conjunto")] }));
  };

  const duplicateAdSet = (adsetId: string) => {
    const src = tree.adsets.find((a) => a.id === adsetId);
    if (!src) return;
    const newId = `adset_${Math.random().toString(36).substr(2, 9)}`;
    const clone: AdSetNode = { ...JSON.parse(JSON.stringify(src)), id: newId, name: `${src.name} - Cópia`, ads: src.ads.map((ad) => ({ ...ad, id: `ad_${Math.random().toString(36).substr(2, 9)}` })) };
    setTree((t) => ({ ...t, adsets: [...t.adsets, clone] }));
    setActNode({ type: "adset", id: newId });
  };

  const removeAdSet = (adsetId: string) => {
    setTree((t) => ({ ...t, adsets: t.adsets.filter((a) => a.id !== adsetId) }));
    if (actNode?.id === adsetId) setActNode({ type: "campaign" });
  };

  const updateAdSet = (adsetId: string, par: Partial<AdSetNode>) =>
    setTree((t) => ({ ...t, adsets: t.adsets.map((a) => (a.id === adsetId ? { ...a, ...par } : a)) }));

  const addAd = (adsetId: string) => {
    setTree((t) => ({
      ...t, adsets: t.adsets.map((a) => a.id === adsetId ? { ...a, ads: [...a.ads, makeAd(String(a.ads.length + 1).padStart(2, "0"))] } : a),
    }));
  };

  const duplicateAd = (adsetId: string, adId: string) => {
    setTree((t) => ({
      ...t, adsets: t.adsets.map((a) => {
        if (a.id !== adsetId) return a;
        const src = a.ads.find((ad) => ad.id === adId);
        if (!src) return a;
        return { ...a, ads: [...a.ads, { ...JSON.parse(JSON.stringify(src)), id: `ad_${Math.random().toString(36).substr(2, 9)}`, name: `${src.name} - Cópia` }] };
      }),
    }));
  };

  const removeAd = (adsetId: string, adId: string) => {
    setTree((t) => ({
      ...t, adsets: t.adsets.map((a) => a.id === adsetId ? { ...a, ads: a.ads.filter((ad) => ad.id !== adId) } : a),
    }));
    if (actNode?.id === adId) setActNode({ type: "adset", id: adsetId });
  };

  const updateAd = (adsetId: string, adId: string, par: Partial<AdNode>) => {
    setTree((t) => ({
      ...t, adsets: t.adsets.map((a) => a.id === adsetId ? { ...a, ads: a.ads.map((ad) => ad.id === adId ? { ...ad, ...par } : ad) } : a),
    }));
  };

  const handleCreate = async () => {
    setLoading(true); setErrorMsg("");
    try {
      const res = await fetch("/api/meta/criar-campanha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tree) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar campanha");
      if (onFinish) onFinish(); else router.push("/marketing/gerenciar");
    } catch (e: any) { setErrorMsg(e.message); }
    finally { setLoading(false); }
  };

  // Edit mode: patch campaign + adsets + ads (each modified entity)
  const handleSaveEdits = async () => {
    if (!editCampaignId) return;
    setLoading(true); setErrorMsg(""); setSaveSuccess(false);
    try {
      // 1. Patch campaign fields
      const campRes = await fetch("/api/meta/editar-campanha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: editCampaignId,
          name: tree.name,
          daily_budget: tree.is_cbo && tree.daily_budget ? parseFloat(tree.daily_budget) : undefined,
        }),
      });
      if (!campRes.ok) {
        const d = await campRes.json();
        throw new Error(d.error || "Erro ao editar campanha");
      }

      // 2. Patch each adset that has a metaId
      for (const adset of tree.adsets) {
        if (!adset.metaId) continue;
        const adsetPayload: Record<string, unknown> = { name: adset.name };
        if (!tree.is_cbo) {
          if (adset.budget_type === "DAILY" && adset.daily_budget)
            adsetPayload.daily_budget = String(Math.round(parseFloat(adset.daily_budget) * 100));
          if (adset.budget_type === "LIFETIME" && adset.lifetime_budget)
            adsetPayload.lifetime_budget = String(Math.round(parseFloat(adset.lifetime_budget) * 100));
        }
        if (adset.start_time) adsetPayload.start_time = adset.start_time;
        if (adset.end_time) adsetPayload.end_time = adset.end_time;

        await fetch("/api/meta/editar-completo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: adset.metaId, type: "adset", payload: adsetPayload }),
        });

        // 3. Patch each ad that has a metaId and has creative fields
        for (const ad of adset.ads) {
          if (!ad.metaId) continue;
          await fetch("/api/meta/editar-ad", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ad_id: ad.metaId,
              name: ad.name,
              copy: ad.copy,
              headline: ad.headline,
              description: ad.description,
              url: ad.url,
              cta_type: ad.cta_type,
              image_hash: ad.image_hash || undefined,
              video_id: ad.video_id || undefined,
              page_id: ad.page_id,
              instagram_actor_id: ad.instagram_actor_id || undefined,
            }),
          });
        }
      }

      setSaveSuccess(true);
      setTimeout(() => {
        if (onSave) onSave();
      }, 1200);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Find active adset/ad ──
  const activeAdset = tree.adsets.find((a) => a.id === actNode?.id);
  const activeAdContext = actNode?.type === "ad"
    ? (() => {
        const adsetIdx = tree.adsets.findIndex((a) => a.ads.some((ad) => ad.id === actNode.id));
        if (adsetIdx === -1) return null;
        const adset = tree.adsets[adsetIdx];
        const ad = adset.ads.find((ad) => ad.id === actNode.id);
        return ad ? { adset, ad } : null;
      })()
    : null;

  return (
    <>
    <div className="flex-1 w-full flex gap-4 lg:gap-6 h-full min-h-0 p-4 lg:p-6 bg-transparent">
      {/* ── Floating Sidebar ── */}
      <div className="w-72 glass-card rounded-2xl flex flex-col py-4 overflow-y-auto flex-shrink-0 shadow-lg min-h-0">
        <div className="px-4 mb-4">
          <h3 className="text-foreground/90 font-bold tracking-wider uppercase text-[10px] flex items-center gap-2 mb-1">
            <FolderTree  className="h-3.5 w-3.5 text-primary" /> Hierarquia
          </h3>
        </div>
        <div className="space-y-0.5">
          <div onClick={() => setActNode({ type: "campaign" })}
            className={`flex items-center gap-2 text-sm px-4 py-2 cursor-pointer transition-all border-l-2 relative ${!actNode || actNode.type === "campaign" ? "bg-primary/10 border-accent text-accent/90" : "border-transparent hover:bg-black/5 dark:hover:bg-black/5 dark:bg-white/5 text-foreground/90"}`}>
            <Target className="h-4 w-4 flex-shrink-0" />
            <span className="truncate flex-1 font-medium">{tree.name || "Campanha"}</span>
          </div>
          {tree.adsets.map((adset) => (
            <div key={adset.id} className="pt-0.5">
              <div 
                 onClick={() => setActNode({ type: "adset", id: adset.id })}
                 className={`flex items-center group relative cursor-pointer border-l-2 transition-all ${actNode?.type === "adset" && actNode.id === adset.id ? "bg-primary/10 border-accent text-accent/80" : "border-transparent text-foreground/90 hover:text-foreground hover:bg-black/5 dark:hover:bg-black/5 dark:bg-white/5"}`}>
                <div className="relative z-10 w-full flex items-center px-4 pl-10 py-2 min-w-0">
                   <Crosshair className={`h-4 w-4 flex-shrink-0 mr-2 ${actNode?.type === "adset" && actNode.id === adset.id ? "text-primary" : "text-foreground/90"}`} />
                   <span className="truncate flex-1 font-medium">{adset.name || "Sem título"}</span>
                   <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                     <button onClick={(e) => { e.stopPropagation(); addAd(adset.id); }} title="Novo anúncio" className="h-5 w-5 flex items-center justify-center hover:bg-muted-foreground/20/50 rounded text-foreground/90 hover:text-foreground"><Plus className="h-3 w-3" /></button>
                     <button onClick={(e) => { e.stopPropagation(); duplicateAdSet(adset.id); }} title="Duplicar" className="h-5 w-5 flex items-center justify-center hover:bg-muted-foreground/20/50 rounded text-foreground/90 hover:text-accent/70"><Copy className="h-3 w-3" /></button>
                     <button onClick={(e) => { e.stopPropagation(); removeAdSet(adset.id); }} title="Excluir" className="h-5 w-5 flex items-center justify-center hover:bg-primary/10 rounded text-foreground/90 hover:text-primary"><Trash2 className="h-3 w-3" /></button>
                   </div>
                </div>
              </div>
              <div className="space-y-0.5 mt-0.5">
                {adset.ads.map((ad) => (
                  <div 
                    key={ad.id} 
                    onClick={() => setActNode({ type: "ad", id: ad.id })}
                    className={`flex items-center group relative cursor-pointer transition-all border-l-2 ${actNode?.type === "ad" && actNode.id === ad.id ? "bg-primary/10 border-accent text-accent/90" : "border-transparent hover:bg-black/5 dark:hover:bg-black/5 dark:bg-white/5 text-foreground/90 hover:text-foreground/90"}`}>
                    <div className="relative z-10 w-full flex items-center px-4 pl-16 py-1.5 min-w-0">
                      <ImageIcon className={`h-3.5 w-3.5 flex-shrink-0 mr-2 ${actNode?.type === "ad" && actNode.id === ad.id ? "text-primary" : "text-foreground/90"}`} />
                      <span className="truncate flex-1 text-xs">{ad.name || "Sem título"}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                        <button onClick={(e) => { e.stopPropagation(); duplicateAd(adset.id, ad.id); }} title="Duplicar" className="h-5 w-5 flex items-center justify-center hover:bg-muted-foreground/20/50 rounded text-foreground/90 hover:text-accent/70"><Copy className="h-3 w-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); removeAd(adset.id, ad.id); }} title="Excluir" className="h-5 w-5 flex items-center justify-center hover:bg-primary/10 rounded text-foreground/90 hover:text-primary"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="px-4 mt-4">
            <Button  onClick={addAdSet} variant="ghost" className="w-full text-xs tracking-wider text-primary hover:text-accent/70 hover:bg-primary/10 border border-primary/20">
              <Plus className="h-3 w-3 mr-2" /> Novo Conjunto
            </Button>
          </div>
        </div>
      </div>

      {/* ── Editor Panel (Right Side Bento Grid) ── */}
      <div className="flex-1 glass-card rounded-2xl flex flex-col relative overflow-hidden shadow-2xl">
        <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-48 space-y-8 scroll-smooth">

          {/* Campaign Section */}
          {(!actNode || actNode.type === "campaign") && (
            <div className="w-full space-y-6">
              <div className="pb-4 border-b border-border">
                 <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
                    Configuração da Campanha
                 </h2>
                 <p className="text-sm text-foreground/90 mt-1">Determine a matriz principal, orçamento mestre de vantagem e objetivo estratégico de otimização ODAX.</p>
              </div>

              <div className="flex flex-col gap-6 w-full">
                {/* Box 1: Identidade da Campanha */}
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-border rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                   <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Identificação Matriz</h3>
                   <button
                     onClick={() => setTree({ ...tree, start_active: !tree.start_active })}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${tree.start_active ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-black/5 dark:bg-black/50 text-foreground/90 hover:text-foreground/90"}`}
                   >
                     <div className={`w-2 h-2 rounded-full ${tree.start_active ? "bg-primary/10 animate-pulse" : "bg-zinc-600"}`} />
                     {tree.start_active ? "Publicação Ativa Instantânea" : "Iniciar como Rascunho"}
                   </button>
                </div>
                <div className="space-y-2">
                  <Label  className="text-foreground/90 font-semibold text-xs">Nome da Campanha</Label>
                  <Input value={tree.name} onChange={(e) => setTree({ ...tree, name: e.target.value })} className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11 focus-visible:ring-primary/50" />
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-3">
                    <Label  className="text-foreground/90 font-semibold text-xs">Objetivo da Campanha (ODAX)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { val: "OUTCOME_AWARENESS", label: "Reconhecimento" },
                        { val: "OUTCOME_TRAFFIC", label: "Tráfego" },
                        { val: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
                        { val: "OUTCOME_LEADS", label: "Cadastros" },
                        { val: "OUTCOME_APP_PROMOTION", label: "Promoção do App" },
                        { val: "OUTCOME_SALES", label: "Vendas" }
                      ].map((obj) => (
                        <div 
                          key={obj.val}
                          onClick={() => setTree({ ...tree, objective: obj.val })}
                          className={`flex items-center justify-center text-center p-3 rounded-xl border text-[11px] lg:text-xs font-semibold cursor-pointer transition-all ${tree.objective === obj.val ? "bg-primary/10 border-accent text-accent/80 shadow-[0_0_15px_rgba(0,153,255,0.2)]" : "border-border bg-black/5 dark:bg-black/5 dark:bg-black/40 text-foreground/90 hover:bg-black/5 dark:hover:bg-black/5 dark:bg-white/5 border-border"}`}
                        >
                          {obj.label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label  className="text-foreground/90 font-semibold text-xs">Categorias Especiais Ad</Label>
                    <Select value={Array.isArray(tree.special_ad_categories) ? tree.special_ad_categories[0] : tree.special_ad_categories} onValueChange={(v) => setTree({ ...tree, special_ad_categories: [v] })}>
                      <SelectTrigger  className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Nenhuma (Padrão)</SelectItem>
                        <SelectItem value="CREDIT">Crédito</SelectItem>
                        <SelectItem value="HOUSING">Moradia</SelectItem>
                        <SelectItem value="EMPLOYMENT">Emprego</SelectItem>
                        <SelectItem value="ISSUES_ELECTIONS_POLITICS">Temas Sociais</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label  className="text-foreground/90 font-semibold text-xs">Tipo de Leilão</Label>
                    <Select value={tree.buying_type} onValueChange={(v: any) => setTree({ ...tree, buying_type: v })}>
                      <SelectTrigger  className="bg-black/5 dark:bg-black/50 border-border text-foreground/90 rounded-xl h-11 pointer-events-none opacity-80"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="AUCTION">Leilão (Exclusivo)</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label  className="text-foreground/90 font-semibold text-xs">Limite Geral de Gasto CBO</Label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-foreground/90">R$</span>
                       <Input type="number" placeholder="Opcional" value={tree.spend_cap} onChange={(e) => setTree({ ...tree, spend_cap: e.target.value })} className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl pl-10 h-11 focus-visible:ring-primary/50" />
                    </div>
                  </div>
                </div>
              </div>

                {/* Box 2: Orçamento (Advantage+) */}
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-border rounded-2xl p-6 shadow-xl space-y-6 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                   <div>
                     <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">Orçamento Advantage+ (CBO)</h3>
                     <p className="text-[11px] text-foreground/90 font-medium">Distribuir dinamicamente a verba em tempo real entre os conjuntos buscando eficiência ODAX.</p>
                   </div>
                   <button onClick={() => setTree({ ...tree, is_cbo: !tree.is_cbo })} className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 ${tree.is_cbo ? "bg-accent" : "bg-muted-foreground/20"}`}>
                     <div className={`bg-white w-4 h-4 rounded-full transition-transform ${tree.is_cbo ? "translate-x-6" : "translate-x-0"}`} />
                   </button>
                </div>
                {tree.is_cbo && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-col gap-4 pt-1">
                    <div className="space-y-2">
                      <Label  className="text-foreground/90 font-semibold text-xs">Orçamento Base Diário Cópula</Label>
                      <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-foreground/90">R$</span>
                         <Input type="number" value={tree.daily_budget} onChange={(e) => setTree({ ...tree, daily_budget: e.target.value })} className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl font-mono text-base font-bold pl-10 h-11 focus-visible:ring-primary/50" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label  className="text-foreground/90 font-semibold text-xs">Estratégia de Lances (Algoritmo)</Label>
                      <Select value={tree.bid_strategy} onValueChange={(v) => setTree({ ...tree, bid_strategy: v })}>
                        <SelectTrigger  className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOWEST_COST_WITHOUT_CAP">Volume Máximo (Padrão e Recomendado)</SelectItem>
                          <SelectItem value="COST_CAP">Teto de CPA/CPL Fixado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}
              </div>
              </div>
            </div>
          )}

          {/* AdSet Section */}
          {actNode?.type === "adset" && activeAdset && (() => {
            const adset = activeAdset;
            const upd = (par: Partial<AdSetNode>) => updateAdSet(adset.id, par);
            return (
              <div className="w-full space-y-6">
                <div className="flex justify-between items-end pb-4 border-b border-border">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">Conjunto de Inteligência</h2>
                    <p className="text-sm text-foreground/90 mt-1">Configurações de escopo, budget localizado, calendário e público alvo para os anúncios alocados.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => duplicateAdSet(adset.id)} className="bg-card border-border text-primary hover:text-accent/70 hover:bg-muted rounded-xl"><Copy className="h-4 w-4 mr-2" /> Duplicar</Button>
                  </div>
                </div>
                <div className="flex flex-col gap-6 w-full">

              <div className="glass-card border border-border rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="space-y-2">
                     <Label  className="text-foreground/90 font-semibold text-xs">Nome de Identificação (Alias)</Label>
                     <Input value={adset.name} onChange={(e) => upd({ name: e.target.value })} className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11 text-base font-medium focus-visible:ring-primary/50" />
                  </div>
                </div>

              <div className="glass-card border border-border rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="space-y-1 pb-3 border-b border-border">
                     <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Conversão e Tracking Direto</h3>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="space-y-3 col-span-2 md:col-span-1">
                      <Label  className="text-foreground/90 font-semibold text-xs">Localização do Foco (Direcionamento Real)</Label>
                      <div className="flex flex-col gap-3">
                        {[
                          { val: "WEBSITE", label: "Site / LP" },
                          { val: "APP", label: "App" },
                          { val: "MESSAGING_APP", label: "Mensagem (DMs)" }
                        ].map((loc) => (
                          <div 
                            key={loc.val}
                            onClick={() => upd({ conversion_location: loc.val })}
                            className={`flex items-center justify-center text-center p-3 rounded-xl border text-[11px] lg:text-xs font-semibold cursor-pointer transition-all ${adset.conversion_location === loc.val ? "bg-primary/10 border-accent text-accent/80 shadow-[0_0_15px_rgba(0,153,255,0.2)]" : "border-border bg-black/5 dark:bg-black/5 dark:bg-black/40 text-foreground/90 hover:bg-black/5 dark:hover:bg-black/5 dark:bg-white/5 border-border"}`}
                          >
                            {loc.label}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label  className="text-foreground/90 font-semibold text-xs">Evento Algorítmico Padrão</Label>
                      <Select value={adset.optimization_goal || "__AUTO__"} onValueChange={(v) => upd({ optimization_goal: v === "__AUTO__" ? "" : v })}>
                        <SelectTrigger  className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11"><SelectValue placeholder="Automático pela Rede Neural" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__AUTO__">Automatico/Padrao (Recomendado)</SelectItem>
                          {/* Awareness */}
                          {tree.objective === "OUTCOME_AWARENESS" && <SelectItem value="REACH">Alcance Maximo (Awareness)</SelectItem>}
                          <SelectItem value="IMPRESSIONS">Impressoes Maximas</SelectItem>
                          {/* Traffic */}
                          {adset.conversion_location !== "MESSAGING_APP" && <SelectItem value="LINK_CLICKS">Cliques no Link</SelectItem>}
                          {adset.conversion_location !== "MESSAGING_APP" && <SelectItem value="LANDING_PAGE_VIEWS">Aberturas Completas LP (Pixel)</SelectItem>}
                          {/* Messaging */}
                          {adset.conversion_location === "MESSAGING_APP" && <SelectItem value="REPLIES">Max. Conversas (Direct/WhatsApp)</SelectItem>}
                          {/* Engagement */}
                          {tree.objective === "OUTCOME_ENGAGEMENT" && adset.conversion_location !== "MESSAGING_APP" && <SelectItem value="POST_ENGAGEMENT">Engajamento no Post</SelectItem>}
                          {/* Leads */}
                          {tree.objective === "OUTCOME_LEADS" && <SelectItem value="LEAD_GENERATION">Geracao de Leads</SelectItem>}
                          {/* Sales */}
                          {tree.objective === "OUTCOME_SALES" && <SelectItem value="OFFSITE_CONVERSIONS">Conversao no Site (Pixel)</SelectItem>}
                          {/* App */}
                          {tree.objective === "OUTCOME_APP_PROMOTION" && <SelectItem value="APP_INSTALLS">Instalacoes do App</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Seleção de Mensageria Fina */}
                  {adset.conversion_location === "MESSAGING_APP" && (
                    <div className="pt-5 border-t border-border space-y-3 mt-4">
                      <Label  className="text-foreground/90 font-semibold text-xs flex items-center gap-2">
                        Canais de Contato <span className="px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary text-[9px] uppercase tracking-widest font-bold">Meta Routing</span>
                      </Label>
                      <div className="flex flex-wrap gap-4">
                         <label className="flex items-center gap-2 text-sm text-foreground/90 hover:text-foreground transition-colors cursor-pointer select-none">
                           <input type="checkbox" 
                                  checked={adset.messaging_destinations?.includes("whatsapp")} 
                                  onChange={(e) => {
                                    const curr = adset.messaging_destinations || [];
                                    upd({ messaging_destinations: e.target.checked ? [...curr, "whatsapp"] : curr.filter(x => x !== "whatsapp") });
                                  }} 
                                  className="h-4 w-4 bg-black/5 dark:bg-black/50 border border-border rounded text-primary focus:ring-primary focus:ring-offset-zinc-900" 
                           />
                           WhatsApp
                         </label>
                         <label className="flex items-center gap-2 text-sm text-foreground/90 hover:text-foreground transition-colors cursor-pointer select-none">
                           <input type="checkbox" 
                                  checked={adset.messaging_destinations?.includes("instagram")} 
                                  onChange={(e) => {
                                    const curr = adset.messaging_destinations || [];
                                    upd({ messaging_destinations: e.target.checked ? [...curr, "instagram"] : curr.filter(x => x !== "instagram") });
                                  }} 
                                  className="h-4 w-4 bg-black/5 dark:bg-black/50 border border-border rounded text-primary focus:ring-primary focus:ring-offset-zinc-900" 
                           />
                           Instagram Direct
                         </label>
                         <label className="flex items-center gap-2 text-sm text-foreground/90 hover:text-foreground transition-colors cursor-pointer select-none">
                           <input type="checkbox" 
                                  checked={adset.messaging_destinations?.includes("messenger")} 
                                  onChange={(e) => {
                                    const curr = adset.messaging_destinations || [];
                                    upd({ messaging_destinations: e.target.checked ? [...curr, "messenger"] : curr.filter(x => x !== "messenger") });
                                  }} 
                                  className="h-4 w-4 bg-black/5 dark:bg-black/50 border border-border rounded text-primary focus:ring-primary focus:ring-offset-zinc-900" 
                           />
                           Messenger
                         </label>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-4 border-t border-border pt-5 mt-2">
                    <div className="space-y-2">
                       <Label  className="text-foreground/90 font-semibold text-xs flex items-center gap-2">Data Source <span className="px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary text-[9px] uppercase tracking-widest font-bold">Pixel</span></Label>
                       <PixelSelector
                         value={adset.pixel_id}
                         onChange={(v) => upd({ pixel_id: v })}
                       />
                    </div>
                    <div className="space-y-2">
                       <Label  className="text-foreground/90 font-semibold text-xs">Acionamento Diretor</Label>
                       <Select value={adset.custom_event_type} onValueChange={(v) => upd({ custom_event_type: v })}>
                         <SelectTrigger  className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11"><SelectValue placeholder="Evento" /></SelectTrigger>
                         <SelectContent><SelectItem value="PURCHASE">Purchase - Alta Conversão Fiscal</SelectItem><SelectItem value="LEAD">Lead Generation</SelectItem><SelectItem value="ADD_TO_CART">Initiate ATC</SelectItem><SelectItem value="VIEW_CONTENT">Page View Master / View Content</SelectItem></SelectContent>
                       </Select>
                    </div>
                  </div>
                </div>

                {!tree.is_cbo && (
                <div className="glass-card border border-border rounded-2xl p-6 shadow-xl space-y-6">
                    <div className="space-y-1 pb-3 border-b border-border">
                       <h3 className="text-xs font-bold text-foreground uppercase tracking-wider text-primary">Orçamento e Lance do Conjunto (Não-CBO)</h3>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="space-y-2">
                         <Label  className="text-foreground/90 font-semibold text-xs">Modelo Orçamentário</Label>
                         <Select value={adset.budget_type || "DAILY"} onValueChange={(v: any) => upd({ budget_type: v })}>
                           <SelectTrigger  className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11"><SelectValue /></SelectTrigger>
                           <SelectContent><SelectItem value="DAILY">Gasto Fixo Diário Permanente</SelectItem><SelectItem value="LIFETIME">Teto de Orçamento Em Escopo Completo</SelectItem></SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         <Label  className="text-foreground/90 font-semibold text-xs">Valor do Orçamento</Label>
                         <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-foreground/90">R$</span>
                            <Input type="number" value={adset.budget_type === "LIFETIME" ? adset.lifetime_budget : adset.daily_budget} onChange={(e) => adset.budget_type === "LIFETIME" ? upd({ lifetime_budget: e.target.value }) : upd({ daily_budget: e.target.value })} className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl font-mono text-base font-bold pl-10 h-11 focus-visible:ring-rose-500/50" />
                         </div>
                      </div>
                    </div>
                    {/* Estratégia de Lance por Conjunto */}
                    <div className="border-t border-border pt-4 flex flex-col gap-4">
                      <div className="space-y-2">
                        <Label  className="text-foreground/90 font-semibold text-xs">Estratégia de Lance</Label>
                        <Select value={adset.bid_strategy || "LOWEST_COST_WITHOUT_CAP"} onValueChange={(v) => upd({ bid_strategy: v })}>
                          <SelectTrigger  className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOWEST_COST_WITHOUT_CAP">Volume Máximo (Automático)</SelectItem>
                            <SelectItem value="LOWEST_COST_WITH_BID_CAP">Cap de Lance (Bid Cap)</SelectItem>
                            <SelectItem value="COST_CAP">Teto de Custo (Cost Cap)</SelectItem>
                            <SelectItem value="MINIMUM_ROAS">ROAS Mínimo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Campo condicional: bid_amount para BID_CAP e COST_CAP */}
                      {(adset.bid_strategy === "LOWEST_COST_WITH_BID_CAP" || adset.bid_strategy === "COST_CAP") && (
                        <div className="space-y-2">
                          <Label  className="text-foreground/90 font-semibold text-xs">
                            {adset.bid_strategy === "LOWEST_COST_WITH_BID_CAP" ? "Valor Máximo do Lance (R$)" : "Teto de CPA/CPL (R$)"}
                          </Label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-foreground/90">R$</span>
                            <Input type="number" value={adset.bid_amount} onChange={(e) => upd({ bid_amount: e.target.value })} placeholder="Ex: 5.00" className="bg-black/5 dark:bg-black/50 border-primary/20 text-foreground rounded-xl pl-10 h-11 focus-visible:ring-rose-500/50" />
                          </div>
                        </div>
                      )}
                      {/* Campo condicional: ROAS mínimo */}
                      {adset.bid_strategy === "MINIMUM_ROAS" && (
                        <div className="space-y-2">
                          <Label  className="text-foreground/90 font-semibold text-xs">ROAS Mínimo (ex: 1.5 = 150%)</Label>
                          <Input type="number" step="0.1" value={adset.roas_average_floor || ""} onChange={(e) => upd({ roas_average_floor: e.target.value })} placeholder="Ex: 1.5" className="bg-black/5 dark:bg-black/50 border-primary/20 text-foreground rounded-xl h-11 focus-visible:ring-amber-500/50" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

              <div className="glass-card border border-border rounded-2xl p-6 shadow-xl space-y-6">
                   <div className="space-y-1 pb-3 border-b border-border">
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Cronograma Logístico (Schedule Calendar)</h3>
                   </div>
                   <div className="flex flex-col gap-6">
                      <div className="space-y-2">
                         <Label  className="text-foreground/90 font-semibold text-xs">Data de Início</Label>
                         <input type="datetime-local" value={adset.start_time} onChange={(e) => upd({ start_time: e.target.value })} className="flex h-11 w-full rounded-xl border border-border bg-black/5 dark:bg-black/50 px-4 py-2 text-sm text-foreground focus-visible:outline-none focus:ring-1 focus:ring-primary/50" />
                      </div>
                      <div className="space-y-2">
                         <Label  className="text-foreground/90 font-semibold text-xs">Data de Encerramento (Opcional)</Label>
                         <input type="datetime-local" value={adset.end_time} onChange={(e) => upd({ end_time: e.target.value })} className="flex h-11 w-full rounded-xl border border-border bg-black/5 dark:bg-black/50 px-4 py-2 text-sm text-foreground/90 focus-visible:outline-none focus:ring-1 focus:ring-white/10" />
                      </div>
                   </div>
                </div>

                <LocationPicker adset={adset} upd={upd} />
                {adset.advantage_audience === 0 && (
                <div className="glass-card border border-border rounded-2xl p-6 shadow-xl space-y-6">
                     <div className="space-y-1 pb-3 border-b border-border">
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Demografia Base</h3>
                     </div>
                     <div className="flex flex-col gap-4">
                       <div className="space-y-2">
                          <Label  className="text-foreground/90 font-semibold text-xs">Idade (Low Limit)</Label>
                          <Select value={adset.age_min} onValueChange={(v) => upd({ age_min: v })}><SelectTrigger  className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 48 }, (_, i) => i + 18).map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select>
                       </div>
                       <div className="space-y-2">
                          <Label  className="text-foreground/90 font-semibold text-xs">Idade (Upper Limit)</Label>
                          <Select value={adset.age_max} onValueChange={(v) => upd({ age_max: v })}><SelectTrigger  className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 48 }, (_, i) => i + 18).map((n) => <SelectItem key={n} value={String(n)}>{n === 65 ? "65+" : n}</SelectItem>)}</SelectContent></Select>
                       </div>
                       <div className="space-y-2">
                          <Label  className="text-foreground/90 font-semibold text-xs">Gênero</Label>
                          <Select value={adset.genders} onValueChange={(v) => upd({ genders: v })}><SelectTrigger  className="bg-black/5 dark:bg-black/50 border-border text-foreground rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todo Espectro Livre</SelectItem><SelectItem value="MALE">Apenas Homens (M)</SelectItem><SelectItem value="FEMALE">Apenas Mulheres (F)</SelectItem></SelectContent></Select>
                       </div>
                     </div>
                  </div>
                )}

                {/* Segmentação */}
                <div className="pt-2">
                   <TargetingPanel adset={adset} upd={upd} />
                </div>

                {/* ── Posicionamentos ── */}
              <div className="glass-card border border-border rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div>
                      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Posicionamentos</h3>
                      <p className="text-[11px] text-foreground/90 mt-0.5">Onde o anúncio será exibido</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-foreground/90">Advantage+</span>
                      <button onClick={() => upd({ placements_type: adset.placements_type === "ADVANTAGE" ? "MANUAL" : "ADVANTAGE" })}
                        className={`w-10 h-5 rounded-full transition-colors flex items-center p-0.5 ${adset.placements_type === "ADVANTAGE" ? "bg-accent" : "bg-muted-foreground/20"}`}>
                        <div className={`bg-white w-4 h-4 rounded-full transition-transform ${adset.placements_type === "ADVANTAGE" ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                      <span className="text-xs text-foreground/90">Manual</span>
                    </div>
                  </div>

                  {adset.placements_type === "ADVANTAGE" ? (
                    <p className="text-sm text-foreground/90 py-2">
                      A Meta otimiza automaticamente onde seu anúncio é exibido para maximizar o resultado com o menor custo.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {/* Plataformas */}
                      <div className="space-y-3">
                        <Label  className="text-foreground/90 text-xs font-semibold">Plataformas</Label>
                        <div className="flex flex-wrap gap-3">
                          {[
                            { val: "facebook", label: "Facebook" },
                            { val: "instagram", label: "Instagram" },
                            { val: "audience_network", label: "Audience Network" },
                            { val: "messenger", label: "Messenger" },
                          ].map((plt) => {
                            const checked = adset.publisher_platforms?.includes(plt.val);
                            return (
                              <label key={plt.val} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-all ${checked ? "border-accent/60 bg-primary/10 text-accent/70" : "border-border text-foreground/90 border-border"}`}>
                                <input type="checkbox" className="hidden" checked={!!checked}
                                  onChange={(e) => {
                                    const curr = adset.publisher_platforms || [];
                                    upd({ publisher_platforms: e.target.checked ? [...curr, plt.val] : curr.filter(x => x !== plt.val) });
                                  }} />
                                {plt.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Facebook Positions */}
                      {adset.publisher_platforms?.includes("facebook") && (
                        <div className="space-y-3">
                          <Label  className="text-foreground/90 text-xs font-semibold">Posições no Facebook</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { val: "feed", label: "Feed" },
                              { val: "story", label: "Stories" },
                              { val: "reels", label: "Reels" },
                              { val: "video_feeds", label: "Feed de Vídeos" },
                              { val: "right_hand_column", label: "Coluna Direita" },
                              { val: "marketplace", label: "Marketplace" },
                              { val: "search", label: "Resultados de Busca" },
                              { val: "groups_feed", label: "Feed de Grupos" },
                              { val: "instream_video", label: "Vídeos In-stream" },
                            ].map((pos) => {
                              const checked = adset.facebook_positions?.includes(pos.val);
                              return (
                                <label key={pos.val} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${checked ? "border-accent/40 bg-primary/10 text-accent/70" : "border-border text-foreground/90 border-border"}`}>
                                  <input type="checkbox" className="hidden" checked={!!checked}
                                    onChange={(e) => {
                                      const curr = adset.facebook_positions || [];
                                      upd({ facebook_positions: e.target.checked ? [...curr, pos.val] : curr.filter(x => x !== pos.val) });
                                    }} />
                                  {pos.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Instagram Positions */}
                      {adset.publisher_platforms?.includes("instagram") && (
                        <div className="space-y-3">
                          <Label  className="text-foreground/90 text-xs font-semibold">Posições no Instagram</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { val: "stream", label: "Feed" },
                              { val: "story", label: "Stories" },
                              { val: "reels", label: "Reels" },
                              { val: "explore", label: "Explorar" },
                              { val: "explore_home", label: "Home Explorar" },
                              { val: "profile_feed", label: "Perfil" },
                              { val: "search", label: "Pesquisa IG" },
                            ].map((pos) => {
                              const checked = adset.instagram_positions?.includes(pos.val);
                              return (
                                <label key={pos.val} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${checked ? "border-accent/40 bg-primary/10 text-accent/70" : "border-border text-foreground/90 border-border"}`}>
                                  <input type="checkbox" className="hidden" checked={!!checked}
                                    onChange={(e) => {
                                      const curr = adset.instagram_positions || [];
                                      upd({ instagram_positions: e.target.checked ? [...curr, pos.val] : curr.filter(x => x !== pos.val) });
                                    }} />
                                  {pos.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Messenger Positions */}
                      {adset.publisher_platforms?.includes("messenger") && (
                        <div className="space-y-3">
                          <Label  className="text-foreground/90 text-xs font-semibold">Posições no Messenger</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { val: "messenger_home", label: "Inbox Messenger" },
                              { val: "story", label: "Stories Messenger" },
                            ].map((pos) => {
                              const checked = adset.messenger_positions?.includes(pos.val);
                              return (
                                <label key={pos.val} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${checked ? "border-primary/20 bg-primary/10 text-primary" : "border-border text-foreground/90 border-border"}`}>
                                  <input type="checkbox" className="hidden" checked={!!checked}
                                    onChange={(e) => {
                                      const curr = adset.messenger_positions || [];
                                      upd({ messenger_positions: e.target.checked ? [...curr, pos.val] : curr.filter(x => x !== pos.val) });
                                    }} />
                                  {pos.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Audience Network Positions */}
                      {adset.publisher_platforms?.includes("audience_network") && (
                        <div className="space-y-3">
                          <Label  className="text-foreground/90 text-xs font-semibold">Posições na Audience Network</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { val: "classic", label: "Nativa / Banner / Intersticial" },
                              { val: "rewarded_video", label: "Vídeo com Recompensa" },
                            ].map((pos) => {
                              const checked = adset.audience_network_positions?.includes(pos.val);
                              return (
                                <label key={pos.val} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${checked ? "border-accent/40 bg-primary/10 text-accent/70" : "border-border text-foreground/90 border-border"}`}>
                                  <input type="checkbox" className="hidden" checked={!!checked}
                                    onChange={(e) => {
                                      const curr = adset.audience_network_positions || [];
                                      upd({ audience_network_positions: e.target.checked ? [...curr, pos.val] : curr.filter(x => x !== pos.val) });
                                    }} />
                                  {pos.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Dispositivos */}
                      <div className="space-y-3">
                        <Label  className="text-foreground/90 text-xs font-semibold">Dispositivos</Label>
                        <div className="flex gap-3">
                          {[{ val: "mobile", label: "Mobile" }, { val: "desktop", label: "Desktop" }].map((dev) => {
                            const checked = adset.device_platforms?.includes(dev.val);
                            return (
                              <label key={dev.val} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer transition-all ${checked ? "border-primary/20 bg-primary/10 text-primary" : "border-border text-foreground/90 border-border"}`}>
                                <input type="checkbox" className="hidden" checked={!!checked}
                                  onChange={(e) => {
                                    const curr = adset.device_platforms || [];
                                    upd({ device_platforms: e.target.checked ? [...curr, dev.val] : curr.filter(x => x !== dev.val) });
                                  }} />
                                {dev.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
            );
          })()}

          {/* Ad Panel */}
          {actNode?.type === "ad" && activeAdContext && (
            <div className="w-full space-y-6">
              <div className="flex justify-between items-end pb-4 border-b border-border">
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Construção Criativa Visual</h2>
                  <p className="text-sm text-foreground/90 mt-1">Configuração de ponta do Post final Renderizado que as massas receberão.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => duplicateAd(activeAdContext.adset.id, activeAdContext.ad.id)} className="bg-card border-border text-primary hover:text-accent/70 hover:bg-muted rounded-xl"><Copy className="h-4 w-4 mr-2" /> Clonar Ad</Button>
                </div>
              </div>

              <div className="glass-card border border-primary/20 rounded-2xl p-6 shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 font-mono font-bold text-4xl text-primary/[0.03] pointer-events-none select-none">
                  AD NAME
                </div>
                <div className="space-y-2 relative z-10">
                   <Label  className="text-primary font-bold text-[11px] uppercase tracking-widest">Apelido (Reference Título) *</Label>
                   <Input value={activeAdContext.ad.name} onChange={(e) => updateAd(activeAdContext.adset.id, activeAdContext.ad.id, { name: e.target.value })} className="bg-black/5 dark:bg-black/5 dark:bg-black/60 border-border text-foreground rounded-xl h-11 text-base font-medium focus-visible:ring-primary/50 my-1" placeholder="Ex: AD 01 - Img Promo..." />
                </div>
              </div>

              <AdPanel
                ad={activeAdContext.ad}
                pages={pages}
                loadingPages={loadingPages}
                onChange={(par) => updateAd(activeAdContext.adset.id, activeAdContext.ad.id, par)}
              />
            </div>
          )}
          
          {/* Spacer to guarantee scroll clearance above the floating action bar */}
          <div className="h-20 flex-shrink-0 pointer-events-none w-full" />
        </div>

        {/* Global Floating Action Bar inside Content */}
        <div className="absolute bottom-0 inset-x-0 p-4 border-t border-border bg-black/10 dark:bg-black/80 backdrop-blur-3xl z-40">
           <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
              {saveSuccess ? (
                <p className="text-primary text-xs font-semibold flex items-center gap-2">
                  <Play className="w-4 h-4 shrink-0" /> Salvo com sucesso!
                </p>
              ) : errorMsg ? (
                <p className="text-primary text-xs font-semibold flex items-center gap-2 max-w-sm truncate">
                  <Trash2 className="w-4 h-4 shrink-0" /> {errorMsg}
                </p>
              ) : <div />}
              <div className="flex gap-3 ml-auto">
                <Button onClick={() => {
                  const errs = validateCampaignTree(tree, tree.adsets);
                  setValidationErrs(errs);
                  setShowValidationModal(true);
                }} variant="outline" className="border-border bg-muted hover:bg-muted-foreground/20 text-foreground/90 rounded-xl h-12 font-bold px-6">
                   <Target  className="h-4 w-4 mr-2 text-primary" /> Consultar Lint / Verificar
                </Button>
                <Button  onClick={editMode ? handleSaveEdits : handleCreate} disabled={loading} className="bg-accent hover:bg-accent text-foreground px-8 font-bold h-12 rounded-xl shadow-[0_4px_24px_-8px_rgba(37,99,235,1)] transition-all">
                   {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5 fill-white" />}
                   {editMode ? "Salvar Alterações" : "Publicar Matriz"}
                </Button>
              </div>
           </div>
        </div>
      </div>

    </div>

      {/* Validation Modal — rendered outside overflow-hidden container */}
      {showValidationModal && (
        <div className="fixed inset-0 z-[200] bg-black/10 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-black/5 dark:bg-black/5 dark:bg-black/20">
               <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-3">
                 Relatório de Validação
                 <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${validationErrs.length === 0 ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary"}`}>
                   {validationErrs.length} {validationErrs.length === 1 ? "problema" : "problemas"}
                 </span>
               </h2>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
               {validationErrs.length === 0 ? (
                 <div className="py-8 text-center text-primary flex flex-col items-center gap-3">
                   <Target className="h-10 w-10" />
                   <p className="font-bold text-lg">Estrutura validada com sucesso.</p>
                   <p className="text-xs text-foreground/90">Nenhum erro estrutural encontrado. Pode publicar.</p>
                 </div>
               ) : (
                 validationErrs.map((err, i) => (
                   <div key={i} className={`p-4 rounded-xl border flex items-start gap-3 ${err.level === 'error' ? 'bg-primary/10 border-primary/20' : 'bg-primary/10 border-primary/20'}`}>
                     <div className={`mt-0.5 ${err.level === 'error' ? 'text-primary' : 'text-primary'}`}>
                       <Crosshair className="h-4 w-4" />
                     </div>
                     <div className="flex-1">
                       <p className={`font-bold text-sm ${err.level === 'error' ? 'text-primary' : 'text-primary'}`}>{err.message}</p>
                       <p className="text-xs text-foreground/90 mt-1 uppercase tracking-wider font-bold">{err.type} › {err.nodeName}</p>
                     </div>
                     <Button  size="sm" variant="ghost" className="h-8 hover:bg-black/5 dark:hover:bg-black/5 dark:bg-white/5 text-foreground/90 hover:text-foreground" onClick={() => { jumpToError(err.nodeId); setShowValidationModal(false); }}>Ir ao campo</Button>
                   </div>
                 ))
               )}
            </div>
            <div className="p-5 border-t border-border bg-black/5 dark:bg-black/5 dark:bg-black/40 flex justify-end">
               <Button onClick={() => setShowValidationModal(false)} className="bg-muted hover:bg-muted-foreground/20 text-foreground font-bold h-11 px-8 rounded-xl">Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

