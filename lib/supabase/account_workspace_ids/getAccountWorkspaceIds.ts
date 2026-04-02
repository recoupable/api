import supabase from "../serverClient";
import type { ArtistQueryRow } from "@/lib/artists/getFormattedArtist";

// Raw row type returned by this query (workspace_info instead of artist_info)
export type AccountWorkspaceRow = Omit<ArtistQueryRow, "artist_info"> & {
  workspace_info?: ArtistQueryRow["artist_info"];
};

/**
 * Get all workspaces for an account, with full info.
 * Returns raw data - formatting should be done by caller.
 *
 * @param accountId - The owner's account ID
 * @returns Array of raw workspace rows from database
 */
export async function getAccountWorkspaceIds(accountId: string): Promise<AccountWorkspaceRow[]> {
  if (!accountId) return [];

  const { data, error } = await supabase
    .from("account_workspace_ids")
    .select(
      `*,
      workspace_info:accounts!account_workspace_ids_workspace_id_fkey (
        *,
        account_socials (
          *,
          social:socials (*)
        ),
        account_info (*)
      )
    `,
    )
    .eq("account_id", accountId);

  if (error) {
    console.error("Error getting account workspaces:", error);
    return [];
  }

  return (data || []) as AccountWorkspaceRow[];
}
