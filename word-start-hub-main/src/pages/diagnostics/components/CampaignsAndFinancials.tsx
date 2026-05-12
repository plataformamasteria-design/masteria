import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, HandCoins } from "lucide-react";

interface CampaignsAndFinancialsProps {
    d: any; // DiagnosticData
    campaignList: any[];
    fmt: (v: number) => string;
}

export function CampaignsAndFinancials({
    d,
    campaignList,
    fmt
}: CampaignsAndFinancialsProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Card className="rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm overflow-hidden flex flex-col transition-all">
                <div className="p-4 border-b border-neutral-200/60 dark:border-white/5 bg-white/40 dark:bg-transparent flex justify-between items-center">
                    <h3 className="text-xs uppercase tracking-wider font-bold flex items-center gap-2 text-foreground">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Campanhas de Tráfego
                    </h3>
                    <Badge variant="secondary" className="text-[10px] h-5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">{campaignList.filter((c: any) => c.status === "ACTIVE").length} ATIVAS</Badge>
                </div>
                <CardContent className="space-y-2 p-5">
                    {campaignList.filter((c: any) => c.status === "ACTIVE").length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">Nenhuma campanha ATIVA neste período.</p>
                    ) : (
                        <div className="max-h-[295px] overflow-y-auto space-y-2 scrollbar-none pr-1">
                            {campaignList.filter((c: any) => c.status === "ACTIVE").map((camp: any, idx: number) => {
                                return (
                                    <div key={camp.campaign_id || idx} className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 transition-all hover:shadow-sm">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[11px] font-black tracking-tight truncate max-w-[75%]">{camp.campaign_name}</span>
                                            <Badge className="text-[9px] h-4 bg-emerald-500/20 text-emerald-600 border-emerald-500/30 font-bold" variant="outline">
                                                ON
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 mt-2">
                                            {[
                                                { label: "Gasto", value: fmt(camp.spend || 0) },
                                                { label: "Impress.", value: (camp.impressions || 0).toLocaleString("pt-BR") },
                                                { label: "Cliques", value: (camp.clicks || 0).toLocaleString("pt-BR") },
                                                { label: "Conv.", value: (camp.conversions || 0).toString() },
                                            ].map(m => (
                                                <div key={m.label} className="text-center">
                                                    <p className="text-[9px] text-muted-foreground tracking-wider uppercase font-medium">{m.label}</p>
                                                    <p className="text-[11px] font-black mt-0.5">{m.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Financial KPIs Box */}
            <div className="rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
                <div className="p-4 border-b border-neutral-200/60 dark:border-white/5 bg-white/40 dark:bg-transparent">
                    <h3 className="text-xs uppercase tracking-wider font-bold flex items-center gap-2 text-foreground">
                        <HandCoins className="h-4 w-4 text-emerald-500" />
                        Indicadores Financeiros
                    </h3>
                </div>
                <div className="p-5 flex-1 mt-1">
                    <div className="space-y-1">
                        {(() => {
                            const calculatedApproxCac = d.contracts_won > 0 ? (d.ad_spend + d.commission_total) / d.contracts_won : 0;
                            const custoPorReuniao = d.meetings_scheduled > 0 ? d.ad_spend / d.meetings_scheduled : 0;
                            return [
                                { label: "Investimento em Anúncios", value: fmt(d.ad_spend), sub: "Total investido nas campanhas" },
                                { label: "CPL (Custo por Lead)", value: fmt(d.cpl), sub: d.total_leads > 0 ? `${fmt(d.ad_spend)} ÷ ${d.total_leads} leads` : "Sem dados" },
                                { label: "CPA (Custo por Reunião)", value: fmt(custoPorReuniao), sub: d.meetings_scheduled > 0 ? `${fmt(d.ad_spend)} ÷ ${d.meetings_scheduled} reun` : "Sem dados" },
                                { label: "CAC Marketing", value: fmt(d.cac_marketing), sub: d.contracts_won > 0 ? `${fmt(d.ad_spend)} ÷ ${d.contracts_won} clientes` : "Sem dados" },
                                { label: "CAC Aproximado", value: fmt(calculatedApproxCac), sub: "(Ads + Comissões) ÷ Clientes" },
                                { label: "Ticket Médio (LTV)", value: fmt(d.ticket_medio), sub: "Receita média por contrato" },
                                { label: "ROAS (Return on Ad Spend)", value: `${d.roas.toFixed(2)}x`, sub: d.roas >= 3 ? "✅ Excelente" : d.roas >= 1.5 ? "⚠️ Razoável" : "❌ Negativo" },
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 group hover:bg-muted/10 px-1 -mx-1 rounded-sm transition-colors">
                                    <div>
                                        <p className="text-[11px] font-bold text-foreground">{item.label}</p>
                                        <p className="text-[10px] text-muted-foreground font-medium">{item.sub}</p>
                                    </div>
                                    <span className="text-[13px] font-black tracking-tighter bg-neutral-100/50 dark:bg-white/5 border border-black/5 dark:border-white/5 shadow-sm px-2.5 py-1 rounded-md">{item.value}</span>
                                </div>
                            ))
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}
