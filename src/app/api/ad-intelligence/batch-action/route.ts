import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

// Simple in-memory store for batches to allow the UI to function without new DB tables
let mockBatches: any[] = [];

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ batches: mockBatches });
  } catch (error: any) {
    console.error("[api/ad-intelligence/batch-action]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { batch_id, global_status, items } = body;

    const batch = mockBatches.find(b => b.id === batch_id);
    if (batch) {
      batch.status = global_status;
      if (items && Array.isArray(items)) {
        items.forEach((item: any) => {
          const bItem = batch.ad_intelligence_batch_items.find((i: any) => i.id === item.id);
          if (bItem) bItem.status = item.status;
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/ad-intelligence/batch-action]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Helper to push new batches from cluster-analysis
export function addMockBatch(batch: any) {
  mockBatches.unshift(batch);
}
