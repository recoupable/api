import supabase from "@/lib/supabase/serverClient";
import type {
  AgentTemplateListFields,
  ShareRow,
} from "@/lib/supabase/agent_templates/agentTemplatesForAccount.types";
import type { AgentTemplateRow } from "@/types/AgentTemplates";

function toBaseRow(
  row: AgentTemplateListFields,
): Omit<AgentTemplateRow, "is_favourite" | "shared_emails"> {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    prompt: row.prompt,
    tags: row.tags ?? null,
    creator: row.creator ?? null,
    is_private: row.is_private,
    created_at: row.created_at ?? null,
    favorites_count: row.favorites_count ?? null,
    updated_at: row.updated_at ?? null,
  };
}

async function selectOwnedAndPublicTemplates(
  accountId: string,
): Promise<AgentTemplateListFields[]> {
  const { data, error } = await supabase
    .from("agent_templates")
    .select(
      "id, title, description, prompt, tags, creator, is_private, created_at, favorites_count, updated_at",
    )
    .or(`creator.eq.${accountId},is_private.eq.false`)
    .order("title");

  if (error) {
    throw error;
  }
  return data ?? [];
}

async function selectShareRowsForAccount(accountId: string): Promise<ShareRow[]> {
  const { data, error } = await supabase
    .from("agent_template_shares")
    .select(
      `
      templates:agent_templates(
        id, title, description, prompt, tags, creator, is_private, created_at, favorites_count, updated_at
      )
    `,
    )
    .eq("user_id", accountId);

  if (error) {
    throw error;
  }
  return (data ?? []) as ShareRow[];
}

function mergeOwnedPublicWithShared(
  ownedPublic: AgentTemplateListFields[],
  shareRows: ShareRow[],
): Omit<AgentTemplateRow, "is_favourite" | "shared_emails">[] {
  const merged: Omit<AgentTemplateRow, "is_favourite" | "shared_emails">[] = [];
  const seen = new Set<string>();

  for (const row of ownedPublic) {
    merged.push(toBaseRow(row));
    seen.add(row.id);
  }

  for (const share of shareRows) {
    if (!share?.templates) continue;
    const list = Array.isArray(share.templates) ? share.templates : [share.templates];
    for (const t of list) {
      if (t?.id && !seen.has(t.id)) {
        merged.push(toBaseRow(t));
        seen.add(t.id);
      }
    }
  }

  return merged;
}

/**
 * Owned + public templates plus templates shared with the account, deduped.
 */
export async function selectMergedAgentTemplatesForAccount(
  accountId: string,
): Promise<Omit<AgentTemplateRow, "is_favourite" | "shared_emails">[]> {
  const [ownedPublic, shareRows] = await Promise.all([
    selectOwnedAndPublicTemplates(accountId),
    selectShareRowsForAccount(accountId),
  ]);
  return mergeOwnedPublicWithShared(ownedPublic, shareRows);
}
