"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Loader2, Save, Play, Pause, Hash, Monitor,
  Smartphone, Camera, RefreshCw, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useSWR from "swr";
import { TargetingPanel, LocationPicker } from "./tree-components";
import { AdPanel } from "./ad-panel";
import type { AdSetNode } from "./tree-builder";

export type EditTarget = {
  id: string;
  type: "campaign" | "adset" | "ad";
  name: string;
  adset_id?: string;
};

type AdPreviewFormat =
  | "DESKTOP_FEED_STANDARD"
  | "MOBILE_FEED_STANDARD"
  | "INSTAGRAM_STANDARD"
  | "INSTAGRAM_STORY"
  | "MOBILE_INTERSTITIAL";

const PREVIEW_FORMATS: { value: AdPreviewFormat; label: string; icon: React.ElementType }[] = [
  { value: "DESKTOP_FEED_STANDARD", label: "Feed Desktop", icon: Monitor },
  { value: "MOBILE_FEED_STANDARD", label: "Feed Mobile", icon: Smartphone },
  { value: "INSTAGRAM_STANDARD", label: "Instagram Feed", icon: Camera },
  { value: "INSTAGRAM_STORY", label: "Instagram Story", icon: Camera },
];

// ── Ad Preview Component ────────────────────────────────────────────────────────
function AdPreviewFrame({ adId }: { adId: string }) {
  const [format, setFormat] = useState<AdPreviewFormat>("MOBILE_FEED_STANDARD");
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  const previewUrl = `/api/meta/ad-preview?ad_id=${adId}&format=${format}`;

  return (
    <div className="space-y-3">
      {/* Format Selector */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {PREVIEW_FORMATS.map(f => (
          <button
            key={f.value}
            onClick={() => { setFormat(f.value); setKey(k => k + 1); setLoading(true); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
              format === f.value
                ? "bg-primary/15 border-accent/40 text-accent/70"
                : "bg-white/5 border-white/8 text-foreground/90 hover:text-foreground/90 hover:border-white/15"
            }`}
          >
            <f.icon className="h-3 w-3" />
            {f.label}
          </button>
        ))}
        <button
          onClick={() => { setKey(k => k + 1); setLoading(true); }}
          className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-foreground/90 hover:text-foreground/90 hover:bg-white/5 transition-colors"
          title="Recarregar preview"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Preview iframe */}
      <div className="relative rounded-xl overflow-hidden border border-white/8 bg-zinc-950" style={{ minHeight: 380 }}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-foreground/90 font-mono">Renderizando preview via Graph API...</span>
          </div>
        )}
        <iframe
          key={key}
          src={previewUrl}
          className="w-full border-0"
          style={{ height: 480, opacity: loading ? 0 : 1, transition: "opacity 0.3s" }}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
      <p className="text-[10px] text-foreground/90 text-center">
        Preview renderizado via Meta Graph API · Apenas leitura
      </p>
    </div>
  );
}

// ── Main Drawer ────────────────────────────────────────────────────────────────
interface FullEditDrawerProps {
  target: EditTarget;
  onClose: () => void;
  onSaved: () => void;
}

export function FullEditDrawer({ target, onClose, onSaved }: FullEditDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [tab, setTab] = useState<"geral" | "publico" | "posicionamento" | "criativo" | "preview">("geral");

  const [camp, setCamp] = useState<any>(null);
  const [adset, setAdset] = useState<AdSetNode | null>(null);
  const [ad, setAd] = useState<any>(null);

  // Define fetcher
  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  // Fetch Meta Pages so the AdPanel dropdowns don't clear selections
  const { data: pagesData, isLoading: loadingPages } = useSWR(
    target.type === "ad" ? "/api/meta/pages" : null,
    fetcher
  );
  const pages = pagesData?.data || [];

  // Load full entity data from Graph API
  useEffect(() => {
    async function fetchFull() {
      try {
        setLoading(true); setErrorMsg(""); setSuccessMsg("");
        const res = await fetch(`/api/meta/entity-full?id=${target.id}&type=${target.type}`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Falha ao carregar entity-full");
        const meta = result.data;

        if (target.type === "campaign") {
          setCamp({
            ...meta,
            daily_budget: meta.daily_budget ? (parseInt(meta.daily_budget) / 100).toString() : "",
            lifetime_budget: meta.lifetime_budget ? (parseInt(meta.lifetime_budget) / 100).toString() : "",
          });
        } else if (target.type === "adset") {
          setAdset({
            ...meta,
            daily_budget: meta.daily_budget ? (parseInt(meta.daily_budget) / 100).toString() : "",
            lifetime_budget: meta.lifetime_budget ? (parseInt(meta.lifetime_budget) / 100).toString() : "",
            budget_type: meta.daily_budget ? "DAILY" : "LIFETIME",
            geo_locations: meta.targeting?.geo_locations?.countries || ["BR"],
            geo_locations_advanced: [
              ...(meta.targeting?.geo_locations?.cities?.map((c: any) => ({ type: "city", key: c.key, name: c.name || `Cidade ID ${c.key}`, radius: c.radius })) || []),
              ...(meta.targeting?.geo_locations?.regions?.map((r: any) => ({ type: "region", key: r.key, name: r.name || `Região ID ${r.key}` })) || []),
              ...(meta.targeting?.geo_locations?.zips?.map((z: any) => ({ type: "zip", key: z.key, name: z.name || `CEP ID ${z.key}` })) || []),
            ],
            age_min: meta.targeting?.age_min?.toString() || "18",
            age_max: meta.targeting?.age_max?.toString() || "65",
            genders: meta.targeting?.genders?.length === 1
              ? (meta.targeting.genders[0] === 1 ? "MALE" : "FEMALE")
              : "ALL",
            custom_audiences: meta.targeting?.custom_audiences?.map((a: any) => ({ id: a.id, name: a.name || a.id })) || [],
            excluded_custom_audiences: meta.targeting?.excluded_custom_audiences?.map((a: any) => ({ id: a.id, name: a.name || a.id })) || [],
            interests: meta.targeting?.flexible_spec?.[0]?.interests || [],
            behaviors: meta.targeting?.flexible_spec?.[0]?.behaviors || [],
            life_events: meta.targeting?.life_events || [],
            work_positions: meta.targeting?.work_positions || [],
            education_statuses: meta.targeting?.education_statuses || [],
            relationship_statuses: meta.targeting?.relationship_statuses || [],
            placements_type: meta.targeting?.publisher_platforms ? "MANUAL" : "ADVANTAGE",
            device_platforms: meta.targeting?.device_platforms || ["mobile", "desktop"],
            publisher_platforms: meta.targeting?.publisher_platforms || ["facebook", "instagram"],
            facebook_positions: meta.targeting?.facebook_positions || ["feed"],
            instagram_positions: meta.targeting?.instagram_positions || ["stream"],
            conversion_location: meta.destination_type || "WEBSITE",
            pixel_id: meta.promoted_object?.pixel_id || "",
            custom_event_type: meta.promoted_object?.custom_event_type || "LEAD",
            optimization_goal: meta.optimization_goal || "",
            bid_amount: meta.bid_amount?.toString() || "",
            dynamic_creative: false,
            start_time: meta.start_time?.slice(0, 16) || "",
            end_time: meta.end_time?.slice(0, 16) || "",
            ads: [],
          } as AdSetNode);
        } else if (target.type === "ad") {
          setAd({
            ...meta,
            id: target.id,
            creative_source: "MANUAL",
            format: meta.creative?.object_story_spec?.video_data ? "SINGLE_VIDEO" : "SINGLE_IMAGE",
            copy: meta.creative?.object_story_spec?.link_data?.message
              || meta.creative?.object_story_spec?.video_data?.message
              || meta.creative?.body || "",
            headline: meta.creative?.object_story_spec?.link_data?.name
              || meta.creative?.object_story_spec?.video_data?.title || meta.creative?.title || "",
            description: meta.creative?.object_story_spec?.link_data?.description || "",
            image_hash: meta.creative?.object_story_spec?.link_data?.image_hash || "",
            image_url: meta.creative?.image_url || meta.creative?.thumbnail_url || "",
            video_id: meta.creative?.video_id || "",
            carousel_cards: [],
            url: meta.creative?.object_story_spec?.link_data?.link
              || meta.creative?.object_story_spec?.link_data?.call_to_action?.value?.link || "",
            cta_type: meta.creative?.object_story_spec?.link_data?.call_to_action?.type || "LEARN_MORE",
            page_id: meta.creative?.object_story_spec?.page_id || "",
            instagram_actor_id: meta.creative?.object_story_spec?.instagram_actor_id || "",
            multi_advertiser: false,
          });
          setTab("criativo");
        }
      } catch (err: any) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchFull();
  }, [target.id, target.type]);

  const handleSave = async () => {
    setSaving(true); setErrorMsg(""); setSuccessMsg("");
    try {
      let payload: any = {};

      if (target.type === "campaign" && camp) {
        payload = {
          name: camp.name,
          status: camp.status,
          daily_budget: camp.daily_budget ? Math.round(parseFloat(camp.daily_budget) * 100) : undefined,
          lifetime_budget: camp.lifetime_budget ? Math.round(parseFloat(camp.lifetime_budget) * 100) : undefined,
          bid_strategy: camp.bid_strategy || undefined,
          spend_cap: camp.spend_cap ? Math.round(parseFloat(camp.spend_cap) * 100) : undefined,
        };
      } else if (target.type === "adset" && adset) {
        payload = {
          name: adset.name,
          status: (adset as any).status,
          daily_budget: adset.budget_type === "DAILY" ? Math.round(parseFloat(adset.daily_budget) * 100) : undefined,
          lifetime_budget: adset.budget_type === "LIFETIME" ? Math.round(parseFloat(adset.lifetime_budget) * 100) : undefined,
          start_time: adset.start_time || undefined,
          end_time: adset.end_time || undefined,
          optimization_goal: adset.optimization_goal || undefined,
          targeting: {
            age_min: Number(adset.age_min),
            age_max: Number(adset.age_max),
            genders: adset.genders === "MALE" ? [1] : adset.genders === "FEMALE" ? [2] : undefined,
            geo_locations: adset.geo_locations_advanced?.length > 0
              ? {
                  cities: adset.geo_locations_advanced.filter(l => l.type === "city").map(l => ({ key: l.key })),
                  regions: adset.geo_locations_advanced.filter(l => l.type === "region").map(l => ({ key: l.key })),
                  countries: adset.geo_locations_advanced.filter(l => l.type === "country").map(l => l.country_code || l.key),
                }
              : { countries: ["BR"] },
            custom_audiences: adset.custom_audiences.length > 0 ? adset.custom_audiences.map(a => ({ id: a.id })) : undefined,
            excluded_custom_audiences: adset.excluded_custom_audiences.length > 0 ? adset.excluded_custom_audiences.map(a => ({ id: a.id })) : undefined,
            flexible_spec: (adset.interests.length > 0 || adset.behaviors.length > 0) ? [{
              interests: adset.interests.length > 0 ? adset.interests : undefined,
              behaviors: adset.behaviors.length > 0 ? adset.behaviors : undefined,
            }] : undefined,
            publisher_platforms: adset.placements_type === "MANUAL" ? adset.publisher_platforms : undefined,
          },
        };
        if (adset.pixel_id) {
          payload.promoted_object = { pixel_id: adset.pixel_id, custom_event_type: adset.custom_event_type };
        }
      } else if (target.type === "ad" && ad) {
        payload = { name: ad.name, status: ad.status };
        const baseSpec = {
          page_id: ad.page_id,
          ...(ad.instagram_actor_id ? { instagram_actor_id: ad.instagram_actor_id } : {}),
        };
        let object_story_spec: any;
        if (ad.format === "SINGLE_VIDEO" && ad.video_id) {
          object_story_spec = {
            ...baseSpec,
            video_data: {
              video_id: ad.video_id,
              message: ad.copy || "",
              title: ad.headline || ad.name || "",
              ...(ad.cta_type ? { call_to_action: { type: ad.cta_type, value: { link: ad.url || "https://comarka.com.br" } } } : {}),
            },
          };
        } else {
          object_story_spec = {
            ...baseSpec,
            link_data: {
              link: ad.url || "https://comarka.com.br",
              message: ad.copy || "",
              name: ad.headline || ad.name || "",
              description: ad.description || "",
              image_hash: ad.image_hash || "28e08d67ae4c6d04effb4aa1a971dcb3",
              ...(ad.cta_type ? { call_to_action: { type: ad.cta_type, value: { link: ad.url || "https://comarka.com.br" } } } : {}),
            },
          };
        }
        payload.creative = { object_story_spec };
      }

      const res = await fetch("/api/meta/editar-completo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, type: target.type, payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setSuccessMsg("Salvo com sucesso!");
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Tab definitions per type
  const tabs =
    target.type === "campaign"
      ? [{ id: "geral", label: "Geral" }]
      : target.type === "adset"
      ? [
          { id: "geral", label: "Geral & Budget" },
          { id: "publico", label: "Público" },
          { id: "posicionamento", label: "Posicionamentos" },
        ]
      : [
          { id: "criativo", label: "Criativo" },
          { id: "preview", label: "Preview Live" },
        ];

  const typeLabel = target.type === "campaign" ? "CAMPANHA" : target.type === "adset" ? "CONJUNTO" : "ANÚNCIO";
  const typeBg = target.type === "campaign" ? "bg-primary/10 text-primary border-primary/20"
    : target.type === "adset" ? "bg-primary/10 text-primary border-primary/20"
    : "bg-primary/10 text-primary border-primary/20";

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999]" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 210 }}
        className="fixed top-0 right-0 bottom-0 w-[640px] bg-[#09090b] border-l border-white/8 shadow-2xl z-[10000] flex flex-col"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-white/5 bg-zinc-950 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${typeBg}`}>
                {typeLabel}
              </span>
              <span className="text-[10px] text-foreground/90 font-mono flex items-center gap-1">
                <Hash className="h-3 w-3" />{target.id}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground truncate max-w-[420px]">{target.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-foreground/90 hover:text-foreground transition-colors flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex gap-0.5 px-6 pt-4 border-b border-white/5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-2 text-xs font-medium rounded-t-md transition-all border-b-2 -mb-px ${
                tab === t.id ? "text-foreground border-accent" : "text-foreground/90 border-transparent hover:text-foreground/90"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-primary">
              <Loader2 className="h-10 w-10 animate-spin" />
              <p className="text-xs font-bold font-mono tracking-widest uppercase">Carregando via Graph API...</p>
            </div>
          ) : (
            <div className="space-y-5">

              {/* ── CAMPAIGN FORM ── */}
              {target.type === "campaign" && camp && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label  className="text-xs font-semibold text-foreground/90">Nome da Campanha</Label>
                    <Input value={camp.name || ""} onChange={e => setCamp({ ...camp, name: e.target.value })} className="bg-white/5 border-white/10 text-foreground" />
                  </div>

                  {/* Status Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/[0.02]">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Status da Campanha</p>
                      <p className="text-xs text-foreground/90">Ativar ou pausar a veiculação imediatamente</p>
                    </div>
                    <button
                      onClick={() => setCamp({ ...camp, status: camp.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        camp.status === "ACTIVE"
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-primary/20 bg-primary/10 text-primary"
                      }`}
                    >
                      {camp.status === "ACTIVE" ? <><Play className="h-3 w-3" /> Ativa</> : <><Pause className="h-3 w-3" /> Pausada</>}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label  className="text-xs font-semibold text-foreground/90">Orçamento Diário (R$)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/90 text-sm">R$</span>
                        <Input
                          type="number"
                          value={camp.daily_budget || ""}
                          onChange={e => setCamp({ ...camp, daily_budget: e.target.value })}
                          className="bg-white/5 border-white/10 text-foreground pl-9"
                          placeholder="Ex: 50.00"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label  className="text-xs font-semibold text-foreground/90">Bid Strategy</Label>
                      <Select value={camp.bid_strategy || "LOWEST_COST_WITHOUT_CAP"} onValueChange={v => setCamp({ ...camp, bid_strategy: v })}>
                        <SelectTrigger  className="bg-white/5 border-white/10 text-foreground h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOWEST_COST_WITHOUT_CAP">Volume Máximo (Padrão)</SelectItem>
                          <SelectItem value="COST_CAP">Teto de Custo</SelectItem>
                          <SelectItem value="LOWEST_COST_WITH_BID_CAP">Teto de Lance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label  className="text-xs font-semibold text-foreground/90">Limite de Gasto Total da Campanha (R$) — Opcional</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/90 text-sm">R$</span>
                      <Input
                        type="number"
                        value={camp.spend_cap || ""}
                        onChange={e => setCamp({ ...camp, spend_cap: e.target.value })}
                        className="bg-white/5 border-white/10 text-foreground pl-9"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label  className="text-xs font-semibold text-foreground/90">Objetivo (somente leitura)</Label>
                      <Input  value={camp.objective || ""} readOnly className="bg-white/[0.02] border-white/5 text-foreground/90 cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                      <Label  className="text-xs font-semibold text-foreground/90">Data de Encerramento</Label>
                      <input
                        type="datetime-local"
                        value={camp.stop_time?.slice(0, 16) || ""}
                        onChange={e => setCamp({ ...camp, stop_time: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── ADSET FORMS ── */}
              {target.type === "adset" && adset && (
                <>
                  {/* Tab: Geral */}
                  {tab === "geral" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label  className="text-xs font-semibold text-foreground/90">Nome do Conjunto</Label>
                        <Input value={adset.name || ""} onChange={e => setAdset({ ...adset, name: e.target.value })} className="bg-white/5 border-white/10 text-foreground" />
                      </div>

                      {/* Status */}
                      <div className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/[0.02]">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Status do Conjunto</p>
                          <p className="text-xs text-foreground/90">Ativar ou pausar véiculação deste conjunto</p>
                        </div>
                        <button
                          onClick={() => setAdset({ ...adset, ...{ status: (adset as any).status === "ACTIVE" ? "PAUSED" : "ACTIVE" } } as AdSetNode)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                            (adset as any).status === "ACTIVE"
                              ? "border-primary/20 bg-primary/10 text-primary"
                              : "border-primary/20 bg-primary/10 text-primary"
                          }`}
                        >
                          {(adset as any).status === "ACTIVE" ? <><Play className="h-3 w-3" /> Ativo</> : <><Pause className="h-3 w-3" /> Pausado</>}
                        </button>
                      </div>

                      {/* Budget */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label  className="text-xs font-semibold text-foreground/90">Tipo de Orçamento</Label>
                          <Select value={adset.budget_type} onValueChange={v => setAdset({ ...adset, budget_type: v as "DAILY" | "LIFETIME" })}>
                            <SelectTrigger  className="bg-white/5 border-white/10 text-foreground h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DAILY">Diário</SelectItem>
                              <SelectItem value="LIFETIME">Vitalício</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label  className="text-xs font-semibold text-foreground/90">Valor (R$)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/90 text-sm">R$</span>
                            <Input
                              type="number"
                              value={adset.budget_type === "DAILY" ? adset.daily_budget : adset.lifetime_budget}
                              onChange={e => adset.budget_type === "DAILY"
                                ? setAdset({ ...adset, daily_budget: e.target.value })
                                : setAdset({ ...adset, lifetime_budget: e.target.value })}
                              className="bg-white/5 border-white/10 text-foreground pl-9 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cronograma */}
                      <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                        <div className="space-y-2">
                          <Label  className="text-xs font-semibold text-foreground/90">Início</Label>
                          <input type="datetime-local" value={adset.start_time || ""} onChange={e => setAdset({ ...adset, start_time: e.target.value })}
                            className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                        </div>
                        <div className="space-y-2">
                          <Label  className="text-xs font-semibold text-foreground/90">Fim (Opcional)</Label>
                          <input type="datetime-local" value={adset.end_time || ""} onChange={e => setAdset({ ...adset, end_time: e.target.value })}
                            className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground/90 focus:outline-none focus:ring-1 focus:ring-white/10" />
                        </div>
                      </div>

                      {/* Optimization */}
                      <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                        <div className="space-y-2">
                          <Label  className="text-xs font-semibold text-foreground/90">Local de Conversão</Label>
                          <Select value={adset.conversion_location} onValueChange={v => setAdset({ ...adset, conversion_location: v })}>
                            <SelectTrigger  className="bg-white/5 border-white/10 text-foreground h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="WEBSITE">Site (Pixel)</SelectItem>
                              <SelectItem value="APP">App</SelectItem>
                              <SelectItem value="MESSAGING_APP">WhatsApp / Direct</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label  className="text-xs font-semibold text-foreground/90">Pixel ID</Label>
                          <Input value={adset.pixel_id} onChange={e => setAdset({ ...adset, pixel_id: e.target.value })} className="bg-white/5 border-white/10 text-foreground font-mono text-xs" placeholder="Ex: 123456789" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab: Público */}
                  {tab === "publico" && (
                    <div className="space-y-5">
                      {/* Idade & Gênero */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-foreground/90 uppercase tracking-widest">Dados Demográficos</h3>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label  className="text-xs text-foreground/90">Idade Mín.</Label>
                            <Select value={adset.age_min} onValueChange={v => setAdset({ ...adset, age_min: v })}>
                              <SelectTrigger  className="bg-white/5 border-white/10 text-foreground h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>{Array.from({ length: 48 }, (_, i) => i + 18).map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label  className="text-xs text-foreground/90">Idade Máx.</Label>
                            <Select value={adset.age_max} onValueChange={v => setAdset({ ...adset, age_max: v })}>
                              <SelectTrigger  className="bg-white/5 border-white/10 text-foreground h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>{Array.from({ length: 48 }, (_, i) => i + 18).map(n => <SelectItem key={n} value={String(n)}>{n === 65 ? "65+" : n}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label  className="text-xs text-foreground/90">Gênero</Label>
                            <Select value={adset.genders} onValueChange={v => setAdset({ ...adset, genders: v })}>
                              <SelectTrigger  className="bg-white/5 border-white/10 text-foreground h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">Todos</SelectItem>
                                <SelectItem value="MALE">Só Homens</SelectItem>
                                <SelectItem value="FEMALE">Só Mulheres</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <LocationPicker adset={adset} upd={(p) => setAdset({ ...adset, ...p } as AdSetNode)} />
                      <TargetingPanel adset={adset} upd={(p) => setAdset({ ...adset, ...p } as AdSetNode)} />
                    </div>
                  )}

                  {/* Tab: Posicionamentos */}
                  {tab === "posicionamento" && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between p-4 rounded-xl border border-white/8 bg-white/[0.02]">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Advantage+ Placements</p>
                          <p className="text-xs text-foreground/90">A Meta distribui automaticamente nos melhores canais</p>
                        </div>
                        <button
                          onClick={() => setAdset({ ...adset, placements_type: adset.placements_type === "ADVANTAGE" ? "MANUAL" : "ADVANTAGE" })}
                          className={`w-11 h-6 rounded-full transition-colors flex items-center p-1 ${adset.placements_type === "ADVANTAGE" ? "bg-accent" : "bg-zinc-700"}`}
                        >
                          <div className={`bg-white w-4 h-4 rounded-full transition-transform ${adset.placements_type === "ADVANTAGE" ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                      </div>

                      {adset.placements_type === "MANUAL" && (
                        <div className="space-y-4">
                          {[
                            { platform: "facebook", positions: adset.facebook_positions, key: "facebook_positions", label: "Facebook", opts: ["feed", "story", "video_feeds", "right_hand_column", "marketplace"] },
                            { platform: "instagram", positions: adset.instagram_positions, key: "instagram_positions", label: "Instagram", opts: ["stream", "story", "reels", "explore"] },
                          ].map(({ label, positions, key, opts }) => (
                            <div key={key} className="space-y-2">
                              <Label  className="text-xs font-bold text-foreground/90 uppercase tracking-wide">{label}</Label>
                              <div className="flex flex-wrap gap-2">
                                {opts.map(pos => {
                                  const active = positions?.includes(pos);
                                  return (
                                    <button
                                      key={pos}
                                      onClick={() => {
                                        const cur: string[] = (adset as any)[key] || [];
                                        const next = cur.includes(pos) ? cur.filter(p => p !== pos) : [...cur, pos];
                                        setAdset({ ...adset, [key]: next } as any);
                                      }}
                                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${active ? "bg-white/15 border-white/30 text-foreground" : "bg-white/[0.03] border-white/8 text-foreground/90 hover:text-foreground/90"}`}
                                    >
                                      {pos}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── AD FORMS ── */}
              {target.type === "ad" && ad && (
                <>
                  {tab === "criativo" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label  className="text-xs font-semibold text-foreground/90">Nome do Anúncio</Label>
                        <Input value={ad.name || ""} onChange={e => setAd({ ...ad, name: e.target.value })} className="bg-white/5 border-white/10 text-foreground" />
                      </div>
                      {/* Status */}
                      <div className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/[0.02]">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Status do Anúncio</p>
                        </div>
                        <button
                          onClick={() => setAd({ ...ad, status: ad.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${ad.status === "ACTIVE" ? "border-primary/20 bg-primary/10 text-primary" : "border-primary/20 bg-primary/10 text-primary"}`}
                        >
                          {ad.status === "ACTIVE" ? <><Play className="h-3 w-3" /> Ativo</> : <><Pause className="h-3 w-3" /> Pausado</>}
                        </button>
                      </div>
                      <AdPanel ad={ad} pages={pages} loadingPages={loadingPages} onChange={(p) => setAd({ ...ad, ...p })} />
                    </div>
                  )}
                  {tab === "preview" && (
                    <AdPreviewFrame adId={target.id} />
                  )}
                </>
              )}

              {/* Messages */}
              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  {successMsg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab !== "preview" && (
          <div className="p-5 border-t border-white/5 bg-zinc-950 flex justify-between items-center flex-shrink-0">
            <Button  variant="ghost" onClick={onClose} disabled={saving} className="text-foreground/90 hover:text-foreground">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading || saving}
              className="bg-primary/10 hover:bg-primary/10 text-foreground font-bold px-6 shadow-[0_0_20px_rgba(16,185,129,0.25)] border-0 gap-2"
            >
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                : <><Save className="h-4 w-4" /> Salvar e Publicar</>}
            </Button>
          </div>
        )}
      </motion.div>
    </>,
    document.body
  );
}
