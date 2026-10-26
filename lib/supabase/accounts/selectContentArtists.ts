import supabase from "@/lib/supabase/serverClient";

interface ContentArtist {
  id: string;
  name: string | null;
}

function completeRows<T>(result: { data: T[] | null; error: unknown; count: number | null }): T[] {
  if (result.error || !result.data || result.count !== result.data.length) {
    throw new Error("Complete content artist roster unavailable");
  }
  return result.data;
}

/**
 * Load only directly held artists and artists in the account's organizations.
 * Errors and truncated results must not turn an ambiguous name into a unique one.
 * No global administrator expansion is applied to this content-bot roster.
 */
export async function selectContentArtists(accountId: string): Promise<ContentArtist[]> {
  const [directResult, membershipResult] = await Promise.all([
    supabase
      .from("account_artist_ids")
      .select("artist:accounts!account_artist_ids_artist_id_fkey (id, name)", { count: "exact" })
      .eq("account_id", accountId),
    supabase
      .from("account_organization_ids")
      .select("organization_id", { count: "exact" })
      .eq("account_id", accountId),
  ]);
  const direct = completeRows(directResult);
  const memberships = completeRows(membershipResult);
  const orgIds = [...new Set(memberships.map(row => row.organization_id))];
  if (orgIds.some(id => !id)) throw new Error("Invalid content artist membership");

  const organizationArtists = orgIds.length
    ? completeRows(
        await supabase
          .from("artist_organization_ids")
          .select("artist:accounts!artist_organization_ids_artist_id_fkey (id, name)", {
            count: "exact",
          })
          .in("organization_id", orgIds as string[]),
      )
    : [];

  const artists = new Map<string, ContentArtist>();
  for (const row of [...direct, ...organizationArtists]) {
    if (!row.artist) throw new Error("Content artist record unavailable");
    artists.set(row.artist.id, row.artist);
  }
  return [...artists.values()];
}
