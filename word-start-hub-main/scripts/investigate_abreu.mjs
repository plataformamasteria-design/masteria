import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyeHBqemdpZnl6aHZ3amZwb2Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIxNTc4MiwiZXhwIjoyMDg1NzkxNzgyfQ.gFgGPXSBN6k1TOhcf6M6Df-20zdgRyec69Rp_UY2jWI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log('🔍 Investigating "Abreu e Rios" duplicates...');

    // 1. Find the organization
    const { data: orgs, error: orgErr } = await supabase
        .from('organizations')
        .select('id, slug, instance_name')
        .or('slug.ilike.%abreu%,instance_name.ilike.%abreu%');

    if (orgErr) {
        console.error('❌ Error finding organization:', orgErr);
        return;
    }

    if (!orgs || orgs.length === 0) {
        console.log('❓ Organization "Abreu e Rios" not found by name/slug.');
        return;
    }

    console.log('🏢 Found organizations:', orgs);

    for (const org of orgs) {
        console.log(`\n📊 Analyzing Org: ${org.slug} (${org.id})`);
        
        const { data: chats, error: chatErr } = await supabase
            .from('chats')
            .select('id, phone, organization_id, channel, wa_name, created_at, updated_at')
            .eq('organization_id', org.id);

        if (chatErr) {
            console.error(`❌ Error fetching chats for ${org.slug}:`, chatErr);
            continue;
        }

        const counts = {};
        chats.forEach(c => {
            const key = `${c.phone}`;
            if (!counts[key]) counts[key] = [];
            counts[key].push(c);
        });

        let foundDup = false;
        for (const phone in counts) {
            if (counts[phone].length > 1) {
                foundDup = true;
                console.log(`⚠️ Duplicate Lead: ${phone} (Found ${counts[phone].length} times)`);
                counts[phone].forEach(item => {
                    console.log(`  - ID: ${item.id}, Name: ${item.wa_name}, Channel: ${item.channel}, Created: ${item.created_at}`);
                });
            }
        }

        if (!foundDup) {
            console.log('✅ No duplicates found for this org right now.');
        }
    }
}

main();
