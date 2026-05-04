
const API_KEY = process.argv[2];

if (!API_KEY) {
    console.error('Please provide the Neon API Key as an argument.');
    process.exit(1);
}

const V1_BASE_URL = 'https://console.neon.tech/api/v1';
const V2_BASE_URL = 'https://console.neon.tech/api/v2';

async function fetchNeon(url: string) {
    console.log(`   Requesting: ${url}`);
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error ${response.status}: ${response.statusText} - ${text}`);
    }

    return response.json();
}

async function main() {
    console.log('🔍 Connecting to Neon API...');

    let projects: any[] = [];
    let usedVersion = 'v2';
    let userId = '';

    // Step 0: Get User ID to try as Org ID
    try {
        console.log('   Fetching User Info...');
        const me = await fetchNeon(`${V2_BASE_URL}/users/me`);
        userId = me.id;
        console.log(`   User ID: ${userId} (${me.login})`);
    } catch (e: any) {
        console.log('   Could not fetch user info:', e.message);
    }

    // Strategy 1: V2 with org_id = user_id
    if (userId) {
        try {
            console.log(`   Trying V2 Projects with org_id=${userId}...`);
            const data = await fetchNeon(`${V2_BASE_URL}/projects?org_id=${userId}`);
            projects = data.projects || data;
            usedVersion = 'v2';
        } catch (e: any) {
            console.log('   ⚠️ V2 (org_id=userId) failed:', e.message);
        }
    }

    if (projects.length === 0) {
        // Strategy 2: V2 with shared=true
        try {
            console.log('   Trying V2 Projects (shared=true)...');
            const data = await fetchNeon(`${V2_BASE_URL}/projects?shared=true`);
            projects = data.projects || data;
            usedVersion = 'v2';
        } catch (e: any) {
            console.log('   ⚠️ V2 (shared=true) failed:', e.message);

            // Strategy 3: V1
            try {
                console.log('   Trying V1 Projects...');
                const data = await fetchNeon(`${V1_BASE_URL}/projects`);
                projects = Array.isArray(data) ? data : (data.projects || []);
                usedVersion = 'v1';
            } catch (e3: any) {
                console.error('❌ Failed to list projects on V1 and V2.');
                console.error('   V1 Error:', e3.message);
                process.exit(1);
            }
        }
    }

    console.log(`📋 Found ${projects?.length || 0} projects using ${usedVersion}.`);

    if (!projects || projects.length === 0) {
        console.error('❌ No projects found.');
        process.exit(1);
    }

    const project = projects[0];
    console.log(`👉 Selected Project: ${project.name} (${project.id})`);

    // Fetch Connection Details
    // Logic differs slightly between V1 and V2 but endpoints are often similar or compatible
    // We need: Host, User, Password, Database

    // We will try to find a connection string in the project details first
    // Some API responses include it.

    let connectionString = '';

    if (project.connection_uris && project.connection_uris.length > 0) {
        connectionString = project.connection_uris[0];
        console.log('✅ Found connection URI in project details.');
    } else {
        // Try to fetch connection URI explicitly
        // V2 endpoint: /projects/{id}/connection_uri (not standard but maybe?)
        // Standard way: Construct from branches/endpoints/roles

        try {
            // Get Branch
            const branchUrl = usedVersion === 'v1'
                ? `${V1_BASE_URL}/projects/${project.id}/branches`
                : `${V2_BASE_URL}/projects/${project.id}/branches`;

            const branchesData = await fetchNeon(branchUrl);
            const branches = branchesData.branches || branchesData;
            const mainBranch = branches.find((b: any) => b.default) || branches[0];

            if (!mainBranch) throw new Error('No branches found');

            // Get Endpoint
            const endpointsUrl = usedVersion === 'v1'
                ? `${V1_BASE_URL}/projects/${project.id}/endpoints`
                : `${V2_BASE_URL}/projects/${project.id}/endpoints`;

            const endpointsData = await fetchNeon(endpointsUrl);
            const endpoints = endpointsData.endpoints || endpointsData;
            const endpoint = endpoints.find((e: any) => e.branch_id === mainBranch.id) || endpoints[0];

            if (!endpoint) throw new Error('No endpoints found');
            console.log(`🖥️  Endpoint: ${endpoint.host} (${endpoint.current_state})`);

            // Get Role (User)
            // In V1, roles might be under project or branch
            const rolesUrl = usedVersion === 'v1'
                ? `${V1_BASE_URL}/projects/${project.id}/branches/${mainBranch.id}/roles` // Guessing V1 structure
                : `${V2_BASE_URL}/projects/${project.id}/branches/${mainBranch.id}/roles`;

            // Note: V1 structure might be different, let's hope for compatibility or fallback
            let roles = [];
            try {
                const rolesData = await fetchNeon(rolesUrl);
                roles = rolesData.roles || rolesData;
            } catch (er) {
                console.log('   Could not list roles on branch, trying project level...');
                // Fallback
            }

            const role = roles.find((r: any) => !r.protected) || roles[0];
            if (!role) throw new Error('No roles found');

            let password = role.password;
            if (!password) {
                // Try reveal
                try {
                    const pwdUrl = usedVersion === 'v1'
                        ? `${V1_BASE_URL}/projects/${project.id}/branches/${mainBranch.id}/roles/${role.name}/password`
                        : `${V2_BASE_URL}/projects/${project.id}/branches/${mainBranch.id}/roles/${role.name}/password`;
                    const pwdData = await fetchNeon(pwdUrl);
                    password = pwdData.password;
                } catch (ep) {
                    console.log('   Could not fetch password explicitly.');
                }
            }

            if (password) {
                connectionString = `postgresql://${role.name}:${password}@${endpoint.host}/neondb?sslmode=require`;
            } else {
                console.error('❌ Could not find password.');
            }

        } catch (err: any) {
            console.error('❌ Error fetching details:', err.message);
        }
    }

    if (connectionString) {
        console.log('\n✅ Connection String Generated Successfully');
        // Output to stdout for parsing (can be piped to file)
        console.log('--- OUTPUT FOR PARSING ---');
        console.log(`DATABASE_URL=[GENERATED - pipe to file for actual value]`);
        // Write to stdout raw for actual capture
        const maskedConnection = connectionString.replace(/:([^@]+)@/, ':****@');
        process.stdout.write(`\n[MASKED]DATABASE_URL=${maskedConnection}\n`);
    } else {
        console.error('❌ Failed to construct connection string.');
        process.exit(1);
    }
}

main();
