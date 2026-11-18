import { z } from "zod";

const profileSchema = z.object({
  id: z.string().min(1).max(255),
  display_name: z.string().max(255).nullish(),
  email: z.string().email().max(254).nullish(),
});

/** Reads the provider profile; callers own flow authorization and identity persistence. */
export async function getSpotifyCurrentAccountProfile(token: string, signal: AbortSignal) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Spotify profile unavailable");
  return profileSchema.parse(await response.json());
}
