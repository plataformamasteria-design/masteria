"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { AtribuicaoIncompletaAlert } from "@/components/avisos/AtribuicaoIncompletaAlert"
import { ATRIBUICAO_INICIO_DATA } from "@/lib/atribuicao"
import {
  TrendingDown,
  TrendingUp,
  Users,
  MousePointerClick,
  Eye,
  DollarSign,
  CalendarCheck,
  UserCheck,
  Handshake,
  Target,
  RefreshCw,
  AlertCircle,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────

interface Etapa {
  id: string
  label: string
  valor: number | null
  tipo: "moeda" | "inteiro"
}

interface Taxa {
  de: string
  para: string
  valor: number | null
  label: string
}

interface FunilData {
  periodo: { tipo: "mes" | "range"; valor: string }
  etapas: Etapa[]
  taxas: Taxa[]
  atribuicao_completa: boolean
  periodo_parcial: boolean
  receita_gerada: { mrr: number; ltv_real: number }
  totais_finais: {
    cac_bruto: number | null
    cprf: number | null
    roas_bruto: number | null
    payback_bruto_meses: number | null
    taxa_lead_para_cliente: number | null
  }
}

interface FunilComarkaProps {
  mesReferencia?: string
  dataInicio?: Date
  dataFim?: Date
  compacto?: boolean
}

// ── Helpers ────────────────────────────────────────────────

const fmtMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v)

const fmtMoedaDecimal = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)

const fmtInt = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(v))

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

const fmtValor = (etapa: Etapa): string => {
  if (etapa.valor === null || etapa.valor === undefined) return "\u2014"
  return etapa.tipo === "moeda" ? fmtMoedaDecimal(etapa.valor) : fmtInt(etapa.valor)
}

const ETAPA_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  investimento: DollarSign,
  impressoes: Eye,
  cliques: MousePointerClick,
  leads: Users,
  qualificados: UserCheck,
  reunioes_agendadas: CalendarCheck,
  reunioes_realizadas: Handshake,
  clientes_fechados: Target,
}

const ETAPA_FONTES: Record<string, string> = {
  investimento: "ads_performance (Meta API)",
  impressoes: "ads_performance (Meta API)",
  cliques: "ads_performance (Meta API)",
  leads: "leads_crm (GHL webhook)",
  qualificados: "lead_funnel_events / leads_crm.etapa",
  reunioes_agendadas: "vw_reunioes_consolidada (lancamentos_diarios)",
  reunioes_realizadas: "vw_reunioes_consolidada (lancamentos_diarios)",
  clientes_fechados: "contratos (status ativo, vw_trafego_funil_mensal)",
}

const TAXA_FORMULAS: Record<string, string> = {
  CTR: "cliques / impressoes",
  "Conversão página": "leads / cliques",
  Qualificação: "qualificados / leads",
  Agendamento: "reunioes_agendadas / qualificados",
  Comparecimento: "reunioes_realizadas / reunioes_agendadas",
  Fechamento: "clientes_fechados / reunioes_realizadas",
}

function mesLabel(valor: string): string {
  if (valor.includes(" a ")) return valor
  const [y, m] = valor.split("-")
  const meses = [
    "", "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ]
  return `${meses[Number(m)]}/${y}`
}

// ── Bar width (log scale for large discrepancies) ──────────

function barWidths(etapas: Etapa[]): number[] {
  const vals = etapas.map((e) => Math.max(1, Number(e.valor) || 1))
  const max = Math.max(...vals)
  const min = Math.min(...vals.filter((v) => v > 0))
  const ratio = max / min

  if (ratio > 1000) {
    // Log scale
    const logMax = Math.log10(max)
    const logMin = Math.log10(Math.max(min, 1))
    return vals.map((v) => {
      const logV = Math.log10(Math.max(v, 1))
      return Math.max(8, ((logV - logMin) / (logMax - logMin)) * 100)
    })
  }
  // Linear scale
  return vals.map((v) => Math.max(8, (v / max) * 100))
}

// ── Skeleton ───────────────────────────────────────────────

function FunilSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 animate-pulse">
      <div className="h-6 w-64 bg-zinc-800 rounded mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-8 bg-zinc-800 rounded" style={{ width: `${100 - i * 10}%` }} />
            <div className="h-4 w-20 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-zinc-800 rounded" />
        ))}
      </div>
    </div>
  )
}

// ── Error state ────────────────────────────────────────────

function FunilError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-6 text-center">
      <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
      <p className="text-sm text-red-300 mb-4">Erro ao carregar funil de aquisicao.</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg bg-red-800/50 px-4 py-2 text-sm text-red-200 hover:bg-red-800/70 transition-colors"
      >
        <RefreshCw size={14} />
        Tentar novamente
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────

