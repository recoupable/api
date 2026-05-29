const PAGE_SIZE = 1000;

/**
 * Collects every row from a paged query by calling `fetchPage(from, to)` until
 * it returns a short page (< PAGE_SIZE). Keeps the pagination loop OUT of the
 * thin `lib/supabase` query helpers — they stay single-query; this composes
 * them. Used by the Phase 2 backfill to read past the PostgREST 1,000-row cap.
 */
export async function paginate<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await fetchPage(from, from + PAGE_SIZE - 1);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}
