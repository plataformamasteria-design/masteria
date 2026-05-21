"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, ComposedChart,
} from "recharts";
import {
  Maximize2, Minimize2, Copy, ChevronLeft, ChevronRight,
  DollarSign, Users, CalendarCheck, Handshake, ArrowRight,
  Printer, Check, AlertTriangle, TrendingUp, TrendingDown,
  Target, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { TabLoading } from "@/components/ui/tab-loading";
import { InvestimentoTimestamp } from "@/components/trafego/InvestimentoTimestamp";

// ── Types ──────────────────────────────────────────────────────────
interface ResumoData {
  investimento: number;
  leads: number;
  qualificados: number;
  reunioes_agendadas: number;
  reunioes_realizadas: number;
  clientes_fechados: number;
  cpl: number;
  ultimaAtualizacao: string | null;
}

interface FunilData {
  leads: number;
  qualificados: number;
  reunioes: number;
  clientes: number;
  warning: string | null;
  taxas: {
    lead_para_qualificado: number | null;
    qualificado_para_reuniao: number | null;
    reuniao_para_cliente: number | null;
  };
}

interface EvolucaoItem {
  mes: string;
  label: string;
  reunioes: number;
  agendadas: number;
  meta: number;
  investimento: number;
  leads: number;
  cpl: number;
}

interface AcaoData {
  tipo: "urgente" | "atencao" | "oportunidade";
  titulo: string;
  detalhe: string;
}

interface ApresentacaoData {
  mesReferencia: string;
  resumo: ResumoData;
  funil: FunilData;
  evolucao: EvolucaoItem[];
  metaReunioes: number;
  metaLeads: number;
  metaCpl: number;
  acoes: AcaoData[];
  periodo: { diasPassados: number; diasNoMes: number };
  ultimaAtualizacao: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtPct = (v: number | null) => (v !== null ? `${(v * 100).toFixed(1).replace(".", ",")}%` : "—");

function getMesLabel(mesRef: string): string {
  const [y, m] = mesRef.split("-").map(Number);
  const meses = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[m]} ${y}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value: val, label: getMesLabel(val) });
  }
  return opts;
}

// ── Slide: Resumo ─────────────────────────────────────────────────

