import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

const MEDIA_PATTERNS = [
  /^image\//,
  /^audio\//,
  /^video\//,
  /^application\/pdf/,
  /^application\/octet-stream/,
];

function isMediaContentType(ct: string): boolean {
  return MEDIA_PATTERNS.some((p) => p.test(ct));
}

function getMediaCategory(ct: string): string {
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("audio/")) return "audio";
  if (ct.startsWith("video/")) return "video";
  if (ct.includes("pdf")) return "document";
  return "file";
}

function getExtension(ct: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "application/pdf": "pdf",
  };
  return map[ct] || "bin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const { url, method, headers, body } = payload;

    if (!url || !method) {
      return new Response(JSON.stringify({ error: "url and method are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fetchOptions: RequestInit = {
      method,
      headers: headers || {},
    };

    if (body && !["GET", "HEAD"].includes(method.toUpperCase())) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    fetchOptions.signal = controller.signal;

    let resp: Response;
    try {
      resp = await fetch(url, fetchOptions);
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const msg = fetchErr.name === "AbortError" ? "Request timed out (30s)" : fetchErr.message;
      return new Response(JSON.stringify({ error: "fetch_failed", message: msg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);

    const contentType = resp.headers.get("content-type") || "";

    // Handle media responses
    if (isMediaContentType(contentType)) {
      const buffer = await resp.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      const category = getMediaCategory(contentType);
      const ext = getExtension(contentType);
      const sizeBytes = buffer.byteLength;

      // Upload to storage for a public URL
      let publicUrl = "";
      try {
        const fileName = `http-proxy/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("chat-files")
          .upload(fileName, buffer, {
            contentType,
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabaseAdmin.storage
            .from("chat-files")
            .getPublicUrl(fileName);
          publicUrl = urlData?.publicUrl || "";
        }
      } catch {
        // Storage upload is best-effort; base64 is always available
      }

      const dataUrl = `data:${contentType};base64,${base64}`;

      return new Response(
        JSON.stringify({
          status: resp.status,
          statusText: resp.statusText,
          data: {
            __media: true,
            category,
            content_type: contentType,
            extension: ext,
            size_bytes: sizeBytes,
            base64: dataUrl,
            url: publicUrl || dataUrl,
            file_name: `response.${ext}`,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle JSON/text responses
    let responseBody: any;
    if (contentType.includes("json")) {
      responseBody = await resp.json();
    } else {
      responseBody = { body: await resp.text() };
    }

    return new Response(
      JSON.stringify({
        status: resp.status,
        statusText: resp.statusText,
        data: responseBody,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "internal_error", message: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
