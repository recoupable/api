import supabase from "@/lib/supabase/serverClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Site } from "@/lib/sites/schema";
type Signup = {
  id: string;
  site_id: string;
  email: string;
  consent_text: string;
  created_at: string;
};
type SiteDatabase = {
  public: {
    Tables: {
      sites: { Row: Site; Insert: Partial<Site>; Update: Partial<Site>; Relationships: [] };
      site_signups: {
        Row: Signup;
        Insert: Partial<Signup>;
        Update: Partial<Signup>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
  };
};
// Local typing for tables introduced by 20260918010000_sites.sql.
export function siteTable<T extends "sites" | "site_signups" = "sites">(name: T = "sites" as T) {
  return (supabase as unknown as SupabaseClient<SiteDatabase>).from(name);
}
