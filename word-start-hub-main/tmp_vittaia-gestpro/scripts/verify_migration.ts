import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const main = async () => {
    console.log("🔍 Verificação de Migração Supabase → R2\n");

    // 1. Check messages table for remaining Supabase URLs
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

    console.log("📨 MESSAGES (file_url):");
    console.log(`   Total com mídia:     ${msgTotal}`);
    console.log(`   Já no R2:            ${msgR2}`);
    console.log(`   Ainda no Supabase:   ${msgSupabase}`);
    console.log(`   Outros (externos):   ${(msgTotal || 0) - (msgR2 || 0) - (msgSupabase || 0)}`);
    console.log();

    // 2. Check lead_files table
    const { count: leadSupabase } = await supabase
        .from("lead_files")
        .select("id", { count: "exact", head: true })
        .like("file_url", "%supabase.co%");

    const { count: leadR2 } = await supabase
        .from("lead_files")
        .select("id", { count: "exact", head: true })
        .like("file_url", "%r2.dev%");

    const { count: leadTotal } = await supabase
        .from("lead_files")
        .select("id", { count: "exact", head: true })
        .not("file_url", "is", null);

    console.log("📁 LEAD FILES (file_url):");
    console.log(`   Total:               ${leadTotal}`);
    console.log(`   Já no R2:            ${leadR2}`);
    console.log(`   Ainda no Supabase:   ${leadSupabase}`);
    console.log();

    // 3. Check chats table for group photos
    const { count: chatSupabase } = await supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .like("group_photo_url", "%supabase.co%");

    const { count: chatR2 } = await supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .like("group_photo_url", "%r2.dev%");

    const { count: chatTotal } = await supabase
        .from("chats")
        .select("id", { count: "exact", head: true })
        .not("group_photo_url", "is", null);

    console.log("👥 CHATS (group_photo_url):");
    console.log(`   Total:               ${chatTotal}`);
    console.log(`   Já no R2:            ${chatR2}`);
    console.log(`   Ainda no Supabase:   ${chatSupabase}`);
    console.log();

    // 4. Check Supabase Storage bucket for remaining files
    console.log("🗄️  SUPABASE STORAGE (chat-files bucket):");
    const { data: bucketFiles, error: bucketError } = await supabase.storage
        .from("chat-files")
        .list("", { limit: 100 });

    if (bucketError) {
        console.log(`   Erro ao listar bucket: ${bucketError.message}`);
    } else {
        // Count folders (each folder may contain files)
        const folders = bucketFiles?.filter(f => f.id === null || !f.name.includes(".")) || [];
        const files = bucketFiles?.filter(f => f.name.includes(".")) || [];
        console.log(`   Pastas raiz restantes: ${folders.length}`);
        console.log(`   Arquivos raiz soltos:  ${files.length}`);

        // Check a few folders to see if they still have content
        let totalRemaining = 0;
        for (const folder of folders.slice(0, 10)) {
            const { data: subFiles } = await supabase.storage
                .from("chat-files")
                .list(folder.name, { limit: 1000 });
            totalRemaining += subFiles?.length || 0;
        }
        if (folders.length > 0) {
            console.log(`   Arquivos nas primeiras ${Math.min(10, folders.length)} pastas: ${totalRemaining}`);
        }
    }

    console.log();

    // Summary
    const remainingSupabase = (msgSupabase || 0) + (leadSupabase || 0) + (chatSupabase || 0);
    const totalR2 = (msgR2 || 0) + (leadR2 || 0) + (chatR2 || 0);

    console.log("═══════════════════════════════════════");
    console.log("📊 RESUMO:");
    console.log(`   URLs apontando para R2:       ${totalR2}`);
    console.log(`   URLs ainda no Supabase:       ${remainingSupabase}`);

    if (remainingSupabase === 0) {
        console.log("\n✅ MIGRAÇÃO 100% COMPLETA! Nenhuma URL do Supabase restante no banco.");
    } else {
        console.log(`\n⚠️  Ainda existem ${remainingSupabase} URLs apontando para o Supabase.`);
    }
    console.log("═══════════════════════════════════════");
};

main().catch(console.error);
