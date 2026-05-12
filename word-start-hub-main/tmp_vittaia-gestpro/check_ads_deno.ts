import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("Supabase URL:", supabaseUrl);
console.log("Service key starts with:", supabaseKey ? supabaseKey.substring(0, 10) : "missing");

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdData() {
    const orgId = "1a8badd1-dd65-4d7a-b9c2-aeadebcc5cd5";

    console.log("Checking marketing_campaigns for Vholi...");
    const { data: camps, error } = await supabase
        .from('marketing_campaigns')
        .select('campaign_id, campaign_name, raw_data')
        .eq('platform', 'meta_ads')
        .eq('organization_id', orgId);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${camps.length} campaigns.`);

    if (camps.length > 0) {
        for (const c of camps) {
            console.log(`\nCampaign: ${c.campaign_name} (${c.campaign_id})`);
            const raw = c.raw_data;
            if (raw && raw.ads) {
                console.log(`  Ads array has ${raw.ads.length} items`);
                if (raw.ads.length > 0) {
                    console.log(`  Sample Ad: ID=${raw.ads[0].id} | Ad_ID=${raw.ads[0].ad_id} | Name=${raw.ads[0].ad_name || raw.ads[0].name}`);
                }
            } else {
                console.log("  No ads array in raw_data");
            }
        }
    }

    // Check tags in this org
    console.log("\nChecking tags for 'anúncio' in Vholi...");
    const { data: tags, error: tagsErr } = await supabase
        .from('tags')
        .select('id, name')
        .eq('organization_id', orgId)
        .ilike('name', '%anúncio%');

    if (tagsErr) console.error("Tags error:", tagsErr);
    else console.log("Ad tags found:", tags);
}

checkAdData();
