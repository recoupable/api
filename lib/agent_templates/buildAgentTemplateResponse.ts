import type { Tables } from "@/types/database.types";
import { ADMIN_EMAILS } from "@/lib/const";
import type { AgentTemplateWithCreator } from "@/lib/supabase/agent_templates/agentTemplateWithCreatorSelect";

export interface AgentTemplateCreator {
  id: string;
  name: string | null;
  image: string | null;
  is_admin: boolean;
}

export type AgentTemplateResponse = Omit<Tables<"agent_templates">, "creator"> & {
  creator: AgentTemplateCreator | null;
  is_favourite: boolean;
  shared_emails: string[];
};

/**
 * Flattens the joined creator block and computes `is_admin` by intersecting
 * the creator's emails with `ADMIN_EMAILS`.
 */
function buildCreator(joined: AgentTemplateWithCreator["creator"]): AgentTemplateCreator | null {
  if (!joined) return null;
  const row = Array.isArray(joined) ? joined[0] : joined;
  if (!row) return null;

  const emails = (row.account_emails ?? [])
    .map(e => e.email)
    .filter((e): e is string => typeof e === "string");

  return {
    id: row.id,
    name: row.name ?? null,
    image: row.account_info?.[0]?.image ?? null,
    is_admin: emails.some(email => ADMIN_EMAILS.includes(email)),
  };
}

/**
 * Shapes a raw joined agent template row into the API response, layering in
 * caller-specific signals (`is_favourite`, `shared_emails`) that are computed
 * upstream.
 */
export function buildAgentTemplateResponse(
  row: AgentTemplateWithCreator,
  args: { isFavourite: boolean; sharedEmails: string[] },
): AgentTemplateResponse {
  const { creator, ...rest } = row;
  return {
    ...rest,
    creator: buildCreator(creator),
    is_favourite: args.isFavourite,
    shared_emails: args.sharedEmails,
  };
}
