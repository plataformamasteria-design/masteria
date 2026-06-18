import 'dotenv/config';
import { getMetaAuthForCompany } from '@/lib/meta-ads';
import { metaFetchPaginated } from '@/lib/meta-fetch';

async function runTests() {
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
    const auth = await getMetaAuthForCompany(companyId);
    
    const res = await metaFetchPaginated({
        endpoint: "ads",
        fields: `id,name,effective_status,creative{name,body,title,call_to_action_type,image_url,thumbnail_url,object_story_spec}`,
        account: auth.accountId,
        token: auth.token,
    });
    
    if (res.error) {
        console.error("Erro:", res.error);
    } else {
        // Log just the first ad with a creative
        const ad = res.data.find(a => a.creative);
        console.log(JSON.stringify(ad || res.data[0], null, 2));
    }
    process.exit(0);
}

runTests().catch(console.error);
