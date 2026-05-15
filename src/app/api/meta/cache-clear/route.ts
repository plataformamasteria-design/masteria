/**
 * POST /api/meta/cache-clear — Limpa o cache em memória para forçar refresh.
 */
import { NextResponse } from "next/server";
import { clearMetaCache } from "@/lib/meta-cache";

export const dynamic = "force-dynamic";

export async function POST() {
  clearMetaCache();
  return NextResponse.json({ success: true, message: "Cache limpo com sucesso" });
}
