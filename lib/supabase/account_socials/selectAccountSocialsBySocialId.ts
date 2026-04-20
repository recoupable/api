import type { SupabaseClient } from "@supabase/supabase-js";
import supabase from "../serverClient";
import type { Database } from "@/types/database.types";

const typedClient = supabase as SupabaseClient<Database>;

export async function selectAccountSocialsBySocialId(socialId: string) {
  const { data, error } = await typedClient
    .from("account_socials")
    .select("*")
    .eq("social_id", socialId);

  if (error) {
    console.error("[ERROR] selectAccountSocialsBySocialId:", error);
    return null;
  }

  return data ?? [];
}
