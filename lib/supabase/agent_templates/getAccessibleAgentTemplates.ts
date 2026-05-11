import supabase from "@/lib/supabase/serverClient";
import { ADMIN_EMAILS } from "@/lib/const";
import type { Tables } from "@/types/database.types";
import { selectAgentTemplateFavorites } from "@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites";
import { selectAgentTemplateShares } from "@/lib/supabase/agent_template_shares/selectAgentTemplateShares";

/**
 * Embedded creator block surfaced on each agent template row.
 */
export interface AgentTemplateCreator {
  id: string;
  name: string | null;
  image: string | null;
  is_admin: boolean;
}

/**
 * Enriched agent template payload returned by GET /api/agent-templates and
 * by the create / update handlers.
 */
export interface AgentTemplateWithDetails {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tags: string[] | null;
  creator: AgentTemplateCreator | null;
  is_private: boolean;
  is_favourite: boolean;
  favorites_count: number | null;
  shared_emails: string[];
  created_at: string | null;
  updated_at: string | null;
}

interface CreatorJoin {
  id: string;
  name: string | null;
  account_info: Array<Pick<Tables<"account_info">, "image">> | null;
  account_emails: Array<Pick<Tables<"account_emails">, "email">> | null;
}

type AgentTemplateRowWithCreator = Omit<Tables<"agent_templates">, "creator"> & {
  creator: CreatorJoin | null;
};

/**
 * Builds the embedded creator object from a joined accounts row, deriving the
 * is_admin flag by intersecting the account's emails with `ADMIN_EMAILS`.
 */
function buildCreator(row: CreatorJoin | null): AgentTemplateCreator | null {
  if (!row) return null;

  const image = row.account_info?.[0]?.image ?? null;
  const emails = (row.account_emails ?? [])
    .map(e => e.email)
    .filter((e): e is string => typeof e === "string");
  const isAdmin = emails.some(email => ADMIN_EMAILS.includes(email));

  return {
    id: row.id,
    name: row.name ?? null,
    image,
    is_admin: isAdmin,
  };
}

/**
 * Fetches every agent template visible to `accountId` and enriches each row
 * with the creator block, the caller's `is_favourite` flag, and (for private
 * templates the caller owns) the list of `shared_emails`.
 *
 * Visibility rules:
 *   - templates the caller created
 *   - public templates (`is_private = false`)
 *   - private templates the caller has been granted access to via
 *     `agent_template_shares`
 *
 * Privacy: `shared_emails` is only populated for templates where the caller
 * is the creator. Sharees would otherwise leak each other's emails.
 *
 * Throws on database error so the handler surfaces a real 500 instead of
 * returning an empty list that looks like "no templates".
 *
 * TODO: paginate. The owned-and-public query is subject to Supabase's
 * default 1000-row cap; as public templates grow this will silently truncate.
 *
 * @param accountId - The authenticated account's UUID.
 * @returns Array of enriched template rows.
 * @throws If any underlying Supabase query fails.
 */
export async function getAccessibleAgentTemplates(
  accountId: string,
): Promise<AgentTemplateWithDetails[]> {
  const ownedAndPublicSelect = `
    *,
    creator:accounts!agent_templates_creator_fkey (
      id,
      name,
      account_info ( image ),
      account_emails ( email )
    )
  `;

  const { data: ownedAndPublic, error: ownedErr } = await supabase
    .from("agent_templates")
    .select(ownedAndPublicSelect)
    .or(`creator.eq.${accountId},is_private.eq.false`)
    .order("title");

  if (ownedErr) {
    console.error("Error selecting owned/public agent_templates:", ownedErr);
    throw new Error(`getAccessibleAgentTemplates (owned/public) failed: ${ownedErr.message}`);
  }

  const { data: sharedJoin, error: sharedErr } = await supabase
    .from("agent_template_shares")
    .select(
      `template:agent_templates!agent_template_shares_template_id_fkey (
        ${ownedAndPublicSelect}
      )`,
    )
    .eq("user_id", accountId);

  if (sharedErr) {
    console.error("Error selecting shared agent_templates:", sharedErr);
    throw new Error(`getAccessibleAgentTemplates (shared) failed: ${sharedErr.message}`);
  }

  // Deduplicate by template id.
  const byId = new Map<string, AgentTemplateRowWithCreator>();
  (ownedAndPublic ?? []).forEach(row => {
    byId.set(row.id, row as unknown as AgentTemplateRowWithCreator);
  });

  (sharedJoin ?? []).forEach(share => {
    const template = (
      share as unknown as {
        template: AgentTemplateRowWithCreator | AgentTemplateRowWithCreator[] | null;
      }
    ).template;
    if (!template) return;
    const list = Array.isArray(template) ? template : [template];
    list.forEach(t => {
      if (t && t.id && !byId.has(t.id)) byId.set(t.id, t);
    });
  });

  const templates = Array.from(byId.values());
  if (templates.length === 0) return [];

  const favourites = await selectAgentTemplateFavorites(accountId);

  // Resolve shared_emails only for private templates the caller owns.
  // Sharees do not see who else a template was shared with.
  const ownedPrivateIds = templates
    .filter(t => t.is_private && t.creator?.id === accountId)
    .map(t => t.id);
  const sharedEmailsByTemplate = await getSharedEmailsByTemplateId(ownedPrivateIds);

  return templates.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    prompt: t.prompt,
    tags: t.tags ?? null,
    creator: buildCreator(t.creator),
    is_private: t.is_private,
    is_favourite: favourites.has(t.id),
    favorites_count: t.favorites_count ?? null,
    shared_emails:
      t.is_private && t.creator?.id === accountId ? (sharedEmailsByTemplate[t.id] ?? []) : [],
    created_at: t.created_at ?? null,
    updated_at: t.updated_at ?? null,
  }));
}

/**
 * Builds a `template_id -> emails[]` map by fanning out template ids through
 * shares, then resolving the recipient account ids back to email strings.
 */
async function getSharedEmailsByTemplateId(
  templateIds: string[],
): Promise<Record<string, string[]>> {
  if (templateIds.length === 0) return {};

  const shares = await selectAgentTemplateShares(templateIds);
  if (shares.length === 0) return {};

  const accountIds = Array.from(new Set(shares.map(s => s.user_id)));

  const { data: emailRows, error } = await supabase
    .from("account_emails")
    .select("account_id, email")
    .in("account_id", accountIds);

  if (error) {
    console.error("Error selecting account_emails for shares:", error);
    throw new Error(`getSharedEmailsByTemplateId failed: ${error.message}`);
  }

  const emailsByAccount = new Map<string, string[]>();
  (emailRows ?? []).forEach(row => {
    if (!row.account_id || !row.email) return;
    const list = emailsByAccount.get(row.account_id) ?? [];
    list.push(row.email);
    emailsByAccount.set(row.account_id, list);
  });

  const result: Record<string, string[]> = {};
  shares.forEach(share => {
    const list = result[share.template_id] ?? [];
    const accountEmails = emailsByAccount.get(share.user_id) ?? [];
    list.push(...accountEmails);
    result[share.template_id] = list;
  });

  Object.keys(result).forEach(id => {
    result[id] = Array.from(new Set(result[id]));
  });

  return result;
}
