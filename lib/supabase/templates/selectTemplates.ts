import type { QueryData } from "@supabase/supabase-js";
import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";
import { getAdminAccountIds } from "@/lib/admins/getAdminAccountIds";
import { selectTemplateFavorites } from "@/lib/supabase/template_favorites/selectTemplateFavorites";
import { flattenCreator, type TemplateCreator } from "@/lib/supabase/templates/flattenCreator";
import { resolveSharedEmails } from "@/lib/supabase/templates/resolveSharedEmails";

export type { TemplateCreator };

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

const creatorIdOf = (r: RawTemplate): string | null => {
  const c = r.creator;
  if (!c) return null;
  return Array.isArray(c) ? (c[0]?.id ?? null) : c.id;
};

const throwOn = (label: string, error: { message: string } | null) => {
  if (!error) return;
  console.error(`Error ${label}:`, error);
  throw new Error(`selectTemplates ${label} failed: ${error.message}`);
};

/**
 * Reads agent templates shaped for the API.
 *
 * - `{ id }`           → row with that id, or empty array
 * - `{ accessibleTo }` → own + public + shared (deduped, sorted by title)
 *
 * Pass `forAccountId` to enrich `is_favourite` and `shared_emails` (the
 * latter only on private templates the account owns). Omit it for
 * lightweight callers (e.g. ownership validators).
 *
 * Throws on database error.
 */
export async function selectTemplates(
  params: SelectTemplatesParams,
  forAccountId?: string,
): Promise<Template[]> {
  // 1. Fetch
  let rows: RawTemplate[];
  if ("id" in params) {
    const { data, error } = await supabase
      .from("agent_templates")
      .select(SELECT)
      .eq("id", params.id);
    throwOn("by id", error);
    rows = data ?? [];
  } else {
    const accountId = params.accessibleTo;
    const [owned, shared] = await Promise.all([
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
    throwOn("owned/public", owned.error);
    throwOn("shared", shared.error);

    const sharedRows = (shared.data ?? []).flatMap(s => {
      const t = (s as { template: RawTemplate | RawTemplate[] | null }).template;
      return t ? (Array.isArray(t) ? t : [t]) : [];
    });
    const seen = new Set<string>();
    rows = [...(owned.data ?? []), ...sharedRows].filter(r =>
      seen.has(r.id) ? false : (seen.add(r.id), true),
    );
  }
  if (rows.length === 0) return [];

  // 2. Caller-/admin-dependent fetches in parallel
  const creatorIds = Array.from(
    new Set(rows.map(creatorIdOf).filter((id): id is string => id !== null)),
  );
  const ownedPrivateIds = forAccountId
    ? rows.filter(r => r.is_private && creatorIdOf(r) === forAccountId).map(r => r.id)
    : [];
  const [adminIds, favorites, sharedEmails] = await Promise.all([
    getAdminAccountIds(creatorIds),
    forAccountId ? selectTemplateFavorites(forAccountId) : Promise.resolve([]),
    forAccountId ? resolveSharedEmails(ownedPrivateIds) : Promise.resolve({}),
  ]);
  const favoriteIds = new Set(favorites.map(f => f.template_id));

  // 3. Shape
  return rows
    .map(row => {
      const creator = flattenCreator(row.creator, adminIds);
      const isOwnedPrivate = !!forAccountId && row.is_private && creator?.id === forAccountId;
      return {
        ...row,
        creator,
        is_favourite: favoriteIds.has(row.id),
        shared_emails: isOwnedPrivate ? (sharedEmails[row.id] ?? []) : [],
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
