import 'dotenv/config';
import { getMetaAuthForCompany } from '@/lib/meta-ads';
import { metaFetchPaginated } from '@/lib/meta-fetch';

async function runTests() {
    const companyId = '7cb4773e-1fab-4699-b35d-c70d9f8d9149';
    const auth = await getMetaAuthForCompany(companyId);
    
    // Pegando adsets de uma campanha qualquer (baseado no id do teste anterior)
    const res = await metaFetchPaginated({
        endpoint: "adsets",
        fields: `id,name,effective_status,targeting`,
        account: auth.accountId,
        token: auth.token,
        params: { filtering: JSON.stringify([{ field: "campaign.id", operator: "IN", value: ["120243218801010662"] }]) }
    });
    
    if (res.error) {
        console.error("Erro:", res.error);
    } else {
        console.log(JSON.stringify(res.data[0], null, 2));
    }
    process.exit(0);
}

runTests().catch(console.error);
