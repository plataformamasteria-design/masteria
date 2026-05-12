// Temporary wrapper to handle Supabase type issues
// This will be removed once the types are properly regenerated
import { supabase as originalSupabase } from "@/integrations/supabase/client";

// Export a typed version that bypasses type checking issues
export const supabase = originalSupabase as any;

// Re-export the original for cases where we need it
export const supabaseOriginal = originalSupabase;
