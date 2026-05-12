import type { RawTemplate } from "@/lib/supabase/templates/selectTemplates";

export interface TemplateCreator {
  id: string;
  name: string | null;
  image: string | null;
  is_admin: boolean;
}

/**
 * Flattens the joined creator block on a raw template row into the API
 * response shape. `is_admin` is taken from the supplied set so the caller
 * can batch-compute admin membership across many rows in one query
 * (see `getAdminAccountIds`).
 */
export function flattenCreator(
  creator: RawTemplate["creator"],
  adminAccountIds: Set<string>,
): TemplateCreator | null {
  if (!creator) return null;
  const row = Array.isArray(creator) ? creator[0] : creator;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name ?? null,
    image: row.account_info?.[0]?.image ?? null,
    is_admin: adminAccountIds.has(row.id),
  };
}
