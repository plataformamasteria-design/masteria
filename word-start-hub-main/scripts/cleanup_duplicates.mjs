import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyeHBqemdpZnl6aHZ3amZwb2Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIxNTc4MiwiZXhwIjoyMDg1NzkxNzgyfQ.gFgGPXSBN6k1TOhcf6M6Df-20zdgRyec69Rp_UY2jWI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchAllChats() {
    let allChats = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        console.log(`📡 Fetching chats from ${from} to ${from + pageSize - 1}...`);
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .range(from, from + pageSize - 1);

        if (error) {
            console.error('❌ Error fetching chats:', error);
            break;
        }

        allChats = allChats.concat(data);
        if (data.length < pageSize) {
            hasMore = false;
        } else {
            from += pageSize;
        }
    }
    return allChats;
}

async function main() {
    console.log('🚀 Starting thorough cleanup of duplicate chats...');

    const chats = await fetchAllChats();
    console.log(`📊 Total chats fetched: ${chats.length}`);

    // Grouping by organization and lead identifier (phone for leads, name/phone for groups)
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
            // Lead identifier: phone (normalize digits just in case)
            const key = String(chat.phone).replace(/\D/g, '');
            if (!orgs[chat.organization_id].leads[key]) {
                orgs[chat.organization_id].leads[key] = [];
            }
            orgs[chat.organization_id].leads[key].push(chat);
        }
    });

    const duplicateSets = [];

    for (const orgId in orgs) {
        for (const key in orgs[orgId].groups) {
            if (orgs[orgId].groups[key].length > 1) {
                duplicateSets.push(orgs[orgId].groups[key]);
            }
        }
        for (const key in orgs[orgId].leads) {
            if (orgs[orgId].leads[key].length > 1) {
                duplicateSets.push(orgs[orgId].leads[key]);
            }
        }
    }

    if (duplicateSets.length === 0) {
        console.log('✅ No duplicate chats found.');
        return;
    }

    console.log(`⚠️ Found ${duplicateSets.length} sets of duplicates to clean up.\n`);

    for (const set of duplicateSets) {
        // Find the best chat to keep (latest updated_at or last_message_at)
        const keep = [...set].sort((a, b) => {
            const dateA = new Date(a.last_message_at || a.updated_at || a.created_at).getTime();
            const dateB = new Date(b.last_message_at || b.updated_at || b.created_at).getTime();
            return dateB - dateA;
        })[0];

        const duplicateIds = set.map(c => c.id).filter(id => id !== keep.id);

        console.log(`🧹 Cleaning set: ${keep.group_name || keep.phone} (Keeping ${keep.id}, deleting ${duplicateIds.length} others)`);

        for (const dupId of duplicateIds) {
            console.log(`  - Migrating data from ${dupId} to ${keep.id}...`);

            // Migrate Messages
            await supabase.from('messages').update({ chat_id: keep.id }).eq('chat_id', dupId);

            // Migrate Tags
            const { data: dupTags } = await supabase.from('chat_tags').select('tag_id').eq('chat_id', dupId);
            if (dupTags && dupTags.length > 0) {
                for (const t of dupTags) {
                    try {
                        await supabase.from('chat_tags').insert({ chat_id: keep.id, tag_id: t.tag_id, organization_id: keep.organization_id });
                    } catch (e) { /* ignore constraint error */ }
                }
                await supabase.from('chat_tags').delete().eq('chat_id', dupId);
            }

            // Migrate Funnel Stage
            const { data: dupStages } = await supabase.from('chat_funnel_stage').select('*').eq('chat_id', dupId);
            if (dupStages && dupStages.length > 0) {
                for (const s of dupStages) {
                    const { funnel_id } = s;
                    const { data: existing } = await supabase.from('chat_funnel_stage').select('id').eq('chat_id', keep.id).eq('funnel_id', funnel_id).maybeSingle();
                    if (!existing) {
                        await supabase.from('chat_funnel_stage').update({ chat_id: keep.id }).eq('id', s.id);
                    } else {
                        await supabase.from('chat_funnel_stage').delete().eq('id', s.id);
                    }
                }
            }

            // Migrate others...
            await supabase.from('calendar_events').update({ chat_id: keep.id }).eq('chat_id', dupId);
            await supabase.from('tasks').update({ chat_id: keep.id }).eq('chat_id', dupId);
            await supabase.from('transactions').update({ chat_id: keep.id }).eq('chat_id', dupId);
            await supabase.from('scheduled_messages').update({ chat_id: keep.id }).eq('chat_id', dupId);
            await supabase.from('automation_executions').update({ chat_id: keep.id }).eq('chat_id', dupId);
            await supabase.from('lead_follow_up_tracking').update({ chat_id: keep.id }).eq('chat_id', dupId);

            // Finally delete the duplicate chat
            const { error: delErr } = await supabase.from('chats').delete().eq('id', dupId);
            if (delErr) {
                console.error(`  ❌ Failed to delete duplicate chat ${dupId}: ${delErr.message}`);
            } else {
                console.log(`  ✅ Successfully deleted duplicate chat ${dupId}`);
            }
        }
    }

    console.log('\n✅ Cleanup process finished.');
}

main().catch(console.error);
