import type { QueryData } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/serverClient";

export const AGENT_TEMPLATE_WITH_CREATOR_SELECT = `
  *,
  creator:accounts!agent_templates_creator_fkey (
    id,
    name,
    account_info ( image ),
    account_emails ( email )
  )
` as const;

const _typedQuery = supabase.from("agent_templates").select(AGENT_TEMPLATE_WITH_CREATOR_SELECT);

export type AgentTemplateWithCreator = QueryData<typeof _typedQuery>[number];
