import supabase from "@/lib/supabase/serverClient";

/**
 * For each supplied template id, returns the emails it has been shared with.
 * One round trip: embeds the share's `user_id → accounts → account_emails`
 * chain in a single PostgREST query, then groups + dedupes the emails by
 * template id in memory. Empty input returns an empty map.
 *
 * PostgREST doesn't support array aggregation in select strings, so the
 * grouping step has to live here (or in a Postgres view/RPC, which would
 * be a schema change).
 */
export async function resolveSharedEmails(
  templateIds: string[],
): Promise<Record<string, string[]>> {
  if (templateIds.length === 0) return {};

  const { data, error } = await supabase
    .from("agent_template_shares")
    .select(
      `
      template_id,
      sharee:accounts!agent_template_shares_user_id_fkey (
        account_emails ( email )
      )
    `,
    )
    .in("template_id", templateIds);

  if (error) {
    console.error("Error selecting template shares with emails:", error);
    throw new Error(`resolveSharedEmails failed: ${error.message}`);
  }

  const result: Record<string, string[]> = {};
  (data ?? []).forEach(row => {
    const shareeList = Array.isArray(row.sharee) ? row.sharee : row.sharee ? [row.sharee] : [];
    shareeList.forEach(sharee => {
      sharee.account_emails?.forEach(ae => {
        if (!ae?.email) return;
        const list = result[row.template_id] ?? [];
        list.push(ae.email);
        result[row.template_id] = list;
      });
    });
  });
  Object.keys(result).forEach(id => {
    result[id] = Array.from(new Set(result[id]));
  });
  return result;
}
