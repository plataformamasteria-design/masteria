import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { verifySession } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"
);

const SchemaObj = z.object({
  context_type: z.enum(["global", "account_specific"]),
  account_id: z.string().nullable().optional(),
  learning_text: z.string().min(3),
  active: z.boolean().default(true),
});

export async function GET() {
  const { error: authError } = await verifySession();
  if (authError) return authError;

  const { data, error } = await supabase
    .from("ad_intelligence_memory")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memory: data });
}

export async function POST(req: NextRequest) {
  const { error: authError } = await verifySession();
  if (authError) return authError;

  try {
    const body = await req.json();
    const parsed = SchemaObj.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const { context_type, account_id, learning_text, active } = parsed.data;

    const { data, error } = await supabase
      .from("ad_intelligence_memory")
      .insert({
        context_type,
        account_id: account_id || null, // null if it's a global/niche rule
        learning_text,
        active
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, memory: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error: authError } = await verifySession();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { error } = await supabase
      .from("ad_intelligence_memory")
      .update({ active: false })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
