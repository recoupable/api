import type { QueryData } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/serverClient";

/**
 * Shared SELECT fragment for reading agent_templates with the creator
 * account joined (id, name, image). `is_admin` is no longer derived from
 * embedded emails — callers compute it from organization membership via
 * `getAdminAccountIds` and attach it during shaping.
 */
export const TEMPLATE_WITH_CREATOR_SELECT = `
  *,
  creator:accounts!agent_templates_creator_fkey (
    id,
    name,
    account_info ( image )
  )
` as const;

const _typedQuery = supabase.from("agent_templates").select(TEMPLATE_WITH_CREATOR_SELECT);

export type RawTemplate = QueryData<typeof _typedQuery>[number];
