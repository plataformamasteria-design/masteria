import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

const ResolveItemSchema = z.object({
  id: z.string(),
  status: z.enum(["approved", "rejected", "adjusted"]),
  ajuste_manual: z.string().optional()
});

const BatchActionSchema = z.object({
  batch_id: z.string(),
  global_status: z.enum(["approved", "partially_approved", "rejected"]),
  items: z.array(ResolveItemSchema)
});

export async function POST(req: NextRequest) {
  const { error: authError } = await verifySession();
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = BatchActionSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const { batch_id, global_status, items } = parsed.data;

    // 1. Atualiza Status do Batch
    const { error: batchErr } = await supabase
      .from("ad_intelligence_batches")
      .update({ status: global_status, resolved_at: new Date().toISOString() })
      .eq("id", batch_id);

    if (batchErr) throw batchErr;

    // 2. Atualiza Status dos Itens Individualmente
    for (const item of items) {
      await supabase
        .from("ad_intelligence_batch_items")
        .update({ 
          status: item.status, 
          ajuste_manual: item.ajuste_manual || null 
        })
        .eq("id", item.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[BatchAction Error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  const { error: authError } = await verifySession();
  if (authError) return authError;

  try {
    // Retorna todos os Lotes Pendentes com seus items
    const { data: batches, error } = await supabase
      .from("ad_intelligence_batches")
      .select(`
        id, title, niche, general_diagnosis, status, created_at,
        ad_intelligence_batch_items (
          id, account_id, account_name, diagnosis, suggested_action, confidence_level, status
        )
      `)
      .order("created_at", { ascending: false });
      
    if (error) throw error;

    return NextResponse.json({ success: true, batches });
  } catch(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
