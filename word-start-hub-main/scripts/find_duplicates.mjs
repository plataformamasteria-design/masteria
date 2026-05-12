import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyeHBqemdpZnl6aHZ3amZwb2Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIxNTc4MiwiZXhwIjoyMDg1NzkxNzgyfQ.gFgGPXSBN6k1TOhcf6M6Df-20zdgRyec69Rp_UY2jWI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log('🔍 Checking for duplicate chats (groups and leads) using Service Role Key...');

    const { data: chats, error } = await supabase
        .from('chats')
        .select('id, phone, organization_id, wa_name, group_name, is_group, created_at, updated_at, last_message_at');

    if (error) {
        console.error('❌ Error fetching chats:', error);
        return;
    }

    console.log(`📊 Total chats fetched: ${chats.length}`);

    const groupDuplicates = [];
    const leadDuplicates = [];

    // Grouping by organization
    const orgs = {};
    chats.forEach(chat => {
        if (!orgs[chat.organization_id]) {
            orgs[chat.organization_id] = { groups: {}, leads: {} };
        }
        
        if (chat.is_group) {
            // Group identifier: group_name or phone (JID)
            const key = chat.group_name || chat.phone;
            if (!orgs[chat.organization_id].groups[key]) {
                orgs[chat.organization_id].groups[key] = [];
            }
            orgs[chat.organization_id].groups[key].push(chat);
        } else {
            // Lead identifier: phone
            const key = chat.phone;
            if (!orgs[chat.organization_id].leads[key]) {
                orgs[chat.organization_id].leads[key] = [];
            }
            orgs[chat.organization_id].leads[key].push(chat);
        }
    });

    for (const orgId in orgs) {
        for (const key in orgs[orgId].groups) {
            if (orgs[orgId].groups[key].length > 1) {
                groupDuplicates.push({
                    orgId,
                    key,
                    count: orgs[orgId].groups[key].length,
                    items: orgs[orgId].groups[key]
                });
            }
        }
        for (const key in orgs[orgId].leads) {
            if (orgs[orgId].leads[key].length > 1) {
                leadDuplicates.push({
                    orgId,
                    key,
                    count: orgs[orgId].leads[key].length,
                    items: orgs[orgId].leads[key]
                });
            }
        }
    }

    if (groupDuplicates.length === 0 && leadDuplicates.length === 0) {
        console.log('✅ No duplicate chats found.');
    } else {
        if (groupDuplicates.length > 0) {
            console.log(`⚠️ Found ${groupDuplicates.length} sets of duplicate groups:`);
            groupDuplicates.forEach(dup => {
                console.log(`\nGroup: ${dup.key} in Org: ${dup.orgId} (Found ${dup.count} times)`);
                dup.items.forEach(item => {
                    console.log(`  - ID: ${item.id}, Created At: ${item.created_at}, Updated At: ${item.updated_at}`);
                });
            });
        }
        if (leadDuplicates.length > 0) {
            console.log(`\n⚠️ Found ${leadDuplicates.length} sets of duplicate leads:`);
            leadDuplicates.forEach(dup => {
                console.log(`\nLead (Phone): ${dup.key} in Org: ${dup.orgId} (Found ${dup.count} times)`);
                dup.items.forEach(item => {
                    console.log(`  - ID: ${item.id}, Name: ${item.wa_name}, Created At: ${item.created_at}, Updated At: ${item.updated_at}`);
                });
            });
        }
    }
}

main();
