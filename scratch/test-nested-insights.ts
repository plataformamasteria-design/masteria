import { config } from "dotenv";
config({ path: ".env.local" });

import { getMetaAuthForCompany } from "@/lib/meta-ads";
import { metaFetchPaginated } from "@/lib/meta-fetch";

async function test() {
    const auth = await getMetaAuthForCompany("ed4d2caa-494f-4237-86ea-062273a1107f");
    
    const res = await metaFetchPaginated({
        endpoint: "campaigns",
        fields: "id,name,effective_status,objective,insights.date_preset(last_30d){spend,impressions,clicks,actions}",
        account: auth.accountId,
        token: auth.token,
        params: {}
    });

    console.log("RES:", JSON.stringify(res.data.slice(0, 2), null, 2));
}

test().catch(console.error);
