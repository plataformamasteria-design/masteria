import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_ACCESS_TOKEN") || ""; 
// wait I don't have service role locally!
