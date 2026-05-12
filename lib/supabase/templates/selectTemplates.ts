import type { Tables } from "@/types/database.types";
import { getAdminAccountIds } from "@/lib/admins/getAdminAccountIds";
import { selectTemplateFavorites } from "@/lib/supabase/template_favorites/selectTemplateFavorites";
import { fetchRawTemplates } from "@/lib/supabase/templates/fetchRawTemplates";
import { flattenCreator, type TemplateCreator } from "@/lib/supabase/templates/flattenCreator";
import { resolveSharedEmails } from "@/lib/supabase/templates/resolveSharedEmails";
import type { RawTemplate } from "@/lib/supabase/templates/templateWithCreatorSelect";

export type { TemplateCreator } from "@/lib/supabase/templates/flattenCreator";

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
  const rows = await fetchRawTemplates(params);
  if (rows.length === 0) return [];

  const adminAccountIds = await getAdminAccountIds(uniqueCreatorIds(rows));
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

function uniqueCreatorIds(rows: RawTemplate[]): string[] {
  const ids = new Set<string>();
  rows.forEach(row => {
    const c = row.creator;
    if (!c) return;
    const single = Array.isArray(c) ? c[0] : c;
    if (single?.id) ids.add(single.id);
  });
  return Array.from(ids);
}
