import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function main() {
  const { data, error } = await supabase.from("ads_metadata").select("*").limit(1);
  if (error) {
    console.error("Error fetching ads_metadata:", error);
  } else {
    console.log("ads_metadata columns:", data && data.length > 0 ? Object.keys(data[0]) : "No data");
  }

  const { data: data2, error: error2 } = await supabase.from("ads_performance").select("*").limit(1);
  if (error2) {
    console.error("Error fetching ads_performance:", error2);
  } else {
    console.log("ads_performance columns:", data2 && data2.length > 0 ? Object.keys(data2[0]) : "No data");
  }
}

main();
