import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DiagnosticData, EnrichedMonthData, AdSegmentedData, HealthScore } from "./types";

export const LOSS_LABELS: Record<string, string> = {
    price: "Preço",
    timing: "Timing",
    competitor: "Concorrência",
    no_need: "Sem necessidade",
    no_response: "Sem resposta",
    other: "Outro",
};

export const STATUS_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#ef4444", "#f59e0b"];

export const PLATFORMS = [
    { value: "meta_ads", label: "Meta Ads (Facebook/Instagram)" },
    { value: "google_ads", label: "Google Ads" },
    { value: "tiktok_ads", label: "TikTok Ads" },
    { value: "linkedin_ads", label: "LinkedIn Ads" },
    { value: "outros", label: "Outros" },
];

export const emptyAdSegmented = (): AdSegmentedData => ({
    ad_leads: 0, organic_leads: 0, ad_qualified: 0, organic_qualified: 0,
    ad_converted: 0, organic_converted: 0, ad_lost: 0, organic_lost: 0,
    ad_avg_hours: 0, organic_avg_hours: 0, campaign_breakdown: [],
});

export const emptyMonth = (month: string): DiagnosticData => ({
    reference_month: month, total_leads: 0, meetings_scheduled: 0,
    meetings_done: 0, no_show: 0, contracts_won: 0, ltv_total: 0,
    ad_spend: 0, commission_rate: 10, cpl: 0, meeting_rate: 0,
    cprf: 0, conversion_rate: 0, cac_marketing: 0, cac_approximate: 0,
    ticket_medio: 0, mrr: 0, roas: 0, commission_total: 0, closers_result: 0,
    campaign_name: "", campaign_platform: "meta_ads", campaign_impressions: 0,
    campaign_clicks: 0, campaign_ctr: 0, campaign_cpc: 0,
    campaign_conversions: 0, campaign_cost_per_conversion: 0, campaign_notes: "",
});

export const emptyEnriched = (): EnrichedMonthData => ({
    leads_qualificados: 0, leads_convertidos: 0, leads_perdidos: 0,
    leads_adiados: 0, loss_reasons: {}, closers: [], avg_resolution_hours: 0,
    bookings_confirmed: 0, bookings_cancelled: 0, clients_converted: 0, clients_value: 0,
});

export function calculateKPIs(d: DiagnosticData): DiagnosticData {
    const leads = d.total_leads || 0;
    const meetingsDone = d.meetings_done || 0;
    const contracts = d.contracts_won || 0;
    const adSpend = d.ad_spend || 0;
    const ltvTotal = d.ltv_total || 0;
    const commRate = d.commission_rate || 0;
    const mrr = contracts > 0 ? ltvTotal / contracts : 0;
    const cpl = leads > 0 ? adSpend / leads : 0;
    const meetingRate = leads > 0 ? (d.meetings_scheduled / leads) * 100 : 0;
    const cprf = meetingsDone > 0 ? adSpend / meetingsDone : 0;
    const conversionRate = leads > 0 ? (contracts / leads) * 100 : 0;
    const cacMarketing = contracts > 0 ? adSpend / contracts : 0;
    const commissionTotal = mrr * contracts * (commRate / 100);
    const cacApproximate = contracts > 0 ? (adSpend + commissionTotal) / contracts : 0;
    const ticketMedio = contracts > 0 ? mrr : 0;
    const totalMrr = mrr * contracts;
    const roas = adSpend > 0 ? totalMrr / adSpend : 0;
    const closersResult = totalMrr - adSpend - commissionTotal;

    const impressions = d.campaign_impressions || 0;
    const clicks = d.campaign_clicks || 0;
    const campaignCtr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const campaignCpc = clicks > 0 ? adSpend / clicks : 0;
    const campaignConversions = d.campaign_conversions || 0;
    const costPerConversion = campaignConversions > 0 ? adSpend / campaignConversions : 0;

    return {
        ...d,
        cpl: Math.round(cpl * 100) / 100,
        meeting_rate: Math.round(meetingRate * 100) / 100,
        cprf: Math.round(cprf * 100) / 100,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        cac_marketing: Math.round(cacMarketing * 100) / 100,
        cac_approximate: Math.round(cacApproximate * 100) / 100,
        ticket_medio: Math.round(ticketMedio * 100) / 100,
        mrr: Math.round(totalMrr * 100) / 100,
        roas: Math.round(roas * 100) / 100,
        commission_total: Math.round(commissionTotal * 100) / 100,
        closers_result: Math.round(closersResult * 100) / 100,
        campaign_ctr: Math.round(campaignCtr * 100) / 100,
        campaign_cpc: Math.round(campaignCpc * 100) / 100,
        campaign_cost_per_conversion: Math.round(costPerConversion * 100) / 100,
    };
}

