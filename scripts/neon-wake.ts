/**
 * Neon Database Endpoint Wake-Up Script v2
 * Uses the Neon API to find and start suspended database endpoints.
 */

const NEON_API_KEY = 'napi_z2535ywmzuamozvcq0qxz18m4o51pa5rwmpisdybakbp1b6ek15h70eq431ktzre';
const NEON_API_BASE = 'https://console.neon.tech/api/v2';

async function neonRequest(path: string, method = 'GET', body?: any) {
    const url = `${NEON_API_BASE}${path}`;
    console.log(`🔍 ${method} ${url}`);

    const res = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${NEON_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        console.error('❌ Non-JSON response:', text);
        return null;
    }

    if (!res.ok) {
        console.error(`❌ API Error (${res.status}):`, JSON.stringify(data, null, 2));
        return null;
    }

    return data;
}

async function main() {
    console.log('🚀 Starting Neon endpoint wake-up v2...\n');

    // 1. Get user info first
    console.log('📋 Fetching user info...');
    const userInfo = await neonRequest('/users/me');
    if (userInfo) {
        console.log(`  Email: ${userInfo.email || 'N/A'}`);
        console.log(`  Plan: ${userInfo.plan || 'N/A'}`);
        console.log(`  ID: ${userInfo.id || 'N/A'}`);
    }

    // 2. Try to list projects - with different approaches
    console.log('\n📦 Fetching projects...');

    // Try without org_id first (for personal accounts)
    let projectsData = await neonRequest('/projects?limit=10');

    // If that fails, try to get orgs and use org_id
    if (!projectsData) {
        console.log('   Trying with org_id approach...');
        const orgsData = await neonRequest('/orgs');
        if (orgsData?.organizations?.length > 0) {
            const orgId = orgsData.organizations[0].id;
            console.log(`   Found org: ${orgId}`);
            projectsData = await neonRequest(`/projects?org_id=${orgId}&limit=10`);
        }
    }

    if (!projectsData?.projects) {
        console.error('❌ Could not fetch projects');
        process.exit(1);
    }

    console.log(`\n✅ Found ${projectsData.projects.length} projects:\n`);

    for (const project of projectsData.projects) {
        console.log(`  📁 ${project.name} (ID: ${project.id})`);
        console.log(`     Region: ${project.region_id}`);
        console.log(`     Created: ${project.created_at}`);

        // Get endpoints
        const endpointsData = await neonRequest(`/projects/${project.id}/endpoints`);
        if (endpointsData?.endpoints) {
            for (const endpoint of endpointsData.endpoints) {
                console.log(`\n     📡 Endpoint: ${endpoint.id}`);
                console.log(`        Host: ${endpoint.host}`);
                console.log(`        State: ${endpoint.current_state || 'unknown'}`);
                console.log(`        Suspended: ${endpoint.suspended ? 'YES ⚠️' : 'NO'}`);

                // If suspended or idle, try to start
                if (endpoint.suspended || endpoint.current_state === 'idle') {
                    console.log(`\n     ⚡ Starting endpoint ${endpoint.id}...`);
                    const result = await neonRequest(`/projects/${project.id}/endpoints/${endpoint.id}/start`, 'POST');
                    if (result) {
                        console.log(`     ✅ Endpoint started! New state: ${result.endpoint?.current_state || 'starting'}`);
                    }
                }
            }
        }
        console.log('');
    }

    console.log('🎉 Done!');
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
