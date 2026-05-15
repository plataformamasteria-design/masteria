"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Loader2, Target, Brain, Users, Heart, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TargetingItem, AdSetNode } from "./tree-builder";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export function PixelSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data, isLoading } = useSWR("/api/meta/pixels", fetcher);
  const pixels: { id: string; name: string }[] = data?.data || [];

  if (!isLoading && pixels.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ID do Pixel (manual)"
        className="bg-black/50 border-white/10 text-foreground rounded-xl h-11 font-mono text-xs focus-visible:ring-primary/50"
      />
    );
  }

  return (
    <Select value={value || "__NONE__"} onValueChange={(v) => onChange(v === "__NONE__" ? "" : v)}>
      <SelectTrigger className="bg-black/50 border-white/10 text-foreground rounded-xl h-11 text-xs">
        {isLoading ? (
          <span className="text-foreground/90 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando pixels...
          </span>
        ) : (
          <SelectValue placeholder="Selecionar pixel..." />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__NONE__">Nenhum pixel</SelectItem>
        {pixels.map((px) => (
          <SelectItem key={px.id} value={px.id}>
            {px.name} — <span className="font-mono text-foreground/90">{px.id}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AsyncCombobox({ items, setItems, endpoint, placeholder, searchKey, minChars = 2 }: {
  items: TargetingItem[]; setItems: (t: TargetingItem[]) => void;
  endpoint: string; placeholder: string; searchKey: string; minChars?: number;
}) {
  const [inp, setInp] = useState("");
  const [open, setOpen] = useState(false);
  const shouldFetch = open && inp.length >= minChars;
  const url = shouldFetch ? `${endpoint}${searchKey ? `?${searchKey}=${encodeURIComponent(inp)}` : ""}` : null;
  const { data, isLoading } = useSWR(url, fetcher);
  const list: TargetingItem[] = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="relative flex flex-wrap gap-1.5 p-2 bg-white/5 border border-white/10 rounded-md min-h-10 items-center focus-within:border-primary/20 transition-colors">
      {items.map((t, i) => (
        <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-xs text-primary">
          {t.name}
          <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="hover:text-foreground ml-1">
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <div className="flex-1 min-w-[120px] relative">
        <input type="text" value={inp}
          onChange={(e) => { setInp(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={items.length === 0 ? placeholder : ""}
          className="w-full bg-transparent text-foreground text-sm outline-none placeholder:text-foreground/90"
        />
        {open && (
          <div className="absolute z-50 top-full mt-1 w-72 max-h-60 overflow-y-auto bg-zinc-900 border border-white/10 rounded-md shadow-2xl">
            {inp.length < minChars ? (
              <div className="p-3 text-xs text-foreground/90">Digite ao menos {minChars} letras...</div>
            ) : isLoading ? (
              <div className="p-3 text-xs text-foreground/90 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Buscando na Meta...</div>
            ) : list.length === 0 ? (
              <div className="p-3 text-xs text-foreground/90">Nenhum resultado encontrado.</div>
            ) : list.map((it) => (
              <div key={it.id} onMouseDown={(e) => { e.preventDefault(); if (!items.find((x) => x.id === it.id)) setItems([...items, { id: it.id, name: it.name }]); setInp(""); setOpen(false); }}
                className="p-2 text-sm text-foreground hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0 truncate">
                {it.name}
                {((it as Record<string, unknown>).audience_size_upper_bound) && (
                  <span className="text-[10px] text-foreground/90 ml-2">{(it as Record<string, unknown>).audience_size_upper_bound?.toLocaleString("pt-BR")} pessoas)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LocationPicker({ adset, upd }: { adset: AdSetNode, upd: (p: Partial<AdSetNode>) => void }) {
  const [inp, setInp] = useState("");
  const [open, setOpen] = useState(false);
  const items = (adset.geo_locations_advanced as Record<string, unknown>[]) || [];
  
  const endpoint = "/api/meta/search-locations?q=";
  const shouldFetch = open && inp.length >= 2;
  const { data, isLoading } = useSWR(shouldFetch ? `${endpoint}${encodeURIComponent(inp)}` : null, fetcher);
  const list = Array.isArray(data?.data) ? data.data : [];

  const add = (loc: Record<string, unknown>) => {
    if (items.find((x) => x.key === loc.key)) return;
    const newItem = { ...loc, radius: loc.type === "city" ? 40 : undefined, distance_unit: "kilometer" };
    upd({ geo_locations_advanced: [...items, newItem] });
    setInp(""); setOpen(false);
  };
  const remove = (idx: number) => {
    upd({ geo_locations_advanced: items.filter((_, i) => i !== idx) });
  };
  const updateRadius = (idx: number, r: number) => {
    const next = [...items];
    next[idx].radius = r;
    upd({ geo_locations_advanced: next });
  };

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="space-y-1 pb-3 border-b border-white/5">
        <h3 className="text-xs font-bold text-foreground/90 uppercase tracking-wider flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Geofencing de Alta Precisão (Ad Geolocation)</h3>
      </div>
      <div className="relative">
        <Input type="text" value={inp} onChange={(e) => { setInp(e.target.value); setOpen(true); }} placeholder="Pesquisar países, estados, cidades ou CEPs..." className="bg-black/50 border-white/10 text-foreground h-11 rounded-xl focus:ring-primary/50" />
        {open && (
          <div className="absolute z-50 top-full mt-2 w-full max-h-60 overflow-y-auto bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-2">
            {inp.length < 2 ? <div className="p-3 text-xs text-foreground/90">Digite ao menos 2 caracteres...</div> : isLoading ? <div className="p-3 text-xs text-primary flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Mapeando satélite Meta...</div> : list.length === 0 ? <div className="p-3 text-xs text-foreground/90">Local não encontrado no Graph API.</div> : list.map((loc: Record<string, unknown>) => (
              <div key={loc.key} onMouseDown={(e) => { e.preventDefault(); add(loc); }} className="p-3 text-sm text-foreground hover:bg-primary/10 cursor-pointer border-b border-white/5 last:border-0 hover:border-l-2 hover:border-l-accent transition-all truncate flex items-center justify-between">
                <div>
                  <span className="font-bold">{loc.name as string}</span>
                  {loc.region && <span className="text-foreground/90 ml-2">({loc.region as string}, {loc.country_code as string})</span>}
                </div>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded uppercase font-bold text-foreground/90">{loc.type as string}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div className="space-y-3 pt-2">
          {items.map((loc: Record<string, unknown>, i: number) => (
            <div key={String(loc.key)} className="flex items-center gap-4 bg-black/30 border border-white/5 p-3 rounded-xl relative group">
               <div className="flex-1">
                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                     {loc.name as string} <span className="text-[9px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">{loc.type as string}</span>
                  </p>
                  <p className="text-[10px] text-foreground/90">{loc.region ? `${loc.region as string}, ${loc.country_code as string || ""}` : (loc.country_code as string) || "Global"}</p>
               </div>
               {loc.type === "city" && (
                 <div className="flex items-center gap-3 w-48">
                    <span className="text-[10px] text-foreground/90 font-bold whitespace-nowrap">Raio: {loc.radius as number} km</span>
                    <input type="range" min="17" max="80" value={loc.radius as number} onChange={(e) => updateRadius(i, parseInt(e.target.value))} className="w-full accent-accent bg-zinc-800 rounded-full h-1" />
                 </div>
               )}
               <button onClick={() => remove(i)} className="p-2 text-foreground/90 hover:text-primary opacity-50 group-hover:opacity-100 transition-all rounded-lg hover:bg-primary/10">
                 <Trash2 className="h-4 w-4" />
               </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckGroup<T extends string | number>({ label, options, selected, onChange }: {
  label: string; options: { value: T; label: string }[]; selected: T[]; onChange: (val: T[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-foreground/90 text-xs">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label key={String(opt.value)} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${checked ? "bg-primary/20 border-accent/40 text-accent/70" : "border-white/10 text-foreground/90 hover:border-white/30"}`}>
              <input type="checkbox" className="hidden" checked={checked} onChange={(e) => { if (e.target.checked) onChange([...selected, opt.value]); else onChange(selected.filter((v) => v !== opt.value)); }} />
              {opt.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}

type TargetingTab = "interests" | "behaviors" | "demographics";

export function TargetingPanel({ adset, upd }: { adset: AdSetNode; upd: (p: Partial<AdSetNode>) => void }) {
  const [tab, setTab] = useState<TargetingTab>("interests");
  const tabDef = [
    { id: "interests" as const, label: "Interesses", icon: <Brain className="h-3.5 w-3.5" /> },
    { id: "behaviors" as const, label: "Comportamentos", icon: <Users className="h-3.5 w-3.5" /> },
    { id: "demographics" as const, label: "Dados Demográficos", icon: <Heart className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4 mt-6 p-4 bg-white/[0.03] border border-white/8 rounded-xl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Segmentação Detalhada
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-foreground/90">Público Original</span>
          <button onClick={() => upd({ advantage_audience: adset.advantage_audience === 0 ? 1 : 0 })}
            className={`w-10 h-5 rounded-full transition-colors flex items-center p-0.5 ${adset.advantage_audience !== 0 ? "bg-accent" : "bg-zinc-700"}`}>
            <div className={`bg-white w-4 h-4 rounded-full transition-transform ${adset.advantage_audience !== 0 ? "translate-x-5" : "translate-x-0"}`} />
          </button>
          <span className="text-xs text-foreground/90 font-bold">Público Advantage+</span>
        </div>
      </div>
      
      {adset.advantage_audience !== 0 && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-xs text-accent/70">
          <strong className="text-primary">Público Advantage+ ativado:</strong> A tecnologia da Meta encontrará automaticamente o melhor público. As opções de interesses e demografia preenchidas abaixo servirão apenas como <em>sugestão</em> inicial para o algoritmo.
        </div>
      )}

      {adset.advantage_audience === 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-foreground/90 text-xs">Incluir Públicos Customizados</Label>
            <AsyncCombobox items={adset.custom_audiences} setItems={(t) => upd({ custom_audiences: t })} endpoint="/api/meta/audiences" searchKey="" placeholder="Buscar públicos..." minChars={0} />
          </div>
          <div className="space-y-1">
            <Label className="text-foreground/90 text-xs">Excluir Públicos</Label>
            <AsyncCombobox items={adset.excluded_custom_audiences} setItems={(t) => upd({ excluded_custom_audiences: t })} endpoint="/api/meta/audiences" searchKey="" placeholder="Ex: Compradores 90D..." minChars={0} />
          </div>
        </div>
      )}

      {adset.advantage_audience === 0 && (
        <div className="border-t border-white/10 pt-4">
          <div className="flex gap-1 bg-black/20 p-1 rounded-lg mb-4">
            {tabDef.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-all ${tab === t.id ? "bg-white/10 text-foreground shadow-sm" : "text-foreground/90 hover:text-foreground/90"}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            {tab === "interests" && (
              <motion.div key="interests" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="space-y-2">
                <Label className="text-foreground/90 text-xs">Interesses (busca em tempo real na Meta API)</Label>
                <AsyncCombobox items={adset.interests} setItems={(t) => upd({ interests: t })} endpoint="/api/meta/search-interests" searchKey="q" placeholder="Ex: E-commerce, marketing digital, fitness..." />
                <p className="text-[10px] text-foreground/90">Múltiplos itens = público ampliado (OR).</p>
              </motion.div>
            )}
            {tab === "behaviors" && (
              <motion.div key="behaviors" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="space-y-2">
                <Label className="text-foreground/90 text-xs">Comportamentos (dispositivos, atividade digital, viagens...)</Label>
                <AsyncCombobox items={adset.behaviors} setItems={(t) => upd({ behaviors: t })} endpoint="/api/meta/search-behaviors" searchKey="q" placeholder="Ex: viajantes frequentes, usuários de iPhone..." />
              </motion.div>
            )}
            {tab === "demographics" && (
              <motion.div key="demographics" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="space-y-5">
                <CheckGroup label="Status de Relacionamento" options={[{ value: 1, label: "Solteiro(a)" }, { value: 2, label: "Em relacionamento" }, { value: 3, label: "Casado(a)" }, { value: 4, label: "Noivo(a)" }, { value: 6, label: "Separado(a)" }, { value: 7, label: "Divorciado(a)" }, { value: 8, label: "Viúvo(a)" }]} selected={adset.relationship_statuses} onChange={(v) => upd({ relationship_statuses: v as number[] })} />
                <CheckGroup label="Nível de Escolaridade" options={[{ value: 1, label: "Ensino Médio" }, { value: 2, label: "Cursando Superior" }, { value: 3, label: "Superior Completo" }, { value: 4, label: "Técnico" }, { value: 5, label: "Pós/MBA" }, { value: 6, label: "PhD" }, { value: 13, label: "Faculdade (geral)" }]} selected={adset.education_statuses} onChange={(v) => upd({ education_statuses: v as number[] })} />
                <div className="space-y-1">
                  <Label className="text-foreground/90 text-xs flex items-center gap-1"><Briefcase className="h-3 w-3" />Cargos / Funções</Label>
                  <AsyncCombobox items={adset.work_positions} setItems={(t) => upd({ work_positions: t })} endpoint="/api/meta/search-demographics" searchKey="q" placeholder="Ex: Gerente de Marketing, CEO..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground/90 text-xs flex items-center gap-1"><Heart className="h-3 w-3" />Eventos de Vida</Label>
                  <AsyncCombobox items={adset.life_events} setItems={(t) => upd({ life_events: t })} endpoint="/api/meta/search-demographics" searchKey="q" placeholder="Ex: recém-casados, novo emprego..." />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
