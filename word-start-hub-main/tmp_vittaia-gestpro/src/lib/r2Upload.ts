import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a file to R2 via the r2-upload-proxy edge function.
 * Falls back to Supabase Storage if R2 proxy fails.
 */
export async function uploadFileToR2(
    file: File | Blob,
    chatId: string,
    fileName?: string
): Promise<{ publicUrl: string; storagePath: string }> {
    const resolvedFileName = fileName || (file instanceof File ? file.name : `${Date.now()}.bin`);
    const contentType = file.type || "application/octet-stream";

    // Get auth session for the proxy call
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error("User not authenticated");
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";

    const response = await fetch(`${supabaseUrl}/functions/v1/r2-upload-proxy`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            "x-file-name": resolvedFileName,
            "x-content-type": contentType,
            "x-chat-id": chatId,
        },
        body: file,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
        publicUrl: data.publicUrl,
        storagePath: data.storagePath,
    };
}

/**
 * Upload file with fallback to Supabase Storage if R2 proxy is unavailable.
 */
export async function uploadFileWithFallback(
    file: File | Blob,
    chatId: string,
    fileName?: string
): Promise<string> {
    try {
        const result = await uploadFileToR2(file, chatId, fileName);
        return result.publicUrl;
    } catch (r2Error) {
        console.warn("[r2Upload] R2 upload failed, falling back to Supabase Storage:", r2Error);

        // Fallback to Supabase Storage
        const resolvedFileName = fileName || (file instanceof File ? file.name : `${Date.now()}.bin`);
        const fileExt = resolvedFileName.split(".").pop() || "bin";
        const filePath = `${chatId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("chat-files")
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from("chat-files")
            .getPublicUrl(filePath);

        return publicUrl;
    }
}
