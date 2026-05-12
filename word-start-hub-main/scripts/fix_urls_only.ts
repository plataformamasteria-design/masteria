import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_PUBLIC_URL = "https://pub-45013932b06545f3846a4e1d3cc738e7.r2.dev";
const SUPABASE_STORAGE_PREFIX = "https://jrxpjzgifyzhvwjfpofz.supabase.co/storage/v1/object/public/chat-files/";

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const main = async () => {
    console.log("🔧 Fixing orphaned Supabase URLs → R2 URLs (database-only update)\n");

    let totalFixed = 0;
    let totalFailed = 0;
    let page = 0;
    const PAGE_SIZE = 50;

    while (true) {
        const { data: messages, error } = await supabase
            .from("messages")
            .select("id, file_url")
            .like("file_url", "%supabase.co%")
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
            console.error("Error fetching messages:", error.message);
            break;
        }

        if (!messages || messages.length === 0) {
            break;
        }

        console.log(`Processing batch ${page + 1} (${messages.length} messages)...`);

        for (const msg of messages) {
            try {
                // Extract the file path from the Supabase URL
                const fileUrl = msg.file_url as string;

                // Handle both encoded and decoded URLs
                let filePath: string;
                if (fileUrl.includes("/storage/v1/object/public/chat-files/")) {
                    filePath = fileUrl.split("/storage/v1/object/public/chat-files/")[1];
                } else {
                    console.log(`  ⚠️ Unexpected URL format: ${fileUrl}`);
                    totalFailed++;
                    continue;
                }

                // Build R2 URL
                const r2Url = `${R2_PUBLIC_URL}/${filePath}`;

                // Update the database
                const { error: updateError } = await supabase
                    .from("messages")
                    .update({ file_url: r2Url })
                    .eq("id", msg.id);

                if (updateError) {
                    console.log(`  ❌ Failed to update message ${msg.id}: ${updateError.message}`);
                    totalFailed++;
                } else {
                    totalFixed++;
                }
            } catch (err: any) {
                console.log(`  ❌ Error processing message ${msg.id}: ${err.message}`);
                totalFailed++;
            }
        }

        console.log(`  ✅ Batch done. Total fixed: ${totalFixed}, Failed: ${totalFailed}`);

        // Since we're updating the rows we just fetched (removing them from the filter),
        // we don't increment the page - the next query will get the next batch automatically
        if (messages.length < PAGE_SIZE) break;
    }

    console.log("\n═══════════════════════════════════════");
    console.log(`📊 RESULT:`);
    console.log(`   URLs fixed:  ${totalFixed}`);
    console.log(`   Failed:      ${totalFailed}`);
    if (totalFailed === 0 && totalFixed > 0) {
        console.log("\n✅ All remaining Supabase URLs have been updated to R2!");
    }
    console.log("═══════════════════════════════════════");
};

main().catch(console.error);
