import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

/**
 * Resolves an artist_account_id to an artist slug (directory name).
 *
 * The slug is derived from the artist's name, lowercased with spaces
 * replaced by hyphens — matching how sandboxes generate folder names.
 *
 * @param artistAccountId - The artist's account UUID
 * @returns The artist slug, or null if not found
 */
export async function resolveArtistSlug(
  artistAccountId: string,
): Promise<string | null> {
  const accounts = await selectAccounts(artistAccountId);
  const name = accounts[0]?.name;
  if (!name) return null;

  return name.toLowerCase().replace(/\s+/g, "-");
}
