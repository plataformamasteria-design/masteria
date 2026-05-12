export interface DiagnosticData {
    id?: string;
    reference_month: string;
    total_leads: number;
    meetings_scheduled: number;
    meetings_done: number;
    no_show: number;
    contracts_won: number;
    ltv_total: number;
    ad_spend: number;
    commission_rate: number;
    cpl: number;
    meeting_rate: number;
    cprf: number;
    conversion_rate: number;
    cac_marketing: number;
    cac_approximate: number;
    ticket_medio: number;
    mrr: number;
    roas: number;
    commission_total: number;
    closers_result: number;
    campaign_name: string;
    campaign_platform: string;
    campaign_impressions: number;
    campaign_clicks: number;
    campaign_ctr: number;
    campaign_cpc: number;
    campaign_conversions: number;
    campaign_cost_per_conversion: number;
    campaign_notes: string;
}

export interface EnrichedMonthData {
    leads_qualificados: number;
    leads_convertidos: number;
    leads_perdidos: number;
    leads_adiados: number;
    loss_reasons: Record<string, number>;
    closers: CloserStats[];
    avg_resolution_hours: number;
    bookings_confirmed: number;
    bookings_cancelled: number;
    clients_converted: number;
    clients_value: number;
}

export interface CloserStats {
    id: string;
    name: string;
    total: number;
    convertidos: number;
    perdidos: number;
    taxa: number;
    avg_hours: number;
}

export interface AdSegmentedData {
    ad_leads: number;
    organic_leads: number;
    ad_qualified: number;
    organic_qualified: number;
    ad_converted: number;
    organic_converted: number;
    ad_lost: number;
    organic_lost: number;
    ad_avg_hours: number;
    organic_avg_hours: number;
    campaign_breakdown: { campaign_name: string; campaign_id: string; count: number; converted: number; lost: number; qualified: number }[];
}

export interface HealthScore {
    overall: number;
    conversion: number;
    noShow: number;
    roas: number;
    velocity: number;
    label: string;
    color: string;
}
