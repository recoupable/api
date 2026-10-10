import supabase from "@/lib/supabase/serverClient";
import { stripNullish } from "@/lib/objects/stripNullish";
import type { TablesInsert } from "@/types/database.types";

type PostRow = TablesInsert<"posts">;

/**
 * Upserts an array of posts into the `posts` table, merging on
 * `post_url` so a re-scrape refreshes the engagement counts (and the
 * publish timestamp, which the handlers always set) in place — safe to
 * call repeatedly for the same post set during Apify webhook replays.
 *
 * Null/undefined fields are dropped first, so a run that omits a count,
 * caption or media never erases the value a previous run stored. Rows are
 * then written in one call per distinct column set: postgrest-js names the
 * union of all rows' keys and PostgREST fills a key a row omits with NULL,
 * which would clear retained values (and violate `posts.media NOT NULL`)
 * when one run mixes posts that did and did not report media
 * (recoupable/app#2132). Calls run in sequence; the first error is thrown.
 *
 * @param posts - Rows matching the posts-table insert type.
 */
export async function upsertPosts(posts: PostRow[]): Promise<void> {
  const cleaned = posts.map(stripNullish) as PostRow[];
  for (const rows of groupByColumnSet(cleaned)) {
    const { error } = await supabase.from("posts").upsert(rows, { onConflict: "post_url" });
    if (error) {
      console.error("[ERROR] upsertPosts:", error);
      throw error;
    }
  }
}

function groupByColumnSet(rows: PostRow[]): PostRow[][] {
  const groups = new Map<string, PostRow[]>();
  for (const row of rows) {
    const key = Object.keys(row).sort().join(",");
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()];
}
