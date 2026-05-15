/**
 * GET /api/meta/ad-creative-full — Dados completos do criativo de um anúncio.
 * Multi-tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    const adId = new URL(req.url).searchParams.get("ad_id");
    if (!adId) return NextResponse.json({ error: "ad_id obrigatório" }, { status: 400 });

    // 1. Buscar anúncio com creative expandido
    const adFields = "id,name,status,effective_status,creative{id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec}";
    const adRes = await fetch(`${META_BASE}/${adId}?access_token=${auth.token}&fields=${adFields}`);
    const adData = await adRes.json();
    if (!adRes.ok) throw new Error(adData.error?.message || `Meta API ${adRes.status}`);

    const creative = adData.creative || {};
    const oss = creative.object_story_spec || {};
    const linkData = oss.link_data;
    const videoData = oss.video_data;

    // Determinar tipo
    let creative_type: "IMAGE" | "VIDEO" | "CAROUSEL" | "UNKNOWN" = "UNKNOWN";
    if (linkData?.child_attachments?.length) creative_type = "CAROUSEL";
    else if (videoData || creative.video_id) creative_type = "VIDEO";
    else if (linkData || creative.image_url) creative_type = "IMAGE";

    // Montar detalhes
    const details: Record<string, unknown> = {
      copy: linkData?.message || videoData?.message || creative.body || "",
      headline: linkData?.name || videoData?.title || creative.title || "",
      description: linkData?.description || "",
      link: linkData?.link || linkData?.call_to_action?.value?.link || "",
      image_url: creative.image_url || linkData?.picture || "",
      thumbnail_url: creative.thumbnail_url || "",
      video_id: creative.video_id || videoData?.video_id || "",
      cta_type: linkData?.call_to_action?.type || videoData?.call_to_action?.type || "",
      cta_link: linkData?.call_to_action?.value?.link || videoData?.call_to_action?.value?.link || "",
      page_id: oss.page_id || "",
      instagram_actor_id: oss.instagram_actor_id || "",
    };

    // Carousel cards
    if (linkData?.child_attachments) {
      details.cards = linkData.child_attachments.map((c: any, i: number) => ({
        index: i,
        headline: c.name || "",
        description: c.description || "",
        link: c.link || "",
        image_url: c.picture || c.image_hash || "",
        video_id: c.video_id || "",
        cta_type: c.call_to_action?.type || "",
      }));
    }

    // 2. Tentar buscar preview HTML
    let preview_html: string | null = null;
    try {
      const pvRes = await fetch(`${META_BASE}/${adId}/previews?access_token=${auth.token}&ad_format=MOBILE_FEED_STANDARD`);
      const pvData = await pvRes.json();
      preview_html = pvData.data?.[0]?.body || null;
    } catch {}

    return NextResponse.json({
      ad: { id: adData.id, name: adData.name, status: adData.status, effective_status: adData.effective_status },
      creative_id: creative.id || "",
      creative_type,
      creative_details: details,
      preview_html,
    });
  } catch (e: any) {
    console.error("[api/meta/ad-creative-full]", e);
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
