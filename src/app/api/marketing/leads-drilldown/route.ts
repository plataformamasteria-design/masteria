import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams;
    const mesReferencia = url.get("mesReferencia");
    const tipo = url.get("tipo");
    
    // Returning an empty list of leads since we don't have the crm_leads mapping yet
    return NextResponse.json({
      leads: []
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
