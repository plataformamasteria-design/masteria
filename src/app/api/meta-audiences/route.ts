import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthForSession, META_BASE } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getMetaAuthForSession();
    if (!auth.accountId) {
      return NextResponse.json({ error: "Conta de anúncios não selecionada" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const accountParam = searchParams.get("account_id");

    const account = accountParam ? (accountParam.startsWith("act_") ? accountParam : `act_${accountParam}`) : (auth.accountId.startsWith("act_") ? auth.accountId : `act_${auth.accountId}`);

    // Fetch adsets with targeting information
    const r = await fetch(`${META_BASE}/${account}/adsets?fields=id,name,status,campaign{id,name},targeting&limit=500&access_token=${auth.token}`);
    
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`Meta API Error: ${err}`);
    }
    
    const json = await r.json();
    const data = json.data || [];

    const mappedData = data.map((adset: any) => {
      const t = adset.targeting || {};
      const audiences: any[] = [];

      // Flexible interests
      if (t.flexible_spec) {
        for (const spec of t.flexible_spec) {
          if (spec.interests) {
            for (const interest of spec.interests) {
              audiences.push({ tipo: "interest", id: interest.id, name: interest.name });
            }
          }
          if (spec.behaviors) {
            for (const behavior of spec.behaviors) {
              audiences.push({ tipo: "behavior", id: behavior.id, name: behavior.name });
            }
          }
        }
      }

      // Custom audiences
      if (t.custom_audiences) {
        for (const ca of t.custom_audiences) {
          const isLookalike = ca.name?.toLowerCase().includes("lookalike") || ca.name?.toLowerCase().includes("lal") || ca.name?.toLowerCase().includes("semelhante");
          audiences.push({ 
            tipo: isLookalike ? "lookalike" : "custom_audience", 
            id: ca.id, 
            name: ca.name 
          });
        }
      }

      // If targeting has interests directly
      if (t.interests) {
        for (const interest of t.interests) {
           audiences.push({ tipo: "interest", id: interest.id, name: interest.name });
        }
      }
      
      // If no audiences, we won't add any. The UI handles bucketBroad!
      
      return {
        adset_id: adset.id,
        adset_name: adset.name,
        campaign_id: adset.campaign?.id || "",
        campaign_name: adset.campaign?.name || "",
        status: adset.status,
        age_min: t.age_min,
        age_max: t.age_max,
        genders: t.genders ? t.genders.map(String) : [],
        locations: t.geo_locations?.countries || [],
        audiences,
      };
    });

    return NextResponse.json({ data: mappedData });
  } catch (err: any) {
    console.error("[api/meta-audiences]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
