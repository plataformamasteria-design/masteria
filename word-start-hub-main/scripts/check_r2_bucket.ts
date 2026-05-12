import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyeHBqemdpZnl6aHZ3amZwb2Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIxNTc4MiwiZXhwIjoyMDg1NzkxNzgyfQ.gFgGPXSBN6k1TOhcf6M6Df-20zdgRyec69Rp_UY2jWI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function audit() {
    console.log("🔍 AUDITORIA: URLs no Banco de Dados\n");

    // Messages with supabase URLs
    const { count: msgSupabase } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .like("file_url", "%supabase.co%");

    const { count: msgR2 } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .like("file_url", "%r2.dev%");

    const { count: msgTotal } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .not("file_url", "is", null);

    console.log(`📨 Messages com arquivo: ${msgTotal}`);
    console.log(`   - URLs Supabase: ${msgSupabase}`);
    console.log(`   - URLs R2:       ${msgR2}`);
    console.log(`   - Outros:        ${(msgTotal || 0) - (msgSupabase || 0) - (msgR2 || 0)}`);

    // Lead files
    const { count: leadSupabase } = await supabase
        .from("lead_files")
        .select("id", { count: "exact", head: true })
        .like("file_url", "%supabase.co%");

    const { count: leadR2 } = await supabase
        .from("lead_files")
        .select("id", { count: "exact", head: true })
        .like("file_url", "%r2.dev%");

    console.log(`\n📁 Lead files:`);
    console.log(`   - URLs Supabase: ${leadSupabase}`);
    console.log(`   - URLs R2:       ${leadR2}`);

    // Group photos
    const { count: chatSupabase } = await supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .like("group_photo_url", "%supabase.co%");

    const { count: chatR2 } = await supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .like("group_photo_url", "%r2.dev%");

    console.log(`\n📷 Group photos:`);
    console.log(`   - URLs Supabase: ${chatSupabase}`);
    console.log(`   - URLs R2:       ${chatR2}`);

    // Supabase Storage bucket listing
    console.log(`\n=== SUPABASE STORAGE BUCKETS ===`);
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets) {
        for (const bucket of buckets) {
            console.log(`  📦 ${bucket.name} (public: ${bucket.public})`);
            // List top-level items to estimate count
            const { data: items } = await supabase.storage.from(bucket.name).list("", { limit: 1000 });
            if (items) {
                console.log(`     → ${items.length} top-level items`);
            }
        }
    }

    // Summary
    const totalSupabase = (msgSupabase || 0) + (leadSupabase || 0) + (chatSupabase || 0);
    const totalR2 = (msgR2 || 0) + (leadR2 || 0) + (chatR2 || 0);

    console.log(`\n=== RESUMO ===`);
    console.log(`  ✅ Referências apontando para R2: ${totalR2}`);
    console.log(`  ⚠️  Referências apontando para Supabase: ${totalSupabase}`);

    if (totalSupabase > 0) {
        console.log(`  🔴 ${totalSupabase} referências precisam ser migradas.`);
    } else if (totalR2 > 0) {
        console.log(`  🟢 Todas as referências já apontam para R2!`);
        console.log(`  💡 O storage do Supabase pode conter ÓRFÃOS que podem ser deletados.`);
    } else {
        console.log(`  ⚠️  Nenhuma referência encontrada com file_url.`);
    }
}

audit().catch(console.error);
