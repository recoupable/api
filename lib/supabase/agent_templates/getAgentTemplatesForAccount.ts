import supabase from "@/lib/supabase/serverClient";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import type { AgentTemplateRow } from "@/types/AgentTemplates";
import type { Tables } from "@/types/database.types";

type ShareRow = {
  templates:
    | Pick<
        Tables<"agent_templates">,
        | "id"
        | "title"
        | "description"
        | "prompt"
        | "tags"
        | "creator"
        | "is_private"
        | "created_at"
        | "favorites_count"
        | "updated_at"
      >
    | Pick<
        Tables<"agent_templates">,
        | "id"
        | "title"
        | "description"
        | "prompt"
        | "tags"
        | "creator"
        | "is_private"
        | "created_at"
        | "favorites_count"
        | "updated_at"
      >[]
    | null;
};

function toBaseRow(
  row: Pick<
    Tables<"agent_templates">,
    | "id"
    | "title"
    | "description"
    | "prompt"
    | "tags"
    | "creator"
    | "is_private"
    | "created_at"
    | "favorites_count"
    | "updated_at"
  >,
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

/**
 * Templates visible to an authenticated account: owned, public, shared-with,
 * plus `is_favourite` and `shared_emails` for private rows (OpenAPI contract).
 */
export async function getAgentTemplatesForAccount(accountId: string): Promise<AgentTemplateRow[]> {
  const { data: ownedPublic, error: ownedErr } = await supabase
    .from("agent_templates")
    .select(
      "id, title, description, prompt, tags, creator, is_private, created_at, favorites_count, updated_at",
    )
    .or(`creator.eq.${accountId},is_private.eq.false`)
    .order("title");

  if (ownedErr) {
    throw ownedErr;
  }

  const { data: shareData, error: shareErr } = await supabase
    .from("agent_template_shares")
    .select(
      `
      templates:agent_templates(
        id, title, description, prompt, tags, creator, is_private, created_at, favorites_count, updated_at
      )
    `,
    )
    .eq("user_id", accountId);

  if (shareErr) {
    throw shareErr;
  }

  const merged: Omit<AgentTemplateRow, "is_favourite" | "shared_emails">[] = [];
  const seen = new Set<string>();

  for (const row of ownedPublic ?? []) {
    merged.push(toBaseRow(row));
    seen.add(row.id);
  }

  for (const share of (shareData ?? []) as ShareRow[]) {
    if (!share?.templates) continue;
    const list = Array.isArray(share.templates) ? share.templates : [share.templates];
    for (const t of list) {
      if (t?.id && !seen.has(t.id)) {
        merged.push(toBaseRow(t));
        seen.add(t.id);
      }
    }
  }

  const { data: favData, error: favErr } = await supabase
    .from("agent_template_favorites")
    .select("template_id")
    .eq("user_id", accountId);

  if (favErr) {
    throw favErr;
  }

  const favouriteIds = new Set((favData ?? []).map(f => f.template_id));

  const privateIds = merged.filter(t => t.is_private).map(t => t.id);

  let emailsByTemplate: Record<string, string[]> = {};
  if (privateIds.length > 0) {
    const { data: shares, error: shErr } = await supabase
      .from("agent_template_shares")
      .select("template_id, user_id")
      .in("template_id", privateIds);

    if (shErr) {
      throw shErr;
    }

    const userIds = [...new Set((shares ?? []).map(s => s.user_id))];
    if (userIds.length > 0) {
      const emailRows = await selectAccountEmails({ accountIds: userIds });
      const userEmailMap: Record<string, string[]> = {};
      for (const er of emailRows) {
        if (!er.account_id || !er.email) continue;
        if (!userEmailMap[er.account_id]) userEmailMap[er.account_id] = [];
        userEmailMap[er.account_id].push(er.email);
      }
      emailsByTemplate = {};
      for (const s of shares ?? []) {
        if (!emailsByTemplate[s.template_id]) emailsByTemplate[s.template_id] = [];
        const add = userEmailMap[s.user_id] ?? [];
        emailsByTemplate[s.template_id].push(...add);
      }
      for (const id of Object.keys(emailsByTemplate)) {
        emailsByTemplate[id] = [...new Set(emailsByTemplate[id])];
      }
    }
  }

  return merged
    .map(t => ({
      ...t,
      is_favourite: favouriteIds.has(t.id),
      shared_emails: t.is_private ? (emailsByTemplate[t.id] ?? []) : [],
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
