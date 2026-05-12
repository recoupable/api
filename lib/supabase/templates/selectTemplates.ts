import type { QueryData } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/serverClient";
import { ADMIN_EMAILS } from "@/lib/const";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectTemplateFavorites } from "@/lib/supabase/template_favorites/selectTemplateFavorites";
import { selectTemplateShares } from "@/lib/supabase/template_shares/selectTemplateShares";

const SELECT = `
  *,
  creator:accounts!agent_templates_creator_fkey (
    id,
    name,
    account_info ( image ),
    account_emails ( email )
  )
` as const;

const _typedQuery = supabase.from("agent_templates").select(SELECT);

type RawTemplate = QueryData<typeof _typedQuery>[number];

export interface TemplateCreator {
  id: string;
  name: string | null;
  image: string | null;
  is_admin: boolean;
}

export type Template = Omit<RawTemplate, "creator"> & {
  creator: TemplateCreator | null;
  is_favourite: boolean;
  shared_emails: string[];
};

type SelectTemplatesParams = { id: string } | { accessibleTo: string };

function flattenCreator(creator: RawTemplate["creator"]): TemplateCreator | null {
  if (!creator) return null;
  const row = Array.isArray(creator) ? creator[0] : creator;
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

async function resolveSharedEmails(templateIds: string[]): Promise<Record<string, string[]>> {
  if (templateIds.length === 0) return {};
  const shares = await selectTemplateShares(templateIds);
  if (shares.length === 0) return {};

  const accountIds = Array.from(new Set(shares.map(s => s.user_id)));
  const accountEmails = await selectAccountEmails({ accountIds });

  const emailsByAccount = new Map<string, string[]>();
  accountEmails.forEach(row => {
    if (!row.account_id || !row.email) return;
    const list = emailsByAccount.get(row.account_id) ?? [];
    list.push(row.email);
    emailsByAccount.set(row.account_id, list);
  });

  const result: Record<string, string[]> = {};
  shares.forEach(share => {
    const list = result[share.template_id] ?? [];
    list.push(...(emailsByAccount.get(share.user_id) ?? []));
    result[share.template_id] = list;
  });
  Object.keys(result).forEach(id => {
    result[id] = Array.from(new Set(result[id]));
  });
  return result;
}

async function fetchRaw(params: SelectTemplatesParams): Promise<RawTemplate[]> {
  if ("id" in params) {
    const { data, error } = await supabase
      .from("agent_templates")
      .select(SELECT)
      .eq("id", params.id);
    if (error) {
      console.error("Error selecting template by id:", error);
      throw new Error(`selectTemplates(id) failed: ${error.message}`);
    }
    return data ?? [];
  }

  const accountId = params.accessibleTo;
  const [ownedAndPublic, shared] = await Promise.all([
    supabase
      .from("agent_templates")
      .select(SELECT)
      .or(`creator.eq.${accountId},is_private.eq.false`)
      .order("title"),
    supabase
      .from("agent_template_shares")
      .select(`template:agent_templates!agent_template_shares_template_id_fkey (${SELECT})`)
      .eq("user_id", accountId),
  ]);

  if (ownedAndPublic.error) {
    console.error("Error selecting owned/public templates:", ownedAndPublic.error);
    throw new Error(
      `selectTemplates(accessibleTo) owned/public failed: ${ownedAndPublic.error.message}`,
    );
  }
  if (shared.error) {
    console.error("Error selecting shared templates:", shared.error);
    throw new Error(`selectTemplates(accessibleTo) shared failed: ${shared.error.message}`);
  }

  const byId = new Map<string, RawTemplate>();
  (ownedAndPublic.data ?? []).forEach(row => byId.set(row.id, row));
  (shared.data ?? []).forEach(s => {
    const { template } = s as { template: RawTemplate | RawTemplate[] | null };
    if (!template) return;
    const list = Array.isArray(template) ? template : [template];
    list.forEach(t => {
      if (t && !byId.has(t.id)) byId.set(t.id, t);
    });
  });
  return Array.from(byId.values());
}

/**
 * Reads templates and returns them fully shaped for the API:
 *   - creator block flattened to `{ id, name, image, is_admin }`
 *   - `is_favourite` populated against `forAccountId` (defaults to `false`)
 *   - `shared_emails` populated only for private templates `forAccountId` owns
 *
 * `{ id }`         → row with that id, or empty array when not found.
 * `{ accessibleTo }` → own + public + shared (deduped) for that account.
 *
 * Pass `forAccountId` whenever you need is_favourite / shared_emails marked.
 * Internal callers (e.g. ownership validators) can omit it to skip the
 * caller-specific enrichment queries.
 *
 * Throws on database error.
 */
export async function selectTemplates(
  params: SelectTemplatesParams,
  forAccountId?: string,
): Promise<Template[]> {
  const rawRows = await fetchRaw(params);
  if (rawRows.length === 0) return [];

  const flattened = rawRows.map(row => {
    const { creator, ...rest } = row;
    return { ...rest, creator: flattenCreator(creator) };
  });

  if (!forAccountId) {
    return flattened.map(row => ({ ...row, is_favourite: false, shared_emails: [] }));
  }

  const ownedPrivateIds = flattened
    .filter(r => r.is_private && r.creator?.id === forAccountId)
    .map(r => r.id);
  const [favorites, sharedEmailsMap] = await Promise.all([
    selectTemplateFavorites(forAccountId),
    resolveSharedEmails(ownedPrivateIds),
  ]);
  const favoriteIds = new Set(favorites.map(f => f.template_id));

  return flattened.map(row => ({
    ...row,
    is_favourite: favoriteIds.has(row.id),
    shared_emails:
      row.is_private && row.creator?.id === forAccountId ? (sharedEmailsMap[row.id] ?? []) : [],
  }));
}
