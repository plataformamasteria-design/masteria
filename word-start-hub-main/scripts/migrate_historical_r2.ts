import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const SUPABASE_URL = "https://jrxpjzgifyzhvwjfpofz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const R2_ACCOUNT_ID = "55db4b9916d2853fe1e5ef9d840ae8e1";
const R2_ACCESS_KEY_ID = "6a0bbdad86cd9a12920c4f6a940e7155";
const R2_SECRET_ACCESS_KEY = "f3338840a0e7eb428c5164f2470d16cca280db400df738970c5820598f75506d";
const R2_BUCKET_NAME = "vitta-chat-files";
const R2_PUBLIC_URL = "https://pub-45013932b06545f3846a4e1d3cc738e7.r2.dev";

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const r2 = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
});

const getPathFromSupabaseUrl = (url: string) => {
    const match = url.match(/\/object\/public\/chat-files\/(.+)$/);
    return match ? match[1] : null;
};

const migrateFile = async (supabaseUrl: string) => {
    try {
        const path = getPathFromSupabaseUrl(supabaseUrl);
        if (!path) {
            console.log(`Skipping invalid URL: ${supabaseUrl}`);
            return { success: false, newUrl: null, path: null };
        }

        console.log(`Downloading: ${path}`);
        const response = await fetch(supabaseUrl);
        if (!response.ok) {
            console.log(`Failed to download ${supabaseUrl}: ${response.statusText}`);
            return { success: false, newUrl: null, path };
        }

        const arrayBuffer = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "application/octet-stream";

        console.log(`Uploading to R2: ${path} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
        const r2Url = new URL(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${path}`);

        let res = await r2.fetch(r2Url, {
            method: "PUT",
            body: arrayBuffer,
            headers: {
                "Content-Type": contentType,
            },
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.log(`R2 Upload failed for ${path}: ${res.statusText} ${errorText}`);
            return { success: false, newUrl: null, path };
        }

        const newPublicUrl = `${R2_PUBLIC_URL}/${path}`;
        return { success: true, newUrl: newPublicUrl, path };
    } catch (err: any) {
        console.error(`Error migrating ${supabaseUrl}:`, err.message);
        return { success: false, newUrl: null, path: null };
    }
};

const processMessages = async () => {
    console.log("--- MIGRATING MESSAGES ---");
    let from = 0;
    const limit = 50;
    let hasMore = true;
    let count = 0;

    while (hasMore) {
        const { data: messages, error } = await supabase
            .from("messages")
            .select("id, file_url")
            .like("file_url", "%supabase.co%")
            .range(from, from + limit - 1);

        if (error) {
            console.error("Error fetching messages:", error.message);
            break;
        }

        if (!messages || messages.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Fetched ${messages.length} messages to process...`);

        for (const msg of messages) {
            const result = await migrateFile(msg.file_url);
            if (result.success && result.newUrl && result.path) {
                // Update DB
                await supabase.from("messages").update({ file_url: result.newUrl }).eq("id", msg.id);
                // Delete from Supabase Storage
                await supabase.storage.from("chat-files").remove([result.path]);
                count++;
            }
        }

        from += limit;
    }
    console.log(`Migrated ${count} messages.`);
};

const processLeadFiles = async () => {
    console.log("\n--- MIGRATING LEAD FILES ---");
    let from = 0;
    const limit = 50;
    let hasMore = true;
    let count = 0;

    while (hasMore) {
        const { data: files, error } = await supabase
            .from("lead_files")
            .select("id, file_url")
            .like("file_url", "%supabase.co%")
            .range(from, from + limit - 1);

        if (error) {
            console.error("Error fetching lead_files:", error.message);
            break;
        }

        if (!files || files.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Fetched ${files.length} lead files to process...`);

        for (const file of files) {
            const result = await migrateFile(file.file_url);
            if (result.success && result.newUrl && result.path) {
                // Update DB
                await supabase.from("lead_files").update({ file_url: result.newUrl }).eq("id", file.id);
                // Delete from Supabase Storage
                await supabase.storage.from("chat-files").remove([result.path]);
                count++;
            }
        }

        from += limit;
    }
    console.log(`Migrated ${count} lead files.`);
};

const processChats = async () => {
    console.log("\n--- MIGRATING CHATS (GROUP PHOTOS) ---");
    let from = 0;
    const limit = 50;
    let hasMore = true;
    let count = 0;

    while (hasMore) {
        const { data: chats, error } = await supabase
            .from("chats")
            .select("id, group_photo_url")
            .like("group_photo_url", "%supabase.co%")
            .range(from, from + limit - 1);

        if (error) {
            console.error("Error fetching chats:", error.message);
            break;
        }

        if (!chats || chats.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Fetched ${chats.length} group photos to process...`);

        for (const chat of chats) {
            if (!chat.group_photo_url) continue;
            const result = await migrateFile(chat.group_photo_url);
            if (result.success && result.newUrl && result.path) {
                // Update DB
                await supabase.from("chats").update({ group_photo_url: result.newUrl }).eq("id", chat.id);
                // Delete from Supabase Storage
                await supabase.storage.from("chat-files").remove([result.path]);
                count++;
            }
        }

        from += limit;
    }
    console.log(`Migrated ${count} group photos.`);
};

// Also delete all empty folders or files without db entry? That would require listing the bucket.
// Listing the bucket recursively is hard, but we can do a simple list just to see what's left.
const cleanupOrphanTasks = async () => { };

const main = async () => {
    console.log("🚀 Starting Historical Data Migration to R2...");
    await processMessages();
    await processLeadFiles();
    await processChats();
    console.log("✅ Migration completed.");
};

main().catch(console.error);
