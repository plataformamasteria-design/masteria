/**
 * GET /api/meta/ad-preview — Retorna HTML de preview de anúncio renderizado pela Meta.
 * Multi-tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    const { searchParams } = new URL(req.url);
    const adId = searchParams.get("ad_id");
    const format = searchParams.get("format") || "MOBILE_FEED_STANDARD";

    if (!adId) {
      return new NextResponse("<p>ad_id obrigatório</p>", {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    const qs = new URLSearchParams({
      access_token: auth.token,
      ad_format: format,
    });

    const res = await fetch(`${META_BASE}/${adId}/previews?${qs.toString()}`);
    const data = await res.json();

    if (!res.ok || !data.data?.[0]?.body) {
      const errMsg = data.error?.message || "Preview não disponível";
      return new NextResponse(
        `<html><body style="background:#09090b;color:#888;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh"><p>${errMsg}</p></body></html>`,
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // O body retornado pela Meta é HTML com iframe — servimos com wrapper para auto-resize
    const previewHtml = data.data[0].body;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #09090b; display: flex; justify-content: center; padding: 8px; }
  iframe { border: none; max-width: 100%; }
</style></head><body>
${previewHtml}
<script>
  // Reportar altura real ao parent
  function reportHeight() {
    const h = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: 'metaPreviewHeight', height: h }, '*');
  }
  window.addEventListener('load', () => setTimeout(reportHeight, 500));
  new MutationObserver(reportHeight).observe(document.body, { childList: true, subtree: true });
</script>
</body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e: any) {
    console.error("[api/meta/ad-preview]", e);
    return new NextResponse(
      `<html><body style="background:#09090b;color:#f87171;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh"><p>${e.message}</p></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
