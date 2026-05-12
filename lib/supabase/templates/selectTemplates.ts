import type { QueryData } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";
import { getAdminAccountIds } from "@/lib/admins/getAdminAccountIds";
import { selectTemplateFavorites } from "@/lib/supabase/template_favorites/selectTemplateFavorites";
import { flattenCreator, type TemplateCreator } from "@/lib/supabase/templates/flattenCreator";
import { resolveSharedEmails } from "@/lib/supabase/templates/resolveSharedEmails";

export type { TemplateCreator } from "@/lib/supabase/templates/flattenCreator";

/**
 * The one SELECT for reading templates. Creator is always joined — there's
 * no "template without creator" path in this codebase.
 */
const SELECT = `
  *,
  creator:accounts!agent_templates_creator_fkey (
    id,
    name,
    account_info ( image )
  )
` as const;

const _typedQuery = supabase.from("agent_templates").select(SELECT);

export type RawTemplate = QueryData<typeof _typedQuery>[number];

export type Template = Omit<Tables<"agent_templates">, "creator"> & {
  creator: TemplateCreator | null;
  is_favourite: boolean;
  shared_emails: string[];
};

export type SelectTemplatesParams = { id: string } | { accessibleTo: string };

/**
 * Returns agent templates fully shaped for the API:
 *  - creator block flattened to `{ id, name, image, is_admin }`
 *  - `is_admin` derived from Recoup org membership (see `getAdminAccountIds`)
 *  - `is_favourite` populated against `forAccountId` (defaults to `false`)
 *  - `shared_emails` populated only for private templates `forAccountId` owns
 *
 * `{ id }`           → row with that id, or empty array.
 * `{ accessibleTo }` → own + public + shared (deduped, sorted by title).
 *
 * Omit `forAccountId` for internal callers (e.g. ownership validators) that
 * only need the creator block and want to skip the per-caller enrichment.
 *
 * Throws on database error.
 */
export async function selectTemplates(
  params: SelectTemplatesParams,
  forAccountId?: string,
): Promise<Template[]> {
  let rows: RawTemplate[];

  if ("id" in params) {
    const { data, error } = await supabase
      .from("agent_templates")
      .select(SELECT)
      .eq("id", params.id);
    if (error) {
      console.error("Error selecting template by id:", error);
      throw new Error(`selectTemplates(id) failed: ${error.message}`);
    }
    rows = data ?? [];
  } else {
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
    rows = Array.from(byId.values());
  }

  if (rows.length === 0) return [];

  const creatorIds = new Set<string>();
  rows.forEach(row => {
    const c = row.creator;
    if (!c) return;
    const single = Array.isArray(c) ? c[0] : c;
    if (single?.id) creatorIds.add(single.id);
  });
  const adminAccountIds = await getAdminAccountIds(Array.from(creatorIds));

  const flattened = rows.map(row => ({
    ...row,
    creator: flattenCreator(row.creator, adminAccountIds),
  }));

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

  return flattened
    .map(row => ({
      ...row,
      is_favourite: favoriteIds.has(row.id),
      shared_emails:
        row.is_private && row.creator?.id === forAccountId ? (sharedEmailsMap[row.id] ?? []) : [],
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
