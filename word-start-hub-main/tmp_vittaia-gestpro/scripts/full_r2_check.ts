import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const R2_PUBLIC_URL = "https://pub-45013932b06545f3846a4e1d3cc738e7.r2.dev";

const main = async () => {
    console.log("🔍 Scanning ALL R2 URLs for 404s (this will take a moment)...\n");

    let offset = 0;
    const PAGE_SIZE = 200;
    let totalChecked = 0;
    let totalOk = 0;
    let total404 = 0;
    let totalError = 0;
    const broken: { id: string; url: string; status: number; created_at: string }[] = [];

    while (true) {
        const { data: messages, error } = await supabase
            .from("messages")
            .select("id, file_url, created_at")
            .like("file_url", "%r2.dev%")
            .order("created_at", { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

        if (error || !messages || messages.length === 0) break;

        // Check in parallel batches of 20
        for (let i = 0; i < messages.length; i += 20) {
            const batch = messages.slice(i, i + 20);
            const results = await Promise.all(
                batch.map(async (msg) => {
                    try {
                        const resp = await fetch(msg.file_url as string, { method: "HEAD" });
                        return { msg, status: resp.status, ok: resp.ok };
                    } catch (err: any) {
                        return { msg, status: 0, ok: false };
                    }
                })
            );

            for (const r of results) {
                totalChecked++;
                if (r.ok) {
                    totalOk++;
                } else {
                    if (r.status === 404) total404++;
                    else totalError++;
                    broken.push({
                        id: r.msg.id,
                        url: (r.msg.file_url as string).substring(R2_PUBLIC_URL.length),
                        status: r.status,
                        created_at: r.msg.created_at as string,
                    });
                }
            }
        }

        console.log(`  Checked ${totalChecked} URLs... (${totalOk} OK, ${total404} 404s, ${totalError} errors)`);
        offset += PAGE_SIZE;
    }

    console.log("\n═══════════════════════════════════════");
    console.log("📊 RESULTADO COMPLETO:");
    console.log(`   Total verificados:  ${totalChecked}`);
    console.log(`   ✅ Acessíveis:      ${totalOk} (${((totalOk / totalChecked) * 100).toFixed(1)}%)`);
    console.log(`   ❌ 404 (ausentes):  ${total404}`);
    console.log(`   ⚠️  Outros erros:   ${totalError}`);

    if (broken.length > 0) {
        console.log(`\n📋 Arquivos inacessíveis (${broken.length}):`);
        for (const b of broken) {
            const date = new Date(b.created_at).toISOString().split("T")[0];
            console.log(`   [${date}] ${b.status} → ...${b.url.substring(0, 80)}`);
        }

        // Check if these exist on Supabase
        console.log("\n🔍 Verificando se existem no Supabase Storage...");
        for (const b of broken.slice(0, 10)) {
            const path = b.url.startsWith("/") ? b.url.substring(1) : b.url;
            const supabaseUrl = `${SUPABASE_URL}/storage/v1/object/public/chat-files/${path}`;
            try {
                const resp = await fetch(supabaseUrl, { method: "HEAD" });
                console.log(`   ${resp.ok ? "✅ Existe" : `❌ ${resp.status}`} no Supabase: ...${path.substring(0, 60)}`);
            } catch {
                console.log(`   ❌ Erro ao verificar Supabase: ...${path.substring(0, 60)}`);
            }
        }
    }

    console.log("═══════════════════════════════════════");
};

main().catch(console.error);
