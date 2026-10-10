import supabase from "@/lib/supabase/serverClient";
import type { SupabaseClient } from "@supabase/supabase-js";
/** Service-owned tables introduced by 20261010060000_release_players.sql. */
export function playerDatabase() {
  return supabase as unknown as SupabaseClient;
}
