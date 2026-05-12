import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Clock, XCircle } from "lucide-react";

export const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || "https://jrxpjzgifyzhvwjfpofz.supabase.co";
export const ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

export interface PaymentRecord {
    id: string;
    organization_id: string;
    amount: number;
    status: string;
    reference_month: string;
    mercadopago_payment_id: string | null;
    mercadopago_preference_id: string | null;
    mercadopago_external_reference: string | null;
    payment_method: string | null;
    payment_date: string | null;
    due_date: string | null;
    created_at: string;
    metadata: any;
    pix_qr_code: string | null;
    pix_copy_paste: string | null;
    boleto_url: string | null;
    payment_link: string | null;
    notes: string | null;
    payment_type: string;
}

export interface MercadoPagoConfig {
    id: string;
    access_token_encrypted: string | null;
    public_key: string | null;
    webhook_secret: string | null;
    active: boolean;
}

export const PAYMENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    mensalidade: { label: "Mensalidade", color: "text-blue-600" },
    token_chatgpt: { label: "Token ChatGPT", color: "text-emerald-600" },
    token_gemini: { label: "Token Gemini", color: "text-violet-600" },
};

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; badgeVariant: "default" | "secondary" | "destructive" | "outline" }> = {
    paid: { label: "Pago", color: "text-green-600", icon: CheckCircle, badgeVariant: "default" },
    pending: { label: "Pendente", color: "text-yellow-600", icon: Clock, badgeVariant: "secondary" },
    failed: { label: "Falhou", color: "text-destructive", icon: XCircle, badgeVariant: "destructive" },
    cancelled: { label: "Cancelado", color: "text-muted-foreground", icon: XCircle, badgeVariant: "outline" },
};

export async function callMP(action: string, body?: any, method = "POST") {
    const session = (await supabase.auth.getSession()).data.session;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mercadopago-webhook?action=${action}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: ANON_KEY,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
}

export async function calculateOrgTotal(orgId: string): Promise<number> {
    const [modulesRes, connectionsRes, globalModulesRes, globalConnsRes] = await Promise.all([
        (supabase as any).from("organization_modules").select("module_key, price").eq("organization_id", orgId).eq("active", true),
        (supabase as any).from("organization_connections").select("connection_key, price").eq("organization_id", orgId).eq("active", true),
        (supabase as any).from("global_module_prices").select("module_key, base_price"),
        (supabase as any).from("global_connection_prices").select("connection_key, base_price"),
    ]);

    const globalModuleMap: Record<string, number> = {};
    for (const gm of globalModulesRes.data || []) globalModuleMap[gm.module_key] = Number(gm.base_price || 0);
    const globalConnMap: Record<string, number> = {};
    for (const gc of globalConnsRes.data || []) globalConnMap[gc.connection_key] = Number(gc.base_price || 0);

    const FREE_CONNECTIONS = ["whatsapp_nativo"];
    let total = 0;
    for (const m of modulesRes.data || []) {
        const price = Number(m.price || 0);
        total += price > 0 ? price : (globalModuleMap[m.module_key] || 0);
    }
    for (const c of connectionsRes.data || []) {
        if (FREE_CONNECTIONS.includes(c.connection_key)) continue;
        const price = Number(c.price || 0);
        total += price > 0 ? price : (globalConnMap[c.connection_key] || 0);
    }
    return total;
}
