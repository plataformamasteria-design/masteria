import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const { getMetaAuthForCompany } = await import('../src/lib/meta-ads');
    const { metaFetchPaginated } = await import('../src/lib/meta-fetch');

    try {
        const auth = await getMetaAuthForCompany('ba56e066-6609-437c-9c9f-663e1565410a');
        
        const since = "2026-05-01";
        const until = "2026-05-15";
        const timeRangeStr = JSON.stringify({ since, until });
        
        const res = await metaFetchPaginated({
            endpoint: "campaigns",
            fields: `id,name,effective_status,objective,insights.time_range(${timeRangeStr}){spend,impressions,clicks,actions}`,
            account: auth.accountId,
            token: auth.token
        });

        console.log("Response:", JSON.stringify(res, null, 2));

    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
