import { z } from "zod";

const idSchema = z.string().regex(/^[A-Za-z0-9]{22}$/);
const artistSchema = z.object({ id: idSchema, name: z.string() }).passthrough();
const albumSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    tracks: z.object({ items: z.array(z.unknown()), next: z.string().nullable() }),
  })
  .passthrough();

/** Independent source lookups. These public provider facts do not establish ownership. */
export async function fetchExpandedSpotifyContext(
  input: { releaseId: string; artistIds: string[] },
  accessToken: string,
  fetcher: typeof fetch = fetch,
) {
  const releaseId = idSchema.parse(input.releaseId);
  const artistIds = z
    .array(idSchema)
    .min(1)
    .max(20)
    .parse([...new Set(input.artistIds)]);
  const lookup = async (kind: "albums" | "artists", id: string) => {
    const url = `https://api.spotify.com/v1/${kind}/${id}`;
    const startedAt = new Date().toISOString();
    const started = Date.now();
    try {
      const response = await fetcher(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`Spotify HTTP ${response.status}`);
      const raw: unknown = await response.json();
      const data = kind === "albums" ? albumSchema.parse(raw) : artistSchema.parse(raw);
      if (data.id !== id) throw new Error("Provider identity mismatch; review required");
      return {
        kind,
        id,
        url,
        startedAt,
        elapsedMs: Date.now() - started,
        status: "saved" as const,
        data,
        error: null,
      };
    } catch (error) {
      return {
        kind,
        id,
        url,
        startedAt,
        elapsedMs: Date.now() - started,
        status: "failed" as const,
        data: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
  const results = await Promise.all([
    lookup("albums", releaseId),
    ...artistIds.map(id => lookup("artists", id)),
  ]);
  return {
    results,
    limitations: [
      "Source collection only; saved status means captured in this returned result, not a database write.",
      "Album tracks are the provider's first page; a non-null tracks.next means more tracks remain.",
      "Missing provider fields remain unknown. Labels and copyright notices do not establish ownership shares.",
      "No retries, discography crawl, audio analysis, or paid model calls.",
    ],
  };
}
