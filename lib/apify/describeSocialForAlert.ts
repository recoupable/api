import { selectSocials } from "@/lib/supabase/socials/selectSocials";

/**
 * The scraped profile as a human reads it in an alert: `@handle` when the
 * run is linked to a social, otherwise `fallback` (the run id). Never throws.
 *
 * @param socialId - The root run's `social_id`; null/undefined → fallback.
 * @param fallback - What to show when no handle can be resolved.
 */
export async function describeSocialForAlert(
  socialId: string | null | undefined,
  fallback: string,
): Promise<string> {
  if (!socialId) return fallback;
  try {
    const [social] = (await selectSocials({ id: socialId })) ?? [];
    return social?.username ? `@${social.username}` : fallback;
  } catch (error) {
    console.error("[WARN] describeSocialForAlert failed:", error);
    return fallback;
  }
}
