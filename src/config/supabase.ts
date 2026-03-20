import { createClient } from "@supabase/supabase-js";
import { config } from "./environment";

export function getSupabaseAdminClient() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("Supabase storage is not configured");
  }

  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
