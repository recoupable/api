import supabase from "@/lib/supabase/serverClient";

/**
 * Select artist fan segments by artist social IDs, with joined fan social data.
 *
 * @param artistSocialIds - Array of social IDs belonging to the artist
 * @returns Array of fan segment rows with joined socials data
 */
export async function selectArtistFanSegments(artistSocialIds: string[]) {
  if (artistSocialIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("artist_fan_segment")
    .select("*, socials!artist_fan_segment_fan_social_id_fkey(*)")
    .in("artist_social_id", artistSocialIds);

  if (error) {
    console.error("Error fetching artist fan segments:", error);
    throw error;
  }

  return data || [];
}