function SlideResumo({ data, mesRef, periodo, metaCpl, ultimaAtualizacao }: {
  data: ResumoData;
  mesRef: string;
  periodo: { diasPassados: number; diasNoMes: number };
  metaCpl: number;
  ultimaAtualizacao: string | null;
}) {
  const cpl = data.leads > 0 ? data.investimento / data.leads : 0;
  const cplStatus = metaCpl > 0
    ? cpl <= metaCpl ? "dentro" : cpl <= metaCpl * 1.3 ? "atencao" : "acima"
    : null;

  const horaAtualizada = ultimaAtualizacao
    ? new Date(ultimaAtualizacao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const items = [
    { icon: DollarSign, label: "Investimento em Tráfego", value: formatCurrency(data.investimento), color: "text-accent" },
    { icon: Users, label: "Leads Gerados", value: String(data.leads), color: "text-violet-500" },
    { icon: CalendarCheck, label: "Reuniões com o Closer", value: String(data.reunioes_realizadas), color: "text-amber-500" },
    { icon: Handshake, label: "Novos Clientes Fechados", value: data.clientes_fechados > 0 ? String(data.clientes_fechados) : "—", color: "text-primary" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12">
      <div className="text-center mb-8">
        <p className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-2">Resumo Executivo</p>
        <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">{getMesLabel(mesRef)}</h2>
        <p className="text-xs text-zinc-400 mt-2">
          Período: 01/{mesRef.split("-")[1]}/{mesRef.split("-")[0]} a {String(periodo.diasPassados).padStart(2, "0")}/{mesRef.split("-")[1]}/{mesRef.split("-")[0]} ({periodo.diasPassados} dias de {periodo.diasNoMes})
        </p>
        {cpl > 0 && (
          <p className="text-xs text-zinc-400 mt-1">
            CPL médio: {formatCurrency(cpl)}
            {metaCpl > 0 && ` | Meta: ${formatCurrency(metaCpl)}`}
          </p>
        )}
        {cplStatus && (
          <span className={`inline-flex items-center gap-1 mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            cplStatus === "dentro" ? "bg-primary text-primary dark:bg-primary/15 dark:text-primary" :
            cplStatus === "atencao" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400" :
            "bg-destructive text-destructive dark:bg-destructive/15 dark:text-destructive"
          }`}>
            {cplStatus === "dentro" ? "🟢 Dentro da meta" : cplStatus === "atencao" ? "🟡 Atenção" : "🔴 Acima da meta"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 w-full max-w-4xl">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className="flex flex-col items-center text-center"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${item.color} bg-current/10`}
              style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}>
              <item.icon size={28} className={item.color} />
            </div>
            <p className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">{item.value}</p>
            <p className="text-sm text-zinc-500 mt-2 font-medium">{item.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Investimento context */}
      {horaAtualizada && (
        <p className="text-[11px] text-zinc-400 mt-8 text-center">
          {formatCurrency(data.investimento)} investidos até {horaAtualizada}
          <br />
          <span className="text-zinc-500">⚡ Valor atualizado em tempo real — pode diferir de outros relatórios</span>
        </p>
      )}

      {/* Timeline connector */}
      <div className="hidden md:flex items-center justify-center mt-6 gap-2 text-zinc-300 dark:text-zinc-600">
        {items.map((_, i) => (
          <div key={i} className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            {i < items.length - 1 && <div className="w-16 h-0.5 bg-zinc-200 dark:bg-muted-foreground/20" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Slide: Funil ──────────────────────────────────────────────────

function SlideFunil({ data }: { data: FunilData }) {
  const etapas = [
    { label: "Leads Gerados", valor: data.leads, color: "bg-accent", width: 100 },
    { label: "Leads Qualificados pelo SDR", valor: data.qualificados, color: "bg-violet-500", width: data.leads > 0 ? Math.max(20, (data.qualificados / data.leads) * 100) : 20 },
    { label: "Reuniões com o Closer", valor: data.reunioes, color: "bg-amber-500", width: data.leads > 0 ? Math.max(15, (data.reunioes / data.leads) * 100) : 15 },
    { label: "Novos Clientes Fechados", valor: data.clientes, color: "bg-primary", width: data.leads > 0 ? Math.max(10, (data.clientes / data.leads) * 100) : 10 },
  ];

  const taxas = [
    { label: "Qualificação", valor: data.taxas.lead_para_qualificado },
    { label: "Comparecimento", valor: data.taxas.qualificado_para_reuniao },
    { label: "Fechamento", valor: data.taxas.reuniao_para_cliente },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12">
      <div className="text-center mb-10">
        <p className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-2">Funil de Resultados</p>
        <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">Do Interesse ao Cliente</h2>
      </div>

      <div className="w-full max-w-2xl space-y-2">
        {etapas.map((etapa, i) => (
          <div key={etapa.label}>
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: i * 0.2, duration: 0.5 }}
              style={{ width: `${etapa.width}%`, originX: 0.5 }}
              className="mx-auto"
            >
              <div className={`${etapa.color} rounded-xl py-4 px-6 flex items-center justify-between text-foreground`}>
                <span className="font-semibold text-sm md:text-base">{etapa.label}</span>
                <span className="text-2xl md:text-3xl font-black tabular-nums">{etapa.valor}</span>
              </div>
            </motion.div>
            {i < etapas.length - 1 && (
              <div className="flex items-center justify-center py-1">
                <span className="text-xs font-bold text-zinc-400 bg-zinc-100 dark:bg-muted px-3 py-1 rounded-full">
                  {taxas[i]?.valor != null && taxas[i].valor! > 0
                    ? `${fmtPct(taxas[i].valor)} converteram`
                    : "—"
                  }
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Warning: impossible conversion */}
      {data.warning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-6 flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 px-4 py-2.5 rounded-lg max-w-2xl"
        >
          <AlertTriangle size={14} className="shrink-0" />
          {data.warning}
        </motion.div>
      )}
    </div>
  );
}

// ── Slide: Evolução (com sub-tabs) ────────────────────────────────

type EvolucaoMode = "reunioes" | "cpl" | "leads" | "investimento";

function SlideEvolucao({ data, meta, metaCpl, metaLeads, periodo }: {
  data: EvolucaoItem[];
  meta: number;
  metaCpl: number;
  metaLeads: number;
  periodo: { diasPassados: number; diasNoMes: number };
}) {
  const [mode, setMode] = useState<EvolucaoMode>("reunioes");

  const mesAtual = data[data.length - 1];
  const mesAnterior = data.length >= 2 ? data[data.length - 2] : null;

  // Dynamic text based on mode
  const getText = () => {
    if (!mesAtual) return "";
    const projecao = (val: number) => periodo.diasPassados > 0
      ? Math.round((val / periodo.diasPassados) * periodo.diasNoMes)
      : val;

    switch (mode) {
      case "reunioes": {
        if (mesAtual.reunioes >= meta) {
          const pct = ((mesAtual.reunioes / meta - 1) * 100).toFixed(0);
          return `Meta atingida! ${mesAtual.reunioes} de ${meta} reuniões realizadas. Resultado ${pct}% acima do esperado.`;
        }
        const proj = projecao(mesAtual.reunioes);
        return `Sua meta é ${meta} reuniões/mês. Em ${periodo.diasPassados} dias chegamos a ${mesAtual.reunioes}. No ritmo atual, projetamos ${proj} reuniões até o final do mês.`;
      }
      case "cpl": {
        if (mesAtual.cpl <= 0) return "Sem dados de CPL para o período.";
        const txt = `Seu CPL atual é ${formatCurrency(mesAtual.cpl)}.`;
        if (mesAnterior && mesAnterior.cpl > 0) {
          const diff = mesAtual.cpl - mesAnterior.cpl;
          const verb = diff > 0 ? "subiu" : "caiu";
          return `${txt} O CPL ${verb} de ${formatCurrency(mesAnterior.cpl)} para ${formatCurrency(mesAtual.cpl)} em relação ao mês anterior.`;
        }
        return txt;
      }
      case "leads": {
        const txt = `Este mês geramos ${mesAtual.leads} leads`;
        if (metaLeads > 0) {
          const rel = mesAtual.leads >= metaLeads ? "acima" : "abaixo";
          return `${txt}, ${rel} da meta de ${metaLeads}.`;
        }
        const proj = projecao(mesAtual.leads);
        return `${txt}. No ritmo atual, projetamos ${proj} leads até o final do mês.`;
      }
      case "investimento": {
        const txt = `Investimento acumulado de ${formatCurrency(mesAtual.investimento)}`;
        if (mesAnterior && mesAnterior.investimento > 0) {
          const investVar = ((mesAtual.investimento / mesAnterior.investimento - 1) * 100).toFixed(0);
          const leadsVar = mesAnterior.leads > 0 ? ((mesAtual.leads / mesAnterior.leads - 1) * 100).toFixed(0) : "0";
          const investVerb = Number(investVar) > 0 ? "subiu" : "caiu";
          const leadsVerb = Number(leadsVar) > 0 ? "subiram" : "caíram";
          return `${txt}. Investimento ${investVerb} ${Math.abs(Number(investVar))}% e leads ${leadsVerb} ${Math.abs(Number(leadsVar))}% vs mês anterior.`;
        }
        return `${txt} no período.`;
      }
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "reunioes": return "Reuniões por Mês";
      case "cpl": return "Evolução do CPL";
      case "leads": return "Evolução de Leads";
      case "investimento": return "Investimento vs Resultado";
    }
  };

  // Dynamic Y-axis max
  const getYMax = (): number => {
    switch (mode) {
      case "reunioes": {
        const maxVal = Math.max(...data.map(d => d.reunioes), meta);
        return Math.ceil(maxVal * 1.2);
      }
      case "cpl": {
        const maxVal = Math.max(...data.map(d => d.cpl).filter(v => v > 0), metaCpl || 0);
        return maxVal > 0 ? Math.ceil(maxVal * 1.2) : 100;
      }
      case "leads": {
        const maxVal = Math.max(...data.map(d => d.leads), metaLeads || 0);
        return Math.ceil(maxVal * 1.2);
      }
      case "investimento": {
        const maxVal = Math.max(...data.map(d => d.investimento));
        return Math.ceil(maxVal * 1.2);
      }
    }
  };

  const renderChart = () => {
    const yMax = getYMax();

    switch (mode) {
      case "reunioes":
        return (
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#6b7280", fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, yMax] as [number, number]} tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} formatter={(value: any) => [value, "Reuniões"]} />
            <ReferenceLine y={meta} stroke="#f59e0b" strokeDasharray="8 4" strokeWidth={2} label={{ value: `Meta: ${meta}`, position: "right", fill: "#f59e0b", fontSize: 12, fontWeight: 700 }} />
            <Bar dataKey="reunioes" name="Reuniões" fill="#6366f1" radius={[8, 8, 0, 0]} maxBarSize={60} />
          </BarChart>
        );
      case "cpl":
        return (
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#6b7280", fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, yMax] as [number, number]} tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 14 }} formatter={(value: any) => [formatCurrency(Number(value)), "CPL"]} />
            {metaCpl > 0 && <ReferenceLine y={metaCpl} stroke="#f59e0b" strokeDasharray="8 4" strokeWidth={2} label={{ value: `Meta: ${formatCurrency(metaCpl)}`, position: "right", fill: "#f59e0b", fontSize: 12, fontWeight: 700 }} />}
            <Line type="monotone" dataKey="cpl" name="CPL" stroke="#6366f1" strokeWidth={3} dot={{ r: 5, fill: "#6366f1" }} connectNulls={false} />
          </LineChart>
        );
      case "leads":
        return (
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#6b7280", fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, yMax] as [number, number]} tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 14 }} formatter={(value: any) => [value, "Leads"]} />
            {metaLeads > 0 && <ReferenceLine y={metaLeads} stroke="#f59e0b" strokeDasharray="8 4" strokeWidth={2} label={{ value: `Meta: ${metaLeads}`, position: "right", fill: "#f59e0b", fontSize: 12, fontWeight: 700 }} />}
            <Bar dataKey="leads" name="Leads" fill="#8b5cf6" radius={[8, 8, 0, 0]} maxBarSize={60} />
          </BarChart>
        );
      case "investimento":
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 60, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 13, fill: "#6b7280", fontWeight: 600 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="invest" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="leads" orientation="right" tick={{ fontSize: 12, fill: "#8b5cf6" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 14 }} formatter={(value: any, name: any) => [String(name) === "Investimento" ? formatCurrency(Number(value)) : value, name]} />
            <Bar yAxisId="invest" dataKey="investimento" name="Investimento" fill="#3b82f6" radius={[8, 8, 0, 0]} maxBarSize={60} opacity={0.7} />
            <Line yAxisId="leads" type="monotone" dataKey="leads" name="Leads" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5, fill: "#8b5cf6" }} />
          </ComposedChart>
        );
    }
  };

  const tabs: { id: EvolucaoMode; label: string }[] = [
    { id: "cpl", label: "CPL" },
    { id: "leads", label: "Leads" },
    { id: "reunioes", label: "Reuniões" },
    { id: "investimento", label: "Investimento" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12">
      <div className="text-center mb-4">
        <p className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-2">Evolução</p>
        <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">{getTitle()}</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
              mode === tab.id
                ? "bg-card dark:bg-zinc-100 text-foreground dark:text-zinc-900"
                : "bg-zinc-100 dark:bg-muted text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-3xl h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {getText() && (
        <motion.p
          key={mode}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-base text-zinc-600 dark:text-zinc-400 mt-6 font-medium max-w-xl leading-relaxed"
        >
          {getText()}
        </motion.p>
      )}
    </div>
  );
}

// ── Slide: Próximos Passos (dinâmico) ─────────────────────────────

function SlideProximosPassos({ acoes, fallbackValue, onFallbackChange }: {
  acoes: AcaoData[];
  fallbackValue: string;
  onFallbackChange: (v: string) => void;
}) {
  const ACAO_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; label: string }> = {
    urgente: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive dark:bg-destructive/10 border-destructive dark:border-destructive/20", label: "🔴" },
    atencao: { icon: Target, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20", label: "🟡" },
    oportunidade: { icon: TrendingUp, color: "text-primary", bg: "bg-primary dark:bg-primary/10 border-primary dark:border-primary/20", label: "🟢" },
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12">
      <div className="text-center mb-8">
        <p className="text-sm font-medium text-zinc-400 uppercase tracking-widest mb-2">Plano de Ação</p>
        <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100">Próximos Passos</h2>
      </div>

      {acoes.length > 0 ? (
        <div className="w-full max-w-2xl space-y-4">
          {acoes.map((acao, i) => {
            const cfg = ACAO_CONFIG[acao.tipo] || ACAO_CONFIG.atencao;
            const Icon = cfg.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.2 }}
                className={`p-5 rounded-xl border ${cfg.bg}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{cfg.label}</span>
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{acao.titulo}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{acao.detalhe}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="w-full max-w-2xl">
          <textarea
            value={fallbackValue}
            onChange={(e) => onFallbackChange(e.target.value)}
            rows={8}
            className="w-full rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-card text-zinc-900 dark:text-zinc-100 p-6 text-lg leading-relaxed resize-none focus:outline-none focus:border-accent transition-colors print:border-0"
            placeholder="Nenhuma ação automática gerada. Digite as recomendações aqui..."
          />
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function ApresentacaoPage() {
  const [mesRef, setMesRef] = useState(getCurrentMonth);
  const [clienteId, setClienteId] = useState("");
  const [slideIdx, setSlideIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [proximosPassos, setProximosPassos] = useState(
    "1. Otimizar anúncios com melhor custo por resultado\n2. Aumentar verba nos dias/horários com melhor performance\n3. Revisar criativos e textos das campanhas"
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const monthOpts = useMemo(getMonthOptions, []);

  const { data: clientesData } = useSWR("/api/marketing/clients", fetcher, { revalidateOnFocus: false });
  const clientes: { id: string; client_name: string }[] = clientesData?.data || [];

  const apiUrl = `/api/marketing/apresentacao?mesReferencia=${mesRef}${clienteId ? `&clienteId=${clienteId}` : ""}`;
  const { data, isLoading } = useSWR<ApresentacaoData>(
    apiUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  const totalSlides = 4;

  const goNext = useCallback(() => setSlideIdx((i) => Math.min(i + 1, totalSlides - 1)), []);
  const goPrev = useCallback(() => setSlideIdx((i) => Math.max(i - 1, 0)), []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "Escape" && isFullscreen) { exitFullscreen(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, isFullscreen]);

  function enterFullscreen() {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen();
    }
    setIsFullscreen(true);
  }

  function exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  }

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  if (isLoading) return <TabLoading message="Preparando apresentação..." />;

  const resumo = data?.resumo || { investimento: 0, leads: 0, qualificados: 0, reunioes_agendadas: 0, reunioes_realizadas: 0, clientes_fechados: 0, cpl: 0, ultimaAtualizacao: null };
  const funil = data?.funil || { leads: 0, qualificados: 0, reunioes: 0, clientes: 0, warning: null, taxas: { lead_para_qualificado: null, qualificado_para_reuniao: null, reuniao_para_cliente: null } };
  const evolucao = data?.evolucao || [];
  const metaReunioes = data?.metaReunioes || 20;
  const metaLeads = data?.metaLeads || 0;
  const metaCpl = data?.metaCpl || 0;
  const acoes = data?.acoes || [];
  const periodo = data?.periodo || { diasPassados: 9, diasNoMes: 31 };
  const ultimaAtualizacao = data?.ultimaAtualizacao || null;

  const slides = [
    <SlideResumo key="resumo" data={resumo} mesRef={mesRef} periodo={periodo} metaCpl={metaCpl} ultimaAtualizacao={ultimaAtualizacao} />,
    <SlideFunil key="funil" data={funil} />,
    <SlideEvolucao key="evolucao" data={evolucao} meta={metaReunioes} metaCpl={metaCpl} metaLeads={metaLeads} periodo={periodo} />,
    <SlideProximosPassos key="passos" acoes={acoes} fallbackValue={proximosPassos} onFallbackChange={setProximosPassos} />,
  ];

  const slideNames = ["Resumo", "Funil", "Evolução", "Ações"];

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .apresentacao-container, .apresentacao-container * { visibility: visible; }
          .apresentacao-container { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-slide { page-break-after: always; min-height: 100vh; display: flex !important; }
        }
      `}</style>

      <div ref={containerRef} className={`apresentacao-container ${isFullscreen ? "fixed inset-0 z-[99999] bg-white dark:bg-background" : ""}`}>
        {/* Controls bar */}
        <div className={`no-print flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 ${isFullscreen ? "absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-white/90 dark:from-zinc-950/90 to-transparent" : ""}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={mesRef}
              onChange={(e) => { setMesRef(e.target.value); setSlideIdx(0); }}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-card text-sm px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none"
            >
              {monthOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {clientes.length > 1 && (
              <select
                value={clienteId}
                onChange={(e) => { setClienteId(e.target.value); setSlideIdx(0); }}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-card text-sm px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none max-w-[200px] truncate"
              >
                <option value="">Todos os clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.client_name}</option>
                ))}
              </select>
            )}
            <InvestimentoTimestamp />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5 text-xs">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar Link"}
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
              <Printer size={14} /> Exportar PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={isFullscreen ? exitFullscreen : enterFullscreen}
              className="gap-1.5 text-xs"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? "Sair" : "Tela Cheia"}
            </Button>
          </div>
        </div>

        {/* Slide area */}
        <div className={`relative ${isFullscreen ? "h-[calc(100vh-80px)] mt-16" : "min-h-[600px]"}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={slideIdx}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {slides[slideIdx]}
            </motion.div>
          </AnimatePresence>

          {/* Navigation arrows */}
          <div className="no-print absolute inset-y-0 left-0 flex items-center">
            <button
              onClick={goPrev}
              disabled={slideIdx === 0}
              className="ml-2 w-10 h-10 rounded-full bg-zinc-100 dark:bg-muted flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-muted-foreground/20 disabled:opacity-20 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          <div className="no-print absolute inset-y-0 right-0 flex items-center">
            <button
              onClick={goNext}
              disabled={slideIdx === totalSlides - 1}
              className="mr-2 w-10 h-10 rounded-full bg-zinc-100 dark:bg-muted flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-muted-foreground/20 disabled:opacity-20 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Slide indicators */}
        <div className="no-print flex items-center justify-center gap-3 py-4">
          {slideNames.map((name, i) => (
            <button
              key={i}
              onClick={() => setSlideIdx(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                i === slideIdx
                  ? "bg-card dark:bg-zinc-100 text-foreground dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-muted text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Print-only: all slides visible */}
        <div className="hidden print:block">
          <div className="print-slide"><SlideResumo data={resumo} mesRef={mesRef} periodo={periodo} metaCpl={metaCpl} ultimaAtualizacao={ultimaAtualizacao} /></div>
          <div className="print-slide"><SlideFunil data={funil} /></div>
          <div className="print-slide"><SlideEvolucao data={evolucao} meta={metaReunioes} metaCpl={metaCpl} metaLeads={metaLeads} periodo={periodo} /></div>
          <div className="print-slide"><SlideProximosPassos acoes={acoes} fallbackValue={proximosPassos} onFallbackChange={() => {}} /></div>
        </div>
      </div>
    </>
  );
}


