import supabase from "@/lib/supabase/serverClient";
import type { SupabaseClient } from "@supabase/supabase-js";
/** Tables and RPC introduced by 20260928010000_site_fan_connections.sql. */
export function fanConnectionDatabase() {
  return supabase as unknown as SupabaseClient;
}