export function FunilComarka({
  mesReferencia,
  dataInicio,
  dataFim,
  compacto = false,
}: FunilComarkaProps) {
  const [data, setData] = useState<FunilData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams()
      if (mesReferencia) {
        params.set("mesReferencia", mesReferencia)
      } else if (dataInicio && dataFim) {
        params.set("dataInicio", dataInicio.toISOString().slice(0, 10))
        params.set("dataFim", dataFim.toISOString().slice(0, 10))
      }
      const res = await fetch(`/api/marketing/funil-comarka?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [mesReferencia, dataInicio, dataFim])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <FunilSkeleton />
  if (error || !data) return <FunilError onRetry={fetchData} />

  return <FunilContent data={data} compacto={compacto} />
}

// ── Content (separated to avoid re-renders on fetch) ──────

function FunilContent({
  data,
  compacto,
}: {
  data: FunilData
  compacto: boolean
}) {
  const widths = useMemo(() => barWidths(data.etapas), [data.etapas])
  const noAtrib = !data.atribuicao_completa && !data.periodo_parcial

  // Period for atribuição alert
  const alertPeriodo = useMemo(() => {
    if (data.periodo.tipo === "mes") {
      return {
        inicio: `${data.periodo.valor}-01`,
        fim: `${data.periodo.valor}-28`,
      }
    }
    const parts = data.periodo.valor.split(" a ")
    return { inicio: parts[0], fim: parts[1] }
  }, [data.periodo])

  // Badge colors by conversion direction
  const taxaColor = (val: number | null, idx: number) => {
    if (val === null) return "text-zinc-500"
    // First two (CTR, conv página) are typically low — green if > benchmark
    const benchmarks = [0.008, 0.1, 0.25, 0.6, 0.5, 0.08]
    const benchmark = benchmarks[idx] ?? 0.1
    if (val >= benchmark) return "text-emerald-400"
    if (val >= benchmark * 0.6) return "text-yellow-400"
    return "text-red-400"
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-3 sm:px-6 sm:py-4">
        <h3 className="text-base font-semibold text-zinc-100">
          Funil de Aquisição Comarka
          <span className="ml-2 text-sm font-normal text-zinc-400">
            {mesLabel(data.periodo.valor)}
          </span>
        </h3>
        {data.periodo_parcial && (
          <p className="mt-1 text-xs text-yellow-400">
            Periodo parcialmente coberto pela atribuicao de campanhas
          </p>
        )}
      </div>

      {/* Attribution alert */}
      <div className="px-4 pt-3 sm:px-6">
        <AtribuicaoIncompletaAlert periodo={alertPeriodo} />
      </div>

      {/* Funnel bars */}
      <div className="p-4 sm:p-6 space-y-1">
        {data.etapas.map((etapa, i) => {
          const Icon = ETAPA_ICONS[etapa.id] || Users
          const isPostLead = ["qualificados", "reunioes_agendadas", "reunioes_realizadas", "clientes_fechados"].includes(etapa.id)
          const showHash = noAtrib && isPostLead
          const taxa = i > 0 ? data.taxas[i - 1] : null

          return (
            <div key={etapa.id}>
              {/* Taxa badge between bars */}
              {taxa && (
                <div className="flex items-center gap-2 pl-4 py-0.5">
                  <div className="w-px h-3 bg-zinc-700" />
                  <span
                    className={`text-xs font-medium ${taxa.valor !== null && taxa.valor > 1 ? "text-zinc-500" : taxaColor(taxa.valor, i - 1)}`}
                    title={taxa.valor !== null && taxa.valor > 1
                      ? `${taxa.label}: Dados insuficientes para calcular (${TAXA_FORMULAS[taxa.label] || ""})`
                      : `${taxa.label}: ${TAXA_FORMULAS[taxa.label] || ""}`}
                  >
                    {taxa.label}{" "}
                    {taxa.valor !== null
                      ? taxa.valor > 1
                        ? "\u2014"
                        : fmtPct(taxa.valor)
                      : "\u2014"}
                  </span>
                </div>
              )}

              {/* Bar row */}
              <div className="group flex items-center gap-3">
                <div
                  className={`relative flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                    showHash
                      ? "bg-zinc-800/50 border border-dashed border-zinc-600"
                      : "bg-gradient-to-r from-blue-600/20 to-blue-500/5 border border-blue-500/20"
                  }`}
                  style={{ width: `${widths[i]}%`, minWidth: 120 }}
                  title={`Fonte: ${ETAPA_FONTES[etapa.id] || "view"}`}
                >
                  <Icon size={16} className={showHash ? "text-zinc-500" : "text-blue-400"} />
                  <span className={`text-xs truncate ${showHash ? "text-zinc-500" : "text-zinc-300"}`}>
                    {etapa.label}
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold whitespace-nowrap ${
                    showHash ? "text-zinc-500" : "text-zinc-100"
                  }`}
                >
                  {fmtValor(etapa)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer KPIs */}
      {!compacto && (
        <div className="border-t border-zinc-800 px-4 py-3 sm:px-6 sm:py-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 md:gap-3">
            <KpiCard
              label="CAC"
              value={data.totais_finais.cac_bruto}
              format={fmtMoeda}
              icon={TrendingDown}
            />
            <KpiCard
              label="CPRF"
              value={data.totais_finais.cprf}
              format={fmtMoeda}
              tooltip="Custo por Reuniao Feita"
              icon={CalendarCheck}
            />
            <KpiCard
              label="ROAS LTV"
              value={data.totais_finais.roas_bruto}
              format={(v) => `${v.toFixed(1)}x`}
              tooltip="ROAS LTV = LTV real gerado / Investimento Meta"
              icon={TrendingUp}
            />
            <KpiCard
              label="Payback"
              value={data.totais_finais.payback_bruto_meses}
              format={(v) => `${v.toFixed(1)}m`}
              tooltip="CAC / MRR medio"
              icon={RefreshCw}
            />
            <KpiCard
              label="Lead→Cliente"
              value={data.totais_finais.taxa_lead_para_cliente}
              format={fmtPct}
              icon={Target}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPI Card ───────────────────────────────────────────────

function KpiCard({
  label,
  value,
  format,
  tooltip,
  icon: Icon,
}: {
  label: string
  value: number | null
  format: (v: number) => string
  tooltip?: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2"
      title={tooltip}
    >
      <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
        <Icon size={12} />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-sm font-bold text-zinc-100">
        {value !== null && value !== undefined ? format(value) : "\u2014"}
      </span>
    </div>
  )
}

