import supabase from "@/lib/supabase/serverClient";
import { stripNullish } from "@/lib/objects/stripNullish";
import type { TablesInsert } from "@/types/database.types";

/**
 * Merge posts on post_url, omitting nullish fields without adding them through another row's
 * PostgREST column union. Consecutive rows with the same columns share a request; input order
 * is preserved. Duplicate post_url targets are rejected locally before any write, rather than
 * turning the former single-statement duplicate error into cross-request overwrites.
 *
 * Requests run sequentially and stop at the first error. Earlier requests may already have
 * committed: this is not a transaction, rollback or automatic replay mechanism. The SDK uses
 * minimal responses (no select), retaining the existing { data: null, error: null } success.
 * Empty input returns that same shape without issuing a request.
 *
 * @param posts - Existing posts-table insert rows; no new schema fields are introduced.
 */
export async function upsertPosts(posts: TablesInsert<"posts">[]) {
  const cleaned = posts.map(stripNullish) as TablesInsert<"posts">[];
  const urls = new Set<string>();
  const batches: { key: string; rows: TablesInsert<"posts">[] }[] = [];
  for (const row of cleaned) {
    if (urls.has(row.post_url)) throw new Error("Duplicate post_url values in upsertPosts input");
    urls.add(row.post_url);
    const key = JSON.stringify(Object.keys(row).sort());
    const last = batches.at(-1);
    if (last?.key === key) last.rows.push(row);
    else batches.push({ key, rows: [row] });
  }

  let data: null = null;
  for (const { rows } of batches) {
    const result = await supabase.from("posts").upsert(rows, { onConflict: "post_url" });
    if (result.error) throw result.error;
    data = result.data;
  }
  return { data, error: null };
}
