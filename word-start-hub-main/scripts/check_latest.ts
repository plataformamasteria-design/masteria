import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    const { data, error } = await supabase
        .from("messages")
        .select("id, file_url, content, created_at")
        .not("file_url", "is", null)
        .not("file_url", "eq", "")
        .order("created_at", { ascending: false })
        .limit(10);

    if (error) {
        console.error("Erro:", error.message);
        return;
    }

    console.log("=== 10 ARQUIVOS MAIS RECENTES ===\n");

    let r2 = 0, supa = 0, ext = 0;

    for (const m of data || []) {
        const url = m.file_url || "";
        const isR2 = url.includes("r2.dev");
        const isSupa = url.includes("supabase.co");
        const icon = isR2 ? "✅ R2" : isSupa ? "⚠️  SUPA" : "🔗 EXT";

        if (isR2) r2++;
        else if (isSupa) supa++;
        else ext++;

        const date = new Date(m.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const fileExt = url.split(".").pop()?.split("?")[0] || "?";
        console.log(`${icon} | ${date} | .${fileExt}`);
        console.log(`      ${url.substring(0, 130)}`);
        console.log();
    }

    console.log("─────────────────────────────────");
    console.log(`Resumo: ${r2} R2 | ${supa} Supabase | ${ext} Externo`);

    if (supa === 0 && r2 > 0) {
        console.log("✅ Novos arquivos estão indo para o R2!");
    } else if (supa > 0) {
        console.log("⚠️  Alguns arquivos ainda estão indo para o Supabase!");
    }
})();
