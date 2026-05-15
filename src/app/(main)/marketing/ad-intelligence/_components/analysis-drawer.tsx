"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Cpu, BarChart2, MessageSquare, PlayCircle, Fingerprint, Activity, Film } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrawerPayload {
  id: string;
  type: "campaign" | "adset" | "creative";
  name: string;
  score: number;
  spend: number;
  cpl: number;
  ctr: number;
  aiDiagnosis: string;
  
  // Specific creative details
  format?: string;
  copy?: string;
  headline?: string;
  cta?: string;
  hookRate?: number;
  thruPlays?: number;
  fatigueScore?: number;
  retention15s?: number;
  
  // Before/After fields (Creative)
  proposedHeadline?: string;
  proposedCopy?: string;
  visualIntervention?: string;
}

interface AnalysisDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  payload: DrawerPayload | null;
}

export function AnalysisDrawer({ isOpen, onClose, payload }: AnalysisDrawerProps) {
  const [realCreative, setRealCreative] = useState<any>(null);
  const [loadingCreative, setLoadingCreative] = useState(false);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Fetch creative native info
  useEffect(() => {
    if (isOpen && payload?.type === 'creative' && payload.id) {
       setLoadingCreative(true);
       fetch(`/api/meta/ad-detalhes?ad_id=${payload.id}`)
         .then(r => r.json())
         .then(d => {
             if(d.data) setRealCreative(d.data);
         })
         .finally(() => setLoadingCreative(false));
    } else {
       setRealCreative(null);
    }
  }, [isOpen, payload]);

  if (!isOpen || !payload) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div 
        className={cn(
          "fixed right-0 top-0 bottom-0 z-[110] w-full max-w-md bg-zinc-950 border-l border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-black/40">
           <div>
             <span className="text-[10px] tracking-widest uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 mb-1 inline-block">
               Análise de {payload.type === 'creative' ? 'Criativo' : payload.type === 'campaign' ? 'Campanha' : 'Conjunto'}
             </span>
             <h2 className="text-lg font-bold text-foreground pr-4 truncate" title={payload.name}>{payload.name}</h2>
           </div>
           <button 
             onClick={onClose}
             className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/5 transition-colors shrink-0"
           >
             <X className="h-4 w-4" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Main KPI Bar */}
          <div className="grid grid-cols-3 gap-3">
             <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col items-center justify-center">
               <span className="text-[9px] uppercase text-zinc-500 font-bold mb-1">Score Global</span>
               <span className={cn("text-xl font-black", payload.score >= 80 ? "text-emerald-400" : payload.score <= 50 ? "text-red-400" : "text-amber-400")}>
                 {payload.score}
               </span>
             </div>
             <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col items-center justify-center">
               <span className="text-[9px] uppercase text-zinc-500 font-bold mb-1">CPL Atual</span>
               <span className="text-lg font-mono text-foreground font-bold">R${payload.cpl.toFixed(2)}</span>
             </div>
             <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col items-center justify-center">
               <span className="text-[9px] uppercase text-zinc-500 font-bold mb-1">Gasto</span>
               <span className="text-lg font-mono text-zinc-400 font-bold">R${payload.spend.toFixed(0)}</span>
             </div>
          </div>

          {/* AI Diagnostic Text Extenso */}
          <div className="bg-accent-foreground/10 border border-primary/20 rounded-xl p-5 relative overflow-hidden">
             <Cpu className="absolute -right-4 -top-4 h-24 w-24 text-primary/5 opacity-50 pointer-events-none" />
             <div className="flex items-center gap-2 mb-3">
               <Activity className="h-4 w-4 text-primary" />
               <h3 className="text-xs uppercase tracking-widest font-bold text-primary">Diagnóstico Estruturado (IA)</h3>
             </div>
             <p className="text-sm text-zinc-300 leading-relaxed">
               {payload.aiDiagnosis}
             </p>
             
             <div className="mt-4 pt-4 border-t border-accent/10 flex flex-col gap-2">
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Recomendação Operacional</span>
                <p className="text-xs text-accent/70">
                  Baseado na análise da copy e da retenção atual, <strong>aumentar o orçamento em R$ 50/dia</strong> ou gerar <strong>variações de CTA</strong>.
                </p>
             </div>
          </div>

          {/* Creative Detailed Sections (If Applicable) */}
          {payload.type === 'creative' && (
             <div className="space-y-6">
                
                {/* O Laboratório A/B Visual */}
                <div className="rounded-xl border border-primary/20 bg-black/40 overflow-hidden shadow-2xl relative">
                  <div className="bg-primary/10 px-4 py-2 border-b border-primary/20 flex justify-between items-center">
                    <h3 className="text-[10px] tracking-widest font-bold uppercase text-primary flex items-center gap-2">
                       <Activity className="h-3 w-3" /> A/B Simulator Room
                    </h3>
                  </div>

                  <div className="p-4 flex flex-col gap-4 relative">
                    
                    {/* ANTES (Original) */}
                    <div>
                      <span className="text-[9px] uppercase font-black tracking-widest text-zinc-500 bg-white/5 py-0.5 px-2 rounded-t-lg">Original (CPL Elevado)</span>
                      <div className="bg-zinc-950 border border-white/5 p-3 rounded-b-lg rounded-tr-lg opacity-60 filter flex flex-col gap-2">
                        {loadingCreative ? <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full mx-auto" /> : 
                          <>
                            {realCreative?.creative?.thumbnail_url || realCreative?.creative?.image_url ? (
                              <img src={realCreative.creative.thumbnail_url || realCreative.creative.image_url} alt="creative" className="w-full h-16 object-cover rounded opacity-80" />
                            ) : (
                               <div className="flex bg-white/5 w-full h-16 rounded items-center justify-center border border-white/5 border-dashed">
                                 <Film className="h-5 w-5 text-zinc-600" />
                                 <span className="text-[10px] ml-2 text-zinc-600">Thumbnail Desgastada</span>
                               </div>
                            )}
                            <p className="text-[10px] text-zinc-400 italic line-clamp-2">"{realCreative?.creative?.body || 'Copy atual longa e sem restrição...'}"</p>
                            <p className="text-[9px] font-bold text-zinc-500 mt-1 uppercase">CTA: {realCreative?.creative?.call_to_action_type || 'SAIBA MAIS'}</p>
                          </>
                        }
                      </div>
                    </div>

                    {/* INTERVENÇÃO */}
                    <div className="flex items-center gap-2 px-2">
                       <div className="h-px flex-1 bg-gradient-to-r from-transparent to-accent/30"></div>
                       <span className="text-[9px] uppercase tracking-widest text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                         {payload.visualIntervention || 'Adição de Frame de Qualificação'}
                       </span>
                       <div className="h-px flex-1 bg-gradient-to-l from-transparent to-accent/30"></div>
                    </div>

                    {/* DEPOIS (Proposição da IA) */}
                    <div className="relative">
                      <span className="text-[9px] uppercase font-black tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-0.5 px-2 rounded-t-lg shadow-[0_0_10px_rgba(16,185,129,0.1)]">Modificação IA Sustentada</span>
                      <div className="bg-black/60 border border-emerald-500/30 p-3 rounded-b-lg rounded-tr-lg shadow-xl relative overflow-hidden">
                        
                        <div className="flex absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-primary to-emerald-500"></div>
                        
                        {/* Imagem Placeholder "Prototipo" */}
                        <div className="flex bg-emerald-950/20 w-full h-24 rounded mb-2 items-center justify-center border border-emerald-500/20 relative overflow-hidden group">
                           <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-2">
                             <h4 className="text-white text-xs font-black shadow-lg">⚠️ Apenas para Endividados!</h4>
                           </div>
                           <PlayCircle className="h-6 w-6 text-emerald-500/50 group-hover:scale-110 transition-transform" />
                        </div>
                        
                        <div className="space-y-1">
                          <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Nova Copy Inicial (Hook):</span>
                          <p className="text-[11px] text-zinc-200 line-clamp-3">"{payload.proposedCopy || 'Abaixo você vai descobrir a tabela que os bancos esconderam. Se você possui veículo comprado a partir de 2020...'}"</p>
                        </div>
                        
                        <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/5">
                           <div>
                             <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest block mb-0.5">Novo CTA Projetado</span>
                             <p className="text-[10px] font-black text-emerald-400 uppercase">Simular Economia Agora</p>
                           </div>
                           <button className="text-[9px] uppercase font-bold bg-white text-black px-2 py-1 rounded">Aplicar</button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                      <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-widest block mb-1">Hook Rate (3s)</span>
                      <span className="text-2xl font-black text-emerald-400">{(payload.hookRate || 42).toFixed(2)}%</span>
                   </div>
                   <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                      <span className="text-[10px] text-amber-500/70 font-bold uppercase tracking-widest block mb-1">Retenção (15s)</span>
                      <span className="text-2xl font-black text-amber-400">{(payload.retention15s || 12).toFixed(2)}%</span>
                   </div>
                </div>
             </div>
          )}

        </div>
        
        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-black/40 flex items-center justify-between">
           <button className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir no Meta
           </button>
           <button 
             onClick={onClose}
             className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-lg transition-colors"
           >
             Fechar Análise
           </button>
        </div>
      </div>
    </>
  );
}
