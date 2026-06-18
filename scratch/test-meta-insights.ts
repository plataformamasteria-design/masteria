import 'dotenv/config';
import { getMetaAuthForCompany } from '@/lib/meta-ads';
import { metaFetchPaginated } from '@/lib/meta-fetch';

async function runTests() {
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
    const auth = await getMetaAuthForCompany(companyId);
    
    const res = await metaFetchPaginated({
        endpoint: "campaigns",
        fields: `id,name,effective_status,objective,insights.date_preset(last_30d){spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,inline_link_clicks,cost_per_inline_link_click,actions}`,
        account: auth.accountId,
        token: auth.token,
    });
    
    if (res.error) {
        console.error("Erro:", res.error);
    } else {
        console.log(JSON.stringify(res.data[0], null, 2));
    }
    process.exit(0);
}

runTests().catch(console.error);
