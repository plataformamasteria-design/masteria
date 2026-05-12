import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GHL_BASE = "https://services.leadconnectorhq.com";

async function ghlRequest(token, path, method = "GET", body) {
    console.log("Requesting GHL:", method, path);
    const res = await fetch(`${GHL_BASE}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`GHL Request failed (${res.status}): ${errText}`);
    }
    return res.json();
}

async function testAutoCreate() {
    const orgId = "a1227084-d46e-4596-9897-3dabe85f1a09";
    const chatId = "24719602-0ecf-4422-ba3f-ec0678ebef53"; // Chat ID for Teste 6 (Desconhecido)

    const { data: connection } = await supabase.from("ghl_connections").select("*").eq("organization_id", orgId).single();
    const token = connection.access_token;
    const locationId = connection.location_id;

    try {
        const { data: chat } = await supabase
            .from("chats")
            .select("phone, wa_name, custom_name, is_group, channel")
            .eq("id", chatId)
            .single();

        const cleanPhone = String(chat.phone).replace(/\D/g, "");
        const phone = `+${cleanPhone}`;
        const name = chat.custom_name || chat.wa_name || cleanPhone;

        let ghlUserId = null;
        let connectionInfo = null;
        if (chat.channel) {
            const { data: exactConn } = await supabase
                .from("whatsapp_connections")
                .select("ghl_user_id, instance_name, display_name")
                .eq("organization_id", orgId)
                .eq("instance_name", chat.channel)
                .maybeSingle();

            if (exactConn) {
                connectionInfo = exactConn;
                if (exactConn.ghl_user_id) ghlUserId = exactConn.ghl_user_id;
            }
        }

        console.log("Searching for:", phone);
        const searchResult = await ghlRequest(token, `/contacts/search/duplicate?locationId=${locationId}&number=${encodeURIComponent(phone)}`);
        
        if (searchResult?.contact?.id) {
            const { data: existingMapping } = await supabase.from("ghl_sync_mappings")
                .select("vitta_id")
                .eq("organization_id", orgId)
                .eq("resource_type", "contact")
                .eq("ghl_id", searchResult.contact.id)
                .maybeSingle();

            if (existingMapping && existingMapping.vitta_id !== chatId) {
                console.log(`GHL contact ${searchResult.contact.id} already mapped to Chat ${existingMapping.vitta_id}. Forcing duplicate creation for Chat ${chatId}.`);
            } else {
                console.log("Mapped or same. Should return existing.");
                return;
            }
        }

        let finalName = name;
        if (connectionInfo?.display_name && !name.includes(`[${connectionInfo.display_name}]`)) {
            finalName = `${name} [${connectionInfo.display_name}]`;
        }

        const payload = {
            name: finalName,
            phone: phone,
            locationId: locationId,
        };
        if (ghlUserId) payload.assignedTo = ghlUserId;

        console.log("Creating new GHL contact:", payload);
        const createRes = await ghlRequest(token, "/contacts/", "POST", payload);
        console.log("Create response:", createRes);
        
    } catch (e) {
        console.error("autoCreateGhlContact: Fatal error", e);
    }
}

testAutoCreate();
