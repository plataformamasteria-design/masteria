import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GHL_BASE = "https://services.leadconnectorhq.com";

async function testGhlApi() {
    const orgId = "a1227084-d46e-4596-9897-3dabe85f1a09";
    const { data: connection } = await supabase.from("ghl_connections").select("*").eq("organization_id", orgId).single();
    const token = connection.access_token;
    const locationId = connection.location_id;

    // Contact Deivid Programador phone
    const phone = "+558892161399";
    const payload = {
        name: "Deivid (Amana) Duplicate Test",
        phone: phone,
        locationId: locationId
    };

    console.log("POST /contacts/ with payload:", payload);
    const res = await fetch(`${GHL_BASE}/contacts/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" },
        body: JSON.stringify(payload),
    });
    
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
}
testGhlApi();
