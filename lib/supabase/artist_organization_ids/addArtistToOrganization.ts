import supabase from "../serverClient";

/**
 * Add an artist to an organization.
 * Uses upsert for idempotent operation (won't create duplicates).
 *
 * @param artistId - The artist's account ID
 * @param organizationId - The organization ID to add them to
 * @returns The created/existing record ID, or null if failed
 */
export async function addArtistToOrganization(
  artistId: string,
  organizationId: string,
): Promise<string | null> {
  if (!artistId || !organizationId) return null;

  // Atomic upsert: insert or return existing row
  // Requires unique constraint on (artist_id, organization_id)
  const { data, error } = await supabase
    .from("artist_organization_ids")
    .upsert(
      { artist_id: artistId, organization_id: organizationId },
      { onConflict: "artist_id,organization_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (error) {
    return null;
  }

  return data?.id || null;
}

