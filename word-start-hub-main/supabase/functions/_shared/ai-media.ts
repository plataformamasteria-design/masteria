export async function transcribeAudio(fileUrl: string, credentialId: string, organizationId: string, supabase: any): Promise<string | null> {
    try {
        let apiKey = "";
        let useGlobal = false;

        if (credentialId === "vitta-openai" || credentialId === "vitta-gemini") {
            useGlobal = true;
        } else {
            const { data: cred } = await supabase.from("ai_agent_credentials").select("api_key, provider").eq("id", credentialId).eq("organization_id", organizationId).single();
            if (cred && cred.provider === "openai" && cred.api_key) {
                apiKey = cred.api_key;
            } else {
                useGlobal = true;
            }
        }

        if (useGlobal) {
            const { data: globalCfg } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
            if (!globalCfg?.value) return null;
            apiKey = globalCfg.value;
        }

        const response = await fetch(fileUrl);
        if (!response.ok) return null;
        const audioBlob = await response.blob();
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.ogg");
        formData.append("model", "whisper-1");
        formData.append("language", "pt");

        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: formData,
        });

        if (!whisperRes.ok) return null;
        const result = await whisperRes.json();
        return result.text || null;
    } catch (e) {
        console.error("[ai-media] Transcribe error:", e);
        return null;
    }
}

export async function describeImage(fileUrl: string, credentialId: string, organizationId: string, supabase: any): Promise<string | null> {
    try {
        let apiKey = "";
        let useGlobal = false;

        if (credentialId === "vitta-openai" || credentialId === "vitta-gemini") {
            useGlobal = true;
        } else {
            const { data: cred } = await supabase.from("ai_agent_credentials").select("api_key, provider").eq("id", credentialId).eq("organization_id", organizationId).single();
            if (cred && cred.provider === "openai" && cred.api_key) {
                apiKey = cred.api_key;
            } else {
                useGlobal = true;
            }
        }

        if (useGlobal) {
            const { data: globalCfg } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
            if (!globalCfg?.value) return null;
            apiKey = globalCfg.value;
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: "Descreva detalhadamente o conteúdo desta imagem..." },
                        { type: "image_url", image_url: { url: fileUrl, detail: "high" } }
                    ]
                }], max_tokens: 1000, temperature: 0.3,
            }),
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error("[ai-media] Image describe error:", e);
        return null;
    }
}

export async function extractPdfText(fileUrl: string): Promise<string | null> {
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) return null;
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const text = new TextDecoder("latin1").decode(bytes);
        const extractedParts: string[] = [];

        const btEtRegex = /BT\s([\s\S]*?)ET/g;
        let match;
        while ((match = btEtRegex.exec(text)) !== null) {
            const block = match[1];
            const tjRegex = /\(([^)]*)\)\s*Tj/g;
            let tjMatch;
            while ((tjMatch = tjRegex.exec(block)) !== null) {
                const decoded = tjMatch[1].replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
                if (decoded.trim()) extractedParts.push(decoded);
            }
            const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
            let tjArrMatch;
            while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
                const arrContent = tjArrMatch[1];
                const strRegex = /\(([^)]*)\)/g;
                let strMatch;
                let line = "";
                while ((strMatch = strRegex.exec(arrContent)) !== null) {
                    line += strMatch[1].replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
                }
                if (line.trim()) extractedParts.push(line);
            }
        }

        if (extractedParts.length === 0) {
            const readableRegex = /[\x20-\x7E\xC0-\xFF]{20,}/g;
            let readable;
            while ((readable = readableRegex.exec(text)) !== null) {
                extractedParts.push(readable[0]);
            }
        }

        const result = extractedParts.join(" ").replace(/\s+/g, " ").trim();
        return result.length > 0 ? result.substring(0, 5000) : null;
    } catch (e) {
        console.error("[ai-media] PDF extract error:", e);
        return null;
    }
}
