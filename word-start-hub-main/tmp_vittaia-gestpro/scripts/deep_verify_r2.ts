import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const main = async () => {
    console.log("🔍 VERIFICAÇÃO PROFUNDA: Arquivos realmente existem no R2?\n");

    // 1. Database URL audit
    console.log("═══ PARTE 1: AUDITORIA DO BANCO DE DADOS ═══\n");

    const { count: totalMedia } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .not("file_url", "is", null);

    const { count: r2Count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .like("file_url", "%r2.dev%");

    const { count: supabaseCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .like("file_url", "%supabase.co%");

    const otherCount = (totalMedia || 0) - (r2Count || 0) - (supabaseCount || 0);

    console.log(`📊 Messages com mídia:    ${totalMedia}`);
    console.log(`   ✅ Apontando para R2:   ${r2Count}`);
    console.log(`   ⚠️  Apontando Supabase: ${supabaseCount}`);
    console.log(`   🔗 URLs externas:       ${otherCount}`);
    console.log();

    // 2. Sample R2 URLs and check if they actually respond with 200
    console.log("═══ PARTE 2: TESTE DE ACESSIBILIDADE HTTP (amostra) ═══\n");

    // Get a random sample of R2 URLs from different file types
    const { data: sampleMessages } = await supabase
        .from("messages")
        .select("id, file_url")
        .like("file_url", "%r2.dev%")
        .order("created_at", { ascending: false })
        .limit(100);

    if (!sampleMessages || sampleMessages.length === 0) {
        console.log("Nenhuma URL R2 encontrada para testar.");
        return;
    }

    // Pick diverse sample: first 10, last 10, and 10 random from the middle
    const indices = new Set<number>();
    // First 10
    for (let i = 0; i < Math.min(10, sampleMessages.length); i++) indices.add(i);
    // Last 10
    for (let i = Math.max(0, sampleMessages.length - 10); i < sampleMessages.length; i++) indices.add(i);
    // 10 random from middle
    for (let i = 0; i < 10; i++) {
        indices.add(Math.floor(Math.random() * sampleMessages.length));
    }

    const samplesToTest = Array.from(indices).map(i => sampleMessages[i]);

    let accessible = 0;
    let notAccessible = 0;
    let errors: string[] = [];

    // Categorize by file type
    const typeStats: Record<string, { ok: number; fail: number }> = {};

    console.log(`Testando ${samplesToTest.length} URLs aleatórias do R2...\n`);

    for (const msg of samplesToTest) {
        const url = msg.file_url as string;
        const ext = url.split(".").pop()?.split("?")[0]?.toLowerCase() || "unknown";

        if (!typeStats[ext]) typeStats[ext] = { ok: 0, fail: 0 };

        try {
            const response = await fetch(url, { method: "HEAD" });
            if (response.ok) {
                accessible++;
                typeStats[ext].ok++;
            } else {
                notAccessible++;
                typeStats[ext].fail++;
                errors.push(`  ❌ ${response.status} → ${url.substring(0, 100)}...`);
            }
        } catch (err: any) {
            notAccessible++;
            typeStats[ext].fail++;
            errors.push(`  ❌ ERRO → ${url.substring(0, 100)}... (${err.message})`);
        }
    }

    console.log(`📊 Resultado da amostra:`);
    console.log(`   ✅ Acessíveis:      ${accessible}/${samplesToTest.length}`);
    console.log(`   ❌ Inacessíveis:    ${notAccessible}/${samplesToTest.length}`);
    console.log();

    console.log(`📁 Por tipo de arquivo:`);
    for (const [ext, stats] of Object.entries(typeStats).sort((a, b) => (b[1].ok + b[1].fail) - (a[1].ok + a[1].fail))) {
        const total = stats.ok + stats.fail;
        const status = stats.fail === 0 ? "✅" : "⚠️";
        console.log(`   ${status} .${ext}: ${stats.ok}/${total} acessíveis`);
    }

    if (errors.length > 0) {
        console.log(`\n❌ URLs com problema:`);
        errors.forEach(e => console.log(e));
    }

    // 3. Check Supabase Storage bucket status
    console.log("\n═══ PARTE 3: STATUS DO SUPABASE STORAGE ═══\n");

    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
        console.log(`Erro ao listar buckets: ${bucketsError.message}`);
    } else {
        for (const bucket of buckets || []) {
            const { data: files } = await supabase.storage
                .from(bucket.name)
                .list("", { limit: 1000 });

            const itemCount = files?.length || 0;
            const icon = itemCount === 0 ? "✅" : "📦";
            console.log(`   ${icon} ${bucket.name}: ${itemCount} itens restantes`);
        }
    }

    // 4. Final verdict
    console.log("\n═══════════════════════════════════════");
    console.log("📋 VEREDITO FINAL:");

    if ((supabaseCount || 0) === 0 && notAccessible === 0) {
        console.log("   ✅ MIGRAÇÃO VERIFICADA COM SUCESSO!");
        console.log(`   → ${r2Count} arquivos apontam para R2 no banco`);
        console.log(`   → ${accessible}/${samplesToTest.length} testados e acessíveis`);
        console.log(`   → 0 referências ao Supabase Storage restantes`);
    } else if ((supabaseCount || 0) === 0 && notAccessible > 0) {
        console.log("   ⚠️  MIGRAÇÃO PARCIAL:");
        console.log(`   → URLs no banco atualizadas, mas ${notAccessible} arquivos inacessíveis no R2`);
    } else {
        console.log(`   ❌ MIGRAÇÃO INCOMPLETA: ${supabaseCount} URLs ainda no Supabase`);
    }
    console.log("═══════════════════════════════════════");
};

main().catch(console.error);
