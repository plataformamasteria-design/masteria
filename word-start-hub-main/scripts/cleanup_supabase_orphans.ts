import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyeHBqemdpZnl6aHZ3amZwb2Z6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIxNTc4MiwiZXhwIjoyMDg1NzkxNzgyfQ.gFgGPXSBN6k1TOhcf6M6Df-20zdgRyec69Rp_UY2jWI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function cleanupOrphans() {
    console.log("🧹 Cleaning up orphaned files in Supabase Storage...\n");

    const BUCKET = "chat-files";
    let totalDeleted = 0;
    let totalSize = 0;

    // List all top-level folders
    const { data: folders, error } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });

    if (error) {
        console.error("Error listing bucket:", error);
        return;
    }

    console.log(`Found ${folders?.length || 0} top-level items in ${BUCKET}\n`);

    for (const folder of folders || []) {
        if (folder.id === null) {
            // It's a folder, list its contents
            const { data: files } = await supabase.storage.from(BUCKET).list(folder.name, { limit: 1000 });

            if (files && files.length > 0) {
                const filePaths = files
                    .filter(f => f.id !== null) // Only actual files, not subfolders
                    .map(f => `${folder.name}/${f.name}`);

                if (filePaths.length > 0) {
                    // Delete in chunks of 100
                    for (let i = 0; i < filePaths.length; i += 100) {
                        const chunk = filePaths.slice(i, i + 100);
                        const { error: delError } = await supabase.storage.from(BUCKET).remove(chunk);
                        if (delError) {
                            console.error(`  ❌ Error deleting ${chunk.length} files from ${folder.name}:`, delError);
                        } else {
                            totalDeleted += chunk.length;
                            console.log(`  🗑️  Deleted ${chunk.length} files from ${folder.name}/`);
                        }
                    }
                }
            }
        } else {
            // It's a file at root level - delete it
            const { error: delError } = await supabase.storage.from(BUCKET).remove([folder.name]);
            if (delError) {
                console.error(`  ❌ Error deleting root file ${folder.name}:`, delError);
            } else {
                totalDeleted += 1;
                console.log(`  🗑️  Deleted root file: ${folder.name}`);
            }
        }
    }

    console.log(`\n✅ Cleanup completed. Total files deleted: ${totalDeleted}`);
}

cleanupOrphans().catch(console.error);