export function calculateHealthScore(d: DiagnosticData, enriched: EnrichedMonthData | null): HealthScore {
    const convRate = d.total_leads > 0 ? (d.contracts_won / d.total_leads) * 100 : 0;
    const conversion = Math.min(100, Math.max(0, (convRate / 20) * 100));

    const noShowRate = d.meetings_scheduled > 0 ? (d.no_show / d.meetings_scheduled) * 100 : 0;
    const noShow = Math.max(0, 100 - (noShowRate / 30) * 100);

    const roas = Math.min(100, Math.max(0, (d.roas / 5) * 100));

    const avgH = enriched?.avg_resolution_hours || 0;
    const velocity = avgH > 0 ? Math.max(0, 100 - ((avgH - 24) / 144) * 100) : 50;

    const overall = Math.round((conversion * 0.35 + noShow * 0.15 + roas * 0.3 + velocity * 0.2));
    const label = overall >= 80 ? "Excelente" : overall >= 60 ? "Bom" : overall >= 40 ? "Atenção" : "Crítico";
    const color = overall >= 80 ? "text-emerald-500" : overall >= 60 ? "text-blue-500" : overall >= 40 ? "text-amber-500" : "text-destructive";

    return { overall, conversion, noShow, roas, velocity, label, color };
}

export function fmt(value: number): string {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function getMonthName(month: string): string {
    const [y, m] = month.split("-");
    return format(new Date(parseInt(y), parseInt(m) - 1, 1), "MMMM", { locale: ptBR });
}

export function getMonthShort(month: string): string {
    const [y, m] = month.split("-");
    return format(new Date(parseInt(y), parseInt(m) - 1, 1), "MMM", { locale: ptBR }).toUpperCase();
}

export function generateAlerts(d: DiagnosticData, enriched: EnrichedMonthData | null, prev: DiagnosticData | null): { type: 'success' | 'warning' | 'danger'; message: string; action?: string }[] {
    const alerts: { type: 'success' | 'warning' | 'danger'; message: string; action?: string }[] = [];

    if (d.meetings_scheduled > 0 && (d.no_show / d.meetings_scheduled) > 0.2) {
        alerts.push({ type: 'danger', message: `Alto No-Show: ${((d.no_show / d.meetings_scheduled) * 100).toFixed(0)}% dos agendamentos não compareceram.`, action: "Configure lembretes automáticos via WhatsApp 24h antes." });
    }

    if (d.total_leads > 10 && d.conversion_rate < 5) {
        alerts.push({ type: 'warning', message: `Conversão baixa: ${d.conversion_rate.toFixed(1)}%. A média de mercado é 10-15%.`, action: "Revise a qualificação de leads e o script de vendas." });
    }

    if (d.ad_spend > 0 && d.roas < 1) {
        alerts.push({ type: 'danger', message: `ROAS negativo: ${d.roas.toFixed(2)}x. Cada R$1 investido gera apenas R$${d.roas.toFixed(2)}.`, action: "Pause campanhas de baixo desempenho e redirecione budget." });
    } else if (d.ad_spend > 0 && d.roas >= 3) {
        alerts.push({ type: 'success', message: `ROAS excelente: ${d.roas.toFixed(1)}x. Considere escalar o investimento.` });
    }

    if (enriched && enriched.bookings_confirmed + enriched.bookings_cancelled > 5) {
        const cancelRate = enriched.bookings_cancelled / (enriched.bookings_confirmed + enriched.bookings_cancelled) * 100;
        if (cancelRate > 25) {
            alerts.push({ type: 'warning', message: `Taxa de cancelamento alta: ${cancelRate.toFixed(0)}% dos bookings foram cancelados.`, action: "Envie confirmação 1h antes e ofereça reagendamento fácil." });
        }
    }

    if (prev && prev.total_leads > 0 && d.total_leads < prev.total_leads * 0.7) {
        const drop = ((1 - d.total_leads / prev.total_leads) * 100).toFixed(0);
        alerts.push({ type: 'warning', message: `Queda de ${drop}% em leads vs mês anterior.`, action: "Verifique se campanhas estão ativas e budget está sendo consumido." });
    }

    if (enriched && enriched.avg_resolution_hours > 72) {
        alerts.push({ type: 'warning', message: `Tempo médio de resolução: ${enriched.avg_resolution_hours.toFixed(0)}h. Lead esfria rápido!`, action: "Defina SLA de 24h e use follow-ups automáticos." });
    }

    if (prev && prev.mrr > 0 && d.mrr > prev.mrr * 1.2) {
        alerts.push({ type: 'success', message: `Receita cresceu ${(((d.mrr / prev.mrr) - 1) * 100).toFixed(0)}% vs mês anterior!` });
    }

    return alerts.slice(0, 5);
}

export function projectRevenue(data: DiagnosticData[]): { nextMonth: number; trend: 'up' | 'down' | 'flat' } {
    const recent = data.filter(d => d.mrr > 0).slice(-3);
    if (recent.length < 2) return { nextMonth: 0, trend: 'flat' };
    const avg = recent.reduce((s, d) => s + d.mrr, 0) / recent.length;
    const last = recent[recent.length - 1].mrr;
    const secondLast = recent[recent.length - 2].mrr;
    const growth = secondLast > 0 ? (last - secondLast) / secondLast : 0;
    const projected = last * (1 + growth);
    const trend = growth > 0.05 ? 'up' : growth < -0.05 ? 'down' : 'flat';
    return { nextMonth: Math.max(0, Math.round(projected * 100) / 100), trend };
}
