import { uploadToR2 } from "../../_shared/r2-client.ts";

export async function handleSendMedia(
    supabase: any, nodeType: string, config: any, organizationId: string, chatId: string
) {
    let fileUrl = config.file_url;
    if (!fileUrl) return { success: true, message: "No file URL configured" };

    const mediaType = nodeType === "send_image" ? "image"
        : nodeType === "send_audio" ? "audio"
            : nodeType === "send_video" ? "video" : "document";
    const caption = config.caption || "";
    const rawFileName = config.file_name || "arquivo";
    const fileName = rawFileName.replace(/\s+/g, "_").replace(/[()]/g, "").replace(/[^a-zA-Z0-9._\-]/g, "_");

    if (fileUrl.startsWith("data:")) {
        try {
            const matches = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                const mimeType = matches[1];
                const base64Data = matches[2];
                const binaryStr = atob(base64Data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                const storagePath = `automation-media/${organizationId}/${crypto.randomUUID()}_${fileName}`;

                const r2Url = await uploadToR2(bytes, storagePath, mimeType);
                if (r2Url) {
                    fileUrl = r2Url;
                } else {
                    const { error: uploadError } = await supabase.storage
                        .from("chat-files")
                        .upload(storagePath, bytes.buffer, { contentType: mimeType, upsert: true });

                    if (uploadError) {
                        console.error("[automation] Storage upload failed:", uploadError);
                        return { success: false, message: `Storage upload failed: ${uploadError.message}` };
                    }
                    const { data: publicUrlData } = supabase.storage.from("chat-files").getPublicUrl(storagePath);
                    fileUrl = publicUrlData?.publicUrl || fileUrl;
                }
            }
        } catch (uploadErr: any) {
            console.error("[automation] Base64 upload error:", uploadErr);
            return { success: false, message: `Base64 upload error: ${uploadErr.message}` };
        }
    }

    const { data: insertedMedia, error: mediaError } = await supabase
        .from("messages")
        .insert({
            chat_id: chatId,
            organization_id: organizationId,
            content: caption || null,
            message_type: mediaType,
            file_url: fileUrl,
            file_name: fileName,
            is_from_user: true,
            sent_from_platform: true,
        })
        .select("id")
        .maybeSingle();

    if (mediaError || !insertedMedia?.id) {
        return { success: false, message: mediaError?.message || "Failed to create media message" };
    }

    const evoM = await supabase.functions.invoke("send-to-evolution", {
        body: { messageId: insertedMedia.id },
    });
    if (evoM.error) {
        console.error("[automation] Evolution media send failed:", evoM.error);
    } else {
        await new Promise(r => setTimeout(r, 2000));
    }

    return { success: true, message: `${mediaType} queued` };
}
